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

export const verifyImage = (req, res, next) => {
    if (!req.file) return next()
    const buffer = req.file.buffer
    const jpeg = buffer.length >= 3 && buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255
    const png = buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))
    const webp = buffer.length >= 12 && buffer.toString('ascii',0,4) === 'RIFF' && buffer.toString('ascii',8,12) === 'WEBP'
    const matches = ({ 'image/jpeg': jpeg, 'image/jpg': jpeg, 'image/png': png, 'image/webp': webp })[req.file.mimetype]
    if (!matches) return res.status(400).json({ success: false, message: 'Choose a valid JPEG, PNG or WebP image.' })
    next()
}


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
