import axios from 'axios'
import prisma from '../config/prisma.js'
import { env } from '../config/env.js'

// ─────────────────────────────────────────
// WEATHER SERVICE
// Fetches weather data from OpenWeatherMap
// Caches results in the database for 1 hour
// ─────────────────────────────────────────

const BASE_URL = 'https://api.openweathermap.org/data/2.5'

// ── Cache check ───────────────────────────
const getCachedWeather = async (latitude, longitude) => {
    const snapshot = await prisma.weatherSnapshot.findUnique({
        where: { latitude_longitude: { latitude, longitude } }
    })
    if (!snapshot) return null
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
    if (snapshot.fetchedAt < oneHourAgo) return null
    return snapshot.data
}

// ── Save to cache ─────────────────────────
const saveToCache = async (latitude, longitude, data) => {
    await prisma.weatherSnapshot.upsert({
        where: { latitude_longitude: { latitude, longitude } },
        update: { data, fetchedAt: new Date() },
        create: { latitude, longitude, data },
    })
}

// ── Fetch current weather ─────────────────
const fetchCurrentWeather = async (latitude, longitude) => {
    const response = await axios.get(`${BASE_URL}/weather`, {
        params: { lat: latitude, lon: longitude, appid: env.OPENWEATHER_API_KEY, units: 'metric' },
        timeout: 8000,
    })
    return response.data
}

// ── Fetch 5-day forecast ──────────────────
const fetchForecast = async (latitude, longitude) => {
    const response = await axios.get(`${BASE_URL}/forecast`, {
        params: { lat: latitude, lon: longitude, appid: env.OPENWEATHER_API_KEY, units: 'metric' },
        timeout: 8000,
    })
    return response.data
}

// ── Format forecast into daily summaries ──
const formatDailyForecast = (forecastData) => {
    const days = {}

    forecastData.list.forEach(item => {
        const date = item.dt_txt.split(' ')[0]
        if (!days[date]) {
            days[date] = {
                date,
                temps: [],
                humidity: [],
                description: item.weather[0].description,
                icon: item.weather[0].icon,
                windSpeed: item.wind.speed,
                rainfall: 0,
            }
        }
        days[date].temps.push(item.main.temp)
        days[date].humidity.push(item.main.humidity)
        if (item.rain?.['3h']) days[date].rainfall += item.rain['3h']
    })

    return Object.values(days).map(day => ({
        date: day.date,
        tempMin: Math.round(Math.min(...day.temps)),
        tempMax: Math.round(Math.max(...day.temps)),
        humidity: Math.round(day.humidity.reduce((a, b) => a + b) / day.humidity.length),
        description: day.description,
        icon: day.icon,
        windSpeed: day.windSpeed,
        rainfallMm: parseFloat(day.rainfall.toFixed(1)),
    }))
}

// ─────────────────────────────────────────
// DETECT FARMING ZONE FROM COORDINATES
// Nigeria has 4 agro-ecological zones
// Each has different planting seasons and crops
// ─────────────────────────────────────────
const getFarmingZone = (latitude) => {
    if (latitude < 5.5) return 'SOUTH_SOUTH'    // Rivers, Delta, Bayelsa, Cross River, Akwa Ibom
    if (latitude < 7.5) return 'SOUTH_WEST_EAST' // Lagos, Ogun, Oyo, Imo, Anambra, Enugu
    if (latitude < 9.5) return 'MIDDLE_BELT'     // Benue, Kogi, Plateau, Nassarawa, Niger
    return 'FAR_NORTH'                            // Kano, Sokoto, Zamfara, Kebbi, Borno
}

// Human-readable zone names for alert messages
const ZONE_NAMES = {
    SOUTH_SOUTH: 'South-South (Niger Delta)',
    SOUTH_WEST_EAST: 'South-West / South-East',
    MIDDLE_BELT: 'Middle Belt',
    FAR_NORTH: 'Far North',
}

