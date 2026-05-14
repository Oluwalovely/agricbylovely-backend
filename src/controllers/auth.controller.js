import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import prisma from '../config/prisma.js'
import { env } from '../config/env.js'
import { success, fail } from '../utils/response.js'
import { sendWelcomeEmail } from '../services/email.service.js'


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

        // Check if email is already taken
        const existing = await prisma.farmer.findUnique({ where: { email } })
        if (existing) {
            return res.status(409).json(fail('An account with this email already exists'))
        }

        // Hash the password
        const hashedPassword = await bcrypt.hash(password, 12)

        // Create the farmer
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

        // Generate tokens
        const { accessToken, refreshToken } = generateTokens(farmer.id)

        // Save refresh token
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

        const { password: _, refreshToken: __, ...safeFarmer } = farmer

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

export { register, login, refresh, logout }