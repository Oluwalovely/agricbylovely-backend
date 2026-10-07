import { Router } from 'express'
import { PrismaClient } from '@prisma/client'

const router = Router()
const prisma = new PrismaClient()

// Uptime monitoring checks the HTTP server without waking the database.
router.get('/live', (req, res) => {
  res.set('Cache-Control', 'no-store')
  res.json({
    success: true,
    message: 'AgricByLovely API is running',
  })
})

router.get('/', async (req, res) => {
  let dbStatus = 'connected'

  try {
    await prisma.$queryRaw`SELECT 1`
  } catch {
    dbStatus = 'disconnected'
  }

  res.json({
    success: true,
    message: 'AgricByLovely API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    database: dbStatus,
  })
})

export default router
