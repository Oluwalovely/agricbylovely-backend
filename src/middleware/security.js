import rateLimit from 'express-rate-limit'


// Auth rate limiter 
// Max 10 attempts per 15 minutes per IP
// Prevents brute force login attacks
export const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: {
        success: false,
        message: 'Too many attempts. Please try again in 15 minutes.',
    },
    standardHeaders: true,
    legacyHeaders: false,
})

// Upload rate limiter
// Max 20 uploads per hour per IP
// Prevents storage abuse
export const uploadLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 20,
    message: {
        success: false,
        message: 'Too many uploads. Please try again in an hour.',
    },
})

// Weather rate limiter
// Max 60 requests per hour per IP
// Protects our OpenWeatherMap API quota
export const weatherLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 60,
    message: {
        success: false,
        message: 'Too many weather requests. Please try again later.',
    },
})

// External search rate limiter
// Max 30 external crop searches per hour per IP
// Protects our Perenual API quota
export const searchLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 30,
    message: {
        success: false,
        message: 'Too many search requests. Please try again later.',
    },
})