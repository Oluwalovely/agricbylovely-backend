import { Router } from 'express'
import { getProfile, updateProfile, changePassword, deleteAccount } from '../controllers/farmer.controller.js'
import { authenticate } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { updateProfileSchema, changePasswordSchema } from '../utils/validators.js'

const router = Router()

router.use(authenticate)

router.get('/',           getProfile)                                      // GET  /api/farmers/me
router.put('/',           validate(updateProfileSchema), updateProfile)    // PUT  /api/farmers/me
router.put('/password',   validate(changePasswordSchema), changePassword)  // PUT  /api/farmers/me/password
router.delete('/',        deleteAccount)                                   // DELETE /api/farmers/me

export default router