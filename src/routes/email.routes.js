import { Router } from 'express'
import prisma from '../config/prisma.js'
import { authenticate } from '../middleware/auth.js'
import { success, fail } from '../utils/response.js'
import {
    sendWelcomeEmail,
    sendWeatherAlertEmail,
    sendHarvestReminderEmail,
    sendWeeklyDigestEmail,
} from '../services/email.service.js'

const router = Router()

// All email test routes require login
router.use(authenticate)

// ── Test welcome email ────────────────────
router.post('/test/welcome', async (req, res, next) => {
    try {
        const farmer = await prisma.farmer.findUnique({
            where: { id: req.farmer.id }
        })
        const sent = await sendWelcomeEmail(farmer)
        if (!sent) return res.status(500).json(fail('Email failed to send — check your SMTP settings'))
        res.json(success({}, `Welcome email sent to ${farmer.email}`))
    } catch (err) { next(err) }
})

// ── Test weather alert email ──────────────
router.post('/test/weather-alert', async (req, res, next) => {
    try {
        const farmer = await prisma.farmer.findUnique({
            where: { id: req.farmer.id }
        })

        // Sample alerts for testing
        const alerts = [
            {
                type: 'WEATHER',
                title: 'Heavy Rainfall Warning',
                message: 'Heavy rain of 35mm expected tomorrow. Check field drainage and avoid applying fertiliser.',
            },
            {
                type: 'PEST',
                title: 'High Fungal Risk',
                message: 'Humidity at 89%. High risk of fungal diseases on tomatoes and peppers. Apply preventive fungicide.',
            },
        ]

        const sent = await sendWeatherAlertEmail(farmer, alerts)
        if (!sent) return res.status(500).json(fail('Email failed to send'))
        res.json(success({}, `Weather alert email sent to ${farmer.email}`))
    } catch (err) { next(err) }
})

// ── Test harvest reminder email ───────────
router.post('/test/harvest-reminder', async (req, res, next) => {
    try {
        const farmer = await prisma.farmer.findUnique({
            where: { id: req.farmer.id }
        })

        // Sample crops for testing
        const crops = [
            { cropName: 'Maize', fieldName: 'Field A', daysLeft: 3, date: '2026-05-12' },
            { cropName: 'Tomato', fieldName: 'Field B', daysLeft: 7, date: '2026-05-16' },
        ]

        const sent = await sendHarvestReminderEmail(farmer, crops)
        if (!sent) return res.status(500).json(fail('Email failed to send'))
        res.json(success({}, `Harvest reminder email sent to ${farmer.email}`))
    } catch (err) { next(err) }
})

// ── Test weekly digest email ──────────────
router.post('/test/weekly-digest', async (req, res, next) => {
    try {
        const farmer = await prisma.farmer.findUnique({
            where: { id: req.farmer.id }
        })

        // Get real data for the digest
        const [activeCrops, fields] = await Promise.all([
            prisma.farmerCrop.findMany({
                where: { farmerId: req.farmer.id, harvestedAt: null },
                include: { crop: true, field: true },
                take: 5,
            }),
            prisma.field.findMany({
                where: { farmerId: req.farmer.id }
            }),
        ])

        const data = {
            activeCrops,
            totalFields: fields.length,
            upcomingHarvests: activeCrops.filter(fc =>
                fc.expectedHarvestAt && new Date(fc.expectedHarvestAt) > new Date()
            ).length,
        }

        const sent = await sendWeeklyDigestEmail(farmer, data)
        if (!sent) return res.status(500).json(fail('Email failed to send'))
        res.json(success({}, `Weekly digest email sent to ${farmer.email}`))
    } catch (err) { next(err) }
})

// ── Get email logs ────────────────────────
router.get('/logs', async (req, res, next) => {
    try {
        const logs = await prisma.emailLog.findMany({
            where: { farmerId: req.farmer.id },
            orderBy: { sentAt: 'desc' },
            take: 20,
        })
        res.json(success({ logs, total: logs.length }, 'Email logs fetched'))
    } catch (err) { next(err) }
})

export default router