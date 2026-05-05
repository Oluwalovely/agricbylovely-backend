import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import prisma from '../config/prisma.js'
import { env } from '../config/env.js'
import { success, fail } from '../utils/response.js'


const generateTokens = (farmerId) => {
    
    const accessToken = jwt.sign(
        { farmerId },
        env.JWT_SECRET,
        { expiresIn: env.JWT_EXPIRES_IN } // 15 minutes
    )

    
    const refreshToken = jwt.sign(
        { farmerId },
        env.JWT_REFRESH_SECRET,
        { expiresIn: env.JWT_REFRESH_EXPIRES_IN } // 7 days
    )

    return { accessToken, refreshToken }
}


export const register = async (req, res, next) => {
    try {
        const {
            email,
            password,
            firstName,
            lastName,
            phone,
            farmName,
            farmSizeHa,
            soilType,
            latitude,
            longitude,
            state,
        } = req.body

        
        const existing = await prisma.farmer.findUnique({ where: { email } })
        if (existing) {
            return res.status(409).json(fail('An account with this email already exists'))
        }

        
        const hashedPassword = await bcrypt.hash(password, 12)

        // Create the farmer in the database
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
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                farmName: true,
                state: true,
                createdAt: true,
            },
        })

        
        const { accessToken, refreshToken } = generateTokens(farmer.id)

        // Save refresh token to database so we can validate it later
        await prisma.farmer.update({
            where: { id: farmer.id },
            data: { refreshToken },
        })

        res.status(201).json(
            success({ farmer, accessToken, refreshToken }, 'Account created successfully')
        )
    } catch (err) {
        next(err) 
    }
}


export const login = async (req, res, next) => {
    try {
        const { email, password } = req.body

        
        const farmer = await prisma.farmer.findUnique({ where: { email } })
        if (!farmer) {
            return res.status(401).json(fail('Invalid email or password'))
        }

        // Compare password with hashed version in database
        const isMatch = await bcrypt.compare(password, farmer.password)
        if (!isMatch) {
            return res.status(401).json(fail('Invalid email or password'))
        }

        // Generate fresh tokens
        const { accessToken, refreshToken } = generateTokens(farmer.id)

        // Update refresh token in database
        await prisma.farmer.update({
            where: { id: farmer.id },
            data: { refreshToken },
        })

        // Return farmer data without the password
        const { password: _, refreshToken: __, ...safeFarmer } = farmer

        res.json(success({ farmer: safeFarmer, accessToken, refreshToken }, 'Login successful'))
    } catch (err) {
        next(err)
    }
}


export const refresh = async (req, res, next) => {
    try {
        const { refreshToken } = req.body
        if (!refreshToken) {
            return res.status(401).json(fail('Refresh token is required'))
        }

        // Verify the refresh token is valid
        const decoded = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET)

        // Check that this refresh token matches what is stored in the database
        const farmer = await prisma.farmer.findUnique({
            where: { id: decoded.farmerId },
        })

        if (!farmer || farmer.refreshToken !== refreshToken) {
            return res.status(401).json(fail('Invalid refresh token'))
        }

        // Issue a new access token
        const accessToken = jwt.sign(
            { farmerId: farmer.id },
            env.JWT_SECRET,
            { expiresIn: env.JWT_EXPIRES_IN }
        )

        res.json(success({ accessToken }, 'Token refreshed'))
    } catch (err) {
        // If token is expired or invalid, send 401
        if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
            return res.status(401).json(fail('Invalid or expired refresh token'))
        }
        next(err)
    }
}


export const logout = async (req, res, next) => {
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