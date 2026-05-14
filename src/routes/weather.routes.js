import { Router } from 'express'
import { getMyWeather, getWeatherByCoords, getMyAlerts } from '../controllers/weather.controller.js'
import { authenticate } from '../middleware/auth.js'
import { weatherLimiter } from '../middleware/security.js'

const router = Router()

router.use(authenticate)
router.use(weatherLimiter)

router.get('/',       getMyWeather)       
router.get('/search', getWeatherByCoords) 
router.get('/alerts', getMyAlerts)        

export default router