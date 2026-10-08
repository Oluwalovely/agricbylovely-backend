import prisma from '../config/prisma.js'
import { success, fail } from '../utils/response.js'
import { uploadAvatar, uploadFieldPhoto, uploadCropPhoto, deleteImage } from '../services/upload.service.js'

// Comparing the previous URL protects simultaneous replacements/removals.
function photoController(model, param, property, upload, remove = false) {
  return async (req, res, next) => {
    let newUrl = null
    try {
      if (!remove && !req.file) return res.status(400).json(fail('Please select an image to upload'))
      const id = param ? req.params[param] : req.farmer.id
      const where = { id, ...(param ? { farmerId: req.farmer.id } : {}) }
      const record = await prisma[model].findFirst({ where, select: { [property]: true } })
      if (!record) return res.status(404).json(fail('Record not found'))
      if (!remove) newUrl = await upload(req.file.buffer, id)
      const savedUrl = newUrl
      const result = await prisma[model].updateMany({ where: { ...where, [property]: record[property] }, data: { [property]: newUrl } })
      if (!result.count) {
        if (newUrl) await deleteImage(newUrl)
        newUrl = null
        return res.status(409).json(fail('This photo changed while you were saving. Refresh the page and try again.'))
      }
      newUrl = null
      if (record[property]) await deleteImage(record[property])
      res.json(success({ [property]: savedUrl }, remove ? 'Photo removed.' : 'Photo saved.'))
    } catch (err) {
      if (newUrl) await deleteImage(newUrl)
      next(err)
    }
  }
}

export const uploadFarmerAvatar = photoController('farmer', null, 'avatarUrl', uploadAvatar)
export const deleteFarmerAvatar = photoController('farmer', null, 'avatarUrl', uploadAvatar, true)
export const uploadFieldImage = photoController('field', 'fieldId', 'photoUrl', uploadFieldPhoto)
export const deleteFieldImage = photoController('field', 'fieldId', 'photoUrl', uploadFieldPhoto, true)
export const uploadCropImage = photoController('farmerCrop', 'farmerCropId', 'photoUrl', uploadCropPhoto)
export const deleteCropImage = photoController('farmerCrop', 'farmerCropId', 'photoUrl', uploadCropPhoto, true)
