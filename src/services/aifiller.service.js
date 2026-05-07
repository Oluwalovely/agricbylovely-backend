import axios from 'axios'
import prisma from '../config/prisma.js'
import { env } from '../config/env.js'

// ─────────────────────────────────────────
// AI GAP FILLER SERVICE
// When a crop is saved from Perenual with null fields,
// this service calls the Claude API to fill in the
// missing farming details automatically
// ─────────────────────────────────────────

const fillCropDetails = async (crop) => {
    // Only run if important fields are missing
    const needsFilling = !crop.daysToHarvest ||
        !crop.description ||
        crop.plantingMonths.length === 0

    if (!needsFilling) {
        console.log(`${crop.name} already has full details — skipping AI fill`)
        return crop
    }

    console.log(`Filling missing details for "${crop.name}" using AI...`)

    try {
        const response = await axios.post(
            'https://api.anthropic.com/v1/messages',
            {
                model: 'claude-sonnet-4-5',
                max_tokens: 1000,
                messages: [
                    {
                        role: 'user',
                        content: `You are an agricultural expert. Give me practical farming details for this crop:

Crop name: ${crop.name}
Botanical name: ${crop.botanicalName || 'unknown'}
Category: ${crop.category}

Return ONLY a valid JSON object with these exact fields, no explanation, no markdown:
{
  "description": "2-3 sentence practical growing guide for Nigerian farmers",
  "daysToHarvest": number or null,
  "plantingDepthCm": number or null,
  "spacingCm": number or null,
  "waterNeedsMm": number per week or null,
  "climateZone": "Tropical" or "Semi-arid" or "Temperate" or null,
  "soilTypes": array of these values only: ["CLAY","SANDY","LOAMY","SILTY","PEATY","CHALKY"],
  "companionPlants": array of common crop names,
  "pestsAndDiseases": array of common threats,
  "plantingMonths": array of month numbers 1-12 best for Nigeria,
  "harvestMonths": array of month numbers 1-12 for Nigeria
}`
                    }
                ]
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'anthropic-version': '2023-06-01',
                    'x-api-key': env.ANTHROPIC_API_KEY,
                },
                timeout: 15000,
            }
        )

        // Extract the text response from Claude
        const text = response.data?.content?.[0]?.text
        if (!text) {
            console.log('AI returned empty response')
            return crop
        }

        // Parse the JSON response
        const details = JSON.parse(text.trim())

        // Update the crop in the database with the AI-generated details
        const updated = await prisma.crop.update({
            where: { id: crop.id },
            data: {
                description: details.description || crop.description,
                daysToHarvest: details.daysToHarvest || crop.daysToHarvest,
                plantingDepthCm: details.plantingDepthCm || crop.plantingDepthCm,
                spacingCm: details.spacingCm || crop.spacingCm,
                waterNeedsMm: details.waterNeedsMm || crop.waterNeedsMm,
                climateZone: details.climateZone || crop.climateZone,
                soilTypes: details.soilTypes?.length > 0 ? details.soilTypes : crop.soilTypes,
                companionPlants: details.companionPlants?.length > 0 ? details.companionPlants : crop.companionPlants,
                pestsAndDiseases: details.pestsAndDiseases?.length > 0 ? details.pestsAndDiseases : crop.pestsAndDiseases,
                plantingMonths: details.plantingMonths?.length > 0 ? details.plantingMonths : crop.plantingMonths,
                harvestMonths: details.harvestMonths?.length > 0 ? details.harvestMonths : crop.harvestMonths,
            },
        })

        console.log(`AI details filled successfully for "${crop.name}"`)
        return updated

    } catch (err) {
        // Log full error details so we can see exactly what Anthropic rejected
        console.error(`AI gap fill failed for "${crop.name}":`, err.message)
        console.error('Full error:', JSON.stringify(err.response?.data, null, 2))
        return crop
    }
}

export { fillCropDetails }