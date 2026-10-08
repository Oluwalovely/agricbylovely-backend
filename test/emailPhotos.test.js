import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import bcrypt from 'bcryptjs'
import { v2 as cloudinary } from 'cloudinary'

process.env.NODE_ENV = 'test'
process.env.DATABASE_URL = 'postgresql://test:test@127.0.0.1:1/test'
process.env.JWT_SECRET = 'test-access'
process.env.JWT_REFRESH_SECRET = 'test-refresh'
const { env } = await import('../src/config/env.js')
const { default: prisma } = await import('../src/config/prisma.js')
const { sendEmail, sendPasswordResetEmail } = await import('../src/services/email.service.js')
const { forgotPassword, resetPassword } = await import('../src/controllers/auth.controller.js')
const controllers = await import('../src/controllers/upload.controller.js')
const { uploadAvatar } = await import('../src/services/upload.service.js')
const { verifyImage } = await import('../src/middleware/upload.js')
const farmer = { id: 'farmer-a', email: 'owner@example.test', firstName: '<script>bad</script>', passwordResetToken: null }
let providerBody, providerStatus = 201, logs = [], uploads = [], deleted = [], record, conflict = false, databaseFailure = false
const originalFetch = globalThis.fetch
globalThis.fetch = async (url, options) => {
  assert.ok(url === 'https://api.brevo.com/v3/smtp/email' || url === 'https://api.resend.com/emails')
  providerBody = JSON.parse(options.body)
  assert.ok(options.signal)
  return { ok: providerStatus < 300, status: providerStatus, json: async () => ({ messageId: 'accepted', id: 'accepted' }) }
}
prisma.emailLog.create = async ({ data }) => { logs.push(data); if (databaseFailure) throw Error('logging unavailable') }
prisma.farmer.findUnique = async ({ where }) => where.email === farmer.email ? farmer : null
prisma.farmer.update = async ({ data }) => Object.assign(farmer, data)
prisma.farmer.findFirst = async ({ where }) => {
  if (where.passwordResetToken) return where.passwordResetToken === farmer.passwordResetToken && farmer.passwordResetExpiry > where.passwordResetExpiry.gt ? { ...farmer } : null
  return record && { ...record }
}
prisma.farmer.updateMany = async ({ where, data }) => {
  if ('avatarUrl' in data) return savePhoto(where, data)
  if (farmer.passwordResetToken !== where.passwordResetToken || (where.passwordResetExpiry && farmer.passwordResetExpiry <= where.passwordResetExpiry.gt)) return { count: 0 }
  Object.assign(farmer, data); return { count: 1 }
}
prisma.field.findFirst = prisma.farmerCrop.findFirst = async ({ where }) => where.farmerId === 'farmer-a' && record ? { ...record } : null
function savePhoto(where, data) { if (databaseFailure) throw Error('database unavailable'); if (conflict) return { count: 0 }; Object.assign(record, data); return { count: 1 } }
prisma.field.updateMany = prisma.farmerCrop.updateMany = async ({ where, data }) => savePhoto(where, data)
cloudinary.uploader.upload_stream = (options, callback) => ({ end: () => {
  uploads.push(options)
  callback(null, { secure_url: `https://res.cloudinary.com/test/image/upload/v1/${options.folder}/${options.public_id}.jpg` })
} })
cloudinary.uploader.destroy = async id => { deleted.push(id); return { result: 'ok' } }
function configure() { env.EMAIL_FROM = 'sender@example.test'; env.BREVO_API_KEY = 'test-key'; env.RESEND_API_KEY = ''; env.CLOUDINARY_CLOUD_NAME = 'test'; env.CLOUDINARY_API_KEY = 'key'; env.CLOUDINARY_API_SECRET = 'secret'; providerStatus = 201; databaseFailure = false; conflict = false; uploads = []; deleted = [] }
async function call(handler, req) {
  let status = 200, body, error
  await handler(req, { status(value) { status = value; return this }, json(value) { body = value; return this } }, err => { error = err })
  return { status, body, error }
}
const photoRequest = () => ({ farmer: { id: 'farmer-a' }, params: { fieldId: 'field-a', farmerCropId: 'crop-a' }, file: { buffer: Buffer.from([255,216,255]) } })
after(async () => { globalThis.fetch = originalFetch; await prisma.$disconnect() })

