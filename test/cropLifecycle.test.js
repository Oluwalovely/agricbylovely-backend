import assert from 'node:assert/strict'
import { test } from 'node:test'
process.env.NODE_ENV = 'test'
process.env.DATABASE_URL = 'postgresql://test:test@127.0.0.1:1/test'
process.env.JWT_SECRET = 'test-secret'
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret'
const { cropUpdate, daysBetween } = await import('../src/utils/cropLifecycle.js')
const { updateCropSchema } = await import('../src/utils/validators.js')
const { default: prisma } = await import('../src/config/prisma.js')
const { updateMyCrop, removeMyCrop } = await import('../src/controllers/crop.controller.js')
const { getDashboard, getHarvestHistory, getFarmSummary } = await import('../src/controllers/report.controller.js')
const { getCalendarEvents, getUpcomingEvents } = await import('../src/services/calendar.service.js')
const now = new Date('2026-10-07T18:00:00Z')
const active = { id: 'record', plantedAt: new Date('2026-09-01T16:00:00Z'), harvestedAt: null, stage: 'GROWING', updatedAt: now }
const res = () => ({ code: 200, status(code) { this.code = code; return this }, json(body) { this.body = body } })
const next = error => { throw error }
test('harvesting saves stage/date/yield atomically, including zero and unknown yield', () => {
  const result = cropUpdate(active, { harvestedAt: '2026-10-07', yieldKg: 0, notes: '' }, now)
  assert.equal(result.stage, 'HARVESTED'); assert.equal(result.harvestedAt.toISOString(), '2026-10-07T00:00:00.000Z'); assert.equal(result.yieldKg, 0)
  assert.equal(cropUpdate(active, { stage: 'HARVESTED', harvestedAt: '2026-10-07', yieldKg: null }, now).yieldKg, null)
})
test('invalid lifecycle combinations are rejected before writing', () => {
  for (const body of [{ stage: 'HARVESTED' }, { yieldKg: 2 }, { stage: 'GROWING', harvestedAt: '2026-10-07' }, { harvestedAt: '2026-08-31' }, { harvestedAt: '2026-10-08' }]) assert.throws(() => cropUpdate(active, body, now), error => error.statusCode === 400)
})
test('harvest corrections retain completion and cannot reopen a planting', () => {
  const completed = { ...active, harvestedAt: new Date('2026-10-01') }
  assert.equal(cropUpdate(completed, { notes: 'Corrected', yieldKg: null }, now).stage, 'HARVESTED')
  assert.throws(() => cropUpdate(completed, { stage: 'READY' }, now), /cannot return/)
  assert.equal(cropUpdate(completed, { harvestedAt: '2026-10-02', yieldKg: 5 }, now).yieldKg, 5)
})
test('same-day harvest is allowed and day differences ignore time of day', () => {
  assert.equal(daysBetween('2026-09-01T23:59:00Z', '2026-09-01T00:00:00Z'), 0)
  assert.equal(cropUpdate(active, { harvestedAt: '2026-09-01' }, now).stage, 'HARVESTED')
})
test('update schema accepts blank-yield null and rejects negative yield', () => {
  const params = { id: '11111111-1111-4111-8111-111111111111' }
  assert.equal(updateCropSchema.safeParse({ params, body: { yieldKg: null } }).success, true)
  assert.equal(updateCropSchema.safeParse({ params, body: { yieldKg: -1 } }).success, false)
})
test('updates and removals reject foreign records and scope writes to their owner', async () => {
  prisma.farmerCrop.findFirst = async ({ where }) => { assert.equal(where.farmerId, 'owner'); return null }
  prisma.farmerCrop.update = async () => assert.fail('foreign write')
  prisma.farmerCrop.delete = async () => assert.fail('foreign deletion')
  for (const handler of [updateMyCrop, removeMyCrop]) { const response = res(); await handler({ params: { id: 'foreign' }, farmer: { id: 'owner' }, body: {} }, response, next); assert.equal(response.code, 404) }
  prisma.farmerCrop.findFirst = async () => active
  prisma.farmerCrop.update = async ({ where, data }) => { assert.equal(where.farmerId, 'owner'); assert.equal(where.updatedAt, now); assert.equal(data.stage, 'GROWING'); return data }
  await updateMyCrop({ params: { id: 'record' }, farmer: { id: 'owner' }, body: { stage: 'GROWING', notes: '' } }, res(), next)
})
test('dashboard totals count all active crops and unread notifications beyond display limits', async () => {
  prisma.farmer.findUnique = async () => ({ id: 'owner', latitude: null, longitude: null })
  prisma.farmerCrop.findMany = async ({ take }) => take ? Array.from({ length: 6 }, (_, i) => ({ id: String(i), crop: { name: 'Maize' }, plantedAt: '2099-01-01', expectedHarvestAt: '2099-04-01', stage: 'GROWING' })) : []
  prisma.farmerCrop.count = async () => 17
  prisma.field.findMany = async ({ select }) => { assert.equal(select._count.select.farmerCrops.where.harvestedAt, null); return [] }
  prisma.notification.findMany = async () => []
  prisma.notification.count = async () => 14
  prisma.job.groupBy = async () => []
  const response = res(); await getDashboard({ farmer: { id: 'owner' } }, response, next)
  assert.equal(response.body.stats.totalActiveCrops, 17); assert.equal(response.body.stats.unreadNotifications, 14); assert.equal(response.body.activeCrops.length, 6); assert.equal(response.body.activeCrops[0].progress, 0)
})
test('concurrent edits return a retryable conflict rather than overwriting a harvest', async () => {
  prisma.farmerCrop.findFirst = async () => active
  prisma.farmerCrop.update = async () => { throw Object.assign(new Error('No matching version'), { code: 'P2025' }) }
  let error
  await updateMyCrop({ params: { id: 'record' }, farmer: { id: 'owner' }, body: { stage: 'GROWING' } }, res(), value => { error = value })
  assert.equal(error.statusCode, 409)
  assert.match(error.message, /Refresh the list/)
})
test('harvest history yield covers all pages, not the displayed page', async () => {
  prisma.farmerCrop.findMany = async () => [{ id: 'record', crop: { name: 'Maize' }, plantedAt: '2026-09-01', harvestedAt: '2026-10-01', yieldKg: 2 }]
  prisma.farmerCrop.count = async () => 25
  prisma.farmerCrop.aggregate = async ({ where }) => { assert.equal(where.farmerId, 'owner'); assert.deepEqual(where.harvestedAt, { not: null }); return { _sum: { yieldKg: 200 } } }
  const response = res(); await getHarvestHistory({ farmer: { id: 'owner' }, query: { page: 2, limit: 12 } }, response, next)
  assert.equal(response.body.totalYieldKg, 200); assert.equal(response.body.pages, 3)
})
test('farm summary exposes recorded yield and harvest completion rather than agronomic success', async () => {
  prisma.farmerCrop.count = async ({ where }) => where.harvestedAt === null ? 7 : where.harvestedAt ? 3 : 10
  prisma.field.count = async () => 2
  prisma.farmerCrop.groupBy = async () => []
  prisma.farmerCrop.findMany = async () => []
  prisma.farmerCrop.aggregate = async () => ({ _sum: { yieldKg: 12.5 } })
  const response = res(); await getFarmSummary({ farmer: { id: 'owner' } }, response, next)
  assert.equal(response.body.summary.harvestCompletionRate, 30); assert.equal(response.body.summary.totalYieldKg, 12.5)
})
test('calendar uses actual completed harvest dates and treats today as due rather than overdue', async () => {
  prisma.farmerCrop.findMany = async () => [{ ...active, harvestedAt: '2026-10-07', expectedHarvestAt: '2026-12-01', crop: { name: 'Maize' } }]
  const events = await getCalendarEvents('owner', 10, 2026)
  assert.equal(events[0].harvest.date, '2026-10-07'); assert.equal(events[0].harvest.isHarvested, true)
  prisma.farmerCrop.findMany = async () => [{ ...active, expectedHarvestAt: new Date().toISOString().slice(0, 10), crop: { name: 'Maize' } }]
  const upcoming = await getUpcomingEvents('owner')
  assert.equal(upcoming[0].type, 'HARVEST'); assert.equal(upcoming[0].daysLeft, 0)
})
