/** Real Stream pagination and consumer-state acceptance on owned fixtures only. */
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { RESP_TYPES } from 'redis'
import { RedisConnections, openRedis } from '../lib/host/connection-service.js'
import { RedisStreams } from '../lib/host/stream-reader.js'
import { until, withRedisFixture } from './redis-fixture.mjs'

const report = { startedAt: new Date().toISOString(), checks: [], fixtures: [], passed: false }
const signal = () => new AbortController().signal
const target = view => { assert(view.id !== null); return { id: view.id, generation: view.generation, db: view.db } }
const MAX_ID = '18446744073709551615-18446744073709551615'
try {
  await withRedisFixture(async ({ settings, admin, clients, metadata }) => {
    report.fixtures.push(metadata)
    const key = Buffer.from([255, 0, 13]), binary = Buffer.from([254, 0]), long = Buffer.concat([Buffer.alloc(65535, 97), Buffer.from('中😀'), Buffer.alloc(65536, 98)])
    await admin.sendCommand(['XADD', key, '1-0', binary, Buffer.from([255, 0]), 'same', 'one', 'same', 'two', '', ''])
    await admin.sendCommand(['XADD', key, '1-18446744073709551615', 'json', '{"id":9007199254740993,"huge":1e400}'])
    await admin.sendCommand(['XADD', key, '9007199254740993-0', 'large', long])
    await admin.sendCommand(['XADD', key, MAX_ID, 'last', 'done']); await admin.pExpire(key, 120000)
    // Only the fixture administrator creates a consumer/Pending entry, before
    // the viewer runs; subsequent snapshots must remain exactly unchanged.
    await admin.sendCommand(['XGROUP', 'CREATE', key, 'fixture-group', '0-0'])
    await admin.sendCommand(['XREADGROUP', 'GROUP', 'fixture-group', 'fixture-consumer', 'COUNT', '1', 'STREAMS', key, '>'])
    for (let index = 0; index < 235; index++) await admin.sendCommand(['XADD', 'many', '1000-' + index, 'field', String(index)])
    await admin.sendCommand(['XADD', 'empty', '1-0', 'field', 'value']); await admin.sendCommand(['XTRIM', 'empty', 'MAXLEN', '0'])
    await admin.sendCommand(['XADD', 'huge-field', '1-0', Buffer.alloc(65537, 97), 'v'])
    await admin.sendCommand(['XADD', 'giant', '1-0', 'field', Buffer.alloc(2 * 1024 * 1024, 97)])
    await admin.sendCommand(['XADD', 'amplified', '1-0', ...Array.from({ length: 6 }, (_, index) => [Buffer.alloc(65536, index), Buffer.alloc(65536, 97)]).flat()])
    const buffers = admin.withTypeMapping({ [RESP_TYPES.BLOB_STRING]: Buffer })
    const dump = await buffers.sendCommand(['DUMP', key]), expiry = await admin.sendCommand(['PEXPIRETIME', key])
    const pending = await admin.sendCommand(['XPENDING', key, 'fixture-group']), groups = await admin.sendCommand(['XINFO', 'GROUPS', key])
    assert.equal(pending[0], 1)
    const stats = async () => {
      const info = await admin.info('commandstats'), map = new Map([...info.matchAll(/^cmdstat_([^:]+):calls=(\d+)/gmu)].map(match => [match[1], Number(match[2])]))
      return Object.fromEntries(['xadd', 'xdel', 'xtrim', 'xreadgroup', 'xack', 'xclaim', 'xautoclaim', 'xgroup|create', 'xgroup|setid', 'xgroup|destroy'].map(command => [command, map.get(command) ?? 0]))
    }
    const before = await stats(), baseline = await clients(), connections = new RedisConnections(), reader = new RedisStreams(connections)
    try {
      let view = await connections.connect('a', settings, signal())
      const request = (name, direction = 'forward', start = '-', end = '+', count = 100, cursor = null) => ({ target: target(view), keyBase64: (Buffer.isBuffer(name) ? name : Buffer.from(name)).toString('base64'), direction, start, end, count, cursor })
      const first = await reader.read('a', request(key, 'forward', '-', '+', 2), signal())
      assert.equal(first.state, 'page'); assert.equal(first.metadata.length, '4'); assert(BigInt(first.metadata.ttlMs) > 0n)
      assert.deepEqual(first.messages.map(message => message.id), ['1-0', '1-18446744073709551615'])
      assert.deepEqual(first.messages[0].fields.map(pair => Buffer.from(pair.field.base64, 'base64')), [binary, Buffer.from('same'), Buffer.from('same'), Buffer.alloc(0)])
      assert.deepEqual(first.messages[0].fields.map(pair => Buffer.from(pair.value.base64, 'base64')), [Buffer.from([255, 0]), Buffer.from('one'), Buffer.from('two'), Buffer.alloc(0)])
      const last = await reader.read('a', request(key, 'forward', '-', '+', 2, first.cursor), signal())
      assert.deepEqual(last.messages.map(message => message.id), ['9007199254740993-0', MAX_ID]); assert.equal(last.cursor, null)
      const prefix = last.messages[0].fields[0].value
      assert.equal(prefix.fullByteLength, long.length); assert.equal(prefix.byteLength, 65536); assert.deepEqual(Buffer.from(prefix.suffix, 'base64'), long.subarray(65536, 65539))
      report.checks.push('actual binary key/field/value, empty and duplicate field occurrences stay ordered; uint64 sequence/millisecond IDs continue exclusively and long values keep bounded byte prefixes')
      async function readAll(direction, start = '-', end = '+', count = 100) {
        const ids = []; let cursor = null, pages = 0
        do {
          const page = await reader.read('a', request('many', direction, start, end, count, cursor), signal())
          assert.equal(page.state, 'page'); ids.push(...page.messages.map(message => message.id)); cursor = page.cursor; assert(++pages < 50)
        } while (cursor !== null)
        assert.equal(new Set(ids).size, ids.length)
        return { ids, pages }
      }
      const forward = await readAll('forward'), reverse = await readAll('reverse')
      assert.equal(forward.ids.length, 235); assert(forward.pages > 1); assert.deepEqual(reverse.ids, [...forward.ids].reverse())
      assert.deepEqual((await readAll('forward', '1000-99', '1000-101', 1)).ids, ['1000-99', '1000-100', '1000-101'])
      assert.deepEqual((await readAll('reverse', '1000-99', '1000-101', 1)).ids, ['1000-101', '1000-100', '1000-99'])
      assert.deepEqual((await readAll('forward', '1000-900', '1000-999')).ids, [])
      assert.deepEqual(await reader.read('a', request('empty'), signal()).then(page => [page.state, page.metadata.length, page.messages, page.cursor]), ['page', '0', [], null])
      report.checks.push('actual 235-message forward/reverse pagination has no duplicate IDs; inclusive bounded ranges and empty existing Streams differ from missing keys')
      assert.deepEqual(await stats(), before); assert.deepEqual(await buffers.sendCommand(['DUMP', key]), dump); assert.equal(await admin.sendCommand(['PEXPIRETIME', key]), expiry)
      assert.deepEqual(await admin.sendCommand(['XPENDING', key, 'fixture-group']), pending); assert.deepEqual(await admin.sendCommand(['XINFO', 'GROUPS', key]), groups)
      report.checks.push('consumer group last-delivered/Pending summary, serialized bytes, absolute expiry and all write/group command counters unchanged')
      await admin.sendCommand(['ACL', 'SETUSER', 'stream-reader', 'reset', 'on', '>' + settings.password, '~*', '+ping', '+type', '+pttl', '+xlen', '+xrange', '+xrevrange'])
      const restricted = await connections.connect('restricted', { ...settings, username: 'stream-reader' }, signal()), limited = { ...request(key), target: target(restricted) }
      assert.equal((await reader.read('restricted', limited, signal())).state, 'page'); assert.equal((await reader.read('restricted', { ...limited, direction: 'reverse' }, signal())).state, 'page')
      assert.match(await admin.sendCommand(['ACL', 'DRYRUN', 'stream-reader', 'XREADGROUP', 'GROUP', 'fixture-group', 'fixture-consumer', 'COUNT', '1', 'STREAMS', key, '>']), /no permissions/u)
      assert.match(await admin.sendCommand(['ACL', 'DRYRUN', 'stream-reader', 'XACK', key, 'fixture-group', '1-0']), /no permissions/u)
      await admin.sendCommand(['ACL', 'SETUSER', 'stream-reader', '-xrange'])
      assert.equal((await reader.read('restricted', limited, signal())).error, 'permission'); assert.equal((await reader.read('restricted', { ...limited, direction: 'reverse' }, signal())).state, 'page')
      report.checks.push('minimal read-only ACL permits both directions; XRANGE denial is permission, reverse still works, and XREADGROUP/XACK remain forbidden')
      for (const name of ['huge-field', 'amplified']) {
        const page = await reader.read('a', request(name), signal()); assert.equal(page.error, 'oversize'); assert.deepEqual(page.messages, []); assert.equal(page.cursor, null); assert.equal(connections.status('a').state, 'connected')
      }
      assert.equal((await reader.read('a', request('giant', 'forward', '-', '+', 1), signal())).error, 'oversize'); assert.equal(connections.status('a').state, 'error'); assert.equal(connections.status('restricted').state, 'connected')
      view = await connections.connect('a', settings, signal()); assert.equal((await reader.read('a', request(key), signal())).state, 'page')
      report.checks.push('65,537-byte field and JSON-amplified sub-1-MiB RESP message refuse whole on a healthy socket; 2 MiB value closes only its own bounded socket and explicit reconnect recovers')
      const old = request(key); view = await connections.selectDatabase('a', { ...target(view), db: 1 }, signal())
      assert.equal((await reader.read('a', old, signal())).error, 'stale'); assert.equal((await reader.read('a', request(key), signal())).state, 'missing')
      report.checks.push('actual DB generation switch rejects old Stream requests and isolates DB1')
      for (const direction of ['forward', 'reverse']) for (const mutation of ['append', 'trim', 'type', 'missing']) {
        await admin.del('changing'); await admin.sendCommand(['XADD', 'changing', '1-0', 'field', 'one']); await admin.sendCommand(['XADD', 'changing', '2-0', 'field', 'two'])
        let changed = false
        const controlled = new RedisConnections(async (options, requestSignal) => {
          const link = await openRedis(options, requestSignal)
          return { ...link, execute: async (command, args, commandSignal, guard, deadline) => {
            const reply = await link.execute(command, args, commandSignal, guard, deadline)
            if (command === (direction === 'forward' ? 'XRANGE' : 'XREVRANGE') && !changed) {
              changed = true
              if (mutation === 'append') await admin.sendCommand(['XADD', 'changing', '3-0', 'field', 'three'])
              else if (mutation === 'trim') await admin.sendCommand(['XDEL', 'changing', '1-0'])
              else { await admin.del('changing'); if (mutation === 'type') await admin.set('changing', 'string') }
            }
            return reply
          } }
        })
        const controlledReader = new RedisStreams(controlled)
        try {
          const connected = await controlled.connect('changing', settings, signal())
          const page = await controlledReader.read('changing', { ...request('changing', direction), target: target(connected) }, signal())
          assert.equal(page.state, mutation === 'append' ? 'page' : mutation === 'missing' ? 'missing' : 'changed')
          if (mutation === 'append') assert.equal(page.metadata.length, '3')
          else { assert.deepEqual(page.messages, []); assert.equal(page.cursor, null) }
        } finally { controlledReader.dispose(); controlled.dispose() }
      }
      report.checks.push('actual reply/metadata races in both directions allow append and discard detected trimming/type/deletion; no atomic snapshot is claimed')
    } finally { reader.dispose(); connections.dispose() }
    await until(async () => await clients() === baseline, 'all Stream viewer sockets released')
  })
  assert(report.fixtures.every(value => value.stopped)); report.passed = true
} catch (error) { report.error = (error instanceof Error ? error.message : String(error)).replace(/(--requirepass\s+)\S+/gu, '$1[redacted]'); process.exitCode = 1; console.error(report.error) }
finally {
  report.finishedAt = new Date().toISOString()
  const directory = resolve(import.meta.dirname, '../.scratch/artifacts'); await mkdir(directory, { recursive: true })
  await writeFile(resolve(directory, 'streams-smoke.json'), JSON.stringify(report, null, 2) + '\n')
  console.log(JSON.stringify({ passed: report.passed, checks: report.checks.length, fixturesStopped: report.fixtures.every(value => value.stopped) }))
}
