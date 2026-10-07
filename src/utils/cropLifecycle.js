import { AppError } from '../middleware/errorHandler.js'

export const dayNumber = value => Math.floor(new Date(value).getTime() / 86400000)
export const daysBetween = (start, end) => dayNumber(end) - dayNumber(start)

export function cropUpdate(existing, body, now = new Date()) {
  const wasHarvested = existing.harvestedAt != null
  const harvesting = wasHarvested || body.stage === 'HARVESTED' || body.harvestedAt !== undefined
  if (harvesting && body.stage !== undefined && body.stage !== 'HARVESTED') {
    throw new AppError(wasHarvested ? 'A harvested planting cannot return to an active growth stage. Record a new planting for the next cycle.' : 'A harvest date must be saved with the Harvested stage.', 400)
  }
  const data = {}
  if (body.notes !== undefined) data.notes = body.notes
  if (body.stage !== undefined) data.stage = body.stage
  if (harvesting) {
    const date = body.harvestedAt !== undefined ? new Date(body.harvestedAt) : existing.harvestedAt
    if (!date) throw new AppError('Choose a harvest date to complete this planting.', 400)
    if (dayNumber(date) < dayNumber(existing.plantedAt)) throw new AppError('Harvest date cannot be before the planting date.', 400)
    if (dayNumber(date) > dayNumber(now)) throw new AppError('Harvest date cannot be in the future.', 400)
    data.stage = 'HARVESTED'
    data.harvestedAt = date
    if (body.yieldKg !== undefined) data.yieldKg = body.yieldKg
  } else if (body.yieldKg !== undefined) {
    throw new AppError('Record a harvest before saving its yield.', 400)
  }
  return data
}
