import rateLimit from 'express-rate-limit'
import jwt from 'jsonwebtoken'
import { env } from '../config/env.js'

const common = {
  windowMs: 15 * 60 * 1000,
  standardHeaders: true,
  legacyHeaders: false,
  handler(req, res) {
    const retryAfterSeconds = Math.max(1, Math.ceil((req.rateLimit.resetTime.getTime() - Date.now()) / 1000))
    res.status(429).json({ success: false, message: `Too many requests. Please wait ${retryAfterSeconds} seconds before trying again.`, retryAfterSeconds })
  },
}

// Verify the signature before choosing an account bucket. Untrusted/expired
// tokens cannot invent identities to bypass anonymous request limits.
export function rateLimitFarmer(req) {
  const match = req.headers.authorization?.match(/^Bearer (.+)$/)
  if (!match) return null
  try {
    const claims = jwt.verify(match[1], env.JWT_SECRET)
    return typeof claims.farmerId === 'string' && claims.farmerId.length > 0 && Number.isFinite(claims.exp) ? claims.farmerId : null
  } catch { return null }
}

const signedIn = rateLimit({ ...common, max: 600, keyGenerator: req => `farmer:${req.rateLimitFarmerId}` })
const anonymous = rateLimit({ ...common, max: 200 })

export function apiLimiter(req, res, next) {
  if (req.method === 'GET' && ['/api/health', '/api/health/live'].includes(req.path)) return next()
  req.rateLimitFarmerId = rateLimitFarmer(req)
  return req.rateLimitFarmerId ? signedIn(req, res, next) : anonymous(req, res, next)
}
