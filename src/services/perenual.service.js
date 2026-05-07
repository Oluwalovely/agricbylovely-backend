import axios from 'axios'
import { env } from '../config/env.js'

// ─────────────────────────────────────────
// PERENUAL SERVICE
// Fetches plant data from Perenual API
// Best for: flowers, ornamental plants, vegetables
// Free tier: 300 requests/day
// Get your key at: https://perenual.com/docs/api
// ─────────────────────────────────────────

const PERENUAL_URL = 'https://perenual.com/api/species-list'

// Guesses crop category from its common name
const guessCategory = (name = '') => {
  const lower = name.toLowerCase()

  const vegetables = ['cucumber', 'tomato', 'pepper', 'spinach', 'lettuce', 'cabbage', 'broccoli', 'carrot', 'onion', 'garlic', 'eggplant', 'okra', 'squash', 'zucchini', 'pumpkin', 'kale', 'celery', 'artichoke', 'asparagus', 'chard']
  const fruits     = ['apple', 'mango', 'banana', 'orange', 'lemon', 'lime', 'grape', 'strawberry', 'watermelon', 'pineapple', 'papaya', 'pawpaw', 'guava', 'cherry', 'peach', 'pear', 'fig', 'avocado', 'passion']
  const grains     = ['wheat', 'rice', 'maize', 'corn', 'barley', 'oat', 'sorghum', 'millet', 'rye']
  const herbs      = ['mint', 'basil', 'rosemary', 'thyme', 'lavender', 'sage', 'parsley', 'cilantro', 'oregano', 'dill', 'chamomile', 'fennel']
  const tubers     = ['potato', 'yam', 'cassava', 'taro', 'ginger', 'turmeric', 'beetroot', 'radish', 'turnip']
  const legumes    = ['bean', 'pea', 'lentil', 'chickpea', 'soybean', 'groundnut', 'cowpea']

  if (vegetables.some(v => lower.includes(v))) return 'VEGETABLE'
  if (fruits.some(f => lower.includes(f)))     return 'FRUIT'
  if (grains.some(g => lower.includes(g)))     return 'GRAIN'
  if (herbs.some(h => lower.includes(h)))      return 'HERB'
  if (tubers.some(t => lower.includes(t)))     return 'TUBER'
  if (legumes.some(l => lower.includes(l)))    return 'LEGUME'

  return 'FLOWER' // default for ornamental plants
}

// Maps Perenual sunlight — handles both string and array
const mapSunlight = (sunlight) => {
  if (!sunlight) return 'FULL_SUN'

  const lower = Array.isArray(sunlight)
    ? sunlight.join(' ').toLowerCase()
    : sunlight.toLowerCase()

  if (lower.includes('part shade') || lower.includes('partial')) return 'PARTIAL_SUN'
  if (lower.includes('full shade')) return 'FULL_SHADE'
  return 'FULL_SUN'
}

// Maps Perenual watering string to mm per week
const mapWaterNeeds = (watering) => {
  if (!watering) return null
  const lower = watering.toLowerCase()
  if (lower === 'frequent')  return 70
  if (lower === 'average')   return 40
  if (lower === 'minimum')   return 20
  if (lower === 'none')      return 5
  return null
}

// Maps Perenual data to our database shape
const mapPerenualCrop = (item) => {
  return {
    name:             item.common_name || 'Unknown',
    botanicalName:    item.scientific_name?.[0] || null,
    category:         guessCategory(item.common_name),
    description:      null, // will be filled by AI gap filler
    imageUrl:         item.default_image?.regular_url || null,
    daysToHarvest:    null, // will be filled by AI gap filler
    plantingDepthCm:  null,
    spacingCm:        null,
    sunlight:         mapSunlight(item.sunlight),
    climateZone:      item.hardiness?.min || null,
    soilTypes:        [],
    companionPlants:  [],
    pestsAndDiseases: [],
    plantingMonths:   [], // will be filled by AI gap filler
    harvestMonths:    [],
    waterNeedsMm:     mapWaterNeeds(item.watering),
  }
}

// Main function — search Perenual for a plant by name
const searchPerenual = async (query) => {
  if (!env.PERENUAL_API_KEY) {
    console.log('Perenual API key not set — skipping')
    return []
  }

  try {
    const response = await axios.get(PERENUAL_URL, {
      params: {
        key: env.PERENUAL_API_KEY,
        q: query,
      },
      timeout: 8000,
    })

    const plants = response.data?.data || []
    console.log(`Perenual found: ${plants.length} results for "${query}"`)

    return plants
      .filter(item => item.common_name)
      .map(mapPerenualCrop)

  } catch (err) {
    console.error('Perenual API error:', err.message)
    return []
  }
}

export { searchPerenual }