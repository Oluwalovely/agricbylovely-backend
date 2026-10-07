import prisma from '../config/prisma.js'
import { success, fail } from '../utils/response.js'
import { cropUpdate } from '../utils/cropLifecycle.js'
import { AppError } from '../middleware/errorHandler.js'


const getAllCrops = async (req, res, next) => {
    try {
        const { q, category, page = 1, limit = 20 } = req.query

        
        const where = {}

        if (q) {
            where.OR = [
                { name: { contains: q, mode: 'insensitive' } },
                { botanicalName: { contains: q, mode: 'insensitive' } },
                { description: { contains: q, mode: 'insensitive' } },
            ]
        }

        if (category) {
            where.category = category.toUpperCase()
        }

        const skip = (parseInt(page) - 1) * parseInt(limit)

        const [crops, total] = await Promise.all([
            prisma.crop.findMany({
                where,
                skip,
                take: parseInt(limit),
                orderBy: { name: 'asc' },
            }),
            prisma.crop.count({ where }),
        ])

        
        res.json(success({
            crops,
            total,
            page: parseInt(page),
            pages: Math.ceil(total / parseInt(limit)),
            source: 'database',
        }, 'Crops fetched successfully'))

    } catch (err) {
        next(err)
    }
}


const getCropById = async (req, res, next) => {
    try {
        const crop = await prisma.crop.findUnique({
            where: { id: req.params.id },
        })

        if (!crop) {
            return res.status(404).json(fail('Crop not found'))
        }

        res.json(success({ crop }, 'Crop fetched successfully'))
    } catch (err) {
        next(err)
    }
}



const getCropCategories = async (req, res, next) => {
    try {
        const categories = await prisma.crop.groupBy({
            by: ['category'],
            _count: { category: true },
            orderBy: { _count: { category: 'desc' } },
        })

        const result = categories.map(c => ({
            category: c.category,
            count: c._count.category,
        }))

        res.json(success({ categories: result }, 'Categories fetched successfully'))
    } catch (err) {
        next(err)
    }
}


const plantCrop = async (req, res, next) => {
    try {
        const { plantedAt, fieldId, notes, quantity } = req.body
        const cropId = req.params.id

        const crop = await prisma.crop.findUnique({ where: { id: cropId } })
        if (!crop) {
            return res.status(404).json(fail('Crop not found'))
        }

        if (fieldId) {
            const field = await prisma.field.findFirst({
                where: { id: fieldId, farmerId: req.farmer.id },
                select: { id: true },
            })
            if (!field) return res.status(404).json(fail('Field not found'))
        }

        const plantDate = new Date(plantedAt || Date.now())
        const expectedHarvestAt = crop.daysToHarvest
            ? new Date(plantDate.getTime() + crop.daysToHarvest * 24 * 60 * 60 * 1000)
            : null

        const farmerCrop = await prisma.farmerCrop.create({
            data: {
                farmerId: req.farmer.id,
                cropId,
                fieldId: fieldId || null,
                plantedAt: plantDate,
                expectedHarvestAt,
                notes: notes || null,
                quantity: quantity ? parseFloat(quantity) : null,
                stage: 'GERMINATING',
            },
            include: { crop: true, field: true },
        })

        res.status(201).json(success({ farmerCrop }, 'Crop added to your farm successfully'))
    } catch (err) {
        next(err)
    }
}


const getMyCrops = async (req, res, next) => {
    try {
        const farmerCrops = await prisma.farmerCrop.findMany({
            where: { farmerId: req.farmer.id },
            include: { crop: true, field: true },
            orderBy: { plantedAt: 'desc' },
        })

        res.json(success({ farmerCrops }, 'Your crops fetched successfully'))
    } catch (err) {
        next(err)
    }
}


const updateMyCrop = async (req, res, next) => {
    try {
        const existing = await prisma.farmerCrop.findFirst({
            where: { id: req.params.id, farmerId: req.farmer.id },
        })

        if (!existing) {
            return res.status(404).json(fail('Crop record not found'))
        }

        const updateData = cropUpdate(existing, req.body)

        const farmerCrop = await prisma.farmerCrop.update({
            where: { id: req.params.id, farmerId: req.farmer.id, updatedAt: existing.updatedAt },
            data: updateData,
            include: { crop: true, field: true },
        })

        res.json(success({ farmerCrop }, 'Crop updated successfully'))
    } catch (err) {
        next(err.code === 'P2025' ? new AppError('This planting changed while saving. Refresh the list and try again.', 409) : err)
    }
}


const removeMyCrop = async (req, res, next) => {
    try {
        const existing = await prisma.farmerCrop.findFirst({
            where: { id: req.params.id, farmerId: req.farmer.id },
        })

        if (!existing) {
            return res.status(404).json(fail('Crop record not found'))
        }

        await prisma.farmerCrop.delete({ where: { id: req.params.id, farmerId: req.farmer.id } })

        res.json(success({}, 'Crop removed successfully'))
    } catch (err) {
        next(err)
    }
}

export {
    getAllCrops,
    getCropById,
    getCropCategories,
    plantCrop,
    getMyCrops,
    updateMyCrop,
    removeMyCrop,
}
