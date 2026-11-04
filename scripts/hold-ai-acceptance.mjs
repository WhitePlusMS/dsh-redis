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
  const buffers = admin.withTypeMapping({ [RESP_TYPES.BLOB_STRING]: Buffer })
  const keys = ['fixture:order:0', 'fixture:order:1', 'fixture:user:123', 'fixture:members', 'fixture:scores']
  const before = await Promise.all(keys.map(key => buffers.sendCommand(['DUMP', key])))
  console.log(JSON.stringify({ ready: true, host: settings.host, port: settings.port, syntheticKeys: 19 }))
  await new Promise((resolve, reject) => {
    process.stdin.once('data', resolve)
    process.stdin.once('error', reject)
    process.stdin.once('end', () => reject(new Error('Fixture input closed before verification')))
    process.stdin.resume()
  })
  process.stdin.pause()
  assert.deepEqual(await Promise.all(keys.map(key => buffers.sendCommand(['DUMP', key]))), before)
  assert.equal(await admin.dbSize(), 19)
  console.log(JSON.stringify({ fixtureDataUnchanged: true }))
}, { passwordRequired: false })
assert(fixture.stopped)
console.log(JSON.stringify({ fixtureStopped: true }))
