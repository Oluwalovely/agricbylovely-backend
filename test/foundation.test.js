import assert from 'node:assert/strict'
import { test, before, after } from 'node:test'
import express from 'express'
import jwt from 'jsonwebtoken'

process.env.NODE_ENV = 'test'
process.env.DATABASE_URL = 'postgresql://test:test@127.0.0.1:1/test'
process.env.JWT_SECRET = 'phase-one-test-access-secret'
process.env.JWT_REFRESH_SECRET = 'phase-one-test-refresh-secret'

const { default: app } = await import('../src/app.js')
const { default: prisma } = await import('../src/config/prisma.js')
const { env } = await import('../src/config/env.js')
const { validate } = await import('../src/middleware/validate.js')
const { sanitize } = await import('../src/middleware/sanitize.js')
const schemas = await import('../src/utils/validators.js')
const { authenticateSocket, configureNotificationSockets } = await import('../src/middleware/socketAuth.js')
const farmerA = '11111111-1111-4111-8111-111111111111'
const farmerB = '22222222-2222-4222-8222-222222222222'
const fieldA = '33333333-3333-4333-8333-333333333333'
const fieldB = '44444444-4444-4444-8444-444444444444'
const cropId = '55555555-5555-4555-8555-555555555555'
const token = jwt.sign({ farmerId: farmerA }, env.JWT_SECRET, { expiresIn: '15m' })
let server
let url
let writes = []
const originals = {
  farmer: prisma.farmer.findUnique,
  field: prisma.field.findFirst,
  crop: prisma.crop.findUnique,
  create: prisma.farmerCrop.create,
}

before(async () => {
  prisma.farmer.findUnique = async ({ where }) => [farmerA, farmerB].includes(where.id) ? { id: where.id } : null
  prisma.field.findFirst = async ({ where }) =>
    (where.id === fieldA && where.farmerId === farmerA) ||
    (where.id === fieldB && where.farmerId === farmerB) ? { id: where.id } : null
  prisma.crop.findUnique = async ({ where }) => where.id === cropId ? { id: cropId, daysToHarvest: 90 } : null
  prisma.farmerCrop.create = async ({ data }) => { writes.push(data); return { id: 'created', ...data } }
  server = app.listen(0, '127.0.0.1')
  await new Promise(resolve => server.once('listening', resolve))
  url = 'http://127.0.0.1:' + server.address().port
})
after(async () => {
  prisma.farmer.findUnique = originals.farmer
  prisma.field.findFirst = originals.field
  prisma.crop.findUnique = originals.crop
  prisma.farmerCrop.create = originals.create
  server.closeAllConnections()
  await new Promise(resolve => server.close(resolve))
  await prisma.$disconnect()
})

