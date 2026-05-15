import { Router } from 'express'
import {
    register,
    login,
    refresh,
    logout,
    forgotPassword,
    resetPassword,
} from '../controllers/auth.controller.js'
import { authenticate } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { registerSchema, loginSchema, forgotPasswordSchema, resetPasswordSchema } from '../utils/validators.js'
import { authLimiter } from '../middleware/security.js'

const router = Router()

// Public routes with strict rate limiting
router.post('/register', authLimiter, validate(registerSchema), register)
router.post('/login', authLimiter, validate(loginSchema), login)
router.post('/refresh', refresh)
router.post('/forgot-password', authLimiter, validate(forgotPasswordSchema), forgotPassword)
router.post('/reset-password', authLimiter, validate(resetPasswordSchema), resetPassword)

// Protected route
router.post('/logout', authenticate, logout)

export default router