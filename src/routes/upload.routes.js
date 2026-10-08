import { Router } from 'express'
import {
    uploadFarmerAvatar,
    uploadFieldImage,
    uploadCropImage,
    deleteFarmerAvatar,
    deleteFieldImage,
    deleteCropImage,
} from '../controllers/upload.controller.js'
import { authenticate } from '../middleware/auth.js'
import { uploadSingle, handleUploadError, verifyImage } from '../middleware/upload.js'
import { z } from 'zod'
import { validate } from '../middleware/validate.js'
import { uploadLimiter } from '../middleware/security.js'

const router = Router()

router.use(authenticate)
router.use(uploadLimiter) 

const fieldParams = validate(z.object({ params: z.object({ fieldId: z.string().uuid() }) }))
const cropParams = validate(z.object({ params: z.object({ farmerCropId: z.string().uuid() }) }))
router.post('/avatar', uploadSingle, handleUploadError, verifyImage, uploadFarmerAvatar)
router.delete('/avatar', deleteFarmerAvatar)
router.post('/fields/:fieldId', fieldParams, uploadSingle, handleUploadError, verifyImage, uploadFieldImage)
router.delete('/fields/:fieldId', fieldParams, deleteFieldImage)
router.post('/crops/:farmerCropId', cropParams, uploadSingle, handleUploadError, verifyImage, uploadCropImage)
router.delete('/crops/:farmerCropId', cropParams, deleteCropImage)

export default router
