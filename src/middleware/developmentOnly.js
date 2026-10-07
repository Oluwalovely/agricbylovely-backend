import { env } from '../config/env.js'
import { fail } from '../utils/response.js'

export const developmentOnly = (req, res, next) => {
  if (env.NODE_ENV !== 'development') {
    return res.status(403).json(fail('Manual jobs are disabled outside development'))
  }
  next()
}
