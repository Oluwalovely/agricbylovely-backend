import { Router } from 'express'
import {
    getMyNotifications,
    markOneAsRead,
    markAllRead,
    deleteOne,
    clearRead,
    sendTestNotification,
} from '../controllers/notification.controller.js'
import { authenticate } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { notificationQuerySchema, idParamsSchema } from '../utils/validators.js'

const router = Router()


router.use(authenticate)

router.get('/', validate(notificationQuerySchema), getMyNotifications)
router.put('/read-all', markAllRead)            
router.delete('/clear-read', clearRead)               
router.post('/test', sendTestNotification)   
router.put('/:id/read', validate(idParamsSchema), markOneAsRead)
router.delete('/:id', validate(idParamsSchema), deleteOne)
export default router