const request = async (path, body, method = 'POST') => {
  const response = await fetch(url + path, { method, headers: {
    'Content-Type': 'application/json', Authorization: 'Bearer ' + token,
  }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
  return { status: response.status, body: await response.json() }
}

test('invalid registration responds with field-level 400 errors', async () => {
  const response = await request('/api/auth/register', { email: 'invalid' })
  assert.equal(response.status, 400)
  assert.ok(response.body.errors.some(error => error.field === 'email'))
})

test('registration without GPS and zero coordinates validate', () => {
  const body = { email: 'test@example.test', password: 'valid-password', firstName: 'Test', lastName: 'Farmer', farmName: 'Test Farm' }
  const parsed = schemas.registerSchema.parse({ body: { ...body, latitude: null, longitude: null } })
  assert.equal(parsed.body.latitude, undefined)
  assert.equal(schemas.registerSchema.parse({ body: { ...body, latitude: 0, longitude: 0 } }).body.latitude, 0)
})

test('sanitizing text preserves passwords and arrays; parsed values strip unexpected fields', () => {
  const req = { body: { email: ' test@example.test ', password: ' secret  ', values: ['one', 'two'] } }
  sanitize(req, {}, () => {})
  assert.equal(req.body.email, 'test@example.test')
  assert.equal(req.body.password, ' secret  ')
  assert.deepEqual(req.body.values, ['one', 'two'])
  validate(schemas.loginSchema)(req, {}, () => {})
  assert.equal(req.body.values, undefined)
})

test('invalid crop IDs, dates, stages and quantities never reach creation', async () => {
  const count = writes.length
  for (const body of [{ plantedAt: '2026-02-30' }, { quantity: -1 }, { fieldId: 'not-an-id' }]) {
    assert.equal((await request('/api/crops/' + cropId + '/plant', body)).status, 400)
  }
  assert.equal((await request('/api/crops/my-crops/' + cropId, { stage: 'INVALID' }, 'PUT')).status, 400)
  assert.equal(writes.length, count)
})

test('planting rejects a foreign or nonexistent field without writing', async () => {
  const count = writes.length
  for (const fieldId of [fieldB, cropId]) {
    assert.equal((await request('/api/crops/' + cropId + '/plant', { fieldId })).status, 404)
  }
  assert.equal(writes.length, count)
})

test('planting accepts an owned field or no field', async () => {
  const owned = await request('/api/crops/' + cropId + '/plant', { fieldId: fieldA, plantedAt: '2026-10-07', quantity: 2 })
  assert.equal(owned.status, 201)
  assert.equal(owned.body.farmerCrop.farmerId, farmerA)
  assert.equal(owned.body.farmerCrop.fieldId, fieldA)
  const unassigned = await request('/api/crops/' + cropId + '/plant', {})
  assert.equal(unassigned.status, 201)
  assert.equal(unassigned.body.farmerCrop.fieldId, null)
})

test('invalid pagination and weather coordinates return 400', async () => {
  for (const path of ['/api/crops?page=-1', '/api/crops?limit=1000', '/api/crops?category=unknown',
    '/api/notifications?unreadOnly=maybe', '/api/reports/harvest-history?page=abc',
    '/api/calendar?month=13&year=2026', '/api/calendar/upcoming?days=-1',
    '/api/weather/search?lat=91&lon=3', '/api/weather/search?lat=&lon=3']) {
    assert.equal((await request(path, undefined, 'GET')).status, 400, path)
  }
  assert.deepEqual(schemas.weatherQuerySchema.parse({ query: { lat: '0', lon: '0' } }).query, { lat: 0, lon: 0 })
})

test('manual global jobs are blocked outside development', async () => {
  for (const path of ['weather-check', 'harvest-reminders', 'weekly-digest']) {
    assert.equal((await request('/api/jobs/run/' + path, {})).status, 403)
  }
})

test('sockets reject missing, expired, invalid and deleted-account tokens', async () => {
  for (const value of [undefined, 'invalid', jwt.sign({ farmerId: farmerA }, env.JWT_SECRET, { expiresIn: -1 }),
    jwt.sign({ farmerId: cropId }, env.JWT_SECRET, { expiresIn: '15m' })]) {
    const socket = { handshake: { auth: { token: value } }, data: {} }
    const error = await new Promise(resolve => authenticateSocket(socket, resolve))
    assert.equal(error.data.code, 'UNAUTHORIZED')
  }
})

test('notification rooms come only from verified identity, not supplied farmer IDs', async () => {
  let connected
  let middleware
  configureNotificationSockets({ use(fn) { middleware = fn }, on(name, fn) { if (name === 'connection') connected = fn } })
  const rooms = []
  const handlers = new Map()
  const socket = { handshake: { auth: { token, farmerId: farmerB } }, data: {},
    join(room) { rooms.push(room) }, on(name, fn) { handlers.set(name, fn) }, disconnect() {} }
  assert.equal(await new Promise(resolve => middleware(socket, resolve)), undefined)
  connected(socket)
  assert.deepEqual(rooms, ['farmer:' + farmerA])
  assert.equal(handlers.has('join'), false)
  handlers.get('disconnect')()
})

test('database outages on socket authentication are retryable, not invalid credentials', async () => {
  const original = prisma.farmer.findUnique
  prisma.farmer.findUnique = async () => { throw new Error('Database unavailable') }
  try {
    const error = await new Promise(resolve => authenticateSocket({ handshake: { auth: { token } }, data: {} }, resolve))
    assert.equal(error.data.code, 'UNAVAILABLE')
  } finally { prisma.farmer.findUnique = original }
})

test('validation applies transformed query values before handlers run', async () => {
  const local = express()
  local.get('/', validate(schemas.cropQuerySchema), (req, res) => res.json(req.query))
  const listener = local.listen(0, '127.0.0.1')
  await new Promise(resolve => listener.once('listening', resolve))
  try {
    const response = await fetch('http://127.0.0.1:' + listener.address().port + '/?page=2&category=grain')
    assert.deepEqual(await response.json(), { page: 2, category: 'GRAIN' })
  } finally { listener.closeAllConnections(); await new Promise(resolve => listener.close(resolve)) }
})
