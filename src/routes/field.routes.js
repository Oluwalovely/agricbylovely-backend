import { Router } from 'express'
import {
  createField,
  getMyFields,
  getFieldById,
  updateField,
  deleteField,
  getFieldSummary,
} from '../controllers/field.controller.js'
import { authenticate } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { createFieldSchema, updateFieldSchema, idParamsSchema } from '../utils/validators.js'

const router = Router()

router.use(authenticate)

router.get('/summary',  getFieldSummary)
router.get('/',         getMyFields)
router.post('/',        validate(createFieldSchema), createField)
router.get('/:id',      validate(idParamsSchema), getFieldById)
router.put('/:id',      validate(idParamsSchema), validate(updateFieldSchema), updateField)
router.delete('/:id',   validate(idParamsSchema), deleteField)

export default router