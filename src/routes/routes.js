import { Router } from 'express'
import healthRouter  from './health.js'
import authRouter    from './auth.routes.js'
import farmerRouter  from './farmer.routes.js'
import cropRouter    from './crop.routes.js'
import fieldRouter   from './field.routes.js'
import uploadRouter  from './upload.routes.js'

const router = Router()

router.use('/health',     healthRouter)
router.use('/auth',       authRouter)
router.use('/farmers/me', farmerRouter)
router.use('/crops',      cropRouter)
router.use('/fields',     fieldRouter)
router.use('/upload',     uploadRouter)

// Coming in upcoming days:
// router.use('/weather',       weatherRouter)
// router.use('/notifications', notificationRouter)
// router.use('/calendar',      calendarRouter)
// router.use('/reports',       reportRouter)

export default router