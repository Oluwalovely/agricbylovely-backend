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

const router = Router()


router.get('/', getAllCrops)    
router.get('/categories', getCropCategories) 
router.get('/:id', getCropById)      


router.post('/:id/plant', authenticate, plantCrop)  
router.get('/my-crops', authenticate, getMyCrops)
router.put('/my-crops/:id', authenticate, updateMyCrop)
router.delete('/my-crops/:id', authenticate, removeMyCrop)

export default router