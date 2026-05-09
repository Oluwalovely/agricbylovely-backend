import prisma from '../config/prisma.js'

// ─────────────────────────────────────────
// NOTIFICATION SERVICE
// Creates, fetches and manages notifications
// Also handles real-time push via Socket.io
// ─────────────────────────────────────────

// io is the Socket.io instance from index.js
// We pass it in when calling createNotification
// so we can push live to the farmer's screen

// ── Create a notification ─────────────────
// Saves to database AND pushes live via Socket.io
const createNotification = async (farmerId, { type, title, message }, io = null) => {
    // Save notification to database
    const notification = await prisma.notification.create({
        data: { farmerId, type, title, message },
    })

    // Push live to farmer's Socket.io room if io is available
    // The farmer joins room "farmer:THEIR_ID" when they open the app
    if (io) {
        io.to(`farmer:${farmerId}`).emit('new_notification', {
            id: notification.id,
            type: notification.type,
            title: notification.title,
            message: notification.message,
            isRead: notification.isRead,
            createdAt: notification.createdAt,
        })
        console.log(`Live notification pushed to farmer:${farmerId}`)
    }

    return notification
}

// ── Create multiple notifications at once ─
// Used by the job scheduler to alert many farmers
const createManyNotifications = async (notifications, io = null) => {
    const created = []

    for (const notif of notifications) {
        const n = await createNotification(notif.farmerId, notif, io)
        created.push(n)
    }

    return created
}

// ── Get all notifications for a farmer ────
const getNotifications = async (farmerId, { page = 1, limit = 20, unreadOnly = false } = {}) => {
    const where = { farmerId }

    // Filter to unread only if requested
    if (unreadOnly) where.isRead = false

    const skip = (parseInt(page) - 1) * parseInt(limit)

    const [notifications, total, unreadCount] = await Promise.all([
        prisma.notification.findMany({
            where,
            orderBy: { createdAt: 'desc' }, // newest first
            skip,
            take: parseInt(limit),
        }),
        prisma.notification.count({ where }),
        prisma.notification.count({ where: { farmerId, isRead: false } }),
    ])

    return { notifications, total, unreadCount }
}

// ── Mark one notification as read ─────────
const markAsRead = async (notificationId, farmerId) => {
    // Make sure notification belongs to this farmer
    const existing = await prisma.notification.findFirst({
        where: { id: notificationId, farmerId },
    })

    if (!existing) return null

    return prisma.notification.update({
        where: { id: notificationId },
        data: { isRead: true },
    })
}

// ── Mark all notifications as read ────────
const markAllAsRead = async (farmerId) => {
    const result = await prisma.notification.updateMany({
        where: { farmerId, isRead: false },
        data: { isRead: true },
    })
    return result.count // number of notifications marked as read
}

// ── Delete a notification ─────────────────
const deleteNotification = async (notificationId, farmerId) => {
    const existing = await prisma.notification.findFirst({
        where: { id: notificationId, farmerId },
    })
    if (!existing) return null

    return prisma.notification.delete({ where: { id: notificationId } })
}

// ── Delete all read notifications ─────────
// Keeps inbox clean — farmers can clear old alerts
const clearReadNotifications = async (farmerId) => {
    const result = await prisma.notification.deleteMany({
        where: { farmerId, isRead: true },
    })
    return result.count
}

// ── Send weather alerts as notifications ──
// Called by the daily weather check job
// Checks weather alerts and creates notifications for each
const sendWeatherAlertNotifications = async (farmerId, weatherAlerts, io = null) => {
    if (!weatherAlerts || weatherAlerts.length === 0) return []

    const notifications = weatherAlerts.map(alert => ({
        farmerId,
        type: alert.type,
        title: alert.title,
        message: alert.message,
    }))

    return createManyNotifications(notifications, io)
}

// ── Send harvest reminder notification ────
// Called when harvest is 7 days, 3 days or 1 day away
const sendHarvestReminder = async (farmerId, cropName, daysLeft, io = null) => {
    const urgency = daysLeft === 1 ? 'tomorrow' :
        daysLeft === 0 ? 'today' : `in ${daysLeft} days`

    return createNotification(farmerId, {
        type: 'HARVEST',
        title: 'Harvest Reminder',
        message: `Your ${cropName} is ready for harvest ${urgency}. Prepare your harvesting tools and storage facilities.`,
    }, io)
}

export {
    createNotification,
    createManyNotifications,
    getNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearReadNotifications,
    sendWeatherAlertNotifications,
    sendHarvestReminder,
}