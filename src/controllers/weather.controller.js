import prisma from '../config/prisma.js'
import { success, fail } from '../utils/response.js'
import { getWeatherForLocation } from '../services/weather.service.js'


const getMyWeather = async (req, res, next) => {
    try {
        // Get the farmer's saved location
        const farmer = await prisma.farmer.findUnique({
            where: { id: req.farmer.id },
            select: { latitude: true, longitude: true, state: true },
        })

        // If farmer has not set their location yet
        if (!farmer.latitude || !farmer.longitude) {
            return res.status(400).json(fail(
                'Please update your farm location first. Go to your profile and add your latitude and longitude.'
            ))
        }

        const weather = await getWeatherForLocation(farmer.latitude, farmer.longitude)

        res.json(success({ weather }, 'Weather fetched successfully'))
    } catch (err) {
        // If OpenWeatherMap is down or key is invalid
        if (err.response?.status === 401) {
            return res.status(500).json(fail('Weather service is not configured correctly. Please check the API key.'))
        }
        if (err.response?.status === 404) {
            return res.status(400).json(fail('Location not found. Please check your farm coordinates.'))
        }
        next(err)
    }
}


const getWeatherByCoords = async (req, res, next) => {
    try {
        const { lat, lon } = req.query

        if (!lat || !lon) {
            return res.status(400).json(fail('Please provide lat and lon query parameters'))
        }

        const latitude = parseFloat(lat)
        const longitude = parseFloat(lon)

        if (isNaN(latitude) || isNaN(longitude)) {
            return res.status(400).json(fail('Invalid coordinates — lat and lon must be numbers'))
        }

        const weather = await getWeatherForLocation(latitude, longitude)

        res.json(success({ weather }, 'Weather fetched successfully'))
    } catch (err) {
        if (err.response?.status === 401) {
            return res.status(500).json(fail('Weather service is not configured correctly'))
        }
        next(err)
    }
}


const getMyAlerts = async (req, res, next) => {
    try {
        const farmer = await prisma.farmer.findUnique({
            where: { id: req.farmer.id },
            select: { latitude: true, longitude: true },
        })

        if (!farmer.latitude || !farmer.longitude) {
            return res.json(success({ alerts: [] }, 'No location set'))
        }

        const weather = await getWeatherForLocation(farmer.latitude, farmer.longitude)

        res.json(success({
            alerts: weather.alerts,
            total: weather.alerts.length,
        }, 'Alerts fetched successfully'))
    } catch (err) {
        next(err)
    }
}

export { getMyWeather, getWeatherByCoords, getMyAlerts }