import prisma from '../config/prisma.js'

// The lock and durable receipt prevent repeats, including after deletion.
const createScheduledNotification = async (farmerId, data, key, jobType, io) => {
    const notification = await prisma.$transaction(async tx => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${farmerId}:${key}`}))`
        const existing = await tx.job.findFirst({ where: { farmerId, type: jobType, status: 'DONE', payload: { path: ['notificationKey'], equals: key } } })
        if (existing) return null
        const saved = await tx.notification.create({ data: { farmerId, ...data } })
        await tx.job.create({ data: { farmerId, type: jobType, status: 'DONE', payload: { notificationKey: key }, runAt: new Date(), completedAt: new Date() } })
        return saved
    })
    if (notification && io) io.to(`farmer:${farmerId}`).emit('new_notification', notification)
    return notification
}

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
            farmerId,
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

// Create multiple notifications at once
// Used by the job scheduler to alert many farmers
const createManyNotifications = async (notifications, io = null) => {
    const created = []

    for (const notif of notifications) {
        const n = await createNotification(notif.farmerId, notif, io)
        created.push(n)
    }

    return created
}

//  Get all notifications for a farmer 
const getNotifications = async (farmerId, { page = 1, limit = 20, unreadOnly = false } = {}) => {
    const where = { farmerId }

    // Filter to unread only if requested
    if (unreadOnly) where.isRead = false

    const skip = (parseInt(page) - 1) * parseInt(limit)

    const [notifications, total, unreadCount] = await Promise.all([
        prisma.notification.findMany({
            where,
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            skip,
            take: parseInt(limit),
        }),
        prisma.notification.count({ where }),
        prisma.notification.count({ where: { farmerId, isRead: false } }),
    ])

    return { notifications, total, unreadCount }
}

//  Mark one notification as read 
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

//  Mark all notifications as read
const markAllAsRead = async (farmerId) => {
    const result = await prisma.notification.updateMany({
        where: { farmerId, isRead: false },
        data: { isRead: true },
    })
    return result.count // number of notifications marked as read
}


const deleteNotification = async (notificationId, farmerId) => {
    const existing = await prisma.notification.findFirst({
        where: { id: notificationId, farmerId },
    })
    if (!existing) return null

    return prisma.notification.delete({ where: { id: notificationId } })
}

const clearReadNotifications = async (farmerId) => {
    const result = await prisma.notification.deleteMany({
        where: { farmerId, isRead: true },
    })
    return result.count
}

// Send weather alerts as notifications 
// Called by the daily weather check job
// Checks weather alerts and creates notifications for each
const sendWeatherAlertNotifications = async (farmerId, weatherAlerts, io = null, date = new Date().toISOString().slice(0, 10)) => {
    if (!weatherAlerts || weatherAlerts.length === 0) return []

    const notifications = weatherAlerts.map(alert => ({
        farmerId,
        type: alert.type,
        title: alert.title,
        message: alert.message,
    }))

    const created = []
    for (const { farmerId: owner, ...data } of notifications) {
        const saved = await createScheduledNotification(owner, data, `weather:${date}:${data.type}:${data.title}`, 'WEATHER_ALERT', io)
        if (saved) created.push(saved)
    }
    return created
}


// Called when harvest is 7 days, 3 days or 1 day away
const sendHarvestReminder = async (farmerId, cropName, daysLeft, io = null, record = null) => {
    const urgency = daysLeft === 1 ? 'tomorrow' :
        daysLeft === 0 ? 'today' : `in ${daysLeft} days`

    const data = {
        type: 'HARVEST',
        title: 'Harvest Reminder',
        message: `Your ${cropName} has an estimated harvest date ${urgency}. Check crop maturity before harvesting.`,
    }
    if (!record) throw new Error('A planting record is required for a harvest reminder')
    return createScheduledNotification(farmerId, data, `harvest:${record.id}:${new Date(record.expectedHarvestAt).toISOString().slice(0, 10)}:${daysLeft}`, 'HARVEST_REMINDER', io)
}

export {
    createScheduledNotification,
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
