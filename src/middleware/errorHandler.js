class AppError extends Error {
  constructor(message, statusCode = 500) {
    super(message)
    this.statusCode = statusCode
    this.isOperational = true 
  }
}

const notFound = (req, res, next) => {
  next(new AppError(`Route ${req.originalUrl} not found`, 404))
}

const errorHandler = (err, req, res, next) => {
  let message = err.message || 'Something went wrong'
  let statusCode = err.statusCode || 500

  

  
  if (err.code === 'P2002') {
    const field = err.meta?.target?.[0] || 'field'
    message = `A record with this ${field} already exists`
    statusCode = 409
  }

  // Record not found — e.g. farmer with that id does not exist
  if (err.code === 'P2025') {
    message = 'Record not found'
    statusCode = 404
  }

  // Foreign key constraint — e.g. linking to a field that does not exist
  if (err.code === 'P2003') {
    message = 'Related record not found'
    statusCode = 400
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError')  {
    message = 'Invalid token'
    statusCode = 401
  }

  if (err.name === 'TokenExpiredError') {
    message = 'Token has expired'
    statusCode = 401
  }

  // Zod validation errors
  if (err.name === 'ZodError') {
    message = 'Validation failed'
    statusCode = 400
  }

  // In development, also send the full error stack
  // so we can debug easily
  const isDev = process.env.NODE_ENV === 'development'

  res.status(statusCode).json({
    success: false,
    message,
    ...(isDev && { stack: err.stack }),
  })
}

export { AppError, notFound, errorHandler }