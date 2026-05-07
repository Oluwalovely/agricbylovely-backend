import prisma from '../config/prisma.js'
import { success, fail } from '../utils/response.js'
import { searchPerenual } from '../services/perenual.service.js'
import { fillCropDetails } from '../services/aifiller.service.js'

// ─────────────────────────────────────────
// GET ALL CROPS
// GET /api/crops
// Supports search and category filter
// e.g. /api/crops?q=tomato&category=VEGETABLE
// ─────────────────────────────────────────
const getAllCrops = async (req, res, next) => {
    try {
        const { q, category, page = 1, limit = 20 } = req.query

        // Build the filter object based on what was sent
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

        // ── External API fallback ──────────────
        // If nothing found locally and farmer searched for something,
        // try Perenual then fill gaps with AI
        if (crops.length === 0 && q) {
            console.log(`"${q}" not found locally — searching Perenual...`)

            const perenualResults = await searchPerenual(q)
            console.log(`Perenual found: ${perenualResults.length} results`)

            if (perenualResults.length > 0) {
                const saved = []

                for (const crop of perenualResults) {
                    // Check if crop already exists before saving
                    const exists = await prisma.crop.findFirst({
                        where: { name: { equals: crop.name, mode: 'insensitive' } },
                    })

                    if (!exists) {
                        // Save the crop first with whatever Perenual gave us
                        const newCrop = await prisma.crop.create({ data: crop })

                        // Then immediately fill missing details using AI
                        const enriched = await fillCropDetails(newCrop)
                        saved.push(enriched)
                    }
                }

                console.log(`Saved and enriched ${saved.length} new crops`)

                return res.json(success({
                    crops: saved,
                    total: saved.length,
                    page: 1,
                    pages: 1,
                    source: 'external',
                }, 'Crops fetched and enriched from external source'))
            }

            // Nothing found anywhere
            return res.json(success({
                crops: [],
                total: 0,
                page: 1,
                pages: 1,
            }, 'No crops found'))
        }

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

// ─────────────────────────────────────────
// GET ONE CROP
// GET /api/crops/:id
// ─────────────────────────────────────────
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

// ─────────────────────────────────────────
// GET CROP CATEGORIES
// GET /api/crops/categories
// ─────────────────────────────────────────
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

// ─────────────────────────────────────────
// PLANT A CROP
// POST /api/crops/:id/plant
// ─────────────────────────────────────────
const plantCrop = async (req, res, next) => {
    try {
        const { plantedAt, fieldId, notes, quantity } = req.body
        const cropId = req.params.id

        const crop = await prisma.crop.findUnique({ where: { id: cropId } })
        if (!crop) {
            return res.status(404).json(fail('Crop not found'))
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

// ─────────────────────────────────────────
// GET MY CROPS
// GET /api/crops/my-crops
// ─────────────────────────────────────────
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

// ─────────────────────────────────────────
// UPDATE MY CROP
// PUT /api/crops/my-crops/:id
// ─────────────────────────────────────────
const updateMyCrop = async (req, res, next) => {
    try {
        const { stage, notes, yieldKg, harvestedAt } = req.body

        const existing = await prisma.farmerCrop.findFirst({
            where: { id: req.params.id, farmerId: req.farmer.id },
        })

        if (!existing) {
            return res.status(404).json(fail('Crop record not found'))
        }

        const updateData = {}
        if (stage !== undefined) updateData.stage = stage
        if (notes !== undefined) updateData.notes = notes
        if (yieldKg !== undefined) updateData.yieldKg = parseFloat(yieldKg)
        if (harvestedAt !== undefined) updateData.harvestedAt = new Date(harvestedAt)

        const farmerCrop = await prisma.farmerCrop.update({
            where: { id: req.params.id },
            data: updateData,
            include: { crop: true, field: true },
        })

        res.json(success({ farmerCrop }, 'Crop updated successfully'))
    } catch (err) {
        next(err)
    }
}

// ─────────────────────────────────────────
// REMOVE MY CROP
// DELETE /api/crops/my-crops/:id
// ─────────────────────────────────────────
const removeMyCrop = async (req, res, next) => {
    try {
        const existing = await prisma.farmerCrop.findFirst({
            where: { id: req.params.id, farmerId: req.farmer.id },
        })

        if (!existing) {
            return res.status(404).json(fail('Crop record not found'))
        }

        await prisma.farmerCrop.delete({ where: { id: req.params.id } })

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