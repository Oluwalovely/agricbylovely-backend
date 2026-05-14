import { createServer } from 'http'
import { Server } from 'socket.io'
import app from './app.js'
import { env } from './config/env.js'
import { startScheduler } from './jobs/scheduler.js'

const httpServer = createServer(app)


export const io = new Server(httpServer, {
    cors: {
        origin: env.CLIENT_URL,
        credentials: true,
    },
})

app.set('io', io) 

io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id}`)

    // Frontend calls socket.emit('join', farmerId) after login
    socket.on('join', (farmerId) => {
        socket.join(`farmer:${farmerId}`)
        console.log(`Farmer ${farmerId} joined their notification room`)
    })

    socket.on('disconnect', () => {
        console.log(`Socket disconnected: ${socket.id}`)
    })
})

httpServer.listen(env.PORT, () => {
    console.log(`
  AgriByLovely API running
  Environment : ${env.NODE_ENV}
  Port        : ${env.PORT}
  Health check: http://localhost:${env.PORT}/api/health
  `)

    startScheduler(io)
})

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received — shutting down gracefully')
    httpServer.close(() => process.exit(0))
})