import prisma from '../config/prisma.js'
import { success } from '../utils/response.js'
import { daysBetween } from '../utils/cropLifecycle.js'
import { getWeatherForLocation } from '../services/weather.service.js'
import { getUpcomingEvents } from '../services/calendar.service.js'


const getDashboard = async (req, res, next) => {
    try {
        const farmerId = req.farmer.id

        
        const [
            farmer,
            activeCrops,
            fields,
            recentNotifications,
            upcomingEvents,
            jobStats,
            totalActiveCrops,
            unreadCount,
        ] = await Promise.all([

            
            prisma.farmer.findUnique({
                where: { id: farmerId },
                select: {
                    id: true, firstName: true, lastName: true,
                    farmName: true, avatarUrl: true,
                    latitude: true, longitude: true,
                    state: true, soilType: true, farmSizeHa: true,
                },
            }),

            
            prisma.farmerCrop.findMany({
                where: { farmerId, harvestedAt: null },
                include: { crop: true, field: true },
                orderBy: { plantedAt: 'desc' },
                take: 6, // show max 6 on dashboard
            }),

            
            prisma.field.findMany({
                where: { farmerId },
                select: {
                    id: true, name: true, sizeHa: true, soilType: true,
                    _count: { select: { farmerCrops: { where: { harvestedAt: null } } } },
                },
            }),

            
            prisma.notification.findMany({
                where: { farmerId },
                orderBy: [{ isRead: 'asc' }, { createdAt: 'desc' }],
                take: 5,
            }),

            
            getUpcomingEvents(farmerId, 30),

            
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
            prisma.farmerCrop.count({ where: { farmerId, harvestedAt: null } }),
            prisma.notification.count({ where: { farmerId, isRead: false } }),
        ])

        
        let weather = null
        if (farmer.latitude != null && farmer.longitude != null) {
            try {
                weather = await getWeatherForLocation(farmer.latitude, farmer.longitude)
            } catch (err) {
                // Weather fetch failed — don't crash the dashboard
                console.error('Weather fetch failed for dashboard:', err.message)
            }
        }

        
        const totalHectares = fields.reduce((sum, f) => sum + (f.sizeHa || 0), 0)

        
        const nextHarvest = upcomingEvents.find(e => e.type === 'HARVEST') || null
        const overdueCount = upcomingEvents.filter(e => e.type === 'OVERDUE').length

        
        const cropsWithProgress = activeCrops.map(fc => {
            const planted = new Date(fc.plantedAt)
            const harvest = fc.expectedHarvestAt ? new Date(fc.expectedHarvestAt) : null
            const now = new Date()
            const total = harvest ? daysBetween(planted, harvest) : null
            const elapsed = daysBetween(planted, now)
            const progress = total ? Math.max(0, Math.min(100, Math.round((elapsed / total) * 100))) : null
            const daysLeft = harvest ? daysBetween(now, harvest) : null

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

        
        const jobs = { done: 0, failed: 0, running: 0 }
        jobStats.forEach(s => {
            jobs[s.status.toLowerCase()] = s._count.status
        })

        res.json(success({
            farmer,

            
            stats: {
                totalActiveCrops,
                totalFields: fields.length,
                totalHectares: parseFloat(totalHectares.toFixed(2)),
                unreadNotifications: unreadCount,
                upcomingHarvests: upcomingEvents.filter(e => e.type === 'HARVEST').length,
                overdueHarvests: overdueCount,
            },

            
            activeCrops: cropsWithProgress,

            
            fields,

            
            nextHarvest,

            
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

            
            notifications: recentNotifications,

            
            upcomingEvents: upcomingEvents.slice(0, 5),

            
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
            cropsByStage,
            recentActivity,
            harvestYield,
        ] = await Promise.all([

            
            prisma.farmerCrop.count({ where: { farmerId } }),

            
            prisma.farmerCrop.count({ where: { farmerId, harvestedAt: null } }),

            
            prisma.farmerCrop.count({ where: { farmerId, harvestedAt: { not: null } } }),

            
            prisma.field.count({ where: { farmerId } }),

            
            prisma.farmerCrop.groupBy({
                by: ['stage'],
                where: { farmerId, harvestedAt: null },
                _count: { stage: true },
            }),

            
            prisma.farmerCrop.findMany({
                where: { farmerId },
                include: { crop: true, field: true },
                orderBy: { updatedAt: 'desc' },
                take: 10,
            }),
            prisma.farmerCrop.aggregate({ where: { farmerId, harvestedAt: { not: null } }, _sum: { yieldKg: true } }),
        ])

        
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
                totalYieldKg: harvestYield._sum.yieldKg ?? 0,
                harvestCompletionRate: totalCropsPlanted > 0
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

        const [harvested, total, harvestYield] = await Promise.all([
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
            prisma.farmerCrop.aggregate({ where: { farmerId: req.farmer.id, harvestedAt: { not: null } }, _sum: { yieldKg: true } }),
        ])

        
        const totalYieldKg = harvestYield._sum.yieldKg ?? 0

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
                    ? daysBetween(fc.plantedAt, fc.harvestedAt)
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