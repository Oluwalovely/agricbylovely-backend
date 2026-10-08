import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import prisma from '../config/prisma.js'
import { env } from '../config/env.js'
import { emailConfigured } from '../services/emailDelivery.js'
import { success, fail } from '../utils/response.js'
import { sendWelcomeEmail, sendPasswordResetEmail } from '../services/email.service.js'


const generateTokens = (farmerId) => {
    const accessToken = jwt.sign(
        { farmerId },
        env.JWT_SECRET,
        { expiresIn: env.JWT_EXPIRES_IN }
    )
    const refreshToken = jwt.sign(
        { farmerId },
        env.JWT_REFRESH_SECRET,
        { expiresIn: env.JWT_REFRESH_EXPIRES_IN }
    )
    return { accessToken, refreshToken }
}


const register = async (req, res, next) => {
    try {
        const {
            email, password, firstName, lastName,
            phone, farmName, farmSizeHa, soilType,
            latitude, longitude, state,
        } = req.body

        const existing = await prisma.farmer.findUnique({ where: { email } })
        if (existing) {
            return res.status(409).json(fail('An account with this email already exists'))
        }

        const hashedPassword = await bcrypt.hash(password, 12)

        const farmer = await prisma.farmer.create({
            data: {
                email,
                password: hashedPassword,
                firstName,
                lastName,
                phone,
                farmName,
                farmSizeHa: farmSizeHa ? parseFloat(farmSizeHa) : null,
                soilType: soilType || 'LOAMY',
                latitude: latitude ?? null,
                longitude: longitude ?? null,
                state,
            },
            select: {
                id: true, email: true, firstName: true,
                lastName: true, farmName: true, state: true, createdAt: true,
            },
        })

        const { accessToken, refreshToken } = generateTokens(farmer.id)

        await prisma.farmer.update({
            where: { id: farmer.id },
            data: { refreshToken },
        })

        // Send welcome email in background
        sendWelcomeEmail(farmer).catch(err =>
            console.error('Welcome email failed:', err.message)
        )

        res.status(201).json(
            success({ farmer, accessToken, refreshToken }, 'Account created successfully')
        )
    } catch (err) {
        next(err)
    }
}


const login = async (req, res, next) => {
    try {
        const { email, password } = req.body

        const farmer = await prisma.farmer.findUnique({ where: { email } })
        if (!farmer) {
            return res.status(401).json(fail('Invalid email or password'))
        }

        const isMatch = await bcrypt.compare(password, farmer.password)
        if (!isMatch) {
            return res.status(401).json(fail('Invalid email or password'))
        }

        const { accessToken, refreshToken } = generateTokens(farmer.id)

        await prisma.farmer.update({
            where: { id: farmer.id },
            data: { refreshToken },
        })

        const safeFarmer = Object.fromEntries(Object.entries(farmer).filter(([key]) =>
            !['password', 'refreshToken', 'passwordResetToken', 'passwordResetExpiry'].includes(key)))

        res.json(success({ farmer: safeFarmer, accessToken, refreshToken }, 'Login successful'))
    } catch (err) {
        next(err)
    }
}


const refresh = async (req, res, next) => {
    try {
        const { refreshToken } = req.body
        if (!refreshToken) {
            return res.status(401).json(fail('Refresh token is required'))
        }

        const decoded = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET)

        const farmer = await prisma.farmer.findUnique({
            where: { id: decoded.farmerId },
        })

        if (!farmer || farmer.refreshToken !== refreshToken) {
            return res.status(401).json(fail('Invalid refresh token'))
        }

        const accessToken = jwt.sign(
            { farmerId: farmer.id },
            env.JWT_SECRET,
            { expiresIn: env.JWT_EXPIRES_IN }
        )

        res.json(success({ accessToken }, 'Token refreshed'))
    } catch (err) {
        if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
            return res.status(401).json(fail('Invalid or expired refresh token'))
        }
        next(err)
    }
}


const logout = async (req, res, next) => {
    try {
        await prisma.farmer.update({
            where: { id: req.farmer.id },
            data: { refreshToken: null },
        })
        res.json(success({}, 'Logged out successfully'))
    } catch (err) {
        next(err)
    }
}


const forgotPassword = async (req, res, next) => {
    try {
        if (!emailConfigured()) return res.status(503).json(fail('Password recovery is temporarily unavailable. Please try again later.'))
        const { email } = req.body

        const farmer = await prisma.farmer.findUnique({ where: { email } })

        
        if (!farmer) {
            return res.json(success({},
                'If an account with that email exists, a reset has been requested. Check your inbox and spam folder; if no link arrives, try again later.'
            ))
        }

        
        const resetToken = crypto.randomBytes(32).toString('hex')

        
        const resetExpiry = new Date(Date.now() + 60 * 60 * 1000)

        
        await prisma.farmer.update({
            where: { id: farmer.id },
            data: {
                passwordResetToken: crypto.createHash('sha256').update(resetToken).digest('hex'),
                passwordResetExpiry: resetExpiry,
            },
        })

        
        const resetUrl = new URL('/reset-password', env.CLIENT_URL)
        resetUrl.searchParams.set('token', resetToken)

        
        const sent = await sendPasswordResetEmail(farmer, resetUrl.toString())
        if (!sent) await prisma.farmer.updateMany({
            where: { id: farmer.id, passwordResetToken: crypto.createHash('sha256').update(resetToken).digest('hex') },
            data: { passwordResetToken: null, passwordResetExpiry: null },
        })

        // A generic acknowledgement avoids exposing whether the account exists.

        res.json(success({},
            'If an account with that email exists, a reset has been requested. Check your inbox and spam folder; if no link arrives, try again later.'
        ))
    } catch (err) {
        next(err)
    }
}


const resetPassword = async (req, res, next) => {
    try {
        const { token, newPassword } = req.body

        if (!token || !newPassword) {
            return res.status(400).json(fail('Token and new password are required'))
        }

        
        const farmer = await prisma.farmer.findFirst({
            where: {
                passwordResetToken: crypto.createHash('sha256').update(token).digest('hex'),
                passwordResetExpiry: { gt: new Date() }, 
            },
        })

        if (!farmer) {
            return res.status(400).json(fail(
                'This reset link is invalid or has expired. Please request a new one.'
            ))
        }

        
        const hashedPassword = await bcrypt.hash(newPassword, 12)

        
        const changed = await prisma.farmer.updateMany({
            where: { id: farmer.id, passwordResetToken: farmer.passwordResetToken, passwordResetExpiry: { gt: new Date() } },
            data: {
                password: hashedPassword,
                passwordResetToken: null, 
                passwordResetExpiry: null,
                refreshToken: null, 
            },
        })

        if (!changed.count) return res.status(400).json(fail('This reset link is invalid or has expired. Please request a new one.'))

        res.json(success({},
            'Password reset successfully. Please login with your new password.'
        ))
    } catch (err) {
        next(err)
    }
}

export { register, login, refresh, logout, forgotPassword, resetPassword }
