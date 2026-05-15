import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import prisma from '../config/prisma.js'
import { env } from '../config/env.js'
import { success, fail } from '../utils/response.js'
import { sendWelcomeEmail, sendPasswordResetEmail } from '../services/email.service.js'

// ─────────────────────────────────────────
// HELPER — generate both tokens for a farmer
// ─────────────────────────────────────────
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

// ─────────────────────────────────────────
// REGISTER
// POST /api/auth/register
// ─────────────────────────────────────────
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
                latitude: latitude ? parseFloat(latitude) : null,
                longitude: longitude ? parseFloat(longitude) : null,
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

// ─────────────────────────────────────────
// LOGIN
// POST /api/auth/login
// ─────────────────────────────────────────
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

        const { password: _, refreshToken: __, ...safeFarmer } = farmer

        res.json(success({ farmer: safeFarmer, accessToken, refreshToken }, 'Login successful'))
    } catch (err) {
        next(err)
    }
}

// ─────────────────────────────────────────
// REFRESH TOKEN
// POST /api/auth/refresh
// ─────────────────────────────────────────
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

// ─────────────────────────────────────────
// LOGOUT
// POST /api/auth/logout
// ─────────────────────────────────────────
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

// ─────────────────────────────────────────
// FORGOT PASSWORD
// POST /api/auth/forgot-password
// Farmer enters their email — we send a reset link
// ─────────────────────────────────────────
const forgotPassword = async (req, res, next) => {
    try {
        const { email } = req.body

        const farmer = await prisma.farmer.findUnique({ where: { email } })

        // Always return success even if email not found
        // This prevents email enumeration attacks
        // (hackers guessing which emails are registered)
        if (!farmer) {
            return res.json(success({},
                'If an account with that email exists, a reset link has been sent.'
            ))
        }

        // Generate a secure random token
        const resetToken = crypto.randomBytes(32).toString('hex')

        // Token expires in 1 hour
        const resetExpiry = new Date(Date.now() + 60 * 60 * 1000)

        // Save token to database
        await prisma.farmer.update({
            where: { id: farmer.id },
            data: {
                passwordResetToken: resetToken,
                passwordResetExpiry: resetExpiry,
            },
        })

        // Build the reset URL — points to the frontend reset page
        const resetUrl = `${env.CLIENT_URL}/reset-password?token=${resetToken}`

        // Send the reset email
        await sendPasswordResetEmail(farmer, resetUrl)

        console.log(`Password reset email sent to ${farmer.email}`)

        res.json(success({},
            'If an account with that email exists, a reset link has been sent.'
        ))
    } catch (err) {
        next(err)
    }
}

// ─────────────────────────────────────────
// RESET PASSWORD
// POST /api/auth/reset-password
// Farmer submits new password with the token from the email
// ─────────────────────────────────────────
const resetPassword = async (req, res, next) => {
    try {
        const { token, newPassword } = req.body

        if (!token || !newPassword) {
            return res.status(400).json(fail('Token and new password are required'))
        }

        // Find farmer with this reset token
        const farmer = await prisma.farmer.findFirst({
            where: {
                passwordResetToken: token,
                passwordResetExpiry: { gt: new Date() }, // token must not be expired
            },
        })

        if (!farmer) {
            return res.status(400).json(fail(
                'This reset link is invalid or has expired. Please request a new one.'
            ))
        }

        // Hash the new password
        const hashedPassword = await bcrypt.hash(newPassword, 12)

        // Update password and clear the reset token
        await prisma.farmer.update({
            where: { id: farmer.id },
            data: {
                password: hashedPassword,
                passwordResetToken: null, // clear token so it cannot be used again
                passwordResetExpiry: null,
                refreshToken: null, // log out all existing sessions for security
            },
        })

        console.log(`Password reset successful for ${farmer.email}`)

        res.json(success({},
            'Password reset successfully. Please login with your new password.'
        ))
    } catch (err) {
        next(err)
    }
}

export { register, login, refresh, logout, forgotPassword, resetPassword }