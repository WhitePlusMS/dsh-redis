/** Real TLS/identity acceptance against owned containers and short-lived certificates. */
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { RedisConnections } from '../lib/host/connection-service.js'
import { until, withRedisFixture } from './redis-fixture.mjs'

const report = { startedAt: new Date().toISOString(), checks: [], fixtures: [], passed: false }
const secrets = new Set()
const signal = () => new AbortController().signal

/** A fresh Node process loads its default trust store before opening the real client. */
async function defaultTrust(settings, caFile) {
  const code = `
    import {RedisConnections} from './lib/host/connection-service.js';
    let input='';for await(const chunk of process.stdin)input+=chunk;
    const service=new RedisConnections();
    try{console.log(JSON.stringify(await service.test(JSON.parse(input),new AbortController().signal)));}
    finally{service.dispose();}
  `
  const child = spawn(process.execPath, ['--input-type=module', '-e', code], {
    cwd: resolve(import.meta.dirname, '..'), windowsHide: true,
    env: { ...process.env, NODE_EXTRA_CA_CERTS: caFile }, stdio: ['pipe', 'pipe', 'pipe'],
  })
  let output = ''
  const closed = new Promise((done, reject) => { child.once('error', reject); child.once('close', done) })
  const timer = setTimeout(() => child.kill(), 12_000)
  child.stdout.on('data', value => { output = (output + value.toString()).slice(-8192) })
  child.stderr.resume()
  child.stdin.on('error', () => undefined)
  child.stdin.end(JSON.stringify(settings))
  try { assert.equal(await closed, 0, 'Default trust test process must exit cleanly'); return JSON.parse(output) }
  finally { clearTimeout(timer); if (child.exitCode === null && child.signalCode === null) { child.kill(); await closed } }
}

try {
  await withRedisFixture(async ({ settings, clients, metadata, wrongCaPem, certDirectory }) => {
    report.fixtures.push(metadata); secrets.add(settings.password)
    const service = new RedisConnections()
    const baseline = await clients()
    try {
      assert.deepEqual(await service.test(settings, signal()), { outcome: 'passed', error: null })
      await until(async () => await clients() === baseline, 'verified TLS test socket closes')
      report.checks.push('trusted private CA chain and IP subjectAltName accepted; test socket released')
      const connected = await service.connect('tls', settings, signal())
      assert.equal(connected.state, 'connected')
      assert.equal(connected.target.tls, true)
      assert(!JSON.stringify(connected).includes(settings.tls.caPem))
      assert(!JSON.stringify(connected).includes(settings.password))
      await until(async () => await clients() === baseline + 1, 'one authenticated TLS socket')
      service.disconnect('tls', { id: connected.id, generation: connected.generation })
      await until(async () => await clients() === baseline, 'TLS disconnect closes its socket')
      report.checks.push('persistent TLS connect, public TLS marker and manual disconnect without credentials')
      for (const caPem of [wrongCaPem, '', 'not a PEM certificate']) {
        assert.deepEqual(await service.test({ ...settings, tls: { caPem } }, signal()), { outcome: 'failed', error: 'tls-certificate' })
        await until(async () => await clients() === baseline, 'failed CA handshake does not retain a client')
      }
      report.checks.push('wrong, untrusted and malformed CA fail closed with certificate error; no sockets remain')
      assert.deepEqual(await defaultTrust({ ...settings, tls: { caPem: '' } }, resolve(certDirectory, 'ca.pem')), { outcome: 'passed', error: null })
      await until(async () => await clients() === baseline, 'default trust process releases its client')
      report.checks.push('empty CA uses Node default trust store, including NODE_EXTRA_CA_CERTS; no verification bypass')
    } finally { service.dispose() }
  }, { tls: true })
  await withRedisFixture(async ({ settings, clients, metadata }) => {
    report.fixtures.push(metadata); secrets.add(settings.password)
    const service = new RedisConnections()
    try {
      assert.deepEqual(await service.test(settings, signal()), { outcome: 'failed', error: 'tls-hostname' })
      const failed = await service.connect('mismatch', settings, signal())
      assert.equal(failed.state, 'error'); assert.equal(failed.error, 'tls-hostname')
      await until(async () => await clients() === 1, 'mismatched identity leaves only the fixture administrator')
      report.checks.push('trusted CA with a different DNS identity is rejected for the IP target; no retained socket')
    } finally { service.dispose() }
  }, { tls: true, wrongHostname: true })
  assert(report.fixtures.every(value => value.stopped && value.certificatesRemoved))
  report.passed = true
} catch (error) {
  let message = error instanceof Error ? error.stack ?? error.message : String(error)
  for (const secret of secrets) if (secret) message = message.replaceAll(secret, '[redacted]')
  report.error = message; process.exitCode = 1; console.error(message)
} finally {
  report.finishedAt = new Date().toISOString()
  const directory = resolve(import.meta.dirname, '../.scratch/artifacts')
  await mkdir(directory, { recursive: true })
  await writeFile(resolve(directory, 'tls-smoke.json'), JSON.stringify(report, null, 2) + '\n')
  console.log(JSON.stringify({ passed: report.passed, checks: report.checks.length, fixturesStopped: report.fixtures.every(value => value.stopped && value.certificatesRemoved) }))
}
