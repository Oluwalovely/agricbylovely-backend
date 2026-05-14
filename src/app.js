import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import { env } from './config/env.js'
import router from './routes/index.js'
import { notFound, errorHandler } from './middleware/errorHandler.js'
import { sanitize } from './middleware/sanitize.js'

const app = express()


app.use(helmet())


app.use(cors({
  origin:      env.CLIENT_URL,
  credentials: true,
  methods:     ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}))


app.set('trust proxy', 1)


app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max:      200,
  message: {
    success: false,
    message: 'Too many requests, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders:   false,
}))


app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))


app.use(sanitize)


app.use('/api', router)


app.use(notFound)


app.use(errorHandler)

export default app