// ─────────────────────────────────────────
// NIGERIAN FARMING ALERTS
// Rules based on Nigerian climate, crop
// conditions and zone-specific seasons
// ─────────────────────────────────────────
const generateWeatherAlerts = (current, forecast, latitude) => {
    const alerts = []
    const temp = current.main.temp
    const humidity = current.main.humidity
    const wind = current.wind.speed
    const month = new Date().getMonth() + 1 // 1=Jan, 12=Dec
    const zone = getFarmingZone(latitude)
    const zoneName = ZONE_NAMES[zone]

    // ── TEMPERATURE ALERTS ───────────────────

    if (temp > 38) {
        alerts.push({
            type: 'WEATHER',
            title: 'Extreme Heat Warning',
            message: `Temperature is ${Math.round(temp)}°C. Water your crops immediately, especially tomatoes, peppers and leafy vegetables. Consider providing shade for seedlings.`,
        })
    }

    if (temp >= 35 && temp <= 38) {
        alerts.push({
            type: 'WEATHER',
            title: 'Heat Stress Alert',
            message: `Temperature is ${Math.round(temp)}°C. Maize and tomato pollination may be affected. Water crops early morning and evening to reduce heat stress.`,
        })
    }

    if (temp < 15) {
        alerts.push({
            type: 'WEATHER',
            title: 'Cold Temperature Alert',
            message: `Temperature has dropped to ${Math.round(temp)}°C. Cover seedlings and young plants overnight. Cassava and yam are especially vulnerable to cold stress.`,
        })
    }

    // ── HUMIDITY ALERTS ──────────────────────

    if (humidity > 85) {
        alerts.push({
            type: 'PEST',
            title: 'High Fungal Risk',
            message: `Humidity is at ${humidity}%. High risk of fungal diseases on tomatoes, peppers and leafy vegetables. Apply preventive fungicide and ensure good air circulation between plants.`,
        })
    }

    // ── HARMATTAN ALERTS ─────────────────────
    // November to March — dry dusty winds from the Sahara
    // Affects the north more severely than the south

    if (humidity < 20 && temp > 30) {
        alerts.push({
            type: 'WEATHER',
            title: 'Severe Harmattan Conditions',
            message: `Extreme dry conditions — humidity at ${humidity}%. Increase irrigation immediately. Mulch around crop bases to retain soil moisture. Protect young seedlings from dust and desiccation.`,
        })
    }

    if (humidity >= 20 && humidity < 35 && [11, 12, 1, 2, 3].includes(month)) {
        alerts.push({
            type: 'WEATHER',
            title: 'Harmattan Season Advisory',
            message: `Harmattan dry winds are active in your area. Humidity at ${humidity}%. Water crops more frequently, especially cassava, yam and vegetables. Apply mulch to conserve soil moisture.`,
        })
    }

    // ── RAINFALL ALERTS ──────────────────────

    forecast.forEach(day => {
        if (day.rainfallMm > 30) {
            alerts.push({
                type: 'WEATHER',
                title: 'Heavy Rainfall Warning',
                message: `Very heavy rain of ${day.rainfallMm}mm expected on ${day.date}. Check field drainage to prevent waterlogging. Avoid applying fertiliser or pesticide before rain as it will wash away.`,
            })
        } else if (day.rainfallMm > 15) {
            alerts.push({
                type: 'WEATHER',
                title: 'Moderate Rainfall Expected',
                message: `Rainfall of ${day.rainfallMm}mm expected on ${day.date}. Good opportunity to plant or transplant seedlings after the rain. Ensure drainage channels are clear.`,
            })
        }
    })

    // ── ZONE-BASED PLANTING SEASON ALERTS ────

    // ── SOUTH-SOUTH (Niger Delta) ─────────────
    // Rain almost year round — two planting peaks
    if (zone === 'SOUTH_SOUTH') {
        if (month === 2) {
            alerts.push({
                type: 'PLANTING',
                title: 'Planting Season Starting — Niger Delta',
                message: `February marks the start of the first planting season in the ${zoneName} region. Begin preparing your fields for cassava, cocoyam, plantain, vegetables and yam. Rains will intensify from March.`,
            })
        }
        if (month === 3) {
            alerts.push({
                type: 'PLANTING',
                title: 'Peak Planting Time — Niger Delta',
                message: `March is the ideal planting month for the ${zoneName} region. Plant cassava, cocoyam, plantain, ugwu, waterleaf and yam now. Soil moisture is optimal.`,
            })
        }
        if (month === 7) {
            alerts.push({
                type: 'PLANTING',
                title: 'Second Planting Season — Niger Delta',
                message: `July marks the start of the second planting season in the ${zoneName} region. Plant quick-maturing vegetables, maize, cowpea and watermelon before August rains peak.`,
            })
        }
        if (month === 11) {
            alerts.push({
                type: 'HARVEST',
                title: 'Harvest and Dry Season Prep — Niger Delta',
                message: `November signals the short dry season in the ${zoneName} region. Harvest mature crops and prepare storage. Irrigate crops still in the field.`,
            })
        }
    }

    // ── SOUTH-WEST / SOUTH-EAST ───────────────
    // Two distinct rainy seasons
    if (zone === 'SOUTH_WEST_EAST') {
        if (month === 3) {
            alerts.push({
                type: 'PLANTING',
                title: 'First Planting Season — South-West / South-East',
                message: `March marks the beginning of the first planting season in the ${zoneName} region. Plant maize, tomato, pepper, okra, cassava and yam now. Prepare beds and nurseries immediately.`,
            })
        }
        if (month === 4) {
            alerts.push({
                type: 'PLANTING',
                title: 'Peak First Season — South-West / South-East',
                message: `April is peak planting time for the ${zoneName} region. Transplant tomato and pepper seedlings. Direct sow maize, cowpea and okra. Rains are consistent now.`,
            })
        }
        if (month === 7) {
            alerts.push({
                type: 'WEATHER',
                title: 'August Break Approaching',
                message: `The August break (short dry spell) typically occurs in the ${zoneName} region between late July and August. Irrigate crops and prepare for the second planting season in August-September.`,
            })
        }
        if (month === 8) {
            alerts.push({
                type: 'PLANTING',
                title: 'Second Planting Season — South-West / South-East',
                message: `August marks the second planting season in the ${zoneName} region. Plant quick-maturing maize, vegetables, cowpea, watermelon and leafy greens before October when rains end.`,
            })
        }
        if (month === 9) {
            alerts.push({
                type: 'PLANTING',
                title: 'Late Second Season — South-West / South-East',
                message: `September is the last chance to plant quick-maturing crops in the ${zoneName} region. Focus on vegetables, leafy greens and 60-day maize varieties. Rains will end by October.`,
            })
        }
        if (month === 10) {
            alerts.push({
                type: 'HARVEST',
                title: 'Harvest Season — South-West / South-East',
                message: `October marks the end of rains in the ${zoneName} region. Begin harvesting mature crops. Store cassava, yam and grains in a cool dry place. Dry season farming will require irrigation.`,
            })
        }
    }

    // ── MIDDLE BELT ───────────────────────────
    // One long rainy season — April to October
    if (zone === 'MIDDLE_BELT') {
        if (month === 4) {
            alerts.push({
                type: 'PLANTING',
                title: 'Planting Season Starting — Middle Belt',
                message: `April marks the beginning of the planting season in the ${zoneName} region. Start planting yam, maize, soybeans and sorghum. Early rains are arriving — prepare your fields.`,
            })
        }
        if (month === 5) {
            alerts.push({
                type: 'PLANTING',
                title: 'Peak Planting Time — Middle Belt',
                message: `May is the ideal planting month for the ${zoneName} region. Plant maize, soybeans, sesame, ginger, rice and cowpea. Rains are consistent and reliable now.`,
            })
        }
        if (month === 6) {
            alerts.push({
                type: 'PLANTING',
                title: 'Last Planting Window — Middle Belt',
                message: `June is the last reliable planting window in the ${zoneName} region for most crops. Quick-maturing varieties of maize and cowpea can still be planted now.`,
            })
        }
        if (month === 10) {
            alerts.push({
                type: 'HARVEST',
                title: 'Harvest Season — Middle Belt',
                message: `October is peak harvest season in the ${zoneName} region. Harvest soybeans, sesame, maize and sorghum before the dry season sets in. Begin drying and storing produce.`,
            })
        }
        if (month === 11) {
            alerts.push({
                type: 'HARVEST',
                title: 'Dry Season Begins — Middle Belt',
                message: `November marks the start of the dry season in the ${zoneName} region. Complete all harvesting and prepare irrigation systems for dry season farming along riverbanks (fadama).`,
            })
        }
    }

    // ── FAR NORTH ─────────────────────────────
    // One short rainy season — May/June to September
    // Dry season farming (fadama) possible near rivers
    if (zone === 'FAR_NORTH') {
        if (month === 5) {
            alerts.push({
                type: 'PLANTING',
                title: 'Rainy Season Starting — Far North',
                message: `May marks the beginning of the rainy season in the ${zoneName} region. Start planting millet, sorghum, groundnut and cowpea as soon as rains are established. Do not plant too early on dry soil.`,
            })
        }
        if (month === 6) {
            alerts.push({
                type: 'PLANTING',
                title: 'Peak Planting — Far North',
                message: `June is peak planting time in the ${zoneName} region. Plant millet, sorghum, groundnut, cowpea and cotton now. Rains are more reliable. Also good time for onion seedling nurseries.`,
            })
        }
        if (month === 7) {
            alerts.push({
                type: 'PLANTING',
                title: 'Last Planting Window — Far North',
                message: `July is the last planting window for most crops in the ${zoneName} region. Quick-maturing millet and cowpea varieties can still be planted. Focus remaining efforts on weeding and fertilising.`,
            })
        }
        if (month === 9) {
            alerts.push({
                type: 'HARVEST',
                title: 'Early Harvest — Far North',
                message: `September marks the beginning of harvest for early-maturing crops in the ${zoneName} region. Start harvesting millet and cowpea. Prepare storage facilities and drying areas.`,
            })
        }
        if (month === 10) {
            alerts.push({
                type: 'HARVEST',
                title: 'Main Harvest Season — Far North',
                message: `October is peak harvest season in the ${zoneName} region. Harvest sorghum, groundnut and cotton. Dry season farming (fadama) along rivers can begin for onion, tomato and vegetables.`,
            })
        }
        if ([11, 12, 1, 2].includes(month)) {
            alerts.push({
                type: 'PLANTING',
                title: 'Fadama Dry Season Farming — Far North',
                message: `The dry season is an opportunity for irrigated fadama farming in the ${zoneName} region. Plant onions, tomatoes, pepper, wheat and vegetables along riverbanks and lowland areas with irrigation.`,
            })
        }
    }

    // ── WIND ALERTS ──────────────────────────

    if (wind > 10) {
        alerts.push({
            type: 'WEATHER',
            title: 'Strong Winds',
            message: `Wind speed is ${wind}m/s. Stake tall crops like maize, sorghum and tomatoes to prevent lodging. Strong winds can damage flowers and reduce pollination.`,
        })
    }

    if (wind > 7 && humidity < 30 && [11, 12, 1, 2, 3].includes(month)) {
        alerts.push({
            type: 'WEATHER',
            title: 'Dust Storm Risk',
            message: `Dry winds of ${wind}m/s detected during harmattan season. Risk of dust storms. Cover seedling trays and irrigation equipment. Check water sources for dust contamination.`,
        })
    }

    // ── PEST RISK ALERTS ─────────────────────

    // Fall armyworm — peak risk in warm humid conditions
    if (temp > 25 && humidity > 60 && [4, 5, 6, 7, 8, 9].includes(month)) {
        alerts.push({
            type: 'PEST',
            title: 'Fall Armyworm Risk',
            message: `Warm and humid conditions increase fall armyworm activity. Inspect maize leaves early morning for egg masses and feeding damage. Apply recommended pesticide at first sign of infestation.`,
        })
    }

    // Aphid risk — dry conditions with moderate temperatures
    if (humidity < 50 && temp > 25 && temp < 35) {
        alerts.push({
            type: 'PEST',
            title: 'Aphid Activity Alert',
            message: `Dry and warm conditions favour aphid population growth. Check the underside of leaves on tomatoes, peppers and cowpea. Aphids spread plant viruses — act quickly at first sighting.`,
        })
    }

    // Whitefly risk — hot dry conditions
    if (temp > 32 && humidity < 45) {
        alerts.push({
            type: 'PEST',
            title: 'Whitefly Risk',
            message: `Hot dry conditions are ideal for whitefly outbreaks. Check tomato, cassava and pepper plants for white insects under the leaves. Whitefly transmits cassava mosaic disease.`,
        })
    }

    return alerts
}

