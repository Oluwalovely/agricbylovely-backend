import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import { env } from './config/env.js'
import router from './routes/routes.js'
import { notFound, errorHandler } from './middleware/errorHandler.js'
import { sanitize } from './middleware/sanitize.js'

const app = express()

// Security headers 
// Helmet sets HTTP headers that protect against common attacks
app.use(helmet())


app.use(cors({
  origin: env.CLIENT_URL,
  credentials: true, 
}))

//  Global rate limiter 
// Max 200 requests per 15 minutes per IP address
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: { success: false, message: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
}))

//  Body parsers 
// Parse incoming JSON request bodies
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))

//  Input sanitizer 
// Trims whitespace and removes empty strings from all requests
app.use(sanitize)


app.use('/api', router)

//  404 handler
// Catches any request to a route that does not exist
app.use(notFound)

//  Global error handler
// Catches all errors thrown anywhere in the app
app.use(errorHandler)

export default app