import { Router } from 'express'
import { getEvents, getUpcoming, getSummary } from '../controllers/calendar.controller.js'
import { authenticate } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { calendarQuerySchema, upcomingQuerySchema } from '../utils/validators.js'

const router = Router()


router.use(authenticate)

router.get('/',          validate(calendarQuerySchema), getEvents)
router.get('/upcoming',  validate(upcomingQuerySchema), getUpcoming)
router.get('/summary',   validate(calendarQuerySchema), getSummary)

export default router
