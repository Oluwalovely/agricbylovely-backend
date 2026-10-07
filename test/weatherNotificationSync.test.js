import assert from 'node:assert/strict'
import { test } from 'node:test'
process.env.NODE_ENV = 'test'
process.env.DATABASE_URL = 'postgresql://test:test@127.0.0.1:1/test'
process.env.JWT_SECRET = 'test-secret'
process.env.JWT_REFRESH_SECRET = 'test-refresh'
process.env.OPENWEATHER_API_KEY = 'mock-key'
const { default: prisma } = await import('../src/config/prisma.js')
const { getMyWeather, getMyAlerts, getWeatherByCoords } = await import('../src/controllers/weather.controller.js')
const { getDashboard } = await import('../src/controllers/report.controller.js')
const { sendWeatherAlertNotifications } = await import('../src/services/notification.service.js')
const alerts = [{ type: 'PEST', title: 'High Fungal Risk', message: 'Inspect your crops.' }, { type: 'HARVEST', title: 'Harvest Season', message: 'Check mature crops.' }]
const weather = { timezoneOffset: 3600, current: {}, forecast: [], location: {}, alerts, fetchedAt: new Date().toISOString() }
const response = () => ({ status(code) { this.code = code; return this }, json(body) { this.body = body; return this } })
const next = error => { throw error }

function setup(data = weather) {
  const rows = [], receipts = new Set(), pushes = []; let tail = Promise.resolve(), attempts = 0
  prisma.farmer.findUnique = async ({ where }) => ({ id: where.id, latitude: 6.52, longitude: 3.38 })
  prisma.weatherSnapshot.findUnique = async () => ({ fetchedAt: new Date(), data })
  prisma.farmerCrop.findMany = async () => []
  prisma.farmerCrop.count = async () => 0
  prisma.field.findMany = async () => []
  prisma.job.groupBy = async () => []
  prisma.notification.findMany = async ({ where }) => rows.filter(row => row.farmerId === where.farmerId)
  prisma.notification.count = async ({ where }) => rows.filter(row => row.farmerId === where.farmerId && !row.isRead).length
  prisma.$transaction = task => {
    attempts++
    const run = tail.then(() => task({
      $executeRaw: async (sql, key) => { assert.match(sql.join(''), /pg_advisory_xact_lock/); assert.match(key, /^owner/) },
      job: { findFirst: async ({ where }) => receipts.has(`${where.farmerId}:${where.payload.equals}`) ? {} : null, create: async ({ data: receipt }) => receipts.add(`${receipt.farmerId}:${receipt.payload.notificationKey}`) },
      notification: { create: async ({ data: row }) => { const saved = { id: String(rows.length + 1), isRead: false, ...row }; rows.push(saved); return saved } },
    }))
    tail = run.catch(() => {}); return run
  }
  const io = { to(room) { return { emit(event, payload) { pushes.push({ room, event, payload }) } } } }
  const req = (id = 'owner') => ({ farmer: { id }, query: { lat: 6.52, lon: 3.38 }, app: { get: () => io } })
  return { rows, receipts, pushes, req, attempts: () => attempts }
}
test('dashboard saves current advisories before returning its list and unread total', async () => {
  const state = setup(), result = response()
  await getDashboard(state.req(), result, next)
  assert.equal(result.body.notificationSync.createdCount, 2)
  assert.equal(result.body.notifications.length, 2); assert.equal(result.body.stats.unreadNotifications, 2)
  assert.equal(result.body.weatherStatus, 'AVAILABLE')
  assert.equal(state.pushes.length, 2); assert.equal(state.pushes[0].room, 'farmer:owner')
})
test('Weather, Dashboard and daily checks share receipts across visits, reads, deletion and farmers', async () => {
  const state = setup()
  const results = [response(), response(), response()]
  await Promise.all([getMyWeather(state.req(), results[0], next), getMyAlerts(state.req(), results[1], next), getDashboard(state.req(), results[2], next)])
  assert.equal(state.rows.length, 2); assert.equal(state.pushes.length, 2)
  assert.equal(await sendWeatherAlertNotifications('owner', alerts).then(rows => rows.length), 0)
  state.rows.forEach(row => { row.isRead = true })
  await getMyWeather(state.req(), response(), next); assert.equal(state.rows.length, 2)
  state.rows.length = 0
  await getDashboard(state.req(), response(), next); assert.equal(state.rows.length, 0)
  await getMyWeather(state.req('owner-b'), response(), next)
  assert.equal(state.rows.length, 2); assert.ok(state.rows.every(row => row.farmerId === 'owner-b'))
})
test('coordinate previews, missing location and no advisories do not create history', async () => {
  const state = setup()
  await getWeatherByCoords(state.req(), response(), next); assert.equal(state.attempts(), 0)
  prisma.farmer.findUnique = async () => ({ latitude: null, longitude: null })
  const missing = response(); await getMyWeather(state.req(), missing, next)
  assert.equal(missing.body.code, 'LOCATION_REQUIRED'); assert.equal(state.attempts(), 0)
  setup({ ...weather, alerts: [] })
  const empty = response(); await getMyWeather(state.req(), empty, next)
  assert.deepEqual(empty.body.notificationSync, { status: 'SAVED', createdCount: 0 })
})
test('notification storage failure preserves usable weather and is retried on the next visit', async () => {
  const state = setup(), original = prisma.$transaction
  prisma.$transaction = async () => { throw new Error('temporary storage failure') }
  const failure = response(); await getMyWeather(state.req(), failure, next)
  assert.equal(failure.body.weather.alerts.length, 2); assert.equal(failure.body.notificationSync.status, 'UNAVAILABLE'); assert.equal(state.pushes.length, 0)
  prisma.$transaction = original
  const retry = response(); await getMyWeather(state.req(), retry, next)
  assert.equal(retry.body.notificationSync.createdCount, 2)
})
