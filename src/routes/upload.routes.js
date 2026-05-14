import { Router } from 'express'
import {
    uploadFarmerAvatar,
    uploadFieldImage,
    uploadCropImage,
    deleteFarmerAvatar,
} from '../controllers/upload.controller.js'
import { authenticate } from '../middleware/auth.js'
import { uploadSingle, handleUploadError } from '../middleware/upload.js'
import { uploadLimiter } from '../middleware/security.js'

const router = Router()

router.use(authenticate)
router.use(uploadLimiter) 

router.post('/avatar', uploadSingle, handleUploadError, uploadFarmerAvatar)
router.delete('/avatar', deleteFarmerAvatar)
router.post('/fields/:fieldId', uploadSingle, handleUploadError, uploadFieldImage)
router.post('/crops/:farmerCropId', uploadSingle, handleUploadError, uploadCropImage)

export default router