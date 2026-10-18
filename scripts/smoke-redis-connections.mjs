/** Actual Redis socket/authentication acceptance; it never uses a user Redis endpoint. */
import assert from 'node:assert/strict'
import { createServer } from 'node:net'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { RedisConnections } from '../lib/host/connection-service.js'
import { until, withRedisFixture } from './redis-fixture.mjs'

const report = { startedAt: new Date().toISOString(), checks: [], fixtures: [], passed: false }
const secrets = new Set()
const signal = () => new AbortController().signal
const target = view => { assert(view.id !== null); return { id: view.id, generation: view.generation } }
// Exercise the product's sole connection path and explicitly release successes.
async function connectAndClose(service, settings, requestSignal) {
  const view = await service.connect('probe', settings, requestSignal)
  if (view.state === 'connected') service.disconnect('probe', target(view))
  return { state: view.state, error: view.error }
}
try {
  await withRedisFixture(async ({ settings, admin, clients, metadata }) => {
    report.fixtures.push(metadata); secrets.add(settings.password)
    const baseline = await clients()
    assert.equal(baseline, 1)
    const service = new RedisConnections()
    try {
      assert.deepEqual(await connectAndClose(service, settings, signal()), { state: 'connected', error: null })
      await until(async () => await clients() === baseline, 'test connection closes its socket')
      report.checks.push('password authentication through connect and explicit socket cleanup')
      const invalid = { ...settings, password: 'definitely-wrong-fixture-password' }
      assert.deepEqual(await connectAndClose(service, invalid, signal()), { state: 'error', error: 'auth' })
      const failed = await service.connect('bad', invalid, signal())
      assert.equal(failed.error, 'auth')
      assert(!JSON.stringify(failed).includes(invalid.password))
      await until(async () => await clients() === baseline, 'failed authentication closes its socket')
      report.checks.push('wrong password classification and failed socket cleanup')
      await admin.sendCommand(['ACL', 'SETUSER', 'viewer-fixture', 'reset', 'on', '>' + settings.password, '~*', '+@connection'])
      assert.equal((await connectAndClose(service, { ...settings, username: 'viewer-fixture' }, signal())).state, 'connected')
      await until(async () => await clients() === baseline, 'ACL test cleanup')
      await admin.sendCommand(['ACL', 'SETUSER', 'viewer-nopass', 'reset', 'on', 'nopass', '~*', '+@connection'])
      assert.equal((await connectAndClose(service, { ...settings, username: 'viewer-nopass', password: '' }, signal())).state, 'connected')
      await until(async () => await clients() === baseline, 'empty-password ACL cleanup')
      report.checks.push('named ACL authentication, including an explicitly empty password')
      const connected = await service.connect('a', settings, signal())
      assert.equal(connected.state, 'connected')
      await until(async () => await clients() === baseline + 1, 'one persistent connection')
      for (let index = 0; index < 5; index++) assert.equal(service.status('a').state, 'connected')
      assert.equal(await clients(), baseline + 1)
      assert.equal(service.disconnect('a', target(connected)).state, 'disconnected')
      await until(async () => await clients() === baseline, 'manual disconnect releases its socket')
      await delay(200)
      assert.equal(await clients(), baseline)
      report.checks.push('persistent connect, local status, manual disconnect and no reconnect')
      const a = await service.connect('a', settings, signal())
      await service.connect('b', settings, signal())
      await until(async () => await clients() === baseline + 2, 'isolated session connections')
      service.disposeSession('a')
      await until(async () => await clients() === baseline + 1, 'owning session disposal')
      assert.equal(service.status('b').state, 'connected')
      assert.equal(service.status('a').state, 'disconnected')
      assert.notEqual(a.id, service.status('b').id)
      await admin.sendCommand(['CLIENT', 'KILL', 'TYPE', 'normal', 'SKIPME', 'yes'])
      await until(() => service.status('b').state === 'error', 'server-side close reaches Host state')
      await until(async () => await clients() === baseline, 'failed live socket is released')
      report.checks.push('session isolation, disposal and server-side close without reconnect')
    } finally { service.dispose() }
    await until(async () => await clients() === baseline, 'all viewer sockets released')
  })
  await withRedisFixture(async ({ settings, clients, metadata }) => {
    report.fixtures.push(metadata)
    const service = new RedisConnections()
    try { assert.equal((await connectAndClose(service, settings, signal())).state, 'connected') }
    finally { service.dispose() }
    await until(async () => await clients() === 1, 'no-password fixture cleanup')
    report.checks.push('server without a password')
  }, { passwordRequired: false })
  const sockets = new Set()
  const server = createServer(socket => { sockets.add(socket); socket.on('error', () => undefined); socket.on('close', () => sockets.delete(socket)); socket.resume() })
  await new Promise(resolveListen => server.listen(0, '127.0.0.1', resolveListen))
  const address = server.address(); assert(address && typeof address !== 'string')
  const blackhole = { host: '127.0.0.1', port: address.port, username: '', password: '', tls: null }
  const service = new RedisConnections()
  try {
    const timed = await connectAndClose(service, blackhole, signal())
    assert.equal(timed.error, 'timeout')
    await until(() => sockets.size === 0, 'timeout closes the hanging handshake')
    const controller = new AbortController()
    const waiting = connectAndClose(service, blackhole, controller.signal)
    const timer = setTimeout(() => controller.abort(), 100)
    try { assert.equal((await waiting).error, 'cancelled') } finally { clearTimeout(timer) }
    await until(() => sockets.size === 0, 'cancel closes the hanging handshake')
    report.checks.push('real hanging socket timeout and explicit cancellation release resources')
  } finally {
    service.dispose()
    for (const socket of sockets) socket.destroy()
    await new Promise(resolveClose => server.close(resolveClose))
  }
  assert.equal((await connectAndClose(service, blackhole, signal())).error, 'network')
  report.checks.push('unreachable loopback endpoint is a network failure')
  assert(report.fixtures.every(fixture => fixture.stopped))
  report.passed = true
} catch (error) {
  let message = error instanceof Error ? error.stack ?? error.message : String(error)
  for (const secret of secrets) if (secret) message = message.replaceAll(secret, '[redacted]')
  report.error = message
  process.exitCode = 1
  console.error(message)
} finally {
  report.finishedAt = new Date().toISOString()
  const directory = resolve(import.meta.dirname, '../.scratch/artifacts')
  await mkdir(directory, { recursive: true })
  await writeFile(resolve(directory, 'connection-smoke.json'), JSON.stringify(report, null, 2) + '\n')
  console.log(JSON.stringify({ passed: report.passed, checks: report.checks.length, fixturesStopped: report.fixtures.every(fixture => fixture.stopped) }))
}
