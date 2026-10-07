import assert from 'node:assert/strict'
import { test } from 'node:test'
import axios from 'axios'
process.env.NODE_ENV = 'test'
process.env.DATABASE_URL = 'postgresql://test:test@127.0.0.1:1/test'
process.env.JWT_SECRET = 'test-secret'
process.env.JWT_REFRESH_SECRET = 'test-refresh'
process.env.OPENWEATHER_API_KEY = 'mock-key'
const { default: prisma } = await import('../src/config/prisma.js')
const { env } = await import('../src/config/env.js')
const { formatDailyForecast, getWeatherForLocation } = await import('../src/services/weather.service.js')
const { getMyAlerts, getMyWeather } = await import('../src/controllers/weather.controller.js')
const { getNotifications, markAsRead, deleteNotification, clearReadNotifications, markAllAsRead, sendWeatherAlertNotifications, sendHarvestReminder } = await import('../src/services/notification.service.js')
const sample = (dt, temp, rain = 0) => ({ dt, main: { temp, humidity: 60 }, weather: [{ description: 'clear sky', icon: '01d' }], wind: { speed: 2 }, rain: { '3h': rain } })

test('forecast groups local dates, labels partial days and totals rainfall', () => {
  const data = formatDailyForecast({ city: { timezone: 3600 }, list: [sample(Date.parse('2026-10-07T21:00Z') / 1000, 25, 2), sample(Date.parse('2026-10-08T00:00Z') / 1000, 20, 3)] })
  assert.deepEqual(data.map(d => d.date), ['2026-10-07', '2026-10-08'])
  assert.equal(data[1].rainfallMm, 3); assert.equal(data[1].partialDay, true)
  const shifted = formatDailyForecast({ city: { timezone: 10800 }, list: [sample(Date.parse('2026-10-07T21:00Z') / 1000, 25)] })
  assert.equal(shifted[0].date, '2026-10-08')
})
test('weather coalesces simultaneous requests, uses fresh cache and masks provider errors', async () => {
  let calls = 0, saved
  prisma.weatherSnapshot.findUnique = async () => saved ? { data: saved, fetchedAt: new Date() } : null
  prisma.weatherSnapshot.upsert = async ({ create }) => { saved = create.data }
  axios.get = async url => { calls++; await new Promise(resolve => setTimeout(resolve, 5)); return { data: url.endsWith('/forecast') ? { city: { timezone: 3600 }, list: [sample(Date.now()/1000, 28)] } : { name: 'Lagos', sys: { country: 'NG' }, timezone: 3600, main: { temp: 28, feels_like: 29, humidity: 60, pressure: 1010 }, wind: { speed: 2 }, weather: [{ description: 'clear sky', icon: '01d' }], visibility: 10000 } } }
  const [a, b] = await Promise.all([getWeatherForLocation(6.52, 3.38), getWeatherForLocation(6.52, 3.38)])
  assert.equal(calls, 2); assert.deepEqual(a,b); assert.equal(a.source, 'OpenWeather')
  await getWeatherForLocation(6.52, 3.38); assert.equal(calls, 2)
  saved = null; axios.get = async () => { throw new Error('secret-provider-diagnostic') }
  await assert.rejects(getWeatherForLocation(0, 0), error => error.statusCode === 503 && !error.message.includes('secret'))
  env.OPENWEATHER_API_KEY = ''
  await assert.rejects(getWeatherForLocation(0,0), error => error.statusCode === 503)
  env.OPENWEATHER_API_KEY = 'mock-key'
})
test('missing location differs from empty alerts and zero coordinates are valid', async () => {
  const response = { status(code) { this.code = code; return this }, json(body) { this.body = body; return this } }
  prisma.farmer.findUnique = async () => ({ latitude: null, longitude: null })
  await getMyAlerts({ farmer: { id: 'owner' } }, response, error => { throw error })
  assert.equal(response.code, 400); assert.equal(response.body.code, 'LOCATION_REQUIRED')
  prisma.farmer.findUnique = async () => ({ latitude: 0, longitude: 0 })
  let error
  await getMyWeather({ farmer: { id: 'owner' } }, response, e => { error = e })
  assert.equal(error.statusCode, 503)
})
test('notification pagination, totals and every mutation are scoped to the farmer', async () => {
  prisma.notification.findMany = async ({ where, skip, take, orderBy }) => { assert.deepEqual(where, { farmerId: 'owner', isRead: false }); assert.equal(skip,10); assert.equal(take,10); assert.deepEqual(orderBy,[{createdAt:'desc'},{id:'desc'}]); return [] }
  prisma.notification.count = async ({where}) => { assert.equal(where.farmerId,'owner'); return 11 }
  const result = await getNotifications('owner',{page:2,limit:10,unreadOnly:true})
  assert.equal(result.unreadCount,11)
  prisma.notification.findFirst = async ({where}) => { assert.equal(where.farmerId,'owner'); return null }
  prisma.notification.update = async () => { throw new Error('Unauthorized write') }
  prisma.notification.delete = async () => { throw new Error('Unauthorized delete') }
  assert.equal(await markAsRead('foreign','owner'),null); assert.equal(await deleteNotification('foreign','owner'),null)
  prisma.notification.updateMany = async ({where}) => { assert.deepEqual(where,{farmerId:'owner',isRead:false}); return {count:2} }
  prisma.notification.deleteMany = async ({where}) => { assert.deepEqual(where,{farmerId:'owner',isRead:true}); return {count:3} }
  assert.equal(await markAllAsRead('owner'),2); assert.equal(await clearReadNotifications('owner'),3)
})
test('scheduled receipts suppress repeated weather alerts and separate farmers, dates and plantings', async () => {
  const receipts = new Set(), pushes = []; let writes = 0, tail = Promise.resolve()
  prisma.$transaction = task => {
    const run = tail.then(async () => {
      let owner, key
      return task({ $executeRaw: async () => {}, job: { findFirst: async ({where}) => { owner=where.farmerId; key=where.payload.equals; return receipts.has(`${owner}:${key}`) ? {} : null }, create: async () => { receipts.add(`${owner}:${key}`) } }, notification: { create: async ({data}) => { writes++; return {id:String(writes),...data} } } })
    }); tail=run.catch(()=>{}); return run
  }
  const io={to(room){return {emit(event,data){ pushes.push({room,event,data}) }}}}
  const alerts=[{type:'WEATHER',title:'Heat',message:'Warm'}]
  await Promise.all([sendWeatherAlertNotifications('a',alerts,io,'2026-10-07'),sendWeatherAlertNotifications('a',alerts,io,'2026-10-07')])
  assert.equal(writes,1); assert.equal(pushes[0].room,'farmer:a'); assert.equal(pushes[0].data.farmerId,'a')
  await sendWeatherAlertNotifications('b',alerts,io,'2026-10-07'); await sendWeatherAlertNotifications('a',alerts,io,'2026-10-08')
  const record={id:'crop-1',expectedHarvestAt:'2026-10-08'}
  await sendHarvestReminder('a','Maize',1,io,record); await sendHarvestReminder('a','Maize',1,io,record)
  await sendHarvestReminder('a','Maize',1,io,{...record,id:'crop-2'})
  assert.equal(writes,5); assert.match(pushes[3].data.message,/estimated harvest/)
})
test('a receipt failure does not publish a scheduled notification', async () => {
  let emitted=false
  prisma.$transaction = task => task({ $executeRaw: async()=>{}, job:{findFirst:async()=>null,create:async()=>{throw new Error('receipt failure')}},notification:{create:async({data})=>data} })
  await assert.rejects(sendHarvestReminder('a','Maize',0,{to:()=>({emit:()=>{emitted=true}})},{id:'crop',expectedHarvestAt:'2026-10-07'}),/receipt failure/)
  assert.equal(emitted,false)
})
