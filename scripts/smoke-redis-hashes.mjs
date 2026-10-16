/** Actual HSCAN/ACL/size acceptance; all mutations target disposable fixture data. */
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { RESP_TYPES } from 'redis'
import { RedisConnections, openRedis } from '../lib/host/connection-service.js'
import { RedisHashes } from '../lib/host/hash-reader.js'
import { until, withRedisFixture } from './redis-fixture.mjs'

const report = { startedAt: new Date().toISOString(), checks: [], fixtures: [], passed: false }
const signal = () => new AbortController().signal
const target = view => { assert(view.id !== null); return { id: view.id, generation: view.generation, db: view.db } }
try {
  await withRedisFixture(async ({ settings, admin, clients, metadata }) => {
    report.fixtures.push(metadata)
    const key = Buffer.from([255, 0, 13]), field = Buffer.from([254, 0, 10]), value = Buffer.from([255, 0, 13, 10])
    const large = Buffer.concat([Buffer.alloc(65535, 97), Buffer.from('中😀'), Buffer.alloc(65536, 98)])
    await admin.hSet(key, field, value); await admin.hSet(key, '', ''); await admin.hSet(key, 'large', large); await admin.pExpire(key, 120000)
    for (let index = 0; index < 230; index++) await admin.hSet('many', 'item:' + index, 'value:' + index)
    // Compact hashes may ignore COUNT and return all entries. Use an observed
    // hashtable for the separate real-continuation assertion below.
    await admin.hSet('many', 'item:0', 'v'.repeat(1024))
    assert.equal(await admin.sendCommand(['OBJECT', 'ENCODING', 'many']), 'hashtable')
    await admin.hSet('huge-field', Buffer.alloc(65537, 97), 'value'); await admin.hSet('huge-value', 'field', Buffer.alloc(2 * 1024 * 1024, 97))
    for (let index = 0; index < 6; index++) await admin.hSet('amplified-page', Buffer.alloc(65536, index), Buffer.alloc(65536, 97))
    const buffers = admin.withTypeMapping({ [RESP_TYPES.BLOB_STRING]: Buffer })
    const dump = await buffers.sendCommand(['DUMP', key]), expiry = await admin.sendCommand(['PEXPIRETIME', key])
    const stats = async () => {
      const info = await admin.info('commandstats')
      return Object.fromEntries(['hgetall', 'hget', 'hset', 'hdel'].map(command => [command, Number(new RegExp('^cmdstat_' + command + ':calls=(\\d+)', 'mu').exec(info)?.[1] ?? 0)]))
    }
    const before = await stats(), baseline = await clients(), connections = new RedisConnections(), reader = new RedisHashes(connections)
    try {
      let view = await connections.connect('a', settings, signal())
      const request = (name, pattern = '*', cursor = null) => ({ target: target(view), keyBase64: (Buffer.isBuffer(name) ? name : Buffer.from(name)).toString('base64'), pattern, cursor })
      const first = await reader.scan('a', request(key), signal())
      assert.equal(first.state, 'page'); assert.equal(first.metadata.length, '3'); assert(BigInt(first.metadata.ttlMs) > 0n)
      assert.deepEqual(Buffer.from(first.entries.find(row => row.field.base64 === field.toString('base64')).value.base64, 'base64'), value)
      assert.equal(first.entries.find(row => row.field.base64 === '').value.byteLength, 0)
      const largeValue = first.entries.find(row => row.field.base64 === Buffer.from('large').toString('base64')).value
      assert.equal(largeValue.fullByteLength, large.length); assert.equal(largeValue.byteLength, 65536)
      assert.deepEqual(Buffer.from(largeValue.base64, 'base64'), large.subarray(0, 65536)); assert.deepEqual(Buffer.from(largeValue.suffix, 'base64'), large.subarray(65536, 65539))
      report.checks.push('actual binary/empty field and value bytes, precise TTL and 64 KiB prefix with UTF-8 boundary context')
      async function scanAll(pattern) {
        const fields = new Set(); let cursor = null, pages = 0
        do {
          const result = await reader.scan('a', request('many', pattern, cursor), signal())
          assert.equal(result.state, 'page'); assert.equal(result.metadata.length, '230')
          for (const row of result.entries) fields.add(Buffer.from(row.field.base64, 'base64').toString())
          cursor = result.cursor; assert(++pages < 50)
        } while (cursor !== null)
        return { fields, pages }
      }
      const all = await scanAll('*'); assert.equal(all.fields.size, 230); assert(all.pages > 1)
      assert.equal((await scanAll('item:1*')).fields.size, 111); assert.equal((await scanAll('absent:*')).fields.size, 0)
      assert.deepEqual(await stats(), before); assert.deepEqual(await buffers.sendCommand(['DUMP', key]), dump); assert.equal(await admin.sendCommand(['PEXPIRETIME', key]), expiry)
      report.checks.push('actual incremental HSCAN and MATCH complete without HGET/HGETALL or writes; serialized bytes and absolute expiry unchanged')
      await admin.sendCommand(['ACL', 'SETUSER', 'hash-reader', 'reset', 'on', '>' + settings.password, '~*', '+ping', '+type', '+pttl', '+hlen', '+hscan'])
      const restricted = await connections.connect('restricted', { ...settings, username: 'hash-reader' }, signal())
      const limited = { ...request(key), target: target(restricted) }
      assert.equal((await reader.scan('restricted', limited, signal())).state, 'page')
      assert.match(await admin.sendCommand(['ACL', 'DRYRUN', 'hash-reader', 'HSET', 'many', 'x', 'y']), /no permissions/u)
      await admin.sendCommand(['ACL', 'SETUSER', 'hash-reader', '-hscan'])
      assert.deepEqual((await reader.scan('restricted', limited, signal())).entries, [])
      assert.equal((await reader.scan('restricted', limited, signal())).error, 'permission')
      report.checks.push('minimal read ACL succeeds; denied HSCAN is permission rather than missing and HSET remains forbidden')
      assert.equal((await reader.scan('a', request('huge-field'), signal())).error, 'oversize')
      assert.equal(connections.status('a').state, 'connected'); assert.equal((await reader.scan('a', request(key), signal())).state, 'page')
      const amplified = await reader.scan('a', request('amplified-page'), signal())
      assert.equal(amplified.error, 'oversize'); assert.deepEqual(amplified.entries, []); assert.equal(amplified.cursor, null)
      assert.equal(connections.status('a').state, 'connected')
      assert.equal((await reader.scan('a', request('huge-value'), signal())).error, 'oversize')
      assert.equal(connections.status('a').state, 'error')
      assert.equal(connections.status('restricted').state, 'connected')
      view = await connections.connect('a', settings, signal()); assert.equal((await reader.scan('a', request(key), signal())).state, 'page')
      report.checks.push('65,537-byte field and a sub-1-MiB RESP page amplified above the JSON budget are refused whole on a healthy socket; 2 MiB value is rejected by bounded reception and closes only its own socket; explicit reconnect recovers')
      const old = request(key)
      view = await connections.selectDatabase('a', { ...target(view), db: 1 }, signal())
      assert.equal((await reader.scan('a', old, signal())).error, 'stale')
      assert.equal((await reader.scan('a', request(key), signal())).state, 'missing')
      report.checks.push('actual DB change rejects old generation and isolates DB1 without stale fields')
      for (const mutation of ['type', 'missing', 'length']) {
        await admin.del('changing'); await admin.hSet('changing', 'field', 'original')
        let changed = false
        const controlled = new RedisConnections(async (options, requestSignal) => {
          const link = await openRedis(options, requestSignal)
          return { ...link, execute: async (command, args, commandSignal, guard, deadline) => {
            const reply = await link.execute(command, args, commandSignal, guard, deadline)
            if (command === 'HSCAN' && !changed) {
              changed = true
              if (mutation === 'length') await admin.hSet('changing', 'new-field', 'new')
              else { await admin.del('changing'); if (mutation === 'type') await admin.set('changing', 'string') }
            }
            return reply
          } }
        })
        const hash = new RedisHashes(controlled)
        try {
          const connected = await controlled.connect('changing', settings, signal())
          const result = await hash.scan('changing', { target: target(connected), keyBase64: Buffer.from('changing').toString('base64'), pattern: '*', cursor: null }, signal())
          assert.equal(result.state, mutation === 'missing' ? 'missing' : 'changed'); assert.deepEqual(result.entries, []); assert.equal(result.cursor, null)
        } finally { hash.dispose(); controlled.dispose() }
      }
      report.checks.push('admin changes between actual HSCAN and metadata replies discard type/length/deletion races without returning old cells')
    } finally { reader.dispose(); connections.dispose() }
    await until(async () => await clients() === baseline, 'all Hash viewer sockets released')
  })
  assert(report.fixtures.every(value => value.stopped)); report.passed = true
} catch (error) { report.error = (error instanceof Error ? error.message : String(error)).replace(/(--requirepass\s+)\S+/gu, '$1[redacted]'); process.exitCode = 1; console.error(report.error) }
finally {
  report.finishedAt = new Date().toISOString()
  const directory = resolve(import.meta.dirname, '../.scratch/artifacts'); await mkdir(directory, { recursive: true })
  await writeFile(resolve(directory, 'hashes-smoke.json'), JSON.stringify(report, null, 2) + '\n')
  console.log(JSON.stringify({ passed: report.passed, checks: report.checks.length, fixturesStopped: report.fixtures.every(value => value.stopped) }))
}
