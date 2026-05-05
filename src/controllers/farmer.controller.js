import prisma from '../config/prisma.js'
import { success, fail } from '../utils/response.js'

// ─────────────────────────────────────────
// GET MY PROFILE
// GET /api/farmers/me
// Returns the logged-in farmer's full profile
// ─────────────────────────────────────────
const getProfile = async (req, res, next) => {
    try {
        const farmer = await prisma.farmer.findUnique({
            where: { id: req.farmer.id },
            select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                phone: true,
                farmName: true,
                farmSizeHa: true,
                soilType: true,
                latitude: true,
                longitude: true,
                state: true,
                country: true,
                avatarUrl: true,
                createdAt: true,
                // also return a count of their fields and active crops
                _count: {
                    select: {
                        fields: true,
                        farmerCrops: true,
                    },
                },
            },
        })

        if (!farmer) {
            return res.status(404).json(fail('Farmer not found'))
        }

        res.json(success({ farmer }, 'Profile fetched successfully'))
    } catch (err) {
        next(err)
    }
}

// ─────────────────────────────────────────
// UPDATE MY PROFILE
// PUT /api/farmers/me
// Farmer can update their own details
// ─────────────────────────────────────────
const updateProfile = async (req, res, next) => {
    try {
        const {
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

        // Build update object — only include fields that were sent
        // This way we don't overwrite fields the farmer did not touch
        const updateData = {}
        if (firstName !== undefined) updateData.firstName = firstName
        if (lastName !== undefined) updateData.lastName = lastName
        if (phone !== undefined) updateData.phone = phone
        if (farmName !== undefined) updateData.farmName = farmName
        if (soilType !== undefined) updateData.soilType = soilType
        if (state !== undefined) updateData.state = state
        if (farmSizeHa !== undefined) updateData.farmSizeHa = parseFloat(farmSizeHa)
        if (latitude !== undefined) updateData.latitude = parseFloat(latitude)
        if (longitude !== undefined) updateData.longitude = parseFloat(longitude)

        const farmer = await prisma.farmer.update({
            where: { id: req.farmer.id },
            data: updateData,
            select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                phone: true,
                farmName: true,
                farmSizeHa: true,
                soilType: true,
                latitude: true,
                longitude: true,
                state: true,
                country: true,
                avatarUrl: true,
                updatedAt: true,
            },
        })

        res.json(success({ farmer }, 'Profile updated successfully'))
    } catch (err) {
        next(err)
    }
}

// ─────────────────────────────────────────
// CHANGE PASSWORD
// PUT /api/farmers/me/password
// ─────────────────────────────────────────
const changePassword = async (req, res, next) => {
    try {
        const { currentPassword, newPassword } = req.body

        // Get farmer with password from database
        const farmer = await prisma.farmer.findUnique({
            where: { id: req.farmer.id },
        })

        // Verify current password is correct
        const bcrypt = await import('bcryptjs')
        const isMatch = await bcrypt.default.compare(currentPassword, farmer.password)
        if (!isMatch) {
            return res.status(400).json(fail('Current password is incorrect'))
        }

        // Hash the new password
        const hashedPassword = await bcrypt.default.hash(newPassword, 12)

        await prisma.farmer.update({
            where: { id: req.farmer.id },
            data: { password: hashedPassword },
        })

        res.json(success({}, 'Password changed successfully'))
    } catch (err) {
        next(err)
    }
}

// ─────────────────────────────────────────
// DELETE ACCOUNT
// DELETE /api/farmers/me
// Permanently deletes the farmer's account
// ─────────────────────────────────────────
const deleteAccount = async (req, res, next) => {
    try {
        await prisma.farmer.delete({
            where: { id: req.farmer.id },
        })

        res.json(success({}, 'Account deleted successfully'))
    } catch (err) {
        next(err)
    }
}

export { getProfile, updateProfile, changePassword, deleteAccount }