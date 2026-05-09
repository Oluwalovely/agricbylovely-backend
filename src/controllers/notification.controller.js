import { success, fail } from '../utils/response.js'
import {
    getNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearReadNotifications,
    createNotification,
} from '../services/notification.service.js'

// ─────────────────────────────────────────
// GET ALL NOTIFICATIONS
// GET /api/notifications
// Optional filters: ?unreadOnly=true&page=1&limit=20
// ─────────────────────────────────────────
const getMyNotifications = async (req, res, next) => {
    try {
        const { page = 1, limit = 20, unreadOnly } = req.query

        const result = await getNotifications(req.farmer.id, {
            page,
            limit,
            unreadOnly: unreadOnly === 'true',
        })

        res.json(success({
            notifications: result.notifications,
            total: result.total,
            unreadCount: result.unreadCount,
            page: parseInt(page),
            pages: Math.ceil(result.total / parseInt(limit)),
        }, 'Notifications fetched successfully'))
    } catch (err) {
        next(err)
    }
}

// ─────────────────────────────────────────
// MARK ONE AS READ
// PUT /api/notifications/:id/read
// ─────────────────────────────────────────
const markOneAsRead = async (req, res, next) => {
    try {
        const notification = await markAsRead(req.params.id, req.farmer.id)

        if (!notification) {
            return res.status(404).json(fail('Notification not found'))
        }

        res.json(success({ notification }, 'Notification marked as read'))
    } catch (err) {
        next(err)
    }
}

// ─────────────────────────────────────────
// MARK ALL AS READ
// PUT /api/notifications/read-all
// ─────────────────────────────────────────
const markAllRead = async (req, res, next) => {
    try {
        const count = await markAllAsRead(req.farmer.id)
        res.json(success({ count }, `${count} notifications marked as read`))
    } catch (err) {
        next(err)
    }
}

// ─────────────────────────────────────────
// DELETE ONE NOTIFICATION
// DELETE /api/notifications/:id
// ─────────────────────────────────────────
const deleteOne = async (req, res, next) => {
    try {
        const notification = await deleteNotification(req.params.id, req.farmer.id)

        if (!notification) {
            return res.status(404).json(fail('Notification not found'))
        }

        res.json(success({}, 'Notification deleted'))
    } catch (err) {
        next(err)
    }
}

// ─────────────────────────────────────────
// CLEAR ALL READ NOTIFICATIONS
// DELETE /api/notifications/clear-read
// ─────────────────────────────────────────
const clearRead = async (req, res, next) => {
    try {
        const count = await clearReadNotifications(req.farmer.id)
        res.json(success({ count }, `${count} read notifications cleared`))
    } catch (err) {
        next(err)
    }
}

// ─────────────────────────────────────────
// TEST NOTIFICATION (Development only)
// POST /api/notifications/test
// Sends a test notification to confirm
// Socket.io is working end to end
// ─────────────────────────────────────────
const sendTestNotification = async (req, res, next) => {
    try {
        
        const io = req.app.get('io')

        const notification = await createNotification(req.farmer.id, {
            type: 'SYSTEM',
            title: 'Test Notification',
            message: 'This is a test notification from AgricbyLovely. Your notification system is working correctly.',
        }, io)

        res.json(success({ notification }, 'Test notification sent'))
    } catch (err) {
        next(err)
    }
}

export {
    getMyNotifications,
    markOneAsRead,
    markAllRead,
    deleteOne,
    clearRead,
    sendTestNotification,
}