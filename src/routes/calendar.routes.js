import { Router } from 'express'
import { getEvents, getUpcoming, getSummary } from '../controllers/calendar.controller.js'
import { authenticate } from '../middleware/auth.js'

const router = Router()

// All calendar routes require login
router.use(authenticate)

router.get('/',          getEvents)   // GET /api/calendar?month=5&year=2026
router.get('/upcoming',  getUpcoming) // GET /api/calendar/upcoming?days=30
router.get('/summary',   getSummary)  // GET /api/calendar/summary?year=2026

export default router