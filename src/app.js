import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import { apiLimiter } from './middleware/apiLimit.js'
import { env } from './config/env.js'
import router from './routes/routes.js'
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


app.use(apiLimiter)


app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))


app.use(sanitize)


app.use('/api', router)


app.use(notFound)


app.use(errorHandler)

export default app
