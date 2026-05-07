import { v2 as cloudinary } from 'cloudinary'
import '../config/cloudinary.js' // ensure cloudinary is configured

// ─────────────────────────────────────────
// UPLOAD SERVICE
// Handles all image uploads to Cloudinary
// Each upload type has its own folder and settings
// ─────────────────────────────────────────

// Upload a farmer's profile avatar
// Stored in: agricbylovely/avatars/
const uploadAvatar = async (fileBuffer, farmerId) => {
    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
            {
                folder: 'agricbylovely/avatars',
                public_id: `farmer_${farmerId}`, // fixed ID so it overwrites old avatar
                overwrite: true,
                transformation: [
                    { width: 300, height: 300, crop: 'fill', gravity: 'face' }, // square crop focused on face
                    { quality: 'auto', fetch_format: 'auto' },                   // auto optimize
                ],
            },
            (error, result) => {
                if (error) reject(error)
                else resolve(result.secure_url) // return the HTTPS URL
            }
        )
        uploadStream.end(fileBuffer) // send the file buffer to Cloudinary
    })
}

// Upload a photo for a farm field
// Stored in: agricbylovely/fields/
const uploadFieldPhoto = async (fileBuffer, fieldId) => {
    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
            {
                folder: 'agricbylovely/fields',
                public_id: `field_${fieldId}_${Date.now()}`,
                transformation: [
                    { width: 800, height: 600, crop: 'fill' },
                    { quality: 'auto', fetch_format: 'auto' },
                ],
            },
            (error, result) => {
                if (error) reject(error)
                else resolve(result.secure_url)
            }
        )
        uploadStream.end(fileBuffer)
    })
}

// Upload a photo for a farmer's crop
// Stored in: agricbylovely/crops/
const uploadCropPhoto = async (fileBuffer, farmerCropId) => {
    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
            {
                folder: 'agricbylovely/crops',
                public_id: `crop_${farmerCropId}_${Date.now()}`,
                transformation: [
                    { width: 800, height: 600, crop: 'fill' },
                    { quality: 'auto', fetch_format: 'auto' },
                ],
            },
            (error, result) => {
                if (error) reject(error)
                else resolve(result.secure_url)
            }
        )
        uploadStream.end(fileBuffer)
    })
}

// Delete an image from Cloudinary by its URL
// Used when farmer deletes their account or removes a photo
const deleteImage = async (imageUrl) => {
    try {
        // Extract the public_id from the URL
        // e.g. https://res.cloudinary.com/cloud/image/upload/v123/agricbylovely/avatars/farmer_abc
        // public_id = agricbylovely/avatars/farmer_abc
        const parts = imageUrl.split('/')
        const uploadIndex = parts.indexOf('upload')
        const publicId = parts
            .slice(uploadIndex + 2) // skip 'upload' and version number
            .join('/')
            .replace(/\.[^/.]+$/, '') // remove file extension

        await cloudinary.uploader.destroy(publicId)
        console.log(`Deleted image: ${publicId}`)
    } catch (err) {
        // Fail silently — image deletion is not critical
        console.error('Failed to delete image from Cloudinary:', err.message)
    }
}

export { uploadAvatar, uploadFieldPhoto, uploadCropPhoto, deleteImage }