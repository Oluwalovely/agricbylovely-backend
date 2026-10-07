import assert from 'node:assert/strict'
import { test } from 'node:test'
import express from 'express'
import jwt from 'jsonwebtoken'
process.env.NODE_ENV = 'test'
process.env.DATABASE_URL = 'postgresql://test:test@127.0.0.1:1/test'
process.env.JWT_SECRET = 'rate-limit-test-secret'
process.env.JWT_REFRESH_SECRET = 'test-refresh'
const { apiLimiter, rateLimitFarmer } = await import('../src/middleware/apiLimit.js')
const { env } = await import('../src/config/env.js')
const token = (id, options = {}) => jwt.sign({ farmerId: id }, env.JWT_SECRET, { expiresIn: '15m', ...options })

test('only valid signed account tokens select a farmer limit', () => {
  const req = access => ({ headers: { authorization: `Bearer ${access}` } })
  assert.equal(rateLimitFarmer(req(token('a'))), 'a')
  assert.equal(rateLimitFarmer(req(token('a', { expiresIn: -1 }))), null)
  assert.equal(rateLimitFarmer(req(jwt.sign({ farmerId: 'a' }, 'wrong-key'))), null)
  assert.equal(rateLimitFarmer(req(jwt.sign({ farmerId: 'a' }, env.JWT_SECRET))), null)
  assert.equal(rateLimitFarmer({ headers: {} }), null)
})
test('signed-in accounts have independent budgets and health checks do not consume anonymous limits', async () => {
  const app = express(); app.use(apiLimiter); app.use((req,res) => res.json({success:true}))
  const server = app.listen(0,'127.0.0.1'); await new Promise(resolve=>server.once('listening',resolve))
  const base = `http://127.0.0.1:${server.address().port}`
  const get = (path, access) => fetch(base+path,{headers:access?{Authorization:`Bearer ${access}`}:{}})
  const a = token('a'), b = token('b')
  try {
    let result
    for (let i=0;i<600;i++) { result=await get('/api/notifications',a); await result.arrayBuffer() }
    assert.equal(result.status,200)
    result=await get('/api/notifications',a); assert.equal(result.status,429)
    assert.ok(Number(result.headers.get('retry-after'))>0); assert.ok((await result.json()).retryAfterSeconds>0)
    result=await get('/api/notifications',b); assert.equal(result.status,200); await result.arrayBuffer()
    for(let i=0;i<200;i++){result=await get('/api/anonymous');await result.arrayBuffer()}
    assert.equal(result.status,200)
    result=await get('/api/anonymous');assert.equal(result.status,429);await result.arrayBuffer()
    for (const path of ['/api/health','/api/health/live']) { result=await get(path); assert.equal(result.status,200); await result.arrayBuffer() }
    result=await get('/api/notifications',b);assert.equal(result.status,200);await result.arrayBuffer()
  } finally { server.closeAllConnections(); await new Promise(resolve=>server.close(resolve)) }
})