// ── Main function ─────────────────────────
const getWeatherForLocation = async (latitude, longitude) => {
    const lat = parseFloat(latitude.toFixed(2))
    const lon = parseFloat(longitude.toFixed(2))

    const cached = await getCachedWeather(lat, lon)
    if (cached) {
        console.log(`Weather served from cache for (${lat}, ${lon})`)
        return cached
    }

    console.log(`Fetching fresh weather for (${lat}, ${lon})...`)

    const [current, forecastData] = await Promise.all([
        fetchCurrentWeather(lat, lon),
        fetchForecast(lat, lon),
    ])

    const forecast = formatDailyForecast(forecastData)
    const alerts = generateWeatherAlerts(current, forecast, lat)

    const weatherData = {
        location: {
            name: current.name,
            country: current.sys.country,
            latitude: lat,
            longitude: lon,
            zone: getFarmingZone(lat),    // include zone in response
            zoneName: ZONE_NAMES[getFarmingZone(lat)],
        },
        current: {
            temp: Math.round(current.main.temp),
            feelsLike: Math.round(current.main.feels_like),
            humidity: current.main.humidity,
            description: current.weather[0].description,
            icon: current.weather[0].icon,
            windSpeed: current.wind.speed,
            visibility: current.visibility,
            pressure: current.main.pressure,
        },
        forecast,
        alerts,
        fetchedAt: new Date().toISOString(),
    }

    await saveToCache(lat, lon, weatherData)

    return weatherData
}

export { getWeatherForLocation, generateWeatherAlerts, getFarmingZone }