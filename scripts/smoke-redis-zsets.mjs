/** Real rank/score/scan/ACL acceptance against owned disposable Redis only. */
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { RESP_TYPES } from 'redis'
import { RedisConnections, openRedis } from '../lib/host/connection-service.js'
import { RedisZSets } from '../lib/host/zset-reader.js'
import { until, withRedisFixture } from './redis-fixture.mjs'

const report = { startedAt: new Date().toISOString(), checks: [], fixtures: [], passed: false }
const signal = () => new AbortController().signal
const target = view => { assert(view.id !== null); return { id: view.id, generation: view.generation, db: view.db } }
try {
  await withRedisFixture(async ({ settings, admin, clients, metadata }) => {
    report.fixtures.push(metadata)
    const key = Buffer.from([255, 0, 13]), binary = Buffer.from([254, 0])
    await admin.sendCommand(['ZADD', key, '-inf', Buffer.alloc(0), '-0', binary, '1.0000000000000002', 'precise', '1e100', 'large-score', 'inf', 'last'])
    await admin.pExpire(key, 120000)
    for (let index = 0; index < 230; index++) await admin.sendCommand(['ZADD', 'many', String(index), 'item:' + index])
    await admin.sendCommand(['ZADD', 'many', '-1', 'x'.repeat(1024)])
    assert.equal(await admin.sendCommand(['OBJECT', 'ENCODING', 'many']), 'skiplist')
    for (const [name, bytes] of [['largest', 65536], ['huge-member', 65537], ['giant', 2 * 1024 * 1024]]) await admin.sendCommand(['ZADD', name, '0', Buffer.alloc(bytes, 97)])
    for (let index = 0; index < 12; index++) await admin.sendCommand(['ZADD', 'amplified', String(index), Buffer.alloc(65536, index)])
    const buffers = admin.withTypeMapping({ [RESP_TYPES.BLOB_STRING]: Buffer })
    const dump = await buffers.sendCommand(['DUMP', key]), expiry = await admin.sendCommand(['PEXPIRETIME', key])
    const stats = async () => {
      const info = await admin.info('commandstats')
      return Object.fromEntries(['zadd', 'zrem', 'zpopmin', 'zpopmax', 'zincrby'].map(command => [command, Number(new RegExp('^cmdstat_' + command + ':calls=(\\d+)', 'mu').exec(info)?.[1] ?? 0)]))
    }
    const before = await stats(), baseline = await clients(), connections = new RedisConnections(), reader = new RedisZSets(connections)
    try {
      let view = await connections.connect('a', settings, signal())
      const request = (name, offset = '0', count = 100) => ({ target: target(view), keyBase64: (Buffer.isBuffer(name) ? name : Buffer.from(name)).toString('base64'), mode: 'range', offset, count })
      const scan = (name, pattern = '*', cursor = null) => ({ target: target(view), keyBase64: (Buffer.isBuffer(name) ? name : Buffer.from(name)).toString('base64'), mode: 'scan', pattern, cursor })
      const page = await reader.read('a', request(key), signal())
      assert.equal(page.state, 'page'); assert.equal(page.metadata.length, '5'); assert(BigInt(page.metadata.ttlMs) > 0n)
      // Fixed Redis 8.2.6 sample oracle, without a client double conversion:
      // Redis normalizes inserted -0, while the viewer preserves returned text.
      assert.deepEqual(page.entries.map(row => Buffer.from(row.member.base64, 'base64')), [Buffer.alloc(0), binary, Buffer.from('precise'), Buffer.from('large-score'), Buffer.from('last')])
      assert.deepEqual(page.entries.map(row => row.score), ['-inf', '0', '1.0000000000000002', '1e+100', 'inf'])
      assert.deepEqual(page.entries.map(row => row.rank), ['0', '1', '2', '3', '4'])
      assert.equal(page.entries[0].member.byteLength, 0); assert.equal(page.entries[1].member.base64, binary.toString('base64'))
      assert.equal(page.entries[2].score, '1.0000000000000002'); assert.equal(page.entries[0].score, '-inf'); assert.equal(page.entries[4].score, 'inf')
      report.checks.push('actual binary key/member and empty member, exact raw WITHSCORES strings including infinities/high precision, ascending zero-based rank and precise TTL')
      const first = await reader.read('a', request('many'), signal()), second = await reader.read('a', request('many', first.nextOffset), signal()), tail = await reader.read('a', request('many', second.nextOffset), signal())
      assert.equal(first.entries.length, 100); assert.equal(second.offset, '100'); assert.equal(tail.offset, '200'); assert.equal(tail.entries.length, 31); assert.equal(tail.nextOffset, null)
      assert.equal(first.entries[0].score, '-1'); assert.equal(tail.entries[30].rank, '230')
      assert.deepEqual((await reader.read('a', request('many', '9223372036854775807'), signal())).entries, [])
      async function scanAll(pattern) {
        const members = new Map(); let cursor = null, pages = 0
        do {
          const page = await reader.read('a', scan('many', pattern, cursor), signal())
          assert.equal(page.state, 'page'); assert.equal(page.offset, null); assert.equal(page.nextOffset, null)
          for (const row of page.entries) { assert.equal(row.rank, null); members.set(row.member.base64, row.score) }
          cursor = page.cursor; assert(++pages < 50)
        } while (cursor !== null)
        return { members, pages }
      }
      const all = await scanAll('*'); assert.equal(all.members.size, 231); assert(all.pages > 1)
      assert.equal((await scanAll('item:1*')).members.size, 111); assert.equal((await scanAll('absent:*')).members.size, 0)
      assert.deepEqual(await stats(), before); assert.deepEqual(await buffers.sendCommand(['DUMP', key]), dump); assert.equal(await admin.sendCommand(['PEXPIRETIME', key]), expiry)
      report.checks.push('actual rank intervals 0/100/200 and signed-64-bit EOF differ from unordered multi-page MATCH scans; writes, serialized bytes and absolute expiry unchanged')
      const unfinished = await reader.read('a', scan('many'), signal()); assert.notEqual(unfinished.cursor, null)
      await reader.read('a', request('many'), signal())
      assert.equal((await reader.read('a', scan('many', '*', unfinished.cursor), signal())).error, 'stale')
      report.checks.push('actual rank-mode read invalidates a prior scan continuation instead of treating cursor as an offset')
      await admin.sendCommand(['ACL', 'SETUSER', 'zset-reader', 'reset', 'on', '>' + settings.password, '~*', '+ping', '+type', '+pttl', '+zcard', '+zrange', '+zscan'])
      const restricted = await connections.connect('restricted', { ...settings, username: 'zset-reader' }, signal())
      const limited = { ...request(key), target: target(restricted) }, limitedScan = { ...scan(key), target: target(restricted) }
      assert.equal((await reader.read('restricted', limited, signal())).state, 'page'); assert.equal((await reader.read('restricted', limitedScan, signal())).state, 'page')
      assert.match(await admin.sendCommand(['ACL', 'DRYRUN', 'zset-reader', 'ZADD', 'many', '1', 'x']), /no permissions/u)
      await admin.sendCommand(['ACL', 'SETUSER', 'zset-reader', '-zscan'])
      assert.equal((await reader.read('restricted', limitedScan, signal())).error, 'permission'); assert.equal((await reader.read('restricted', limited, signal())).state, 'page')
      report.checks.push('minimal ACL permits both modes, refuses ZSCAN distinctly while rank still works, and forbids ZADD')
      assert.equal((await reader.read('a', request('largest'), signal())).entries[0].member.byteLength, 65536)
      for (const read of [request('huge-member'), scan('huge-member'), request('amplified'), scan('amplified')]) {
        const page = await reader.read('a', read, signal()); assert.equal(page.error, 'oversize'); assert.deepEqual(page.entries, []); assert.equal(page.cursor, null); assert.equal(page.nextOffset, null); assert.equal(connections.status('a').state, 'connected')
      }
      assert.equal((await reader.read('a', request('giant', '0', 1), signal())).error, 'oversize'); assert.equal(connections.status('a').state, 'error'); assert.equal(connections.status('restricted').state, 'connected')
      view = await connections.connect('a', settings, signal()); assert.equal((await reader.read('a', request(key), signal())).state, 'page')
      report.checks.push('full 64 KiB identities survive; 65,537-byte/JSON-amplified rank and scan pages refuse whole on a healthy socket; 2 MiB member closes only its own bounded socket and manual reconnect recovers')
      const old = request(key); view = await connections.selectDatabase('a', { ...target(view), db: 1 }, signal())
      assert.equal((await reader.read('a', old, signal())).error, 'stale'); assert.equal((await reader.read('a', request(key), signal())).state, 'missing')
      report.checks.push('actual DB generation changes reject old rank requests and isolate DB1')
      for (const mode of ['range', 'scan']) for (const mutation of ['length', 'type', 'missing']) {
        await admin.del('changing'); await admin.sendCommand(['ZADD', 'changing', '1', 'one', '2', 'two'])
        let changed = false
        const controlled = new RedisConnections(async (options, requestSignal) => {
          const link = await openRedis(options, requestSignal)
          return { ...link, execute: async (command, args, commandSignal, guard, deadline) => {
            const reply = await link.execute(command, args, commandSignal, guard, deadline)
            if (command === (mode === 'range' ? 'ZRANGE' : 'ZSCAN') && !changed) {
              changed = true
              if (mutation === 'length') await admin.sendCommand(['ZADD', 'changing', '3', 'three'])
              else { await admin.del('changing'); if (mutation === 'type') await admin.set('changing', 'string') }
            }
            return reply
          } }
        })
        const controlledReader = new RedisZSets(controlled)
        try {
          const connected = await controlled.connect('changing', settings, signal())
          const request = { target: target(connected), keyBase64: Buffer.from('changing').toString('base64'), ...(mode === 'range' ? { mode, offset: '0', count: 100 } : { mode, pattern: '*', cursor: null }) }
          const page = await controlledReader.read('changing', request, signal())
          assert.equal(page.state, mutation === 'missing' ? 'missing' : 'changed'); assert.deepEqual(page.entries, []); assert.equal(page.cursor, null); assert.equal(page.nextOffset, null)
        } finally { controlledReader.dispose(); controlled.dispose() }
      }
      report.checks.push('admin cardinality/type/deletion changes between actual ZRANGE or ZSCAN and metadata replies discard old rows')
    } finally { reader.dispose(); connections.dispose() }
    await until(async () => await clients() === baseline, 'all ZSet viewer sockets released')
  })
  assert(report.fixtures.every(value => value.stopped)); report.passed = true
} catch (error) { report.error = (error instanceof Error ? error.message : String(error)).replace(/(--requirepass\s+)\S+/gu, '$1[redacted]'); process.exitCode = 1; console.error(report.error) }
finally {
  report.finishedAt = new Date().toISOString()
  const directory = resolve(import.meta.dirname, '../.scratch/artifacts'); await mkdir(directory, { recursive: true })
  await writeFile(resolve(directory, 'zsets-smoke.json'), JSON.stringify(report, null, 2) + '\n')
  console.log(JSON.stringify({ passed: report.passed, checks: report.checks.length, fixturesStopped: report.fixtures.every(value => value.stopped) }))
}
