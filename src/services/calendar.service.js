import prisma from '../config/prisma.js'


const getMonthName = (monthNumber) => {
    return new Date(2026, monthNumber - 1, 1)
        .toLocaleString('en', { month: 'long' })
}

// Calculates how many days between two dates
const daysBetween = (date1, date2) => {
    const diff = new Date(date2) - new Date(date1)
    return Math.floor(diff / (1000 * 60 * 60 * 24))
}

// Calculates growth progress as a percentage
// e.g. planted 30 days ago, total 90 days → 33%
const getGrowthProgress = (plantedAt, expectedHarvestAt) => {
    if (!expectedHarvestAt) return null
    const total = daysBetween(plantedAt, expectedHarvestAt)
    const elapsed = daysBetween(plantedAt, new Date())
    if (total <= 0) return 100
    return Math.min(100, Math.round((elapsed / total) * 100))
}


const getCalendarEvents = async (farmerId, month, year) => {
    // Get all active crops for this farmer
    const farmerCrops = await prisma.farmerCrop.findMany({
        where: { farmerId },
        include: { crop: true, field: true },
        orderBy: { plantedAt: 'asc' },
    })

    // Build calendar events from each farmer crop
    const events = farmerCrops.map(fc => {
        const plantedAt = new Date(fc.plantedAt)
        const expectedHarvestAt = fc.expectedHarvestAt ? new Date(fc.expectedHarvestAt) : null
        const harvestedAt = fc.harvestedAt ? new Date(fc.harvestedAt) : null
        const daysToHarvest = expectedHarvestAt ? daysBetween(new Date(), expectedHarvestAt) : null
        const progress = getGrowthProgress(plantedAt, expectedHarvestAt)

        return {
            id: fc.id,
            cropName: fc.crop.name,
            cropId: fc.cropId,
            fieldName: fc.field?.name || null,
            stage: fc.stage,
            progress,    // 0-100 percentage

            // Planting event
            planting: {
                date: plantedAt.toISOString().split('T')[0],
                month: plantedAt.getMonth() + 1,
                year: plantedAt.getFullYear(),
            },

            // Harvest event
            harvest: expectedHarvestAt ? {
                date: expectedHarvestAt.toISOString().split('T')[0],
                month: expectedHarvestAt.getMonth() + 1,
                year: expectedHarvestAt.getFullYear(),
                daysLeft: daysToHarvest,
                isOverdue: daysToHarvest < 0 && !harvestedAt,
                isHarvested: !!harvestedAt,
            } : null,

            notes: fc.notes,
        }
    })

    // If month and year are provided, filter to that month
    if (month && year) {
        const m = parseInt(month)
        const y = parseInt(year)

        return events.filter(event => {
            // Include if planting is in this month
            const plantingInMonth = event.planting.month === m && event.planting.year === y

            // Include if harvest is in this month
            const harvestInMonth = event.harvest &&
                event.harvest.month === m &&
                event.harvest.year === y

            // Include if crop is currently growing through this month
            const plantDate = new Date(event.planting.date)
            const harvestDate = event.harvest ? new Date(event.harvest.date) : null
            const monthStart = new Date(y, m - 1, 1)
            const monthEnd = new Date(y, m, 0)

            const growingThroughMonth = harvestDate &&
                plantDate <= monthEnd &&
                harvestDate >= monthStart

            return plantingInMonth || harvestInMonth || growingThroughMonth
        })
    }

    return events
}


const getUpcomingEvents = async (farmerId, days = 30) => {
    const farmerCrops = await prisma.farmerCrop.findMany({
        where: {
            farmerId,
            harvestedAt: null, // only active crops
        },
        include: { crop: true, field: true },
    })

    const upcoming = []
    const now = new Date()
    const future = new Date(now.getTime() + days * 24 * 60 * 60 * 1000)

    farmerCrops.forEach(fc => {
        if (!fc.expectedHarvestAt) return

        const harvestDate = new Date(fc.expectedHarvestAt)
        const daysLeft = daysBetween(now, harvestDate)

        // Include if harvest is within the next N days
        if (harvestDate >= now && harvestDate <= future) {
            upcoming.push({
                type: 'HARVEST',
                cropName: fc.crop.name,
                fieldName: fc.field?.name || null,
                date: harvestDate.toISOString().split('T')[0],
                daysLeft,
                stage: fc.stage,
                farmerCropId: fc.id,
                // Urgency level for frontend color coding
                urgency: daysLeft <= 3 ? 'HIGH' :
                    daysLeft <= 7 ? 'MEDIUM' : 'LOW',
            })
        }

        // Overdue harvest warning
        if (harvestDate < now) {
            upcoming.push({
                type: 'OVERDUE',
                cropName: fc.crop.name,
                fieldName: fc.field?.name || null,
                date: harvestDate.toISOString().split('T')[0],
                daysLeft: daysLeft, // negative number
                daysOverdue: Math.abs(daysLeft),
                stage: fc.stage,
                farmerCropId: fc.id,
                urgency: 'HIGH',
            })
        }
    })

    // Sort by date — soonest first
    return upcoming.sort((a, b) => new Date(a.date) - new Date(b.date))
}


const getMonthlySummary = async (farmerId, year) => {
    const y = parseInt(year) || new Date().getFullYear()
    const farmerCrops = await prisma.farmerCrop.findMany({
        where: { farmerId },
        include: { crop: true },
    })

    // Build a summary for each month
    const months = Array.from({ length: 12 }, (_, i) => ({
        month: i + 1,
        monthName: getMonthName(i + 1),
        year: y,
        plantings: 0,
        harvests: 0,
        crops: [],
    }))

    farmerCrops.forEach(fc => {
        const plantMonth = new Date(fc.plantedAt).getMonth()
        const plantYear = new Date(fc.plantedAt).getFullYear()
        const harvestMonth = fc.expectedHarvestAt ? new Date(fc.expectedHarvestAt).getMonth() : null
        const harvestYear = fc.expectedHarvestAt ? new Date(fc.expectedHarvestAt).getFullYear() : null

        // Count planting in its month
        if (plantYear === y) {
            months[plantMonth].plantings++
            months[plantMonth].crops.push({
                name: fc.crop.name,
                event: 'planting',
                stage: fc.stage,
            })
        }

        // Count harvest in its month
        if (harvestMonth !== null && harvestYear === y) {
            months[harvestMonth].harvests++
            months[harvestMonth].crops.push({
                name: fc.crop.name,
                event: 'harvest',
                stage: fc.stage,
            })
        }
    })

    return months
}

export { getCalendarEvents, getUpcomingEvents, getMonthlySummary }