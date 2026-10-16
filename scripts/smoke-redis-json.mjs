/** Real RedisJSON acceptance. Only fixture setup uses administrator mutations. */
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { RESP_TYPES } from 'redis'
import { RedisConnections, openRedis } from '../lib/host/connection-service.js'
import { RedisJson } from '../lib/host/json-reader.js'
import { RedisReplyError } from '../lib/host/resp.js'
import { withRedisFixture, until } from './redis-fixture.mjs'

const signal = () => new AbortController().signal
const target = view => { assert(view.id !== null); return { id: view.id, generation: view.generation, db: view.db } }
const report = { startedAt: new Date().toISOString(), checks: [], fixtures: [], redisJsonVersion: null, passed: false }
try {
  await withRedisFixture(async ({ settings, admin, clients, metadata }) => {
    report.fixtures.push(metadata)
    const modules = await admin.sendCommand(['MODULE', 'LIST']), json = modules.find(item => item.name === 'ReJSON')
    assert(json); report.redisJsonVersion = json.ver; assert.equal(json.ver, 80209)
    const key = Buffer.from([255, 0, 13]), buffers = admin.withTypeMapping({ [RESP_TYPES.BLOB_STRING]: Buffer })
    const document = '{"id":9007199254740993,"huge":1e100,"name":"中文😀","nil":null,"empty":[],"items":[{"v":1},{"v":2},{"v":3}],"large":"' + 'x'.repeat(70000) + '"}'
    await admin.sendCommand(['JSON.SET', key, '$', document]); await admin.pExpire(key, 120000)
    await admin.sendCommand(['JSON.SET', 'compact', '$', '{"id":9007199254740993,"name":"中文😀"}'])
    await admin.sendCommand(['JSON.SET', 'limit', '$', JSON.stringify('x'.repeat(65532))])
    await admin.sendCommand(['JSON.SET', 'over', '$', JSON.stringify('x'.repeat(65533))])
    await admin.sendCommand(['JSON.SET', 'giant', '$', JSON.stringify('x'.repeat(2 * 1024 * 1024))])
    await admin.sendCommand(['JSON.SET', 'too-many', '$', JSON.stringify(Array(4097).fill(1))])
    await admin.set('plain', '{"id":1}')
    const dump = await buffers.sendCommand(['DUMP', key]), expiry = await admin.sendCommand(['PEXPIRETIME', key])
    const stats = async () => {
      const info = await admin.info('commandstats'), map = new Map([...info.matchAll(/^cmdstat_([^:]+):calls=(\d+)/gmu)].map(match => [match[1], Number(match[2])]))
      return Object.fromEntries(['json.set', 'json.del', 'json.clear', 'json.arrappend', 'json.numincrby', 'json.toggle', 'set', 'del', 'expire', 'pexpire'].map(command => [command, map.get(command) ?? 0]))
    }
    const before = await stats(), baseline = await clients(), connections = new RedisConnections(), reader = new RedisJson(connections)
    try {
      let view = await connections.connect('a', settings, signal())
      const request = (name = key, path = '$') => ({ target: target(view), keyBase64: (Buffer.isBuffer(name) ? name : Buffer.from(name)).toString('base64'), path })
      const root = await reader.read('a', request('compact'), signal())
      assert.equal(root.state, 'value'); assert.equal(root.metadata.type, 'ReJSON-RL'); assert.deepEqual(root.matchTypes, ['object'])
      assert.deepEqual(Buffer.from(root.base64, 'base64'), await buffers.sendCommand(['JSON.GET', 'compact', '$']))
      assert(Buffer.from(root.base64, 'base64').toString().includes('9007199254740993'))
      const id = await reader.read('a', request(key, '$.id'), signal())
      assert.equal(id.state, 'value'); assert.equal(Buffer.from(id.base64, 'base64').toString(), '[9007199254740993]'); assert.deepEqual(id.matchTypes, ['integer'])
      assert(BigInt(id.metadata.ttlMs) > 0n)
      report.checks.push('RedisJSON 80209 actual ReJSON-RL, binary key and complete raw root/path match arrays preserve large integer and UTF-8 bytes exactly')
      for (const [path, expected] of [['$.nil', '[null]'], ['$.empty', '[[]]'], ['$.items[0:2].v', '[1,2]'], ['$.items[*].v', '[1,2,3]']]) {
        const result = await reader.read('a', request(key, path), signal()); assert.equal(result.state, 'value'); assert.equal(Buffer.from(result.base64, 'base64').toString(), expected)
      }
      assert.equal((await reader.read('a', request(key, '$.missing'), signal())).state, 'path-missing')
      assert.equal((await reader.read('a', request('missing'), signal())).state, 'missing')
      assert.equal((await reader.read('a', request('plain'), signal())).state, 'unsupported')
      assert.equal((await reader.read('a', request(key, '$['), signal())).state, 'invalid-path')
      report.checks.push('actual null, empty array, slices and multi-match paths differ from absent path/key, ordinary String and invalid JSONPath')
      assert.deepEqual(await buffers.sendCommand(['DUMP', key]), dump); assert.equal(await admin.sendCommand(['PEXPIRETIME', key]), expiry); assert.deepEqual(await stats(), before)
      report.checks.push('serialized source bytes, absolute expiry and JSON/core write command counters remain unchanged during reads')

      await admin.sendCommand(['ACL', 'SETUSER', 'json-reader', 'reset', 'on', '>' + settings.password, '~*', '+ping', '+type', '+pttl', '+json.type', '+json.get'])
      const limited = await connections.connect('limited', { ...settings, username: 'json-reader' }, signal()), restricted = { ...request(key, '$.id'), target: target(limited) }
      assert.equal((await reader.read('limited', restricted, signal())).state, 'value')
      assert.match(await admin.sendCommand(['ACL', 'DRYRUN', 'json-reader', 'JSON.SET', key, '$', '1']), /no permissions/u)
      await admin.sendCommand(['ACL', 'SETUSER', 'json-reader', '-json.get'])
      assert.equal((await reader.read('limited', restricted, signal())).error, 'permission')
      await admin.sendCommand(['ACL', 'SETUSER', 'json-reader', '+json.get', '-json.type'])
      assert.equal((await reader.read('limited', restricted, signal())).error, 'permission')
      report.checks.push('minimal read ACL succeeds; independent JSON.GET/JSON.TYPE denial stays permission and JSON.SET is forbidden')

      assert.equal((await reader.read('a', request('limit'), signal())).byteLength, 65536)
      for (const name of ['over', 'too-many']) assert.deepEqual(await reader.read('a', request(name, name === 'too-many' ? '$[*]' : '$'), signal()).then(value => [value.state, value.error, value.base64]), ['failed', 'oversize', ''])
      assert.equal(connections.status('a').state, 'connected')
      assert.equal((await reader.read('a', request(key), signal())).error, 'oversize')
      assert.equal((await reader.read('a', request(key, '$.id'), signal())).state, 'value')
      assert.equal((await reader.read('a', request('giant'), signal())).error, 'oversize'); assert.equal(connections.status('a').state, 'error')
      assert.equal(connections.status('limited').state, 'connected')
      view = await connections.connect('a', settings, signal()); assert.equal((await reader.read('a', request('compact'), signal())).state, 'value')
      report.checks.push('64 KiB boundary succeeds; 65,537-byte/4097-match/large-root results refuse whole; narrow path recovers; 2 MiB wire refusal closes only owned socket and manual reconnect works')

      const previous = request(key), switched = await connections.selectDatabase('a', { ...target(view), db: 1 }, signal()); view = switched
      assert.equal((await reader.read('a', previous, signal())).error, 'stale'); assert.equal((await reader.read('a', request(key), signal())).state, 'missing')
      view = await connections.selectDatabase('a', { ...target(view), db: 0 }, signal())
      report.checks.push('actual DB selection invalidates the old generation and isolates JSON reads in DB1')

      for (const mode of ['type', 'delete', 'matches', 'wrong-type']) {
        await admin.del('race')
        await admin.sendCommand(['JSON.SET', 'race', '$', '{"items":[1,2]}'])
        let changed = false
        const racing = new RedisConnections(async (credentials, commandSignal) => {
          const link = await openRedis(credentials, commandSignal)
          return { ...link, execute: async (...args) => {
            if (!changed && args[0] === 'JSON.GET' && mode === 'wrong-type') {
              changed = true; await admin.del('race'); await admin.set('race', 'plain')
            }
            const reply = await link.execute(...args)
            if (!changed && args[0] === 'JSON.GET') {
              changed = true
              if (mode === 'type') { await admin.del('race'); await admin.set('race', 'plain') }
              else if (mode === 'delete') await admin.del('race')
              else await admin.sendCommand(['JSON.SET', 'race', '$.items', '[1,2,3]'])
            }
            return reply
          } }
        })
        try {
          const selected = await racing.connect('race', settings, signal())
          assert.equal((await new RedisJson(racing).read('race', { ...request('race', '$.items[*]'), target: target(selected) }, signal())).state, mode === 'delete' ? 'missing' : 'changed')
        } finally { racing.dispose() }
      }
      report.checks.push('actual reply-to-metadata races discard detected document type change, deletion and changed path cardinality; no atomic snapshot claim')

      // Module commands cannot be startup-renamed before module registration.
      // Explicitly inject a refusal obtained from this real server instead of
      // claiming an untested no-module server or altering its module lifecycle.
      let unavailable
      try { await admin.sendCommand(['JSON.GET_MISSING', 'compact', '$']) } catch (error) { unavailable = error }
      assert(unavailable instanceof Error && unavailable.message.startsWith('ERR unknown command'))
      const rejecting = new RedisConnections(async (credentials, commandSignal) => {
        const link = await openRedis(credentials, commandSignal)
        return { ...link, execute: async (...args) => { if (args[0] === 'JSON.GET') { args[3](); throw new RedisReplyError(unavailable.message) }; return link.execute(...args) } }
      })
      try {
        const selected = await rejecting.connect('refusal', settings, signal())
        assert.equal((await new RedisJson(rejecting).read('refusal', { ...request('compact'), target: target(selected) }, signal())).state, 'unavailable')
      } finally { rejecting.dispose() }
      report.checks.push('explicit Host fault injection of an actual server unknown-command refusal maps unavailable; not claimed as a no-module-server acceptance')
    } finally { connections.dispose() }
    await until(async () => await clients() === baseline, 'owned JSON viewer sockets closed')
  })
  report.passed = true
} finally {
  report.finishedAt = new Date().toISOString()
  const directory = resolve(import.meta.dirname, '../.scratch/artifacts'); await mkdir(directory, { recursive: true })
  await writeFile(resolve(directory, 'json-smoke.json'), JSON.stringify(report, null, 2) + '\n')
}
console.log(JSON.stringify({ passed: report.passed, checks: report.checks.length, fixturesStopped: report.fixtures.every(value => value.stopped && value.certificatesRemoved && value.fixtureRemoved !== false) }))
