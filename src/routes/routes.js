import { Router } from 'express'
import healthRouter        from './health.js'
import authRouter          from './auth.routes.js'
import farmerRouter        from './farmer.routes.js'
import cropRouter          from './crop.routes.js'
import fieldRouter         from './field.routes.js'
import uploadRouter        from './upload.routes.js'
import weatherRouter       from './weather.routes.js'
import calendarRouter      from './calendar.routes.js'
import notificationRouter  from './notification.routes.js'

const router = Router()

router.use('/health',        healthRouter)
router.use('/auth',          authRouter)
router.use('/farmers/me',    farmerRouter)
router.use('/crops',         cropRouter)
router.use('/fields',        fieldRouter)
router.use('/upload',        uploadRouter)
router.use('/weather',       weatherRouter)
router.use('/calendar',      calendarRouter)
router.use('/notifications', notificationRouter)

// Coming in upcoming days:
// router.use('/reports', reportRouter)

export default router