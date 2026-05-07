import prisma from '../config/prisma.js'
import { success, fail } from '../utils/response.js'
import {
    uploadAvatar,
    uploadFieldPhoto,
    uploadCropPhoto,
    deleteImage,
} from '../services/upload.service.js'


const uploadFarmerAvatar = async (req, res, next) => {
    try {
        // req.file is set by multer middleware
        if (!req.file) {
            return res.status(400).json(fail('Please select an image to upload'))
        }

        // Get current avatar URL so we can delete the old one
        const farmer = await prisma.farmer.findUnique({
            where: { id: req.farmer.id },
            select: { avatarUrl: true },
        })

        // Upload new avatar to Cloudinary
        const avatarUrl = await uploadAvatar(req.file.buffer, req.farmer.id)

        // Delete old avatar from Cloudinary if one exists
        if (farmer.avatarUrl) {
            await deleteImage(farmer.avatarUrl)
        }

        // Save new URL to the database
        await prisma.farmer.update({
            where: { id: req.farmer.id },
            data: { avatarUrl },
        })

        res.json(success({ avatarUrl }, 'Profile photo updated successfully'))
    } catch (err) {
        next(err)
    }
}


const uploadFieldImage = async (req, res, next) => {
    try {
        if (!req.file) {
            return res.status(400).json(fail('Please select an image to upload'))
        }

        const { fieldId } = req.params

        // Make sure this field belongs to the logged-in farmer
        const field = await prisma.field.findFirst({
            where: { id: fieldId, farmerId: req.farmer.id },
        })

        if (!field) {
            return res.status(404).json(fail('Field not found'))
        }

        // Upload photo to Cloudinary
        const photoUrl = await uploadFieldPhoto(req.file.buffer, fieldId)

        // Save the photo URL to the field record
        const updated = await prisma.field.update({
            where: { id: fieldId },
            data: { notes: field.notes }, // keep notes, just add photo URL
        })

        res.json(success({ photoUrl }, 'Field photo uploaded successfully'))
    } catch (err) {
        next(err)
    }
}


const uploadCropImage = async (req, res, next) => {
    try {
        if (!req.file) {
            return res.status(400).json(fail('Please select an image to upload'))
        }

        const { farmerCropId } = req.params

        // Make sure this farmerCrop belongs to the logged-in farmer
        const farmerCrop = await prisma.farmerCrop.findFirst({
            where: { id: farmerCropId, farmerId: req.farmer.id },
        })

        if (!farmerCrop) {
            return res.status(404).json(fail('Crop record not found'))
        }

        // Upload photo to Cloudinary
        const photoUrl = await uploadCropPhoto(req.file.buffer, farmerCropId)

        res.json(success({ photoUrl }, 'Crop photo uploaded successfully'))
    } catch (err) {
        next(err)
    }
}


const deleteFarmerAvatar = async (req, res, next) => {
    try {
        const farmer = await prisma.farmer.findUnique({
            where: { id: req.farmer.id },
            select: { avatarUrl: true },
        })

        if (!farmer.avatarUrl) {
            return res.status(400).json(fail('No profile photo to delete'))
        }

        // Delete from Cloudinary
        await deleteImage(farmer.avatarUrl)

        // Remove URL from database
        await prisma.farmer.update({
            where: { id: req.farmer.id },
            data: { avatarUrl: null },
        })

        res.json(success({}, 'Profile photo removed successfully'))
    } catch (err) {
        next(err)
    }
}

export { uploadFarmerAvatar, uploadFieldImage, uploadCropImage, deleteFarmerAvatar }