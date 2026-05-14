import { Router } from 'express'
import { getDashboard, getFarmSummary, getHarvestHistory } from '../controllers/report.controller.js'
import { authenticate } from '../middleware/auth.js'

const router = Router()


router.use(authenticate)

router.get('/dashboard',       getDashboard)      // GET /api/reports/dashboard
router.get('/summary',         getFarmSummary)    // GET /api/reports/summary
router.get('/harvest-history', getHarvestHistory) // GET /api/reports/harvest-history

export default router