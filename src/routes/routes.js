import { Router } from 'express'
import healthRouter  from './health.js'
import authRouter    from './auth.routes.js'
import farmerRouter  from './farmer.routes.js'

const router = Router()

router.use('/health',      healthRouter)
router.use('/auth',        authRouter)
router.use('/farmers/me',  farmerRouter)

// Coming in upcoming days:
// router.use('/crops',         cropRouter)
// router.use('/weather',       weatherRouter)
// router.use('/notifications', notificationRouter)
// router.use('/calendar',      calendarRouter)
// router.use('/reports',       reportRouter)

export default router