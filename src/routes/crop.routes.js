import { Router } from 'express'
import {
    getAllCrops,
    getCropById,
    getCropCategories,
    plantCrop,
    getMyCrops,
    updateMyCrop,
    removeMyCrop,
} from '../controllers/crop.controller.js'
import { authenticate } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { cropQuerySchema, idParamsSchema, plantCropSchema, updateCropSchema } from '../utils/validators.js'
import { searchLimiter } from '../middleware/security.js'

const router = Router()


router.get('/', searchLimiter, validate(cropQuerySchema), getAllCrops)
router.get('/categories', getCropCategories) 
router.get('/my-crops', authenticate, getMyCrops)
router.put('/my-crops/:id', authenticate, validate(updateCropSchema), updateMyCrop)
router.delete('/my-crops/:id', authenticate, validate(idParamsSchema), removeMyCrop)


router.get('/:id', validate(idParamsSchema), getCropById)
router.post('/:id/plant', authenticate, validate(plantCropSchema), plantCrop)


export default router
