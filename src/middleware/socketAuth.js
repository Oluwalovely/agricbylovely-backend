import jwt from 'jsonwebtoken'
import prisma from '../config/prisma.js'
import { env } from '../config/env.js'

export const authenticateSocket = async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token
    if (typeof token !== 'string') throw Object.assign(new Error('Missing token'), { code: 'UNAUTHORIZED' })
    const decoded = jwt.verify(token, env.JWT_SECRET)
    if (typeof decoded.farmerId !== 'string' || !Number.isFinite(decoded.exp)) {
      throw Object.assign(new Error('Invalid identity'), { code: 'UNAUTHORIZED' })
    }
    const farmer = await prisma.farmer.findUnique({
      where: { id: decoded.farmerId },
      select: { id: true },
    })
    if (!farmer) throw Object.assign(new Error('Account not found'), { code: 'UNAUTHORIZED' })
    socket.data.farmerId = farmer.id
    socket.data.expiresAt = decoded.exp * 1000
    next()
  } catch (err) {
    const error = new Error('Unable to authenticate notification connection')
    error.data = { code: err.code === 'UNAUTHORIZED' || ['JsonWebTokenError', 'TokenExpiredError', 'NotBeforeError'].includes(err.name) ? 'UNAUTHORIZED' : 'UNAVAILABLE' }
    next(error)
  }
}

export const configureNotificationSockets = (io) => {
  io.use(authenticateSocket)
  io.on('connection', (socket) => {
    // The verified token selects the room; clients cannot choose another farmer.
    socket.join(`farmer:${socket.data.farmerId}`)
    const expiryTimer = setTimeout(() => socket.disconnect(true),
      Math.max(0, socket.data.expiresAt - Date.now()))
    expiryTimer.unref()
    socket.on('disconnect', () => clearTimeout(expiryTimer))
  })
}
