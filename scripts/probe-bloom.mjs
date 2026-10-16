/** Bloom source semantics on an exclusive fixture; administrator seeds only. */
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
    await admin.sendCommand(['BF.RESERVE', 'bf:scaled', '0.01', '10'])
    await admin.sendCommand(['BF.RESERVE', 'bf:fixed', '0.01', '10', 'NONSCALING'])
    await admin.sendCommand(['CF.RESERVE', 'cf:only', '100'])
    const key = Buffer.from([255, 0, 13]), item = Buffer.from([254, 0])
    await admin.sendCommand(['BF.ADD', key, item]); await admin.sendCommand(['BF.ADD', key, ''])
    for (const name of ['bf:scaled', 'bf:fixed', 'cf:only', key]) {
      const label = Buffer.isBuffer(name) ? 'binary' : name
      report.observations[label] = { type: describe(await raw(settings, ['TYPE', name])), info: describe(await raw(settings, ['BF.INFO', name])) }
    }
    assert.equal(report.observations['bf:scaled'].type, 'MBbloom--')
    assert.notEqual(report.observations['cf:only'].type, 'MBbloom--')
    report.checks.push('Actual Bloom type MBbloom-- differs from Cuckoo; scaling/non-scaling and binary-key INFO integer fields recorded')
    assert.equal(await raw(settings, ['BF.EXISTS', key, item]), 1n)
    assert.equal(await raw(settings, ['BF.EXISTS', key, '']), 1n)
    report.observations.missingInfo = describe(await raw(settings, ['BF.INFO', 'missing']))
    report.observations.missingExists = describe(await raw(settings, ['BF.EXISTS', 'missing', 'x']))
    report.observations.cuckooExists = describe(await raw(settings, ['BF.EXISTS', 'cf:only', 'x']))
    assert.equal(report.observations.missingExists.integer, '0')
    report.checks.push('Binary and empty items query exactly; missing and wrong-type INFO/EXISTS behavior recorded without treating a raw zero as sufficient existence proof')
    await admin.sendCommand(['BF.RESERVE', 'bf:probability', '0.9', '1'])
    await admin.sendCommand(['BF.ADD', 'bf:probability', 'only-added'])
    let falsePositive = null
    for (let index = 0; index < 10000; index++) {
      const candidate = 'never-added-' + index
      if (await raw(settings, ['BF.EXISTS', 'bf:probability', candidate]) === 1n) { falsePositive = candidate; break }
    }
    assert.notEqual(falsePositive, null)
    report.observations.falsePositive = falsePositive
    report.checks.push('An actual never-added item returns one in a deliberately high-false-positive fixture, proving positive is only possible membership')
    return true
  })
  report.passed = run.value
} catch (error) { report.error = error.stack; process.exitCode = 1 }
finally {
  report.finishedAt = new Date().toISOString()
  await writeFile(new URL('../.scratch/artifacts/bloom-source-probe.json', import.meta.url), JSON.stringify(report, null, 2) + '\n')
  console.log(JSON.stringify({ passed: report.passed, checks: report.checks.length, error: report.error ?? null, fixture: report.fixture }))
}
