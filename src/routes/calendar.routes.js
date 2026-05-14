import { Router } from 'express'
import { getEvents, getUpcoming, getSummary } from '../controllers/calendar.controller.js'
import { authenticate } from '../middleware/auth.js'

const router = Router()


router.use(authenticate)

router.get('/',          getEvents)   
router.get('/upcoming',  getUpcoming) 
router.get('/summary',   getSummary)  

export default router