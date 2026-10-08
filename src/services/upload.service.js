import { v2 as cloudinary } from 'cloudinary'
import { randomUUID } from 'node:crypto'
import { env } from '../config/env.js'
import '../config/cloudinary.js' // ensure cloudinary is configured


const uploadAvatar = async (fileBuffer, farmerId) => {
    if (![env.CLOUDINARY_CLOUD_NAME, env.CLOUDINARY_API_KEY, env.CLOUDINARY_API_SECRET].every(Boolean)) {
        const error = new Error('Photo uploads are temporarily unavailable. Please try again later.')
        error.statusCode = 503
        throw error
    }
    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
            {
                folder: 'agricbylovely/avatars',
                timeout: 20000,
                public_id: `farmer_${farmerId}_${randomUUID()}`, // fixed ID so it overwrites old avatar
                overwrite: false,
                transformation: [
                    { width: 300, height: 300, crop: 'fill', gravity: 'face' }, // square crop focused on face
                    { quality: 'auto', fetch_format: 'auto' },                   // auto optimize
                ],
            },
            (error, result) => {
                if (error) { const unavailable = new Error('Photo upload failed. Please try again.'); unavailable.statusCode = 502; reject(unavailable) }
                else resolve(result.secure_url) // return the HTTPS URL
            }
        )
        uploadStream.end(fileBuffer) // send the file buffer to Cloudinary
    })
}


const uploadFieldPhoto = async (fileBuffer, fieldId) => {
    if (![env.CLOUDINARY_CLOUD_NAME, env.CLOUDINARY_API_KEY, env.CLOUDINARY_API_SECRET].every(Boolean)) {
        const error = new Error('Photo uploads are temporarily unavailable. Please try again later.')
        error.statusCode = 503
        throw error
    }
    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
            {
                folder: 'agricbylovely/fields',
                timeout: 20000,
                public_id: `field_${fieldId}_${randomUUID()}`,
                transformation: [
                    { width: 800, height: 600, crop: 'fill' },
                    { quality: 'auto', fetch_format: 'auto' },
                ],
            },
            (error, result) => {
                if (error) { const unavailable = new Error('Photo upload failed. Please try again.'); unavailable.statusCode = 502; reject(unavailable) }
                else resolve(result.secure_url)
            }
        )
        uploadStream.end(fileBuffer)
    })
}


const uploadCropPhoto = async (fileBuffer, farmerCropId) => {
    if (![env.CLOUDINARY_CLOUD_NAME, env.CLOUDINARY_API_KEY, env.CLOUDINARY_API_SECRET].every(Boolean)) {
        const error = new Error('Photo uploads are temporarily unavailable. Please try again later.')
        error.statusCode = 503
        throw error
    }
    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
            {
                folder: 'agricbylovely/crops',
                timeout: 20000,
                public_id: `crop_${farmerCropId}_${randomUUID()}`,
                transformation: [
                    { width: 800, height: 600, crop: 'fill' },
                    { quality: 'auto', fetch_format: 'auto' },
                ],
            },
            (error, result) => {
                if (error) { const unavailable = new Error('Photo upload failed. Please try again.'); unavailable.statusCode = 502; reject(unavailable) }
                else resolve(result.secure_url)
            }
        )
        uploadStream.end(fileBuffer)
    })
}


const deleteImage = async (imageUrl) => {
    try {
        // Extract the public_id from the URL
        // e.g. https://res.cloudinary.com/cloud/image/upload/v123/agricbylovely/avatars/farmer_abc
        // public_id = agricbylovely/avatars/farmer_abc
        const url = new URL(imageUrl)
        if (url.hostname !== 'res.cloudinary.com') return
        const prefix = `/${env.CLOUDINARY_CLOUD_NAME}/image/upload/`
        if (!url.pathname.startsWith(prefix)) return
        const publicId = url.pathname.slice(prefix.length).replace(/^v\d+\//, '').replace(/\.[^/.]+$/, '')
        if (!publicId.startsWith('agricbylovely/')) return

        await cloudinary.uploader.destroy(publicId)
        console.log(`Deleted image: ${publicId}`)
    } catch (err) {
        // Fail silently — image deletion is not critical
        console.error('Failed to delete image from Cloudinary:', err.message)
    }
}

export { uploadAvatar, uploadFieldPhoto, uploadCropPhoto, deleteImage }
