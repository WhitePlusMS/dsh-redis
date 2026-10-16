/** Bitmap interpretation uses the same source helper as the browser bundle;
 * the real Host reader is built. Native acceptance verifies the installed UI.
 */
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { RESP_TYPES } from 'redis'
import { RedisConnections, openRedis } from '../lib/host/connection-service.js'
import { RedisStrings } from '../lib/host/string-reader.js'
import { bitmapByteRange, bitmapWindow } from '../src/client/bitmap-preview.ts'
import { until, withRedisFixture } from './redis-fixture.mjs'

const report = { startedAt: new Date().toISOString(), checks: [], fixtures: [], maxReceivedRangeBytes: 0, passed: false }
const signal = () => new AbortController().signal
const target = view => { assert(view.id !== null); return { id: view.id, generation: view.generation, db: view.db } }
try {
  await withRedisFixture(async ({ settings, admin, clients, metadata }) => {
    report.fixtures.push(metadata)
    const key = Buffer.from([255, 0, 13]), source = Buffer.alloc(2 * 1024 * 1024, 0xa5), buffers = admin.withTypeMapping({ [RESP_TYPES.BLOB_STRING]: Buffer })
    source.set([0x80, 0x01, 0xa5, 0xff]); await admin.set(key, source); await admin.pExpire(key, 120000); await admin.set('empty', '')
    const dump = await buffers.sendCommand(['DUMP', key]), expiry = await admin.sendCommand(['PEXPIRETIME', key])
    const stats = async () => {
      const map = new Map([...(await admin.info('commandstats')).matchAll(/^cmdstat_([^:]+):calls=(\d+)/gmu)].map(match => [match[1], Number(match[2])]))
      return Object.fromEntries(['set', 'setbit', 'bitfield', 'bitop', 'getdel', 'getex', 'del', 'expire', 'pexpire'].map(command => [command, map.get(command) ?? 0]))
    }
    const before = await stats(), baseline = await clients(), calls = []
    const connections = new RedisConnections(async (credentials, commandSignal) => {
      const link = await openRedis(credentials, commandSignal)
      return { ...link, execute: async (...args) => {
        calls.push(args[0]); const reply = await link.execute(...args)
        if (args[0] === 'GETRANGE') { assert(Buffer.isBuffer(reply)); report.maxReceivedRangeBytes = Math.max(report.maxReceivedRangeBytes, reply.length); assert(reply.length <= 519) }
        return reply
      } }
    })
    const reader = new RedisStrings(connections)
    try {
      let view = await connections.connect('bitmap', settings, signal())
      const read = async (name, range, session = 'bitmap', selected = view) => {
        const result = await reader.read(session, { target: target(selected), keyBase64: (Buffer.isBuffer(name) ? name : Buffer.from(name)).toString('base64'), ...bitmapByteRange(range) }, signal())
        return { result, window: result.state === 'value' ? bitmapWindow(result, range) : null }
      }
      async function oracle(offset, count) {
        let bits = ''
        for (let index = 0; index < count; index += 80) {
          const operations = Array.from({ length: Math.min(80, count - index) }, (_value, step) => ['GET', 'u1', String(BigInt(offset) + BigInt(index + step))]).flat()
          bits += (await admin.sendCommand(['BITFIELD_RO', key, ...operations])).map(String).join('')
        }
        return bits
      }
      for (const range of [{ offset: '0', count: 32 }, { offset: '7', count: 64 }, { offset: '15', count: 129 }]) {
        const { result, window } = await read(key, range); assert.equal(result.state, 'value'); assert(window)
        assert.equal(window.rows.map(row => row.bits).join(''), await oracle(range.offset, range.count)); assert.equal(window.totalBits, String(source.length * 8))
      }
      report.checks.push('actual binary String key, highest-bit-first order and byte-boundary windows agree with independent BITFIELD_RO GET u1 oracle')
      const first = await read(key, { offset: '1023', count: 4096 }); assert.equal(first.result.byteLength, 513); assert.equal(first.window.count, 4096)
      assert.equal(first.window.rows.map(row => row.bits).join(''), await oracle('1023', 4096))
      const next = await read(key, { offset: first.window.nextOffset, count: 4096 }); assert.equal(next.window.offset, '5119'); assert.equal(next.window.count, 4096)
      assert.equal(report.maxReceivedRangeBytes, 519)
      assert(calls.every(command => ['TYPE', 'PTTL', 'STRLEN', 'GETRANGE'].includes(command)))
      report.checks.push('2 MiB source expands only a 4096-bit window, 513 payload bytes plus at most six context bytes; next interval is exact and uses only existing fixed String reads')
      const last = await read(key, { offset: String(source.length * 8 - 1), count: 64 }); assert.equal(last.window.count, 1); assert.equal(last.window.rows[0].bits, '1'); assert.equal(last.window.nextOffset, null)
      for (const offset of [String(source.length * 8), '9223372036854775807']) assert.equal((await read(key, { offset, count: 64 })).window.count, 0)
      assert.equal((await read('empty', { offset: '0', count: 64 })).window.totalBits, '0')
      assert.equal((await read('missing', { offset: '0', count: 64 })).result.state, 'missing')
      report.checks.push('last bit clips precisely, empty String and at/past EOF stay empty without zero padding, and maximum accepted integer offset remains exact')
      assert.deepEqual(await buffers.sendCommand(['DUMP', key]), dump); assert.equal(await admin.sendCommand(['PEXPIRETIME', key]), expiry); assert.deepEqual(await stats(), before)
      report.checks.push('source serialized bytes, absolute expiry and String/bitmap write counters remain unchanged')
      await admin.sendCommand(['ACL', 'SETUSER', 'bitmap-reader', 'reset', 'on', '>' + settings.password, '~*', '+ping', '+type', '+pttl', '+strlen', '+getrange'])
      const limited = await connections.connect('limited', { ...settings, username: 'bitmap-reader' }, signal())
      assert.equal((await read(key, { offset: '7', count: 64 }, 'limited', limited)).window.count, 64)
      assert.match(await admin.sendCommand(['ACL', 'DRYRUN', 'bitmap-reader', 'SETBIT', key, '0', '1']), /no permissions/u)
      await admin.sendCommand(['ACL', 'SETUSER', 'bitmap-reader', '-getrange'])
      assert.equal((await read(key, { offset: '7', count: 64 }, 'limited', limited)).result.error, 'permission')
      report.checks.push('minimal existing String-read ACL suffices; SETBIT is forbidden and GETRANGE denial remains a fixed permission state')
      const old = view
      view = await connections.selectDatabase('bitmap', { ...target(view), db: 1 }, signal())
      assert.equal((await read(key, { offset: '0', count: 64 }, 'bitmap', old)).result.error, 'stale')
      assert.equal((await read(key, { offset: '0', count: 64 })).result.state, 'missing')
      view = await connections.selectDatabase('bitmap', { ...target(view), db: 0 }, signal())
      report.checks.push('DB generation changes reject stale windows and isolate DB1')
      for (const mode of ['length', 'type', 'delete']) {
        await admin.del('race'); await admin.set('race', Buffer.from([0x80, 1, 0xa5, 0xff]))
        let changed = false
        const racing = new RedisConnections(async (credentials, commandSignal) => {
          const link = await openRedis(credentials, commandSignal)
          return { ...link, execute: async (...args) => {
            const reply = await link.execute(...args)
            if (!changed && args[0] === 'GETRANGE') {
              changed = true
              if (mode === 'length') await admin.append('race', 'x')
              else { await admin.del('race'); if (mode === 'type') await admin.hSet('race', 'field', 'value') }
            }
            return reply
          } }
        })
        try {
          const selected = await racing.connect('race', settings, signal())
          const result = await new RedisStrings(racing).read('race', { target: target(selected), keyBase64: Buffer.from('race').toString('base64'), ...bitmapByteRange({ offset: '7', count: 16 }) }, signal())
          assert.equal(result.state, mode === 'delete' ? 'missing' : 'changed'); assert.equal(result.base64, '')
        } finally { racing.dispose() }
      }
      report.checks.push('actual range-to-metadata length/type/deletion races discard old bitmap bytes; same-length mutations remain non-atomic')
    } finally { connections.dispose() }
    await until(async () => await clients() === baseline, 'owned bitmap viewer sockets closed')
  })
  report.passed = true
} finally {
  report.finishedAt = new Date().toISOString()
  const directory = resolve(import.meta.dirname, '../.scratch/artifacts'); await mkdir(directory, { recursive: true })
  await writeFile(resolve(directory, 'bitmap-smoke.json'), JSON.stringify(report, null, 2) + '\n')
}
console.log(JSON.stringify({ passed: report.passed, checks: report.checks.length, maxReceivedRangeBytes: report.maxReceivedRangeBytes, fixturesStopped: report.fixtures.every(value => value.stopped && value.certificatesRemoved && value.fixtureRemoved !== false) }))
