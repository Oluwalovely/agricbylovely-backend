import { Router } from 'express'
import {
    uploadFarmerAvatar,
    uploadFieldImage,
    uploadCropImage,
    deleteFarmerAvatar,
} from '../controllers/upload.controller.js'
import { authenticate } from '../middleware/auth.js'
import { uploadSingle, handleUploadError } from '../middleware/upload.js'

const router = Router()

// All upload routes require login
router.use(authenticate)

// Avatar
router.post('/avatar', uploadSingle, handleUploadError, uploadFarmerAvatar)       // POST   /api/upload/avatar
router.delete('/avatar', deleteFarmerAvatar)                                        // DELETE /api/upload/avatar

// Field photo
router.post('/fields/:fieldId', uploadSingle, handleUploadError, uploadFieldImage)  // POST /api/upload/fields/:fieldId

// Crop photo
router.post('/crops/:farmerCropId', uploadSingle, handleUploadError, uploadCropImage) // POST /api/upload/crops/:farmerCropId

export default router