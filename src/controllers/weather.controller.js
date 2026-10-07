import prisma from '../config/prisma.js'
import { success, fail } from '../utils/response.js'
import { getWeatherForLocation } from '../services/weather.service.js'
import { syncWeatherNotifications } from '../services/notification.service.js'
async function farmWeather(req, res, next, alertsOnly = false) {
  try {
    const farmer = await prisma.farmer.findUnique({ where: { id: req.farmer.id }, select: { latitude: true, longitude: true } })
    if (farmer?.latitude == null || farmer?.longitude == null) return res.status(400).json({ ...fail('Add both farm coordinates in your profile to see local weather.'), code: 'LOCATION_REQUIRED' })
    const weather = await getWeatherForLocation(farmer.latitude, farmer.longitude)
    const notificationSync = await syncWeatherNotifications(req.farmer.id, weather, req.app?.get('io'))
    res.json(success(alertsOnly ? { alerts: weather.alerts, total: weather.alerts.length, notificationSync } : { weather, notificationSync }, 'Weather fetched successfully'))
  } catch (error) { next(error) }
}
export const getMyWeather = (req, res, next) => farmWeather(req, res, next)
export const getMyAlerts = (req, res, next) => farmWeather(req, res, next, true)
export const getWeatherByCoords = async (req, res, next) => {
  try {
    const weather = await getWeatherForLocation(Number(req.query.lat), Number(req.query.lon))
    res.json(success({ weather }, 'Weather fetched successfully'))
  } catch (error) { next(error) }
}
