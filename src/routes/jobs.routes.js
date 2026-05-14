import { Router } from 'express'
import prisma from '../config/prisma.js'
import { authenticate } from '../middleware/auth.js'
import { success } from '../utils/response.js'
import {
    runDailyWeatherCheck,
    runHarvestReminders,
    runWeeklyDigest,
} from '../jobs/scheduler.js'

const router = Router()

router.use(authenticate)

// ── View job history ──────────────────────
// GET /api/jobs
router.get('/', async (req, res, next) => {
    try {
        const jobs = await prisma.job.findMany({
            where: { farmerId: req.farmer.id },
            orderBy: { createdAt: 'desc' },
            take: 20,
        })
        res.json(success({ jobs, total: jobs.length }, 'Jobs fetched'))
    } catch (err) { next(err) }
})

// ── Manually trigger jobs (development only) ──
router.post('/run/weather-check', async (req, res, next) => {
    try {
        const io = req.app.get('io')
        // Run in background — don't await
        runDailyWeatherCheck(io).catch(console.error)
        res.json(success({}, 'Weather check job started'))
    } catch (err) { next(err) }
})

router.post('/run/harvest-reminders', async (req, res, next) => {
    try {
        const io = req.app.get('io')
        runHarvestReminders(io).catch(console.error)
        res.json(success({}, 'Harvest reminder job started'))
    } catch (err) { next(err) }
})

router.post('/run/weekly-digest', async (req, res, next) => {
    try {
        runWeeklyDigest().catch(console.error)
        res.json(success({}, 'Weekly digest job started'))
    } catch (err) { next(err) }
})

export default router