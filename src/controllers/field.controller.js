import prisma from '../config/prisma.js'
import { success, fail } from '../utils/response.js'


const createField = async (req, res, next) => {
    try {
        const { name, sizeHa, soilType, latitude, longitude, notes } = req.body

        const field = await prisma.field.create({
            data: {
                farmerId: req.farmer.id,
                name,
                sizeHa: sizeHa ? parseFloat(sizeHa) : null,
                soilType: soilType || 'LOAMY',
                latitude: latitude ? parseFloat(latitude) : null,
                longitude: longitude ? parseFloat(longitude) : null,
                notes: notes || null,
            },
        })

        res.status(201).json(success({ field }, 'Field created successfully'))
    } catch (err) {
        next(err)
    }
}


const getMyFields = async (req, res, next) => {
    try {
        const fields = await prisma.field.findMany({
            where: { farmerId: req.farmer.id },
            orderBy: { createdAt: 'asc' },
            include: {
                // include count of crops planted in each field
                _count: {
                    select: { farmerCrops: true }
                },
                // include the active crops in this field
                farmerCrops: {
                    where: { harvestedAt: null }, // only active crops
                    include: { crop: true },
                    orderBy: { plantedAt: 'desc' },
                }
            }
        })

        res.json(success({ fields }, 'Fields fetched successfully'))
    } catch (err) {
        next(err)
    }
}


const getFieldById = async (req, res, next) => {
    try {
        const field = await prisma.field.findFirst({
            where: {
                id: req.params.id,
                farmerId: req.farmer.id, // make sure it belongs to this farmer
            },
            include: {
                farmerCrops: {
                    include: { crop: true },
                    orderBy: { plantedAt: 'desc' },
                }
            }
        })

        if (!field) {
            return res.status(404).json(fail('Field not found'))
        }

        res.json(success({ field }, 'Field fetched successfully'))
    } catch (err) {
        next(err)
    }
}


const updateField = async (req, res, next) => {
    try {
        const { name, sizeHa, soilType, latitude, longitude, notes } = req.body

        // Make sure the field belongs to this farmer
        const existing = await prisma.field.findFirst({
            where: { id: req.params.id, farmerId: req.farmer.id }
        })

        if (!existing) {
            return res.status(404).json(fail('Field not found'))
        }

        // Only update fields that were sent in the request
        const updateData = {}
        if (name !== undefined) updateData.name = name
        if (soilType !== undefined) updateData.soilType = soilType
        if (notes !== undefined) updateData.notes = notes
        if (sizeHa !== undefined) updateData.sizeHa = parseFloat(sizeHa)
        if (latitude !== undefined) updateData.latitude = parseFloat(latitude)
        if (longitude !== undefined) updateData.longitude = parseFloat(longitude)

        const field = await prisma.field.update({
            where: { id: req.params.id },
            data: updateData,
        })

        res.json(success({ field }, 'Field updated successfully'))
    } catch (err) {
        next(err)
    }
}


const deleteField = async (req, res, next) => {
    try {
        // Make sure the field belongs to this farmer
        const existing = await prisma.field.findFirst({
            where: { id: req.params.id, farmerId: req.farmer.id }
        })

        if (!existing) {
            return res.status(404).json(fail('Field not found'))
        }

        await prisma.field.delete({ where: { id: req.params.id } })

        res.json(success({}, 'Field deleted successfully'))
    } catch (err) {
        next(err)
    }
}


const getFieldSummary = async (req, res, next) => {
    try {
        const fields = await prisma.field.findMany({
            where: { farmerId: req.farmer.id },
            select: {
                id: true,
                name: true,
                sizeHa: true,
                soilType: true,
                _count: {
                    select: { farmerCrops: true }
                }
            }
        })

        // Calculate totals
        const totalFields = fields.length
        const totalHectares = fields.reduce((sum, f) => sum + (f.sizeHa || 0), 0)
        const totalActiveCrops = fields.reduce((sum, f) => sum + f._count.farmerCrops, 0)

        res.json(success({
            summary: {
                totalFields,
                totalHectares: parseFloat(totalHectares.toFixed(2)),
                totalActiveCrops,
                fields,
            }
        }, 'Field summary fetched successfully'))
    } catch (err) {
        next(err)
    }
}

export { createField, getMyFields, getFieldById, updateField, deleteField, getFieldSummary }