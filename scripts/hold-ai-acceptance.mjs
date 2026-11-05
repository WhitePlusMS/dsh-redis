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
  const withGeo = process.argv.includes('--geo')
  // GEOADD is fixture setup only; the DSH plugin never receives a write command.
  if (withGeo) await admin.sendCommand(['GEOADD', 'fixture:places', '13.361389', '38.115556', 'fixture:west', '15.087269', '37.502669', 'fixture:east'])
  // Build delivery state only inside the owned fixture; no consumer runs during verification.
  const withUnknownLag = process.argv.includes('--unknown-lag')
  const withGroup = process.argv.includes('--stream-group') || withUnknownLag
  if (withGroup) {
    await admin.sendCommand(['XADD', 'fixture:stream', '2-0', 'field', 'synthetic-undelivered'])
    await admin.sendCommand(['XGROUP', 'CREATE', 'fixture:stream', 'fixture-group', '0-0'])
    await admin.sendCommand(['XREADGROUP', 'GROUP', 'fixture-group', 'fixture-consumer', 'COUNT', '1', 'STREAMS', 'fixture:stream', '>'])
    // An arbitrary starting ID makes Redis report an unknown lag for this group.
    if (withUnknownLag) await admin.sendCommand(['XGROUP', 'CREATE', 'fixture:stream', 'fixture-unknown', '1-1'])
  }
  // Optional credentials exist only on this owned fixture and are not reused elsewhere.
  if (process.argv.includes('--restricted')) {
    await admin.sendCommand(['ACL', 'SETUSER', 'fixture-reader', 'reset', 'on', '>fixture-only', '~fixture:*', '+@read', '+ping', '-hget', '-scan'])
  }
  const buffers = admin.withTypeMapping({ [RESP_TYPES.BLOB_STRING]: Buffer })
  // Check every fixture key, including absolute expiry, before releasing the instance.
  const keys = [...Array.from({ length: 16 }, (_, index) => 'fixture:order:' + index), 'fixture:user:123', 'fixture:members', 'fixture:scores', 'fixture:string', 'fixture:list', 'fixture:stream']
  if (withGeo) keys.push('fixture:places')
  const before = await Promise.all(keys.map(key => buffers.sendCommand(['DUMP', key])))
  const expiry = await Promise.all(keys.map(key => admin.sendCommand(['PEXPIRETIME', key])))
  const groupBefore = withGroup ? await buffers.sendCommand(['XINFO', 'GROUPS', 'fixture:stream']) : null
  const pendingBefore = withGroup ? await buffers.sendCommand(['XPENDING', 'fixture:stream', 'fixture-group']) : null
  const watchedCommands = ['xreadgroup', 'xack', 'xclaim', 'xautoclaim', 'xgroup|setid', 'xdel', 'xtrim']
  const commandCounts = async () => {
    const rows = (await admin.info('commandstats')).split('\n')
    return Object.fromEntries(watchedCommands.map(name => {
      const row = rows.find(line => line.startsWith('cmdstat_' + name + ':calls='))
      return [name, Number(row?.match(/:calls=(\d+)/u)?.[1] ?? 0)]
    }))
  }
  const beforeCommands = withGroup ? await commandCounts() : null
  if (withGroup) {
    assert(Array.isArray(pendingBefore)); assert.equal(Number(pendingBefore[0]), 1)
    assert(Array.isArray(groupBefore))
    const knownGroup = groupBefore.find(group => String(group.name) === 'fixture-group')
    assert(knownGroup); assert.equal(Number(knownGroup.pending), 1); assert.equal(Number(knownGroup.lag), 1)
    if (withUnknownLag) {
      const unknownGroup = groupBefore.find(group => String(group.name) === 'fixture-unknown')
      assert(unknownGroup); assert.equal(unknownGroup.lag, null); assert.equal(unknownGroup['entries-read'], null)
    }
  }
  console.log(JSON.stringify({ ready: true, host: settings.host, port: settings.port, syntheticKeys: keys.length, restricted: process.argv.includes('--restricted'), streamGroup: withGroup, unknownLag: withUnknownLag, geo: withGeo }))
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
  if (withGroup) {
    assert.deepEqual(await buffers.sendCommand(['XINFO', 'GROUPS', 'fixture:stream']), groupBefore)
    assert.deepEqual(await buffers.sendCommand(['XPENDING', 'fixture:stream', 'fixture-group']), pendingBefore)
    assert.deepEqual(await commandCounts(), beforeCommands)
  }
  console.log(JSON.stringify({ fixtureDataUnchanged: true, ...(withGroup ? { groupStateUnchanged: true, noConsumptionCommands: true } : {}) }))
}, { passwordRequired: false })
assert(fixture.stopped)
console.log(JSON.stringify({ fixtureStopped: true }))
