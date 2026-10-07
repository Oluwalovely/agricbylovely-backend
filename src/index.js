import { createServer } from 'http'
import { Server } from 'socket.io'
import app from './app.js'
import { env } from './config/env.js'
import { startScheduler } from './jobs/scheduler.js'
import { configureNotificationSockets } from './middleware/socketAuth.js'

const httpServer = createServer(app)


export const io = new Server(httpServer, {
    cors: {
        origin: env.CLIENT_URL,
        credentials: true,
    },
})

app.set('io', io) 

configureNotificationSockets(io)

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
