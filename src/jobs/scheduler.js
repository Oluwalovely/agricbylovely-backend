import cron from 'node-cron'
import prisma from '../config/prisma.js'
import { getWeatherForLocation } from '../services/weather.service.js'
import { sendWeatherAlertNotifications, sendHarvestReminder } from '../services/notification.service.js'
import { sendWeatherAlertEmail, sendHarvestReminderEmail, sendWeeklyDigestEmail } from '../services/email.service.js'



// Job logger
// Creates a job record before running
// Updates it after with success or failure
const runJob = async (type, farmerId, task) => {
    const job = await prisma.job.create({
        data: {
            type,
            payload: {},
            status: 'RUNNING',
            runAt: new Date(),
            farmerId: farmerId || null,
        },
    })

    try {
        await task()
        await prisma.job.update({
            where: { id: job.id },
            data: { status: 'DONE', completedAt: new Date() },
        })
    } catch (err) {
        console.error(`Job ${type} failed:`, err.message)
        await prisma.job.update({
            where: { id: job.id },
            data: {
                status: 'FAILED',
                error: err.message,
                retryCount: { increment: 1 },
            },
        })
    }
}


const runDailyWeatherCheck = async (io) => {
    console.log('Running daily weather check...')

    const farmers = await prisma.farmer.findMany({
        where: {
            latitude: { not: null },
            longitude: { not: null },
        },
        select: {
            id: true, email: true, firstName: true,
            lastName: true, farmName: true,
            latitude: true, longitude: true,
        },
    })

    console.log(`Checking weather for ${farmers.length} farmers...`)

    for (const farmer of farmers) {
        await runJob('WEATHER_ALERT', farmer.id, async () => {
            const weather = await getWeatherForLocation(farmer.latitude, farmer.longitude)

            if (weather.alerts.length === 0) {
                console.log(`No alerts for ${farmer.farmName}`)
                return
            }

            console.log(`${weather.alerts.length} alerts for ${farmer.farmName}`)

            // Send in-app notifications via Socket.io
            await sendWeatherAlertNotifications(farmer.id, weather.alerts, io)

            // Send email
            await sendWeatherAlertEmail(farmer, weather.alerts)
        })
    }

    console.log('Daily weather check complete')
}


const runHarvestReminders = async (io) => {
    console.log('Running harvest reminders...')

    const farmerCrops = await prisma.farmerCrop.findMany({
        where: {
            harvestedAt: null,
            expectedHarvestAt: { not: null },
        },
        include: {
            farmer: true,
            crop: true,
            field: true,
        },
    })

    const now = new Date()

    // Group crops by farmer for one email per farmer
    const farmerReminders = {}

    for (const fc of farmerCrops) {
        const harvestDate = new Date(fc.expectedHarvestAt)
        const daysLeft = Math.ceil((harvestDate - now) / (1000 * 60 * 60 * 24))

        // Only remind at 7, 3, 1 and 0 day milestones
        if (![7, 3, 1, 0].includes(daysLeft)) continue

        // Send in-app notification
        await runJob('HARVEST_REMINDER', fc.farmerId, async () => {
            await sendHarvestReminder(fc.farmerId, fc.crop.name, daysLeft, io)
        })

        // Group for email
        if (!farmerReminders[fc.farmerId]) {
            farmerReminders[fc.farmerId] = { farmer: fc.farmer, crops: [] }
        }

        farmerReminders[fc.farmerId].crops.push({
            cropName: fc.crop.name,
            fieldName: fc.field?.name || null,
            daysLeft,
            date: harvestDate.toISOString().split('T')[0],
        })
    }

    // Send one harvest reminder email per farmer
    for (const { farmer, crops } of Object.values(farmerReminders)) {
        await sendHarvestReminderEmail(farmer, crops)
        console.log(`Harvest reminder sent to ${farmer.email} for ${crops.length} crops`)
    }

    console.log('Harvest reminders complete')
}


const runWeeklyDigest = async () => {
    console.log('Running weekly digest...')

    const farmers = await prisma.farmer.findMany({
        select: {
            id: true, email: true, firstName: true,
            lastName: true, farmName: true,
        },
    })

    for (const farmer of farmers) {
        await runJob('WEEKLY_DIGEST', farmer.id, async () => {
            const [activeCrops, fields] = await Promise.all([
                prisma.farmerCrop.findMany({
                    where: { farmerId: farmer.id, harvestedAt: null },
                    include: { crop: true, field: true },
                    take: 5,
                }),
                prisma.field.findMany({
                    where: { farmerId: farmer.id }
                }),
            ])

            const upcomingHarvests = activeCrops.filter(fc =>
                fc.expectedHarvestAt && new Date(fc.expectedHarvestAt) > new Date()
            ).length

            await sendWeeklyDigestEmail(farmer, {
                activeCrops,
                totalFields: fields.length,
                upcomingHarvests,
            })

            console.log(`Weekly digest sent to ${farmer.email}`)
        })
    }

    console.log('Weekly digest complete')
}


const startScheduler = (io) => {
    console.log('Starting job scheduler...')

    // Daily weather check — 6:00 AM every day
    cron.schedule('0 6 * * *', () => {
        runDailyWeatherCheck(io)
    }, { timezone: 'Africa/Lagos' })

    // Harvest reminders — 7:00 AM every day
    cron.schedule('0 7 * * *', () => {
        runHarvestReminders(io)
    }, { timezone: 'Africa/Lagos' })

    // Weekly digest — 7:00 AM every Monday
    cron.schedule('0 7 * * 1', () => {
        runWeeklyDigest()
    }, { timezone: 'Africa/Lagos' })

    console.log('Scheduler started (Africa/Lagos timezone)')
    console.log('  Daily weather check : 6:00 AM every day')
    console.log('  Harvest reminders   : 7:00 AM every day')
    console.log('  Weekly digest       : 7:00 AM every Monday')
}

export {
    startScheduler,
    runDailyWeatherCheck,
    runHarvestReminders,
    runWeeklyDigest,
}