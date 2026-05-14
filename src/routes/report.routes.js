import { Router } from 'express'
import { getDashboard, getFarmSummary, getHarvestHistory } from '../controllers/report.controller.js'
import { authenticate } from '../middleware/auth.js'

const router = Router()


router.use(authenticate)

router.get('/dashboard',       getDashboard)      
router.get('/summary',         getFarmSummary)    
router.get('/harvest-history', getHarvestHistory) 

export default router