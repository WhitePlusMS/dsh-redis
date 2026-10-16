/** Production-reader acceptance on an exclusive owned TimeSeries fixture. */
import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'
import { RESP_TYPES } from 'redis'
import { RedisConnections, openRedis } from '../lib/host/connection-service.js'
import { RedisTimeSeries } from '../lib/host/timeseries-reader.js'
import { until, withRedisFixture } from './redis-fixture.mjs'

const report = { startedAt: new Date().toISOString(), checks: [], fixtures: [], passed: false }
const signal = () => new AbortController().signal
const target = view => { assert(view.id !== null); return { id: view.id, generation: view.generation, db: view.db } }
try {
  await withRedisFixture(async ({ settings, admin, clients, metadata }) => {
    report.fixtures.push(metadata)
    const binary = Buffer.from([255, 0, 13]), stamps = ['0', '1', '9007199254740993', '9223372036854775806', '9223372036854775807']
    const values = ['0', '-0.00000000000000001', '1.2345678901234567', '2', '1.7976931348623157e+308']
    for (let index = 0; index < stamps.length; index++) await admin.sendCommand(['TS.ADD', binary, stamps[index], values[index]])
    await admin.pExpire(binary, 300000)
    await admin.sendCommand(['HELLO', '2'])
    // The server canonicalizes doubles; preserve its response spelling, not the seed literal.
    const serverValues = (await admin.sendCommand(['TS.RANGE', binary, '-', '+'])).map(pair => pair[1])
    assert(serverValues.every(value => typeof value === 'string'))
    await admin.sendCommand(['TS.CREATE', ''])
    for (let index = 0; index < 235; index++) await admin.sendCommand(['TS.ADD', 'many', String(index), String(index / 10)])
    await admin.sendCommand(['TS.CREATE', 'huge-info', 'LABELS', 'huge', 'x'.repeat(2 * 1024 * 1024)])
    await admin.sendCommand(['TS.ADD', 'huge-info', '1', '2'])
    const hugeKey = Buffer.alloc(65536, 97); await admin.sendCommand(['TS.ADD', hugeKey, '1', '2'])
    const buffers = admin.withTypeMapping({ [RESP_TYPES.BLOB_STRING]: Buffer })
    const dump = await buffers.sendCommand(['DUMP', binary]), expiry = await admin.sendCommand(['PEXPIRETIME', binary])
    const stats = async () => {
      const map = new Map([...(await admin.info('commandstats')).matchAll(/^cmdstat_([^:]+):calls=(\d+)/gmu)].map(match => [match[1], Number(match[2])]))
      return Object.fromEntries(['ts.add', 'ts.create', 'ts.del', 'ts.alter', 'ts.incrby', 'ts.decrby', 'set', 'del', 'pexpire'].map(command => [command, map.get(command) ?? 0]))
    }
    const before = await stats(), baseline = await clients(), calls = []
    const connections = new RedisConnections(async (...args) => {
      const link = await openRedis(...args)
      return { ...link, execute: async (command, argv, ...rest) => { calls.push({ command, args: argv }); return link.execute(command, argv, ...rest) } }
    })
    const reader = new RedisTimeSeries(connections)
    let view = await connections.connect('a', settings, signal())
    const request = (name, direction = 'forward', start = '-', end = '+', count = 100, cursor = null) => ({ target: target(view), keyBase64: (Buffer.isBuffer(name) ? name : Buffer.from(name)).toString('base64'), direction, start, end, count, cursor })
    async function readAll(name, direction = 'forward', start = '-', end = '+', count = 100) {
      const samples = []; let cursor = null, pages = 0
      do {
        const page = await reader.read('a', request(name, direction, start, end, count, cursor), signal())
        assert.equal(page.state, 'page'); samples.push(...page.samples); cursor = page.cursor; assert(++pages < 500)
      } while (cursor !== null)
      assert.equal(new Set(samples.map(sample => sample.timestamp)).size, samples.length)
      return { samples, pages }
    }
    try {
      const forward = await readAll(binary, 'forward', '-', '+', 2), reverse = await readAll(binary, 'reverse', '-', '+', 1)
      assert.deepEqual(forward.samples.map(sample => sample.timestamp), stamps); assert.deepEqual(forward.samples.map(sample => sample.value), serverValues)
      assert.deepEqual(reverse.samples, forward.samples.toReversed())
      const sample = await reader.read('a', request(binary), signal())
      assert.deepEqual(sample.info, { totalSamples: '5', firstTimestamp: '0', lastTimestamp: '9223372036854775807', retentionTime: '0' })
      assert(calls.some(call => call.command === 'TS.RANGE' && call.args[1] === '2'))
      assert(calls.some(call => call.command === 'TS.RANGE' && call.args[1] === '9223372036854775807'))
      assert(calls.some(call => call.command === 'TS.REVRANGE' && call.args[2] === '0'))
      assert(calls.every(call => ['TYPE', 'PTTL', 'TS.INFO', 'TS.RANGE', 'TS.REVRANGE'].includes(call.command)))
      report.checks.push('actual binary key, timestamp zero, beyond-53-bit and signed-64 max timestamps and raw double text remain exact in both directions; fixed read commands and numeric +/-1 continuation observed')
      const many = await readAll('many'), manyReverse = await readAll('many', 'reverse')
      assert.equal(many.samples.length, 235); assert.equal(many.pages, 3); assert.deepEqual(manyReverse.samples, many.samples.toReversed())
      assert.deepEqual((await readAll('many', 'forward', '99', '101', 1)).samples.map(sample => sample.timestamp), ['99', '100', '101'])
      assert.deepEqual((await readAll('many', 'reverse', '99', '101', 1)).samples.map(sample => sample.timestamp), ['101', '100', '99'])
      assert.deepEqual((await readAll('many', 'forward', '999', '+')).samples, [])
      assert.equal((await reader.read('a', request(''), signal())).info.totalSamples, '0')
      assert.equal((await reader.read('a', request('missing'), signal())).state, 'missing')
      assert.equal((await reader.read('a', request(hugeKey), signal())).samples[0].value, '2')
      report.checks.push('235 samples paginate in three bounded pages without repeats; inclusive same/bounded/empty ranges, empty series/key and complete 64 KiB raw key identity work')
      assert.deepEqual(await stats(), before); assert.deepEqual(await buffers.sendCommand(['DUMP', binary]), dump); assert.equal(await admin.sendCommand(['PEXPIRETIME', binary]), expiry)
      report.checks.push('serialized series bytes, absolute expiry and all monitored data-write counters remain unchanged after reads')
      await admin.sendCommand(['ACL', 'SETUSER', 'ts-reader', 'reset', 'on', '>' + settings.password, '~*', '+ping', '+type', '+pttl', '+ts.range', '+ts.revrange'])
      const limitedView = await connections.connect('limited', { ...settings, username: 'ts-reader' }, signal()), limited = { ...request(binary), target: target(limitedView) }
      assert.equal((await reader.read('limited', limited, signal())).infoState, 'permission')
      await admin.sendCommand(['ACL', 'SETUSER', 'ts-reader', '+ts.info'])
      assert.equal((await reader.read('limited', limited, signal())).infoState, 'available')
      await admin.sendCommand(['ACL', 'SETUSER', 'ts-reader', '-ts.range'])
      assert.equal((await reader.read('limited', limited, signal())).error, 'permission')
      assert.equal((await reader.read('limited', { ...limited, direction: 'reverse' }, signal())).state, 'page')
      assert.match(await admin.sendCommand(['ACL', 'DRYRUN', 'ts-reader', 'TS.ADD', binary, '1', '3']), /permission/iu)
      report.checks.push('minimal read ACL reads samples without TS.INFO; granting INFO restores metadata, denying RANGE keeps REVRANGE working, and TS.ADD stays forbidden')
      assert.equal((await reader.read('a', request('huge-info'), signal())).error, 'oversize')
      assert.equal(connections.status('a').state, 'error'); assert.equal(connections.status('limited').state, 'connected')
      view = await connections.connect('a', settings, signal())
      assert.equal((await reader.read('a', request(binary), signal())).state, 'page')
      report.checks.push('actual 2 MiB TS.INFO label frame is refused by the receive budget and closes only its owned socket; explicit reconnect recovers')
      const old = request(binary); view = await connections.selectDatabase('a', { ...target(view), db: 1 }, signal())
      assert.equal((await reader.read('a', old, signal())).error, 'stale'); assert.equal((await reader.read('a', request(binary), signal())).state, 'missing')
      view = await connections.selectDatabase('a', { ...target(view), db: 0 }, signal())
      report.checks.push('real SELECT changes generation, rejects old targets and isolates DB1')
      for (const stage of ['TYPE', 'TS.RANGE']) for (const mode of ['missing', 'type']) {
        await admin.del('race'); await admin.sendCommand(['TS.ADD', 'race', '1', '2'])
        let changed = false
        const race = new RedisConnections(async (...args) => {
          const link = await openRedis(...args)
          return { ...link, execute: async (command, argv, ...rest) => {
            const reply = await link.execute(command, argv, ...rest)
            if (!changed && command === stage) { changed = true; await admin.del('race'); if (mode === 'type') await admin.hSet('race', 'field', 'value') }
            return reply
          } }
        }), raceReader = new RedisTimeSeries(race)
        try {
          const connected = await race.connect('race', settings, signal())
          const result = await raceReader.read('race', { ...request('race'), target: target(connected) }, signal())
          assert.equal(result.state, mode === 'missing' ? 'missing' : 'changed'); assert.equal(result.samples.length, 0)
        } finally { raceReader.dispose(); race.dispose() }
      }
      report.checks.push('actual deletion/type changes after first TYPE or after RANGE classify TSDB-specific errors and discard stale samples')
    } finally { reader.dispose(); connections.dispose(); await until(async () => await clients() === baseline, 'all TimeSeries sockets released') }
  })
  report.passed = true
} catch (error) { report.error = error.stack; process.exitCode = 1 }
finally {
  report.finishedAt = new Date().toISOString()
  await writeFile(new URL('../.scratch/artifacts/timeseries-smoke.json', import.meta.url), JSON.stringify(report, null, 2) + '\n')
  console.log(JSON.stringify({ passed: report.passed, checks: report.checks.length, error: report.error ?? null, fixturesStopped: report.fixtures.every(f => f.stopped && f.fixtureRemoved && f.certificatesRemoved) }))
}
