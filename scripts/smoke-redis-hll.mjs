/** Real production-reader checks on exclusive owned HLL fixtures. */
import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'
import { RESP_TYPES } from 'redis'
import { RedisConnections, openRedis } from '../lib/host/connection-service.js'
import { RedisHll } from '../lib/host/hll-reader.js'
import { RedisStrings } from '../lib/host/string-reader.js'
import { until, withRedisFixture } from './redis-fixture.mjs'

const report = { startedAt: new Date().toISOString(), checks: [], fixtures: [], passed: false }
const signal = () => new AbortController().signal
const target = view => { assert(view.id !== null); return { id: view.id, generation: view.generation, db: view.db } }
try {
  await withRedisFixture(async ({ settings, admin, clients, metadata }) => {
    report.fixtures.push(metadata)
    const buffers = admin.withTypeMapping({ [RESP_TYPES.BLOB_STRING]: Buffer }), binary = Buffer.from([255, 0, 13])
    for (const [key, count] of [[binary, 100], ['hll:dense', 10000]]) {
      for (let index = 0; index < count; index += 500) await admin.sendCommand(['PFADD', key, ...Array.from({ length: Math.min(500, count - index) }, (_, offset) => 'item-' + (index + offset))])
      await admin.pExpire(key, 300000)
    }
    await admin.sendCommand(['PFADD', '']); await admin.pExpire('', 300000)
    const sparse = await buffers.get(binary)
    await admin.set('hll:cached', sparse); await admin.sendCommand(['PFCOUNT', 'hll:cached']); await admin.pExpire('hll:cached', 300000)
    const corrupt = Buffer.alloc(17); corrupt.write('HYLL'); corrupt[4] = 1; corrupt[15] = 128
    await admin.set('hll:corrupt', corrupt)
    const huge = Buffer.alloc(2 * 1024 * 1024); sparse.subarray(0, 16).copy(huge); await admin.set('hll:huge-fake', huge)
    await admin.set('hll:plain', 'ordinary String'); await admin.hSet('hll:hash', 'field', 'value')
    const giantKey = Buffer.alloc(65536, 97); await admin.set(giantKey, sparse)
    const stats = async () => {
      const map = new Map([...(await admin.info('commandstats')).matchAll(/^cmdstat_([^:]+):calls=(\d+)/gmu)].map(match => [match[1], Number(match[2])]))
      return Object.fromEntries(['pfadd', 'pfmerge', 'set', 'del', 'expire', 'pexpire', 'getdel', 'getex'].map(command => [command, map.get(command) ?? 0]))
    }
    const before = await stats(), baseline = await clients(), calls = []
    const connections = new RedisConnections(async (...args) => {
      const link = await openRedis(...args)
      return { close: () => link.close(), onFailure: callback => link.onFailure(callback), execute: async (command, argv, ...rest) => {
        const reply = await link.execute(command, argv, ...rest)
        calls.push({ command, args: argv, bytes: Buffer.isBuffer(reply) ? reply.length : null })
        if (command === 'PFCOUNT') { assert.equal(argv.length, 2); assert.deepEqual(argv[0], argv[1]) }
        return reply
      } }
    })
    const reader = new RedisHll(connections), strings = new RedisStrings(connections)
    let view = await connections.connect('hll', settings, signal())
    const request = name => ({ target: target(view), keyBase64: (Buffer.isBuffer(name) ? name : Buffer.from(name)).toString('base64') })
    try {
      for (const key of [binary, 'hll:dense', 'hll:cached', '']) {
        const raw = await buffers.get(key), dump = await buffers.sendCommand(['DUMP', key]), expiry = await admin.sendCommand(['PEXPIRETIME', key])
        const expected = String(await admin.sendCommand(['PFCOUNT', key, key]))
        const result = await reader.read('hll', request(key), signal())
        assert.equal(result.state, 'value'); assert.equal(result.estimate, expected); assert.equal(result.encoding, raw[4] === 0 ? 'dense' : 'sparse'); assert.equal(result.cacheValid, (raw[15] & 128) === 0)
        assert.deepEqual(await buffers.get(key), raw); assert.deepEqual(await buffers.sendCommand(['DUMP', key]), dump); assert.equal(await admin.sendCommand(['PEXPIRETIME', key]), expiry)
      }
      assert.deepEqual(await stats(), before)
      assert(calls.filter(call => call.command === 'GETRANGE').every(call => call.bytes <= 16 && call.args[1] === '0' && call.args[2] === '15'))
      report.checks.push('actual sparse/dense, valid/invalid cache and empty/binary keys preserve exact source bytes, absolute expiry and write counters; fixed duplicate raw inputs and at-most-16-byte headers observed')
      for (const name of ['hll:plain', 'hll:corrupt', 'hll:huge-fake']) assert.equal((await reader.read('hll', request(name), signal())).state, 'invalid')
      assert(calls.filter(call => call.command === 'GETRANGE').every(call => call.bytes <= 16))
      assert.equal((await reader.read('hll', request('hll:missing'), signal())).state, 'missing')
      assert.equal((await reader.read('hll', request('hll:hash'), signal())).state, 'unsupported')
      report.checks.push('ordinary/fake/corrupted sparse and 2 MiB fake strings are invalid without transferring full values; missing and non-String remain distinct')
      assert.equal((await reader.read('hll', request(giantKey), signal())).error, 'oversize')
      assert.equal(connections.status('hll').state, 'connected'); assert.equal((await reader.read('hll', request(binary), signal())).state, 'value')
      report.checks.push('actual 64 KiB raw key duplicated request exceeds the transport budget without truncation or disconnect; a normal key immediately recovers')
      await admin.sendCommand(['ACL', 'SETUSER', 'hll-reader', 'reset', 'on', '>' + settings.password, '~*', '+ping', '+type', '+pttl', '+strlen', '+getrange', '+pfcount'])
      const limited = await connections.connect('limited', { ...settings, username: 'hll-reader' }, signal()), limitedRequest = { target: target(limited), keyBase64: binary.toString('base64') }
      assert.equal((await reader.read('limited', limitedRequest, signal())).state, 'value')
      assert.match(await admin.sendCommand(['ACL', 'DRYRUN', 'hll-reader', 'PFADD', binary, 'forbidden']), /permission/iu)
      await admin.sendCommand(['ACL', 'SETUSER', 'hll-reader', '-pfcount'])
      assert.equal((await reader.read('limited', limitedRequest, signal())).error, 'permission')
      assert.equal((await strings.read('limited', { ...limitedRequest, offset: '0', count: 256 }, signal())).state, 'value')
      report.checks.push('minimal fixed read ACL counts; denied PFCOUNT is permission, PFADD remains forbidden and original String bytes remain readable')
      const old = request(binary)
      view = await connections.selectDatabase('hll', { ...old.target, db: 1 }, signal())
      assert.equal((await reader.read('hll', old, signal())).error, 'stale'); assert.equal((await reader.read('hll', request(binary), signal())).state, 'missing')
      view = await connections.selectDatabase('hll', { ...target(view), db: 0 }, signal())
      report.checks.push('actual DB generation change rejects old HLL results and isolates DB1')
      for (const mode of ['type', 'missing', 'length', 'cache']) {
        await admin.set('hll:race', sparse)
        const race = new RedisConnections(async (...args) => {
          const link = await openRedis(...args)
          return { close: () => link.close(), onFailure: callback => link.onFailure(callback), execute: async (command, argv, ...rest) => {
            const reply = await link.execute(command, argv, ...rest)
            if (command === 'PFCOUNT') {
              if (mode === 'type') { await admin.del('hll:race'); await admin.hSet('hll:race', 'field', 'value') }
              else if (mode === 'missing') await admin.del('hll:race')
              else if (mode === 'length') await admin.set('hll:race', 'short')
              else await admin.sendCommand(['PFCOUNT', 'hll:race'])
            }
            return reply
          } }
        })
        try {
          const connected = await race.connect('race', settings, signal())
          const result = await new RedisHll(race).read('race', { target: target(connected), keyBase64: Buffer.from('hll:race').toString('base64') }, signal())
          assert.equal(result.state, mode === 'missing' ? 'missing' : 'changed'); assert.equal(result.estimate, null)
        } finally { race.dispose() }
      }
      report.checks.push('actual type/deletion/length and concurrent single-input cache update races discard HLL estimates rather than claim a snapshot')
    } finally { connections.dispose(); await until(async () => await clients() === baseline, 'all HLL sockets released') }
  })
  await withRedisFixture(async ({ settings, admin, clients, metadata }) => {
    report.fixtures.push(metadata); metadata.pfcountDisabled = true
    await admin.sendCommand(['PFADD', 'hll:only', 'one'])
    await assert.rejects(admin.sendCommand(['PFCOUNT', 'hll:only', 'hll:only']), /ERR unknown command/iu)
    const baseline = await clients(), connections = new RedisConnections()
    try {
      const view = await connections.connect('unavailable', settings, signal()), request = { target: target(view), keyBase64: Buffer.from('hll:only').toString('base64') }
      assert.equal((await new RedisHll(connections).read('unavailable', request, signal())).state, 'unavailable')
      assert.equal((await new RedisStrings(connections).read('unavailable', { ...request, offset: '0', count: 256 }, signal())).state, 'value')
      report.checks.push('actual owned server disables PFCOUNT; production reader reports unavailable with no single-input fallback and String remains readable')
    } finally { connections.dispose(); await until(async () => await clients() === baseline, 'unavailable HLL socket released') }
  }, { disableHllCount: true })
  report.passed = true
} catch (error) { report.error = error instanceof Error ? error.message : String(error); process.exitCode = 1 }
finally {
  report.finishedAt = new Date().toISOString()
  await writeFile(new URL('../.scratch/artifacts/hll-smoke.json', import.meta.url), JSON.stringify(report, null, 2) + '\n')
  console.log(JSON.stringify({ passed: report.passed, checks: report.checks.length, fixturesStopped: report.fixtures.every(f => f.stopped && f.fixtureRemoved && f.certificatesRemoved), error: report.error }))
}
