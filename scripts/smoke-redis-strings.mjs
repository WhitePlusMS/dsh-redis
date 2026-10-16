/** Real String windows/ACL/concurrency acceptance on disposable fixture data. */
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { RESP_TYPES } from 'redis'
import { RedisConnections, openRedis } from '../lib/host/connection-service.js'
import { RedisStrings } from '../lib/host/string-reader.js'
import { until, withRedisFixture } from './redis-fixture.mjs'

const report = { startedAt: new Date().toISOString(), checks: [], fixtures: [], passed: false }
const signal = () => new AbortController().signal
const target = view => { assert(view.id !== null); return { id: view.id, generation: view.generation, db: view.db } }
try {
  await withRedisFixture(async ({ settings, admin, clients, metadata }) => {
    report.fixtures.push(metadata)
    const original = Buffer.from('A中😀Z'), key = Buffer.from([255, 0, 13, 10])
    const large = Buffer.alloc(4 * 1024 * 1024)
    for (let index = 0; index < large.length; index++) large[index] = index % 251
    await admin.set(key, original); await admin.pExpire(key, 120000)
    await admin.set('large', large); await admin.set('empty', '')
    await admin.hSet('hash', 'field', 'value')
    const buffers = admin.withTypeMapping({ [RESP_TYPES.BLOB_STRING]: Buffer })
    const dump = await buffers.sendCommand(['DUMP', key]), expiry = await admin.sendCommand(['PEXPIRETIME', key])
    const stats = async () => {
      const info = await admin.info('commandstats')
      return { get: Number(/^cmdstat_get:calls=(\d+)/mu.exec(info)?.[1] ?? 0), set: Number(/^cmdstat_set:calls=(\d+)/mu.exec(info)?.[1] ?? 0), getrange: Number(/^cmdstat_getrange:calls=(\d+)/mu.exec(info)?.[1] ?? 0) }
    }
    const before = await stats(), baseline = await clients(), connections = new RedisConnections()
    try {
      let view = await connections.connect('a', settings, signal())
      const reader = new RedisStrings(connections)
      const request = (name, offset = '0', count = 65536) => ({ target: target(view), keyBase64: Buffer.isBuffer(name) ? name.toString('base64') : Buffer.from(name).toString('base64'), offset, count })
      const full = await reader.read('a', request(key), signal())
      assert.equal(full.state, 'value'); assert.equal(full.complete, true); assert.deepEqual(Buffer.from(full.base64, 'base64'), original)
      assert.equal(full.metadata.length, String(original.length)); assert(BigInt(full.metadata.ttlMs) > 0n)
      assert.equal((await reader.read('a', request('empty'), signal())).complete, true)
      report.checks.push('real binary key, millisecond TTL, exact full bytes and an empty String')
      for (let offset = 0; offset < original.length; offset++) {
        const window = await reader.read('a', request(key, String(offset), 1), signal())
        assert.equal(window.state, 'value'); assert.deepEqual(Buffer.from(window.base64, 'base64'), original.subarray(offset, offset + 1))
        assert.deepEqual(Buffer.from(window.prefix, 'base64'), original.subarray(Math.max(0, offset - 3), offset))
        assert.deepEqual(Buffer.from(window.suffix, 'base64'), original.subarray(offset + 1, offset + 4))
      }
      report.checks.push('every real UTF-8 split keeps exact requested bytes and bounded three-byte context')
      const first = await reader.read('a', request('large'), signal())
      const second = await reader.read('a', request('large', first.nextOffset), signal())
      assert.equal(first.complete, false); assert.equal(first.byteLength, 65536); assert.equal(first.nextOffset, '65536')
      assert.deepEqual(Buffer.from(second.base64, 'base64'), large.subarray(65536, 131072))
      assert.equal(second.nextOffset, '131072')
      const beyond = await reader.read('a', request('large', '9223372036854775807'), signal())
      assert.equal(beyond.state, 'value'); assert.equal(beyond.byteLength, 0); assert.equal(beyond.nextOffset, null)
      assert.equal((await reader.read('a', request('missing'), signal())).state, 'missing')
      const hash = await reader.read('a', request('hash'), signal())
      assert.equal(hash.state, 'unsupported'); assert.equal(hash.metadata.type, 'hash'); assert.equal(hash.base64, '')
      report.checks.push('4 MiB String stays in 64 KiB windows; EOF, missing and Hash are distinct')
      const after = await stats()
      assert.equal(after.get, before.get); assert.equal(after.set, before.set); assert(after.getrange > before.getrange)
      assert.deepEqual(await buffers.sendCommand(['DUMP', key]), dump)
      assert.equal(await admin.sendCommand(['PEXPIRETIME', key]), expiry)
      report.checks.push('viewer uses GETRANGE without GET or SET; original serialized bytes and absolute expiration stay unchanged')
      await admin.sendCommand(['ACL', 'SETUSER', 'range-only', 'reset', 'on', '>' + settings.password, '~*', '+ping', '+type', '+pttl', '+strlen', '+getrange'])
      assert.match(await admin.sendCommand(['ACL', 'DRYRUN', 'range-only', 'GET', 'large']), /no permissions/u)
      let restricted = await connections.connect('restricted', { ...settings, username: 'range-only' }, signal())
      const limitedRequest = { ...request('large'), target: target(restricted) }
      assert.equal((await reader.read('restricted', limitedRequest, signal())).byteLength, 65536)
      await admin.sendCommand(['ACL', 'SETUSER', 'range-only', '-getrange'])
      const refused = await reader.read('restricted', limitedRequest, signal())
      assert.equal(refused.error, 'permission'); assert.equal(refused.base64, '')
      report.checks.push('range-only ACL succeeds without GET; denied GETRANGE is a fixed permission error without data')
      await admin.set('expired', 'short-lived', { PX: 30 }); await delay(60)
      assert.equal((await reader.read('a', request('expired'), signal())).state, 'missing')
      const old = request('large')
      view = await connections.selectDatabase('a', { ...target(view), db: 1 }, signal())
      assert.equal((await reader.read('a', old, signal())).error, 'stale')
      report.checks.push('real expiration and a prior DB generation do not return stale value bytes')
      for (const mutation of ['hash', 'missing', 'length']) {
        await admin.set('changing', 'original')
        let changed = false
        const controlled = new RedisConnections(async (options, requestSignal) => {
          const link = await openRedis(options, requestSignal)
          return { ...link, execute: async (command, args, commandSignal, guard, deadline) => {
            const reply = await link.execute(command, args, commandSignal, guard, deadline)
            if (command === 'GETRANGE' && !changed) {
              changed = true
              await admin.del('changing')
              if (mutation === 'hash') await admin.hSet('changing', 'field', 'value')
              if (mutation === 'length') await admin.set('changing', 'different length')
            }
            return reply
          } }
        })
        try {
          const connected = await controlled.connect('changing', settings, signal())
          const result = await new RedisStrings(controlled).read('changing', { target: target(connected), keyBase64: Buffer.from('changing').toString('base64'), offset: '0', count: 256 }, signal())
          assert.equal(result.state, mutation === 'missing' ? 'missing' : 'changed'); assert.equal(result.base64, '')
        } finally { controlled.dispose() }
      }
      report.checks.push('controlled admin changes between actual Redis replies discard wrong-type, missing and changed-length windows')
    } finally { connections.dispose() }
    await until(async () => await clients() === baseline, 'all String viewer sockets released')
  })
  assert(report.fixtures.every(value => value.stopped)); report.passed = true
} catch (error) { report.error = (error instanceof Error ? error.message : String(error)).replace(/(--requirepass\s+)\S+/gu, '$1[redacted]'); process.exitCode = 1; console.error(report.error) }
finally {
  report.finishedAt = new Date().toISOString()
  const directory = resolve(import.meta.dirname, '../.scratch/artifacts'); await mkdir(directory, { recursive: true })
  await writeFile(resolve(directory, 'strings-smoke.json'), JSON.stringify(report, null, 2) + '\n')
  console.log(JSON.stringify({ passed: report.passed, checks: report.checks.length, fixturesStopped: report.fixtures.every(value => value.stopped) }))
}
