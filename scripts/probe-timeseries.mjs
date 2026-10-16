/** Source-semantics probe on an exclusive fixture; never a business endpoint. */
import assert from 'node:assert/strict'
import { createConnection } from 'node:net'
import { writeFile } from 'node:fs/promises'
import { encodeCommand, RespDecoder, RedisReplyError } from '../lib/host/resp.js'
import { withRedisFixture } from './redis-fixture.mjs'

const report = { startedAt: new Date().toISOString(), checks: [], fixture: null, observations: {}, passed: false }
async function raw(settings, argv) {
  const socket = createConnection({ host: settings.host, port: settings.port })
  let active
  socket.on('error', error => active?.reject(error))
  socket.on('data', chunk => {
    try { const reply = active.decoder.write(chunk); if (reply.done) active.resolve(reply.value) }
    catch (error) { active.reject(error) }
  })
  const request = args => new Promise((resolve, reject) => { active = { resolve, reject, decoder: new RespDecoder() }; socket.write(encodeCommand(args)) })
  socket.setTimeout(5000, () => socket.destroy(new Error('Probe timeout')))
  try {
    await new Promise((resolve, reject) => { socket.once('connect', resolve); socket.once('error', reject) })
    if (settings.password) assert.equal(await request(['AUTH', settings.password]), 'OK')
    return await request(argv)
  } finally { socket.destroy() }
}
const describe = value => typeof value === 'bigint' ? { integer: String(value) } : Buffer.isBuffer(value) ? { bulk: value.toString('utf8') } : value instanceof RedisReplyError ? { error: value.message } : Array.isArray(value) ? value.map(describe) : value
try {
  const run = await withRedisFixture(async ({ settings, admin, metadata }) => {
    report.fixture = metadata
    report.observations.modules = describe(await raw(settings, ['MODULE', 'LIST']))
    await admin.sendCommand(['TS.CREATE', 'ts:probe'])
    const stamps = ['0', '1', '9007199254740993', '9223372036854775806', '9223372036854775807']
    for (const stamp of stamps) {
      const reply = await raw(settings, ['TS.ADD', 'ts:probe', stamp, '1.2345678901234567'])
      assert.equal(reply, BigInt(stamp)); report.observations['add:' + stamp] = describe(reply)
    }
    assert.equal(await raw(settings, ['TYPE', 'ts:probe']), 'TSDB-TYPE')
    const all = await raw(settings, ['TS.RANGE', 'ts:probe', '-', '+', 'COUNT', '10'])
    assert.deepEqual(all.map(pair => pair[0]), stamps.map(BigInt))
    assert(all.every(pair => typeof pair[1] === 'string'))
    report.observations.rawRange = describe(all)
    report.checks.push('Actual TYPE TSDB-TYPE; integer RESP2 timestamps through signed-64 max remain exact; sample values are simple strings')
    for (const stamp of stamps) {
      for (const command of ['TS.RANGE', 'TS.REVRANGE']) {
        const same = await raw(settings, [command, 'ts:probe', stamp, stamp, 'COUNT', '1'])
        assert.equal(same.length, 1); assert.equal(same[0][0], BigInt(stamp))
      }
    }
    const reverse = await raw(settings, ['TS.REVRANGE', 'ts:probe', '-', '+', 'COUNT', '10'])
    assert.deepEqual(reverse.map(pair => pair[0]), stamps.toReversed().map(BigInt))
    assert.deepEqual(await raw(settings, ['TS.RANGE', 'ts:probe', '2', '3', 'COUNT', '1']), [])
    await admin.sendCommand(['TS.CREATE', 'ts:empty'])
    assert.deepEqual(await raw(settings, ['TS.RANGE', 'ts:empty', '-', '+', 'COUNT', '1']), [])
    report.checks.push('Both directions use lower then upper inclusive bounds; empty range and empty series return empty arrays')
    for (const [name, argv] of Object.entries({ exclusive: ['TS.RANGE', 'ts:probe', '(1', '+', 'COUNT', '1'], overflow: ['TS.RANGE', 'ts:probe', '0', '9223372036854775808'], negative: ['TS.RANGE', 'ts:probe', '-1', '+'], reversed: ['TS.RANGE', 'ts:probe', '2', '1'], nan: ['TS.ADD', 'ts:nan', '1', 'nan'], inf: ['TS.ADD', 'ts:inf', '1', 'inf'] })) {
      report.observations[name] = describe(await raw(settings, argv))
    }
    assert(report.observations.exclusive.error); assert(report.observations.overflow.error); assert(report.observations.negative.error)
    report.observations.info = describe(await raw(settings, ['TS.INFO', 'ts:probe']))
    report.observations.emptyInfo = describe(await raw(settings, ['TS.INFO', 'ts:empty']))
    await admin.hSet('ts:wrong', 'field', 'value')
    report.observations.wrongTypeInfo = describe(await raw(settings, ['TS.INFO', 'ts:wrong']))
    report.observations.missingInfo = describe(await raw(settings, ['TS.INFO', 'ts:missing']))
    assert.match(report.observations.wrongTypeInfo.error, /^ERR WRONGTYPE /u)
    assert.match(report.observations.missingInfo.error, /^ERR TSDB:/u)
    report.checks.push('Actual range parser rejects Stream-exclusive syntax, negative timestamp and signed-64 overflow; metadata and NaN/inf behavior recorded without assumptions')
    return true
  })
  report.passed = run.value
} catch (error) { report.error = error.stack; process.exitCode = 1 }
finally {
  report.finishedAt = new Date().toISOString()
  await writeFile(new URL('../.scratch/artifacts/timeseries-source-probe.json', import.meta.url), JSON.stringify(report, null, 2) + '\n')
  console.log(JSON.stringify({ passed: report.passed, checks: report.checks.length, error: report.error ?? null, fixture: report.fixture }))
}
