/** Real GEOPOS and rank-range acceptance on exclusive owned Redis instances. */
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { RESP_TYPES } from 'redis'
import { RedisConnections, openRedis } from '../lib/host/connection-service.js'
import { RedisGeo } from '../lib/host/geo-reader.js'
import { RedisZSets } from '../lib/host/zset-reader.js'
import { until, withRedisFixture } from './redis-fixture.mjs'

const report = { startedAt: new Date().toISOString(), checks: [], fixtures: [], passed: false }
const signal = () => new AbortController().signal
const target = view => { assert(view.id !== null); return { id: view.id, generation: view.generation, db: view.db } }
try {
  await withRedisFixture(async ({ settings, admin, clients, metadata }) => {
    report.fixtures.push(metadata)
    const key = Buffer.from([255, 0, 13]), binary = Buffer.from([254, 0]), buffers = admin.withTypeMapping({ [RESP_TYPES.BLOB_STRING]: Buffer })
    await admin.sendCommand(['GEOADD', key, '13.361389', '38.115556', binary, '15.087269', '37.502669', '', '0', '0', 'origin'])
    await admin.pExpire(key, 120000)
    for (let index = 0; index < 235; index++) await admin.sendCommand(['GEOADD', 'many', String(-170 + index), String(-80 + index / 2), 'member-' + index])
    await admin.sendCommand(['ZADD', 'ordinary', '-1', 'negative', '0', 'zero', '1.5', 'fraction', '9007199254740992', 'large', 'inf', 'infinity'])
    await admin.sendCommand(['GEOADD', 'request-limit', '13', '38', Buffer.alloc(49152, 97), '14', '39', Buffer.alloc(49152, 98)])
    await admin.sendCommand(['ZADD', 'huge-member', '1', Buffer.alloc(65537, 97)])
    await admin.sendCommand(['ZADD', 'giant', '1', Buffer.alloc(2 * 1024 * 1024, 97)])
    await admin.set('plain', 'value')
    // The oracle uses RESP2, retaining coordinate and score reply text rather
    // than default RESP3 native doubles. It is not the product connection.
    await admin.sendCommand(['HELLO', '2'])
    const dump = await buffers.sendCommand(['DUMP', key]), expiry = await admin.sendCommand(['PEXPIRETIME', key])
    const stats = async () => {
      const map = new Map([...(await admin.info('commandstats')).matchAll(/^cmdstat_([^:]+):calls=(\d+)/gmu)].map(match => [match[1], Number(match[2])]))
      return Object.fromEntries(['geoadd', 'zadd', 'zrem', 'zincrby', 'zpopmin', 'zpopmax', 'geosearchstore', 'del', 'expire', 'pexpire'].map(command => [command, map.get(command) ?? 0]))
    }
    const before = await stats(), baseline = await clients(), connections = new RedisConnections(), reader = new RedisGeo(connections), zsets = new RedisZSets(connections)
    try {
      let view = await connections.connect('geo', settings, signal())
      const request = (name = key, offset = '0', count = 100) => ({ target: target(view), keyBase64: (Buffer.isBuffer(name) ? name : Buffer.from(name)).toString('base64'), offset, count })
      const page = await reader.read('geo', request(), signal())
      assert.equal(page.state, 'page'); assert.equal(page.metadata.type, 'zset'); assert.equal(page.metadata.length, '3'); assert(BigInt(page.metadata.ttlMs) > 0n)
      assert(page.entries.some(entry => entry.member.base64 === binary.toString('base64'))); assert(page.entries.some(entry => entry.member.base64 === ''))
      const original = await buffers.sendCommand(['ZRANGE', key, '0', '-1', 'WITHSCORES'])
      const positions = await buffers.sendCommand(['GEOPOS', key, ...page.entries.map(entry => Buffer.from(entry.member.base64, 'base64'))])
      for (const [index, entry] of page.entries.entries()) {
        assert.equal(entry.rank, String(index)); assert.deepEqual(Buffer.from(entry.member.base64, 'base64'), original[index * 2]); assert.equal(entry.score, original[index * 2 + 1].toString())
        assert.deepEqual(entry.position, { longitude: positions[index][0].toString(), latitude: positions[index][1].toString() })
      }
      assert.equal(page.entries.find(entry => entry.member.base64 === binary.toString('base64')).position.longitude, '13.361389338970184')
      report.checks.push('actual binary/empty members retain full raw identity, rank, score and exact quantized coordinate text from an independent RESP2 oracle')
      const rows = []; let offset = '0', pages = 0
      do {
        const next = await reader.read('geo', request('many', offset), signal()); assert.equal(next.state, 'page')
        assert(next.entries.every(entry => entry.position !== null)); rows.push(...next.entries); offset = next.nextOffset; assert(++pages < 10)
      } while (offset !== null)
      assert.equal(rows.length, 235); assert.equal(new Set(rows.map(entry => entry.member.base64)).size, 235); assert.deepEqual(rows.map(entry => entry.rank), Array.from({ length: 235 }, (_, index) => String(index)))
      const eof = await reader.read('geo', request('many', '9223372036854775807'), signal()); assert.equal(eof.state, 'page'); assert.equal(eof.entries.length, 0); assert.equal(eof.nextOffset, null)
      assert.equal((await reader.read('geo', request('missing'), signal())).state, 'missing'); assert.equal((await reader.read('geo', request('plain'), signal())).state, 'unsupported')
      const ordinary = await reader.read('geo', request('ordinary'), signal()); assert.equal(ordinary.state, 'page'); assert.equal(ordinary.metadata.type, 'zset'); assert(ordinary.entries.every(entry => entry.position !== null)); assert(ordinary.entries.some(entry => entry.score === 'inf'))
      report.checks.push('235-member rank0/100/200 ranges and exact EOF preserve ranks without duplicates; ordinary negative/fraction/infinity ZSet scores also decode without a Geo-type claim')
      assert.deepEqual(await buffers.sendCommand(['DUMP', key]), dump); assert.equal(await admin.sendCommand(['PEXPIRETIME', key]), expiry); assert.deepEqual(await stats(), before)
      report.checks.push('source serialized bytes, absolute expiry and GEO/ZSet write command counters remain unchanged')
      await admin.sendCommand(['ACL', 'SETUSER', 'geo-reader', 'reset', 'on', '>' + settings.password, '~*', '+ping', '+type', '+pttl', '+zcard', '+zrange', '+geopos'])
      const limited = await connections.connect('limited', { ...settings, username: 'geo-reader' }, signal()), restricted = { ...request(), target: target(limited) }
      assert.equal((await reader.read('limited', restricted, signal())).state, 'page')
      assert.match(await admin.sendCommand(['ACL', 'DRYRUN', 'geo-reader', 'GEOADD', key, '0', '0', 'new']), /no permissions/u)
      await admin.sendCommand(['ACL', 'SETUSER', 'geo-reader', '-geopos'])
      assert.equal((await reader.read('limited', restricted, signal())).error, 'permission')
      assert.equal((await zsets.read('limited', { ...restricted, mode: 'range' }, signal())).state, 'page')
      report.checks.push('minimal fixed read ACL succeeds; GEOPOS denial is permission, GEOADD is forbidden and original ZSet ranges still work')
      assert.equal((await reader.read('geo', request('request-limit'), signal())).error, 'oversize')
      assert.equal(connections.status('geo').state, 'connected')
      assert.equal((await reader.read('geo', request('request-limit', '0', 1), signal())).entries[0].member.byteLength, 49152)
      assert.equal((await reader.read('geo', request('huge-member'), signal())).error, 'oversize'); assert.equal(connections.status('geo').state, 'connected')
      assert.equal((await reader.read('geo', request('giant'), signal())).error, 'oversize'); assert.equal(connections.status('geo').state, 'error'); assert.equal(connections.status('limited').state, 'connected')
      view = await connections.connect('geo', settings, signal()); assert.equal((await reader.read('geo', request(), signal())).state, 'page')
      report.checks.push('96 KiB combined-argument and 65,537-byte identity refusals keep the socket healthy; smaller count recovers; 2 MiB receive refusal closes only owned socket and manual reconnect works')
      const old = request(), switched = await connections.selectDatabase('geo', { ...target(view), db: 1 }, signal()); view = switched
      assert.equal((await reader.read('geo', old, signal())).error, 'stale'); assert.equal((await reader.read('geo', request(), signal())).state, 'missing')
      view = await connections.selectDatabase('geo', { ...target(view), db: 0 }, signal())
      report.checks.push('actual DB generation changes reject old coordinate results and isolate DB1')
      for (const mode of ['length', 'type', 'delete', 'nil', 'wrong-type']) {
        await admin.del('race'); await admin.sendCommand(['GEOADD', 'race', '13', '38', 'one', '14', '39', 'two'])
        let changed = false
        const racing = new RedisConnections(async (credentials, commandSignal) => {
          const link = await openRedis(credentials, commandSignal)
          return { ...link, execute: async (...args) => {
            if (!changed && args[0] === 'GEOPOS' && (mode === 'nil' || mode === 'wrong-type')) {
              changed = true
              if (mode === 'nil') { await admin.zRem('race', Buffer.from(args[1][1])); await admin.sendCommand(['GEOADD', 'race', '15', '40', 'replacement']) }
              else { await admin.del('race'); await admin.set('race', 'plain') }
            }
            const reply = await link.execute(...args)
            if (!changed && args[0] === 'GEOPOS') {
              changed = true
              if (mode === 'length') await admin.sendCommand(['GEOADD', 'race', '15', '40', 'third'])
              else { await admin.del('race'); if (mode === 'type') await admin.set('race', 'plain') }
            }
            return reply
          } }
        })
        try {
          const selected = await racing.connect('race', settings, signal()), result = await new RedisGeo(racing).read('race', { ...request('race'), target: target(selected) }, signal())
          assert.equal(result.state, mode === 'nil' ? 'page' : mode === 'delete' ? 'missing' : 'changed')
          if (mode === 'nil') assert(result.entries.some(entry => entry.position === null))
          else assert.equal(result.entries.length, 0)
        } finally { racing.dispose() }
      }
      report.checks.push('actual metadata/type/deletion races discard rows; equal-cardinality member replacement yields a distinct nil position without pretending an atomic snapshot')
    } finally { zsets.dispose(); connections.dispose() }
    await until(async () => await clients() === baseline, 'owned GEO sockets closed')
  })
  await withRedisFixture(async ({ settings, admin, metadata }) => {
    metadata.geoposDisabled = true; report.fixtures.push(metadata)
    await admin.sendCommand(['GEOADD', 'geo', '13', '38', 'one'])
    const connections = new RedisConnections(), zsets = new RedisZSets(connections)
    try {
      const view = await connections.connect('unavailable', settings, signal()), request = { target: target(view), keyBase64: Buffer.from('geo').toString('base64'), offset: '0', count: 100 }
      assert.equal((await new RedisGeo(connections).read('unavailable', request, signal())).state, 'unavailable')
      assert.equal((await zsets.read('unavailable', { ...request, mode: 'range' }, signal())).state, 'page')
    } finally { zsets.dispose(); connections.dispose() }
  }, { disableGeoPos: true })
  report.checks.push('actual owned server with built-in GEOPOS disabled returns unavailable while the same ZSet remains readable; no synthetic refusal is used')
  report.passed = true
} finally {
  report.finishedAt = new Date().toISOString()
  const directory = resolve(import.meta.dirname, '../.scratch/artifacts'); await mkdir(directory, { recursive: true })
  await writeFile(resolve(directory, 'geo-smoke.json'), JSON.stringify(report, null, 2) + '\n')
}
console.log(JSON.stringify({ passed: report.passed, checks: report.checks.length, fixturesStopped: report.fixtures.every(value => value.stopped && value.certificatesRemoved && value.fixtureRemoved !== false) }))
