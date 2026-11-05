/** Hold an owned, loopback-only synthetic Redis fixture for native DSH acceptance. */
import assert from 'node:assert/strict'
import { RESP_TYPES } from 'redis'
import { withRedisFixture } from './redis-fixture.mjs'

const { fixture } = await withRedisFixture(async ({ settings, admin }) => {
  for (let index = 0; index < 16; index++) {
    await admin.hSet('fixture:order:' + index, { status: index % 4 === 0 ? 'synthetic-failed' : 'synthetic-ready', note: 'synthetic-only' })
  }
  await admin.hSet('fixture:user:123', { name: 'synthetic-user', status: 'synthetic-active' })
  await admin.sendCommand(['SADD', 'fixture:members', 'synthetic-user'])
  await admin.sendCommand(['ZADD', 'fixture:scores', '3.75', 'synthetic-user'])
  await admin.set('fixture:string', 'synthetic-string-value')
  await admin.rPush('fixture:list', ['synthetic-first', 'synthetic-second'])
  await admin.sendCommand(['XADD', 'fixture:stream', '1-0', 'field', 'synthetic-first', 'field', 'synthetic-second'])
  const buffers = admin.withTypeMapping({ [RESP_TYPES.BLOB_STRING]: Buffer })
  // Check every fixture key, including absolute expiry, before releasing the instance.
  const keys = [...Array.from({ length: 16 }, (_, index) => 'fixture:order:' + index), 'fixture:user:123', 'fixture:members', 'fixture:scores', 'fixture:string', 'fixture:list', 'fixture:stream']
  const before = await Promise.all(keys.map(key => buffers.sendCommand(['DUMP', key])))
  const expiry = await Promise.all(keys.map(key => admin.sendCommand(['PEXPIRETIME', key])))
  console.log(JSON.stringify({ ready: true, host: settings.host, port: settings.port, syntheticKeys: keys.length }))
  await new Promise((resolve, reject) => {
    process.stdin.once('data', resolve)
    process.stdin.once('error', reject)
    process.stdin.once('end', () => reject(new Error('Fixture input closed before verification')))
    process.stdin.resume()
  })
  process.stdin.pause()
  assert.deepEqual(await Promise.all(keys.map(key => buffers.sendCommand(['DUMP', key]))), before)
  assert.deepEqual(await Promise.all(keys.map(key => admin.sendCommand(['PEXPIRETIME', key]))), expiry)
  assert.equal(await admin.dbSize(), keys.length)
  console.log(JSON.stringify({ fixtureDataUnchanged: true }))
}, { passwordRequired: false })
assert(fixture.stopped)
console.log(JSON.stringify({ fixtureStopped: true }))
