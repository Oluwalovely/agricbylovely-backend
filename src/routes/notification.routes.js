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


router.use(authenticate)

router.get('/', getMyNotifications)    
router.put('/read-all', markAllRead)            
router.delete('/clear-read', clearRead)               
router.post('/test', sendTestNotification)   
router.put('/:id/read', markOneAsRead)          
router.delete('/:id', deleteOne)               
export default router