import prisma from '../config/prisma.js'
import { success } from '../utils/response.js'
import { getWeatherForLocation } from '../services/weather.service.js'
import { getUpcomingEvents } from '../services/calendar.service.js'


const getDashboard = async (req, res, next) => {
    try {
        const farmerId = req.farmer.id

        // Run all database queries at the same time for speed
        const [
            farmer,
            activeCrops,
            fields,
            recentNotifications,
            upcomingEvents,
            jobStats,
        ] = await Promise.all([

            // Farmer profile
            prisma.farmer.findUnique({
                where: { id: farmerId },
                select: {
                    id: true, firstName: true, lastName: true,
                    farmName: true, avatarUrl: true,
                    latitude: true, longitude: true,
                    state: true, soilType: true, farmSizeHa: true,
                },
            }),

            // Active crops with details
            prisma.farmerCrop.findMany({
                where: { farmerId, harvestedAt: null },
                include: { crop: true, field: true },
                orderBy: { plantedAt: 'desc' },
                take: 6, // show max 6 on dashboard
            }),

            // Fields summary
            prisma.field.findMany({
                where: { farmerId },
                select: {
                    id: true, name: true, sizeHa: true, soilType: true,
                    _count: { select: { farmerCrops: true } },
                },
            }),

            // Recent notifications — unread first
            prisma.notification.findMany({
                where: { farmerId },
                orderBy: [{ isRead: 'asc' }, { createdAt: 'desc' }],
                take: 5,
            }),

            // Upcoming harvests in next 30 days
            getUpcomingEvents(farmerId, 30),

            // Job stats — how many jobs ran today
            prisma.job.groupBy({
                by: ['status'],
                where: {
                    farmerId,
                    createdAt: {
                        gte: new Date(new Date().setHours(0, 0, 0, 0)) // today
                    }
                },
                _count: { status: true },
            }),
        ])

        // ── Weather (optional — only if farmer has location) ──
        let weather = null
        if (farmer.latitude && farmer.longitude) {
            try {
                weather = await getWeatherForLocation(farmer.latitude, farmer.longitude)
            } catch (err) {
                // Weather fetch failed — don't crash the dashboard
                console.error('Weather fetch failed for dashboard:', err.message)
            }
        }

        // ── Calculate stats ───────────────────
        const totalHectares = fields.reduce((sum, f) => sum + (f.sizeHa || 0), 0)
        const unreadCount = recentNotifications.filter(n => !n.isRead).length

        // Next harvest — the soonest upcoming event
        const nextHarvest = upcomingEvents.find(e => e.type === 'HARVEST') || null
        const overdueCount = upcomingEvents.filter(e => e.type === 'OVERDUE').length

        // Growth progress for each active crop
        const cropsWithProgress = activeCrops.map(fc => {
            const planted = new Date(fc.plantedAt)
            const harvest = fc.expectedHarvestAt ? new Date(fc.expectedHarvestAt) : null
            const now = new Date()
            const total = harvest ? Math.floor((harvest - planted) / (1000 * 60 * 60 * 24)) : null
            const elapsed = Math.floor((now - planted) / (1000 * 60 * 60 * 24))
            const progress = total ? Math.min(100, Math.round((elapsed / total) * 100)) : null
            const daysLeft = harvest ? Math.ceil((harvest - now) / (1000 * 60 * 60 * 24)) : null

            return {
                id: fc.id,
                cropName: fc.crop.name,
                botanicalName: fc.crop.botanicalName,
                category: fc.crop.category,
                imageUrl: fc.crop.imageUrl,
                fieldName: fc.field?.name || null,
                stage: fc.stage,
                plantedAt: fc.plantedAt,
                expectedHarvestAt: fc.expectedHarvestAt,
                progress,
                daysLeft,
                isOverdue: daysLeft !== null && daysLeft < 0,
            }
        })

        // Format job stats into a simple object
        const jobs = { done: 0, failed: 0, running: 0 }
        jobStats.forEach(s => {
            jobs[s.status.toLowerCase()] = s._count.status
        })

        res.json(success({
            farmer,

            // Stats summary for the top cards
            stats: {
                totalActiveCrops: activeCrops.length,
                totalFields: fields.length,
                totalHectares: parseFloat(totalHectares.toFixed(2)),
                unreadNotifications: unreadCount,
                upcomingHarvests: upcomingEvents.filter(e => e.type === 'HARVEST').length,
                overdueHarvests: overdueCount,
            },

            // Active crops with progress
            activeCrops: cropsWithProgress,

            // Fields
            fields,

            // Next harvest for the countdown widget
            nextHarvest,

            // Weather snapshot
            weather: weather ? {
                temp: weather.current.temp,
                humidity: weather.current.humidity,
                description: weather.current.description,
                icon: weather.current.icon,
                windSpeed: weather.current.windSpeed,
                alerts: weather.alerts,
                forecast: weather.forecast.slice(0, 3), // show 3 days on dashboard
                zone: weather.location.zoneName,
            } : null,

            // Recent notifications
            notifications: recentNotifications,

            // Upcoming harvests
            upcomingEvents: upcomingEvents.slice(0, 5),

            // Background job status for today
            jobsToday: jobs,

        }, 'Dashboard data fetched successfully'))

    } catch (err) {
        next(err)
    }
}


