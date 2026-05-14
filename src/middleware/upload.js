import multer from 'multer'


// Store files in memory as a Buffer
// We never save files to disk — they go straight to Cloudinary
const storage = multer.memoryStorage()

// Only allow image files
const fileFilter = (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']

    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true) // accept the file
    } else {
        cb(new Error('Only JPEG, PNG and WebP images are allowed'), false)
    }
}

// Max file size — 5MB
const limits = { fileSize: 5 * 1024 * 1024 }

const upload = multer({ storage, fileFilter, limits })


export const uploadSingle = upload.single('image') 


export const handleUploadError = (err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                success: false,
                message: 'Image is too large. Maximum size is 5MB',
            })
        }
        return res.status(400).json({ success: false, message: err.message })
    }

    if (err) {
        return res.status(400).json({ success: false, message: err.message })
    }

    next()
}