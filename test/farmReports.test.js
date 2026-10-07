import assert from 'node:assert/strict'
import { test } from 'node:test'
process.env.NODE_ENV = 'test'
process.env.DATABASE_URL = 'postgresql://test:test@127.0.0.1:1/test'
process.env.JWT_SECRET = 'test-secret'
process.env.JWT_REFRESH_SECRET = 'test-refresh'
const { default: prisma } = await import('../src/config/prisma.js')
const { getMonthlySummary, getCalendarEvents, getUpcomingEvents } = await import('../src/services/calendar.service.js')
const { calendarQuerySchema } = await import('../src/utils/validators.js')
const { getHarvestHistory } = await import('../src/controllers/report.controller.js')
const base = { crop: { name: 'Maize' }, stage: 'GROWING', field: null, notes: null }
test('annual counts separate completed harvests and active estimates, with recorded yield', async () => {
  prisma.farmerCrop.findMany = async ({ where }) => { assert.equal(where.farmerId, 'owner'); return [
    { ...base, id: 'completed', plantedAt: '2026-01-01', expectedHarvestAt: '2026-03-01', harvestedAt: '2026-02-01', yieldKg: 12.5 },
    { ...base, id: 'estimated', plantedAt: '2026-01-02', expectedHarvestAt: '2026-03-02', harvestedAt: null },
    { ...base, id: 'unknown', plantedAt: '2026-01-03', harvestedAt: '2026-02-03', yieldKg: null },
    { ...base, id: 'zero', plantedAt: '2026-01-04', harvestedAt: '2026-02-04', yieldKg: 0 },
  ] }
  const months = await getMonthlySummary('owner', 2026)
  assert.equal(months.length, 12); assert.equal(months[0].plantings, 4)
  assert.equal(months[1].harvests, 3); assert.equal(months[1].yieldKg, 12.5); assert.equal(months[1].recordedYieldCount, 2)
  assert.equal(months[2].harvests, 0); assert.equal(months[2].plannedHarvests, 1)
  assert.equal(months[2].crops[0].event, 'estimated-harvest')
})
test('year boundaries use actual harvest years and do not repeat old estimates', async () => {
  prisma.farmerCrop.findMany = async () => [{ ...base, id: 'cross-year', plantedAt: '2025-12-31T23:59:00Z', expectedHarvestAt: '2026-03-01', harvestedAt: '2026-01-01', yieldKg: 4 }]
  const old = await getMonthlySummary('owner', 2025), current = await getMonthlySummary('owner', 2026)
  assert.equal(old[11].plantings, 1); assert.equal(current[0].harvests, 1)
  assert.equal(current[2].plannedHarvests, 0); assert.equal(current[2].harvests, 0)
})
test('calendar keeps active crops visible with unknown or overdue estimates and includes final-day plantings', async () => {
  prisma.farmerCrop.findMany = async () => [
    { ...base, id: 'unknown', plantedAt: '2026-01-01', harvestedAt: null, expectedHarvestAt: null },
    { ...base, id: 'overdue', plantedAt: '2026-01-01', harvestedAt: null, expectedHarvestAt: '2026-02-01' },
    { ...base, id: 'late', plantedAt: '2026-10-31T23:59:59Z', harvestedAt: null },
    { ...base, id: 'completed-earlier', plantedAt: '2026-01-01', harvestedAt: '2026-02-01' },
    { ...base, id: 'not-started', plantedAt: '2026-11-01', harvestedAt: null },
  ]
  const events = await getCalendarEvents('owner', 10, 2026)
  assert.deepEqual(events.map(event => event.id), ['unknown', 'overdue', 'late'])
})
test('upcoming service scopes active records and includes overdue plus due-today estimates', async () => {
  const today = new Date().toISOString().slice(0, 10)
  const offset = days => new Date(new Date(`${today}T00:00:00Z`).getTime() + days * 86400000).toISOString()
  prisma.farmerCrop.findMany = async ({ where }) => { assert.deepEqual(where, { farmerId: 'owner', harvestedAt: null }); return [-2, 0, 30, 31].map(day => ({ ...base, id: String(day), expectedHarvestAt: offset(day) })) }
  const events = await getUpcomingEvents('owner', 30)
  assert.deepEqual(events.map(event => event.daysLeft), [-2, 0, 30]); assert.equal(events[0].type, 'OVERDUE')
})
test('invalid calendar query bounds and missing year return validation failures', () => {
  for (const query of [{ month: '13', year: '2026' }, { month: '2' }, { year: '2101' }]) assert.equal(calendarQuerySchema.safeParse({ query }).success, false)
  assert.equal(calendarQuerySchema.parse({ query: { month: '2', year: '2024' } }).query.month, 2)
})
test('harvest pagination has a stable tie-breaker and farmer-scoped aggregates', async () => {
  prisma.farmerCrop.findMany = async ({ where, skip, take, orderBy }) => {
    assert.deepEqual(where, { farmerId: 'owner', harvestedAt: { not: null } })
    assert.equal(skip, 10); assert.equal(take, 10)
    assert.deepEqual(orderBy, [{ harvestedAt: 'desc' }, { id: 'desc' }])
    return []
  }
  prisma.farmerCrop.count = async () => 11
  prisma.farmerCrop.aggregate = async ({ where }) => { assert.equal(where.farmerId, 'owner'); return { _sum: { yieldKg: 12.5 } } }
  const response = { json(body) { this.body = body } }
  await getHarvestHistory({ farmer: { id: 'owner' }, query: { page: 2, limit: 10 } }, response, error => { throw error })
  assert.equal(response.body.totalYieldKg, 12.5); assert.equal(response.body.page, 2)
})
