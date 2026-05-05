import { Router } from 'express'
import { register, login, refresh, logout } from '../controllers/auth.controller.js'
import { authenticate } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { registerSchema, loginSchema } from '../utils/validators.js'
import rateLimit from 'express-rate-limit'

const router = Router()

// Strict rate limiter for auth routes only
// Prevents brute force attacks — max 10 attempts per 15 minutes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: 'Too many attempts, please try again later.' },
})

router.post('/register', authLimiter, validate(registerSchema), register)
router.post('/login',    authLimiter, validate(loginSchema),    login)
router.post('/refresh',  refresh)


router.post('/logout', authenticate, logout)

export default router