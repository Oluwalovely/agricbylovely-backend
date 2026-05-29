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
        
        if (!req.file) {
            return res.status(400).json(fail('Please select an image to upload'))
        }

        
        const farmer = await prisma.farmer.findUnique({
            where: { id: req.farmer.id },
            select: { avatarUrl: true },
        })

        
        const avatarUrl = await uploadAvatar(req.file.buffer, req.farmer.id)

        
        if (farmer.avatarUrl) {
            await deleteImage(farmer.avatarUrl)
        }

        
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

        
        const field = await prisma.field.findFirst({
            where: { id: fieldId, farmerId: req.farmer.id },
        })

        if (!field) {
            return res.status(404).json(fail('Field not found'))
        }

        
        const photoUrl = await uploadFieldPhoto(req.file.buffer, fieldId)

        
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

        
        const farmerCrop = await prisma.farmerCrop.findFirst({
            where: { id: farmerCropId, farmerId: req.farmer.id },
        })

        if (!farmerCrop) {
            return res.status(404).json(fail('Crop record not found'))
        }

        
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

        
        await deleteImage(farmer.avatarUrl)

        
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