test('HTTPS sends support Brevo and Resend; logging failure does not change accepted delivery', async () => {
  configure()
  assert.equal(await sendEmail({ to: farmer.email, subject: 'Reset', html: '<p>Hello</p>', template: 'test' }), true)
  assert.equal(providerBody.sender.email, env.EMAIL_FROM)
  databaseFailure = true
  assert.equal(await sendEmail({ to: farmer.email, subject: 'Reset', html: 'Hello', template: 'test' }), true)
  env.BREVO_API_KEY = ''; env.RESEND_API_KEY = 'test-resend'
  assert.equal(await sendEmail({ to: farmer.email, subject: 'Reset', html: 'Hello', template: 'test' }), true)
  assert.deepEqual(providerBody.to, [farmer.email])
})
test('provider rejection is logged as failure, with safe escaped reset HTML', async () => {
  configure(); providerStatus = 403
  assert.equal(await sendPasswordResetEmail(farmer, 'https://example.test/reset?token=abc&x=1'), false)
  assert.match(providerBody.htmlContent, /&lt;script&gt;/)
  assert.ok(!providerBody.htmlContent.includes('<script>'))
  assert.equal(logs.at(-1).status, 'failed')
  assert.ok(!logs.at(-1).error.includes('test-key'))
})
test('unconfigured recovery returns the same unavailable response for known and unknown addresses', async () => {
  configure(); env.BREVO_API_KEY = ''; env.RESEND_API_KEY = ''
  const a = await call(forgotPassword, { body: { email: farmer.email } })
  const b = await call(forgotPassword, { body: { email: 'unknown@example.test' } })
  assert.equal(a.status, 503); assert.deepEqual(a, b)
})
test('reset link stores a hash, updates password once, and revokes refresh token', async () => {
  configure(); farmer.refreshToken = 'old-session'
  assert.equal((await call(forgotPassword, { body: { email: farmer.email } })).status, 200)
  const token = new URL(providerBody.htmlContent.match(/href="([^"]*reset-password[^"]*)"/)[1]).searchParams.get('token')
  assert.notEqual(farmer.passwordResetToken, token)
  assert.equal(farmer.passwordResetToken, crypto.createHash('sha256').update(token).digest('hex'))
  assert.equal((await call(resetPassword, { body: { token: farmer.passwordResetToken, newPassword: 'stolen-hash-password' } })).status, 400)
  const request = { body: { token, newPassword: 'new-test-password' } }
  const results = await Promise.all([call(resetPassword, request), call(resetPassword, request)])
  assert.deepEqual(results.map(r => r.status).sort(), [200, 400])
  assert.equal(await bcrypt.compare('new-test-password', farmer.password), true)
  assert.equal(farmer.refreshToken, null)
  assert.equal((await call(resetPassword, request)).status, 400)
})
test('failed delivery clears only its token and gives a generic acknowledgement', async () => {
  configure(); providerStatus = 500
  const known = await call(forgotPassword, { body: { email: farmer.email } })
  const unknown = await call(forgotPassword, { body: { email: 'unknown@example.test' } })
  assert.deepEqual(known, unknown); assert.equal(farmer.passwordResetToken, null)
})
test('expired reset cannot change the password', async () => {
  configure(); farmer.passwordResetToken = 'a'.repeat(64); farmer.passwordResetExpiry = new Date(0)
  assert.equal((await call(resetPassword, { body: { token: 'a'.repeat(64), newPassword: 'ignored-password' } })).status, 400)
})
test('avatar uploads get unique IDs and never delete the replacement', async () => {
  configure(); record = { avatarUrl: 'https://res.cloudinary.com/test/image/upload/v1/agricbylovely/avatars/old.jpg' }
  const result = await call(controllers.uploadFarmerAvatar, photoRequest())
  assert.equal(result.body.avatarUrl, record.avatarUrl)
  assert.equal(deleted[0], 'agricbylovely/avatars/old')
  assert.ok(!deleted.some(id => record.avatarUrl.includes(id)))
  const other = await uploadAvatar(Buffer.from('test'), 'farmer-a')
  assert.notEqual(other, record.avatarUrl); assert.equal(uploads[0].overwrite, false)
})
test('field and planting uploads persist; unauthorized records never upload', async () => {
  configure()
  for (const handler of [controllers.uploadFieldImage, controllers.uploadCropImage]) {
    record = { photoUrl: null }
    const result = await call(handler, photoRequest())
    assert.ok(record.photoUrl); assert.equal(result.body.photoUrl, record.photoUrl)
    const req = photoRequest(); req.farmer.id = 'farmer-b'
    const before = uploads.length
    assert.equal((await call(handler, req)).status, 404); assert.equal(uploads.length, before)
  }
})
test('failed or conflicting photo saves preserve old photo and clean the unused upload', async () => {
  configure(); record = { photoUrl: 'old-photo' }; conflict = true
  assert.equal((await call(controllers.uploadFieldImage, photoRequest())).status, 409)
  assert.equal(record.photoUrl, 'old-photo'); assert.equal(deleted.length, 1)
  conflict = false; databaseFailure = true
  assert.ok((await call(controllers.uploadCropImage, photoRequest())).error)
  assert.equal(record.photoUrl, 'old-photo'); assert.equal(deleted.length, 2)
})
test('photo removal commits before provider cleanup, and is idempotent', async () => {
  configure(); record = { photoUrl: 'https://res.cloudinary.com/test/image/upload/v1/agricbylovely/fields/old.jpg' }
  assert.equal((await call(controllers.deleteFieldImage, photoRequest())).body.photoUrl, null)
  assert.equal(record.photoUrl, null); assert.equal(deleted.length, 1)
  await call(controllers.deleteFieldImage, photoRequest()); assert.equal(deleted.length, 1)
})
test('forged image content is rejected before provider upload', () => {
  let status, proceeded = false
  verifyImage({ file: { mimetype: 'image/png', buffer: Buffer.from('<script>fake</script>') } }, { status(n) { status = n; return this }, json() {} }, () => { proceeded = true })
  assert.equal(status, 400); assert.equal(proceeded, false)
})