const getFarmSummary = async (req, res, next) => {
    try {
        const farmerId = req.farmer.id

        const [
            totalCropsPlanted,
            activeCrops,
            harvestedCrops,
            totalFields,
            cropsByCategory,
            cropsByStage,
            recentActivity,
        ] = await Promise.all([

            // Total crops ever planted
            prisma.farmerCrop.count({ where: { farmerId } }),

            // Currently active
            prisma.farmerCrop.count({ where: { farmerId, harvestedAt: null } }),

            // Successfully harvested
            prisma.farmerCrop.count({ where: { farmerId, harvestedAt: { not: null } } }),

            // Total fields
            prisma.field.count({ where: { farmerId } }),

            // Crops grouped by category
            prisma.farmerCrop.groupBy({
                by: ['cropId'],
                where: { farmerId },
                _count: { cropId: true },
            }),

            // Active crops grouped by growth stage
            prisma.farmerCrop.groupBy({
                by: ['stage'],
                where: { farmerId, harvestedAt: null },
                _count: { stage: true },
            }),

            // Last 10 activities
            prisma.farmerCrop.findMany({
                where: { farmerId },
                include: { crop: true, field: true },
                orderBy: { updatedAt: 'desc' },
                take: 10,
            }),
        ])

        // Format stage breakdown
        const stageBreakdown = cropsByStage.map(s => ({
            stage: s.stage,
            count: s._count.stage,
        }))

        res.json(success({
            summary: {
                totalCropsPlanted,
                activeCrops,
                harvestedCrops,
                totalFields,
                successRate: totalCropsPlanted > 0
                    ? Math.round((harvestedCrops / totalCropsPlanted) * 100)
                    : 0,
            },
            stageBreakdown,
            recentActivity: recentActivity.map(fc => ({
                id: fc.id,
                cropName: fc.crop.name,
                fieldName: fc.field?.name || null,
                stage: fc.stage,
                plantedAt: fc.plantedAt,
                updatedAt: fc.updatedAt,
            })),
        }, 'Farm summary fetched successfully'))
    } catch (err) {
        next(err)
    }
}


const getHarvestHistory = async (req, res, next) => {
    try {
        const { page = 1, limit = 20 } = req.query
        const skip = (parseInt(page) - 1) * parseInt(limit)

        const [harvested, total] = await Promise.all([
            prisma.farmerCrop.findMany({
                where: { farmerId: req.farmer.id, harvestedAt: { not: null } },
                include: { crop: true, field: true },
                orderBy: { harvestedAt: 'desc' },
                skip,
                take: parseInt(limit),
            }),
            prisma.farmerCrop.count({
                where: { farmerId: req.farmer.id, harvestedAt: { not: null } }
            }),
        ])

        // Calculate total yield
        const totalYieldKg = harvested.reduce((sum, fc) => sum + (fc.yieldKg || 0), 0)

        res.json(success({
            harvested: harvested.map(fc => ({
                id: fc.id,
                cropName: fc.crop.name,
                category: fc.crop.category,
                fieldName: fc.field?.name || null,
                plantedAt: fc.plantedAt,
                harvestedAt: fc.harvestedAt,
                yieldKg: fc.yieldKg,
                notes: fc.notes,
                daysToHarvest: fc.harvestedAt && fc.plantedAt
                    ? Math.floor((new Date(fc.harvestedAt) - new Date(fc.plantedAt)) / (1000 * 60 * 60 * 24))
                    : null,
            })),
            total,
            totalYieldKg: parseFloat(totalYieldKg.toFixed(2)),
            page: parseInt(page),
            pages: Math.ceil(total / parseInt(limit)),
        }, 'Harvest history fetched successfully'))
    } catch (err) {
        next(err)
    }
}

export { getDashboard, getFarmSummary, getHarvestHistory }