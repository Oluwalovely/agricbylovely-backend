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

const router = Router()

// All notification routes require login
router.use(authenticate)

router.get('/', getMyNotifications)     // GET    /api/notifications
router.put('/read-all', markAllRead)             // PUT    /api/notifications/read-all
router.delete('/clear-read', clearRead)               // DELETE /api/notifications/clear-read
router.post('/test', sendTestNotification)    // POST   /api/notifications/test
router.put('/:id/read', markOneAsRead)           // PUT    /api/notifications/:id/read
router.delete('/:id', deleteOne)               // DELETE /api/notifications/:id

export default router