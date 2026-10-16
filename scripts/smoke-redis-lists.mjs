/** Actual List index/range/ACL acceptance on exclusive disposable fixtures. */
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { RESP_TYPES } from 'redis'
import { RedisConnections, openRedis } from '../lib/host/connection-service.js'
import { RedisLists } from '../lib/host/list-reader.js'
import { until, withRedisFixture } from './redis-fixture.mjs'

const report = { startedAt: new Date().toISOString(), checks: [], fixtures: [], passed: false }
const signal = () => new AbortController().signal
const target = view => { assert(view.id !== null); return { id: view.id, generation: view.generation, db: view.db } }
try {
  await withRedisFixture(async ({ settings, admin, clients, metadata }) => {
    report.fixtures.push(metadata)
    const key = Buffer.from([255, 0, 13]), large = Buffer.alloc(131073, 97)
    const items = [Buffer.from('same'), Buffer.from('same'), Buffer.from([255, 0]), Buffer.alloc(0), large, ...Array.from({ length: 230 }, (_, index) => Buffer.from('item:' + index))]
    await admin.rPush(key, items); await admin.pExpire(key, 120000)
    await admin.rPush('amplified', Array.from({ length: 12 }, () => Buffer.alloc(65536, 97)))
    await admin.rPush('giant', Buffer.alloc(2 * 1024 * 1024, 97))
    const buffers = admin.withTypeMapping({ [RESP_TYPES.BLOB_STRING]: Buffer })
    const dump = await buffers.sendCommand(['DUMP', key]), expiry = await admin.sendCommand(['PEXPIRETIME', key])
    const stats = async () => {
      const info = await admin.info('commandstats')
      return Object.fromEntries(['lpush', 'rpush', 'lpop', 'rpop', 'lset', 'ltrim', 'lrem'].map(command => [command, Number(new RegExp('^cmdstat_' + command + ':calls=(\\d+)', 'mu').exec(info)?.[1] ?? 0)]))
    }
    const before = await stats(), baseline = await clients(), connections = new RedisConnections()
    try {
      let view = await connections.connect('a', settings, signal())
      const reader = new RedisLists(connections), request = (name = key, offset = '0', count = 100) => ({ target: target(view), keyBase64: (Buffer.isBuffer(name) ? name : Buffer.from(name)).toString('base64'), offset, count })
      const first = await reader.read('a', request(), signal())
      assert.equal(first.state, 'page'); assert.equal(first.entries.length, 100); assert.equal(first.metadata.length, '235'); assert(BigInt(first.metadata.ttlMs) > 0n)
      assert.deepEqual(first.entries.slice(0, 2).map(row => row.index), ['0', '1']); assert.deepEqual(first.entries[0].value, first.entries[1].value)
      assert.deepEqual(Buffer.from(first.entries[2].value.base64, 'base64'), items[2]); assert.equal(first.entries[3].value.byteLength, 0)
      assert.equal(first.entries[4].value.fullByteLength, large.length); assert.equal(first.entries[4].value.byteLength, 65536)
      report.checks.push('actual binary key, duplicate zero-based positions, binary/empty elements, precise TTL and bounded long-value prefix')
      const second = await reader.read('a', request(key, first.nextOffset), signal()), tail = await reader.read('a', request(key, second.nextOffset), signal())
      assert.equal(second.offset, '100'); assert.equal(second.nextOffset, '200'); assert.equal(tail.entries.length, 35); assert.equal(tail.entries[34].index, '234'); assert.equal(tail.nextOffset, null)
      const eof = await reader.read('a', request(key, '9223372036854775807'), signal())
      assert.equal(eof.state, 'page'); assert.deepEqual(eof.entries, []); assert.equal(eof.nextOffset, null)
      assert.deepEqual(await stats(), before); assert.deepEqual(await buffers.sendCommand(['DUMP', key]), dump); assert.equal(await admin.sendCommand(['PEXPIRETIME', key]), expiry)
      report.checks.push('actual inclusive intervals continue 0/100/200 through the final index; signed-64-bit EOF is empty; serialized data/expiry and write counters unchanged')
      await admin.sendCommand(['ACL', 'SETUSER', 'list-reader', 'reset', 'on', '>' + settings.password, '~*', '+ping', '+type', '+pttl', '+llen', '+lrange'])
      const restricted = await connections.connect('restricted', { ...settings, username: 'list-reader' }, signal()), limited = { ...request(), target: target(restricted) }
      assert.equal((await reader.read('restricted', limited, signal())).state, 'page')
      assert.match(await admin.sendCommand(['ACL', 'DRYRUN', 'list-reader', 'LPOP', 'giant']), /no permissions/u)
      await admin.sendCommand(['ACL', 'SETUSER', 'list-reader', '-lrange'])
      assert.equal((await reader.read('restricted', limited, signal())).error, 'permission')
      report.checks.push('minimal List read ACL works and LRANGE refusal is permission rather than missing; LPOP remains forbidden')
      const amplified = await reader.read('a', request('amplified'), signal())
      assert.equal(amplified.error, 'oversize'); assert.deepEqual(amplified.entries, []); assert.equal(amplified.nextOffset, null); assert.equal(connections.status('a').state, 'connected')
      assert.equal((await reader.read('a', request('giant'), signal())).error, 'oversize'); assert.equal(connections.status('a').state, 'error'); assert.equal(connections.status('restricted').state, 'connected')
      view = await connections.connect('a', settings, signal()); assert.equal((await reader.read('a', request(), signal())).state, 'page')
      report.checks.push('JSON-amplified interval is refused whole on a healthy socket; 2 MiB element is rejected before unbounded reception and closes only its own socket')
      const old = request(); view = await connections.selectDatabase('a', { ...target(view), db: 1 }, signal())
      assert.equal((await reader.read('a', old, signal())).error, 'stale'); assert.equal((await reader.read('a', request(), signal())).state, 'missing')
      report.checks.push('actual DB generation switch refuses old List intervals and isolates DB1')
      for (const mutation of ['length', 'type', 'missing']) {
        await admin.del('changing'); await admin.rPush('changing', ['one', 'two'])
        let changed = false
        const controlled = new RedisConnections(async (options, requestSignal) => {
          const link = await openRedis(options, requestSignal)
          return { ...link, execute: async (command, args, commandSignal, guard, deadline) => {
            const reply = await link.execute(command, args, commandSignal, guard, deadline)
            if (command === 'LRANGE' && !changed) {
              changed = true
              if (mutation === 'length') await admin.lPush('changing', 'new')
              else { await admin.del('changing'); if (mutation === 'type') await admin.hSet('changing', 'field', 'value') }
            }
            return reply
          } }
        })
        try {
          const connected = await controlled.connect('changing', settings, signal())
          const result = await new RedisLists(controlled).read('changing', { target: target(connected), keyBase64: Buffer.from('changing').toString('base64'), offset: '0', count: 100 }, signal())
          assert.equal(result.state, mutation === 'missing' ? 'missing' : 'changed'); assert.deepEqual(result.entries, []); assert.equal(result.nextOffset, null)
        } finally { controlled.dispose() }
      }
      report.checks.push('admin inserts/type changes/deletes between actual LRANGE and metadata replies discard the old interval')
    } finally { connections.dispose() }
    await until(async () => await clients() === baseline, 'all List viewer sockets released')
  })
  assert(report.fixtures.every(value => value.stopped)); report.passed = true
} catch (error) { report.error = (error instanceof Error ? error.message : String(error)).replace(/(--requirepass\s+)\S+/gu, '$1[redacted]'); process.exitCode = 1; console.error(report.error) }
finally {
  report.finishedAt = new Date().toISOString()
  const directory = resolve(import.meta.dirname, '../.scratch/artifacts'); await mkdir(directory, { recursive: true })
  await writeFile(resolve(directory, 'lists-smoke.json'), JSON.stringify(report, null, 2) + '\n')
  console.log(JSON.stringify({ passed: report.passed, checks: report.checks.length, fixturesStopped: report.fixtures.every(value => value.stopped) }))
}
