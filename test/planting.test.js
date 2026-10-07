import assert from 'node:assert/strict'
import { test } from 'node:test'
process.env.NODE_ENV = 'test'
process.env.DATABASE_URL = 'postgresql://test:test@127.0.0.1:1/test'
process.env.JWT_SECRET = 'test-access-secret'
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret'
const { default: prisma } = await import('../src/config/prisma.js')
const { getAllCrops, getCropById, plantCrop, getMyCrops } = await import('../src/controllers/crop.controller.js')
const response = () => ({ code: 200, status(code) { this.code = code; return this }, json(body) { this.body = body } })
const next = error => { throw error }
test('catalogue search combines category/search and paginates consistent totals without writes', async () => {
  let filter
  prisma.crop.findMany = async ({ where, skip, take }) => { filter = where; assert.equal(skip, 12); assert.equal(take, 12); return [{ id: 'maize' }] }
  prisma.crop.count = async ({ where }) => { assert.deepEqual(where, filter); return 25 }
  prisma.crop.create = async () => assert.fail('catalogue browsing must not import records')
  const res = response()
  await getAllCrops({ query: { q: 'maize', category: 'GRAIN', page: 2, limit: 12 } }, res, next)
  assert.equal(filter.category, 'GRAIN'); assert.equal(filter.OR[0].name.contains, 'maize')
  assert.equal(res.body.pages, 3); assert.equal(res.body.total, 25); assert.equal(res.body.page, 2)
})
test('empty search remains local with the requested page and no imports or enrichment', async () => {
  prisma.crop.findMany = async () => []
  prisma.crop.count = async () => 0
  prisma.crop.create = async () => assert.fail('must not import')
  const res = response()
  await getAllCrops({ query: { q: 'unknown crop', page: 3, limit: 12 } }, res, next)
  assert.deepEqual(res.body.crops, []); assert.equal(res.body.source, 'database'); assert.equal(res.body.page, 3)
})
test('missing crop guides return 404 and planting cannot create an unknown crop', async () => {
  prisma.crop.findUnique = async () => null
  prisma.farmerCrop.create = async () => assert.fail('must not create')
  for (const handler of [getCropById, plantCrop]) {
    const res = response(); await handler({ params: { id: 'missing' }, body: {}, farmer: { id: 'owner' } }, res, next); assert.equal(res.code, 404)
  }
})
test('planting calculates the harvest from the chosen date and writes only to the current farmer', async () => {
  prisma.crop.findUnique = async () => ({ id: 'maize', daysToHarvest: 90 })
  prisma.field.findFirst = async ({ where }) => { assert.deepEqual(where, { id: 'plot', farmerId: 'owner' }); return { id: 'plot' } }
  prisma.farmerCrop.create = async ({ data }) => {
    assert.equal(data.farmerId, 'owner'); assert.equal(data.fieldId, 'plot'); assert.equal(data.quantity, 2); assert.equal(data.notes, '2 bags'); assert.equal(data.stage, 'GERMINATING')
    assert.equal(data.expectedHarvestAt.getTime() - data.plantedAt.getTime(), 90 * 86400000)
    return { id: 'record', ...data }
  }
  const res = response(); await plantCrop({ params: { id: 'maize' }, farmer: { id: 'owner' }, body: { plantedAt: '2026-10-07', fieldId: 'plot', quantity: 2, notes: '2 bags' } }, res, next)
  assert.equal(res.code, 201)
})
test('unknown harvest duration stays null and unassigned plantings are supported', async () => {
  prisma.crop.findUnique = async () => ({ id: 'maize', daysToHarvest: null })
  prisma.farmerCrop.create = async ({ data }) => { assert.equal(data.fieldId, null); assert.equal(data.expectedHarvestAt, null); return data }
  await plantCrop({ params: { id: 'maize' }, farmer: { id: 'owner' }, body: { plantedAt: '2026-10-07' } }, response(), next)
})
test('My Crops reads only the signed-in farmer with field and crop details', async () => {
  prisma.farmerCrop.findMany = async args => { assert.deepEqual(args.where, { farmerId: 'owner' }); assert.deepEqual(args.include, { crop: true, field: true }); return [] }
  const res = response(); await getMyCrops({ farmer: { id: 'owner' } }, res, next); assert.deepEqual(res.body.farmerCrops, [])
})
