import assert from 'node:assert/strict'
import { test } from 'node:test'
process.env.NODE_ENV = 'test'
process.env.DATABASE_URL = 'postgresql://test:test@127.0.0.1:1/test'
process.env.JWT_SECRET = 'test-access-secret'
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret'
const { default: prisma } = await import('../src/config/prisma.js')
const { updateProfile } = await import('../src/controllers/farmer.controller.js')
const { createField, updateField, deleteField, getFieldById, getFieldSummary } = await import('../src/controllers/field.controller.js')
const { updateProfileSchema, createFieldSchema, updateFieldSchema } = await import('../src/utils/validators.js')

const res = () => ({ code: 200, status(value) { this.code = value; return this }, json(value) { this.body = value; return this } })
const next = error => { throw error }
test('profile and field schemas support clearing optional numbers and paired coordinates', () => {
  for (const schema of [updateProfileSchema, createFieldSchema, updateFieldSchema]) {
    const base = schema === createFieldSchema ? { name: 'Plot' } : {}
    assert.equal(schema.safeParse({ body: { ...base, latitude: null, longitude: null, sizeHa: null, farmSizeHa: null } }).success, true)
    assert.equal(schema.safeParse({ body: { ...base, latitude: 0, longitude: 0 } }).success, true)
    assert.equal(schema.safeParse({ body: { ...base, latitude: 5 } }).success, false)
  }
})
test('profile update persists nulls without converting them to NaN and scopes to the farmer', async () => {
  prisma.farmer.update = async args => { assert.equal(args.where.id, 'owner'); assert.deepEqual(args.data, { phone: '', state: '', farmSizeHa: null, latitude: null, longitude: null }); return { id: 'owner', ...args.data } }
  const response = res()
  await updateProfile({ farmer: { id: 'owner' }, body: { phone: '', state: '', farmSizeHa: null, latitude: null, longitude: null } }, response, next)
  assert.equal(response.body.farmer.latitude, null)
})
test('field creation retains zero coordinates and editing can clear size and notes', async () => {
  prisma.field.create = async ({ data }) => { assert.equal(data.farmerId, 'owner'); assert.equal(data.latitude, 0); assert.equal(data.longitude, 0); return { id: 'plot', ...data } }
  await createField({ farmer: { id: 'owner' }, body: { name: 'Plot', latitude: 0, longitude: 0 } }, res(), next)
  prisma.field.findFirst = async ({ where }) => { assert.equal(where.farmerId, 'owner'); return { id: 'plot' } }
  prisma.field.update = async ({ data }) => { assert.deepEqual(data, { sizeHa: null, latitude: null, longitude: null, notes: '' }); return { id: 'plot', ...data } }
  await updateField({ farmer: { id: 'owner' }, params: { id: 'plot' }, body: { sizeHa: null, latitude: null, longitude: null, notes: '' } }, res(), next)
})
test('foreign fields cannot be read, edited or deleted', async () => {
  prisma.field.findFirst = async ({ where }) => { assert.equal(where.farmerId, 'owner'); return null }
  prisma.field.delete = async () => { assert.fail('must not delete') }
  prisma.field.update = async () => { assert.fail('must not update') }
  for (const controller of [getFieldById, updateField, deleteField]) {
    const response = res()
    await controller({ farmer: { id: 'owner' }, params: { id: 'foreign' }, body: {} }, response, next)
    assert.equal(response.code, 404)
  }
})
test('field deletion uses the database relation to keep planting records', async () => {
  prisma.field.findFirst = async () => ({ id: 'plot' })
  prisma.field.delete = async ({ where }) => { assert.equal(where.id, 'plot') }
  prisma.farmerCrop.deleteMany = async () => assert.fail('crop history must not be removed')
  const response = res()
  await deleteField({ farmer: { id: 'owner' }, params: { id: 'plot' } }, response, next)
  assert.equal(response.body.success, true)
  const { readFile } = await import('node:fs/promises')
  const migration = await readFile(new URL('../prisma/migrations/20260505072026_init/migration.sql', import.meta.url), 'utf8')
  assert.match(migration, /FOREIGN KEY \("fieldId"\).*ON DELETE SET NULL/)
})
test('field summary counts active plantings separately from harvest history', async () => {
  prisma.field.findMany = async ({ select }) => { assert.deepEqual(select._count.select.farmerCrops.where, { harvestedAt: null }); return [{ sizeHa: 2, _count: { farmerCrops: 3 } }] }
  const response = res()
  await getFieldSummary({ farmer: { id: 'owner' } }, response, next)
  assert.equal(response.body.summary.totalActiveCrops, 3)
})
