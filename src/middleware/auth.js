import jwt from 'jsonwebtoken'
import prisma from '../config/prisma.js'
import { env } from '../config/env.js'
import { fail } from '../utils/response.js'

// ─────────────────────────────────────────
// AUTHENTICATE MIDDLEWARE
// Protects routes that require a logged-in farmer
// Add this to any route that should be private
//
// Usage: router.get('/me', authenticate, getProfile)
// ─────────────────────────────────────────
export const authenticate = async (req, res, next) => {
  try {
    // Get the token from the Authorization header
    // Frontend sends: Authorization: Bearer <token>
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json(fail('Access token is required'))
    }

    // Extract just the token part after "Bearer "
    const token = authHeader.split(' ')[1]

    // Verify the token is valid and not expired
    const decoded = jwt.verify(token, env.JWT_SECRET)

    // Find the farmer in the database to make sure they still exist
    const farmer = await prisma.farmer.findUnique({
      where: { id: decoded.farmerId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        farmName: true,
      },
    })

    if (!farmer) {
      return res.status(401).json(fail('Farmer account not found'))
    }

    // Attach farmer to the request so route handlers can use it
    // e.g. req.farmer.id, req.farmer.email
    req.farmer = farmer

    next() // move to the actual route handler
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json(fail('Access token has expired'))
    }
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json(fail('Invalid access token'))
    }
    next(err)
  }
}