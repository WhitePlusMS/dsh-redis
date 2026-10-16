/** Actual SSCAN acceptance. Mutations are confined to owned disposable fixtures. */
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { RESP_TYPES } from 'redis'
import { RedisConnections, openRedis } from '../lib/host/connection-service.js'
import { RedisSets } from '../lib/host/set-reader.js'
import { until, withRedisFixture } from './redis-fixture.mjs'

const report = { startedAt: new Date().toISOString(), checks: [], fixtures: [], passed: false }
const signal = () => new AbortController().signal
const target = view => { assert(view.id !== null); return { id: view.id, generation: view.generation, db: view.db } }
try {
  await withRedisFixture(async ({ settings, admin, clients, metadata }) => {
    report.fixtures.push(metadata)
    const key = Buffer.from([255, 0, 13]), binary = Buffer.from([254, 0, 10]), largest = Buffer.alloc(65536, 97)
    await admin.sAdd(key, [binary, Buffer.alloc(0), largest]); await admin.pExpire(key, 120000)
    await admin.sAdd('many', [...Array.from({ length: 230 }, (_, index) => 'item:' + index), 'x'.repeat(1024)])
    assert.equal(await admin.sendCommand(['OBJECT', 'ENCODING', 'many']), 'hashtable')
    await admin.sAdd('huge-member', Buffer.alloc(65537, 97)); await admin.sAdd('giant', Buffer.alloc(2 * 1024 * 1024, 97))
    await admin.sAdd('amplified', Array.from({ length: 12 }, (_, index) => Buffer.alloc(65536, index)))
    const buffers = admin.withTypeMapping({ [RESP_TYPES.BLOB_STRING]: Buffer })
    const dump = await buffers.sendCommand(['DUMP', key]), expiry = await admin.sendCommand(['PEXPIRETIME', key])
    const stats = async () => {
      const info = await admin.info('commandstats')
      return Object.fromEntries(['smembers', 'sadd', 'srem', 'spop', 'smove'].map(command => [command, Number(new RegExp('^cmdstat_' + command + ':calls=(\\d+)', 'mu').exec(info)?.[1] ?? 0)]))
    }
    const before = await stats(), baseline = await clients(), connections = new RedisConnections(), reader = new RedisSets(connections)
    try {
      let view = await connections.connect('a', settings, signal())
      const request = (name, pattern = '*', cursor = null) => ({ target: target(view), keyBase64: (Buffer.isBuffer(name) ? name : Buffer.from(name)).toString('base64'), pattern, cursor })
      async function scanAll(name, pattern = '*') {
        const members = new Map(); let cursor = null, pages = 0
        do {
          const page = await reader.scan('a', request(name, pattern, cursor), signal())
          assert.equal(page.state, 'page'); assert.equal(page.metadata.type, 'set')
          for (const member of page.members) members.set(member.base64, member)
          cursor = page.cursor; assert(++pages < 50)
        } while (cursor !== null)
        return { members, pages }
      }
      const first = await reader.scan('a', request(key), signal())
      assert.equal(first.state, 'page'); assert.equal(first.metadata.length, '3'); assert(BigInt(first.metadata.ttlMs) > 0n)
      const raw = (await scanAll(key)).members
      assert.equal(raw.size, 3); assert.equal(raw.get('').byteLength, 0)
      assert.deepEqual(Buffer.from(raw.get(binary.toString('base64')).base64, 'base64'), binary)
      assert.deepEqual(Buffer.from(raw.get(largest.toString('base64')).base64, 'base64'), largest)
      report.checks.push('actual binary key, empty/binary/full 64 KiB members, precise TTL and complete byte identities')
      const all = await scanAll('many'); assert.equal(all.members.size, 231); assert(all.pages > 1)
      assert.equal((await scanAll('many', 'item:1*')).members.size, 111); assert.equal((await scanAll('many', 'absent:*')).members.size, 0)
      assert.deepEqual(await stats(), before); assert.deepEqual(await buffers.sendCommand(['DUMP', key]), dump); assert.equal(await admin.sendCommand(['PEXPIRETIME', key]), expiry)
      report.checks.push('actual multi-page SSCAN/MATCH finishes without SMEMBERS or writes; serialized bytes and absolute expiry unchanged')
      await admin.sendCommand(['ACL', 'SETUSER', 'set-reader', 'reset', 'on', '>' + settings.password, '~*', '+ping', '+type', '+pttl', '+scard', '+sscan'])
      const restricted = await connections.connect('restricted', { ...settings, username: 'set-reader' }, signal()), limited = { ...request(key), target: target(restricted) }
      assert.equal((await reader.scan('restricted', limited, signal())).state, 'page')
      assert.match(await admin.sendCommand(['ACL', 'DRYRUN', 'set-reader', 'SADD', 'many', 'x']), /no permissions/u)
      await admin.sendCommand(['ACL', 'SETUSER', 'set-reader', '-sscan'])
      assert.equal((await reader.scan('restricted', limited, signal())).error, 'permission')
      report.checks.push('minimal Set read ACL succeeds; SSCAN refusal is permission, and SADD stays forbidden')
      const huge = await reader.scan('a', request('huge-member'), signal())
      assert.equal(huge.error, 'oversize'); assert.deepEqual(huge.members, []); assert.equal(huge.cursor, null); assert.equal(connections.status('a').state, 'connected')
      const amplified = await reader.scan('a', request('amplified'), signal())
      assert.equal(amplified.error, 'oversize'); assert.deepEqual(amplified.members, []); assert.equal(amplified.cursor, null); assert.equal(connections.status('a').state, 'connected')
      assert.equal((await reader.scan('a', request('giant'), signal())).error, 'oversize'); assert.equal(connections.status('a').state, 'error'); assert.equal(connections.status('restricted').state, 'connected')
      view = await connections.connect('a', settings, signal()); assert.equal((await reader.scan('a', request(key), signal())).state, 'page')
      report.checks.push('65,537-byte member and JSON-amplified sub-1-MiB RESP page refuse whole without truncated identities; 2 MiB member closes only its own bounded socket; explicit reconnect recovers')
      const old = request(key); view = await connections.selectDatabase('a', { ...target(view), db: 1 }, signal())
      assert.equal((await reader.scan('a', old, signal())).error, 'stale'); assert.equal((await reader.scan('a', request(key), signal())).state, 'missing')
      report.checks.push('actual DB generation switch refuses old Set requests and isolates DB1')
      for (const mutation of ['length', 'type', 'missing']) {
        await admin.del('changing'); await admin.sAdd('changing', ['one', 'two'])
        let changed = false
        const controlled = new RedisConnections(async (options, requestSignal) => {
          const link = await openRedis(options, requestSignal)
          return { ...link, execute: async (command, args, commandSignal, guard, deadline) => {
            const reply = await link.execute(command, args, commandSignal, guard, deadline)
            if (command === 'SSCAN' && !changed) {
              changed = true
              if (mutation === 'length') await admin.sAdd('changing', 'new')
              else { await admin.del('changing'); if (mutation === 'type') await admin.set('changing', 'string') }
            }
            return reply
          } }
        })
        const controlledReader = new RedisSets(controlled)
        try {
          const connected = await controlled.connect('changing', settings, signal())
          const page = await controlledReader.scan('changing', { target: target(connected), keyBase64: Buffer.from('changing').toString('base64'), pattern: '*', cursor: null }, signal())
          assert.equal(page.state, mutation === 'missing' ? 'missing' : 'changed'); assert.deepEqual(page.members, []); assert.equal(page.cursor, null)
        } finally { controlledReader.dispose(); controlled.dispose() }
      }
      report.checks.push('admin cardinality/type/deletion changes between actual SSCAN and metadata replies discard old members')
    } finally { reader.dispose(); connections.dispose() }
    await until(async () => await clients() === baseline, 'all Set viewer sockets released')
  })
  assert(report.fixtures.every(value => value.stopped)); report.passed = true
} catch (error) { report.error = (error instanceof Error ? error.message : String(error)).replace(/(--requirepass\s+)\S+/gu, '$1[redacted]'); process.exitCode = 1; console.error(report.error) }
finally {
  report.finishedAt = new Date().toISOString()
  const directory = resolve(import.meta.dirname, '../.scratch/artifacts'); await mkdir(directory, { recursive: true })
  await writeFile(resolve(directory, 'sets-smoke.json'), JSON.stringify(report, null, 2) + '\n')
  console.log(JSON.stringify({ passed: report.passed, checks: report.checks.length, fixturesStopped: report.fixtures.every(value => value.stopped) }))
}
