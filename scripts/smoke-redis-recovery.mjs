/** Production readers and transport against real Redis through one owned delay proxy. */
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { RESP_TYPES } from 'redis'
import { RedisConnections } from '../lib/host/connection-service.js'
import { RedisStrings } from '../lib/host/string-reader.js'
import { createReadDelayProxy } from './read-delay-proxy.mjs'
import { until, withRedisFixture } from './redis-fixture.mjs'

const report = { startedAt: new Date().toISOString(), checks: [], fixtures: [], passed: false }
const signal = () => new AbortController().signal
const target = view => { assert(view.id !== null); return { id: view.id, generation: view.generation, db: view.db } }
const secrets = []
try {
  await withRedisFixture(async fixture => {
    const { settings, admin, clients, metadata } = fixture; report.fixtures.push(metadata); secrets.push(settings.password)
    const keyA = Buffer.from([0, 255, 13, 10, 128]), keyB = Buffer.from('recovery:b'), keyMax = Buffer.alloc(65536, 255)
    const valueA = Buffer.from([65, 0, 255, 66]), valueB = Buffer.from('independent-B')
    await admin.set(keyA, valueA); await admin.pExpire(keyA, 3_600_000)
    await admin.set(keyB, valueB); await admin.set(keyMax, 'maximum-key')
    await admin.select(1); await admin.set(keyA, 'DB1-A'); await admin.select(0)
    const buffers = admin.withTypeMapping({ [RESP_TYPES.BLOB_STRING]: Buffer })
    const dump = await buffers.sendCommand(['DUMP', keyA]), expiry = await admin.sendCommand(['PEXPIRETIME', keyA])
    const writes = async () => Object.fromEntries((await admin.info('commandstats')).split('\r\n').filter(line => /^cmdstat_(?:set|del|unlink|expire|pexpire|persist):/u.test(line)).map(line => [line.split(':')[0], line.match(/calls=(\d+)/u)?.[1]]))
    const beforeWrites = await writes(), baseline = await clients()
    const proxy = await createReadDelayProxy(settings), connections = new RedisConnections(), strings = new RedisStrings(connections)
    let a, b
    const read = (owner, view, key, readSignal = signal()) => strings.read(owner, { target: target(view), keyBase64: key.toString('base64'), offset: '0', count: 256 }, readSignal)
    const checkB = async () => { const result = await read('b', b, keyB); assert.equal(result.state, 'value'); assert.equal(result.base64, valueB.toString('base64')) }
    try {
      a = await connections.connect('a', proxy.settings, signal()); b = await connections.connect('b', proxy.settings, signal())
      assert.equal(a.state, 'connected'); assert.equal(b.state, 'connected')
      assert.equal((await read('a', a, keyMax)).base64, Buffer.from('maximum-key').toString('base64'))
      const hold = proxy.holdNext('GETRANGE', keyA), controller = new AbortController()
      const first = read('a', a, keyA, controller.signal)
      await until(() => hold.received, 'real GETRANGE reply buffered')
      const cancelAt = Date.now(); controller.abort()
      assert.equal((await first).error, 'cancelled'); report.cancelObservedMs = Date.now() - cancelAt
      const before = proxy.commands.length
      const next = read('a', a, keyB)
      await checkB()
      assert.equal(proxy.commands.slice(before).filter(value => value.connectionId === hold.connectionId).length, 0)
      hold.release()
      assert.equal((await next).base64, valueB.toString('base64'))
      assert.deepEqual(connections.status('a'), a)
      report.checks.push('actual binary GETRANGE cancellation returns promptly while its bounded reply drains; same-session successor waits, receives its own value, and B remains readable on an independent socket')

      const queueHold = proxy.holdNext('GETRANGE', keyA), active = new AbortController()
      const activeRead = read('a', a, keyA, active.signal); await until(() => queueHold.received, 'queue-bound active reply')
      const mark = proxy.commands.length, controllers = Array.from({ length: 15 }, () => new AbortController())
      const waiting = controllers.map(controller => connections.read('a', target(a), 'TYPE', [keyB], controller.signal))
      const settled = Promise.allSettled(waiting)
      await assert.rejects(connections.read('a', target(a), 'TYPE', [keyB], signal()), error => error.code === 'busy')
      for (const controller of controllers) controller.abort()
      assert((await settled).every(value => value.status === 'rejected' && value.reason.code === 'cancelled'))
      active.abort(); assert.equal((await activeRead).error, 'cancelled'); await checkB(); queueHold.release()
      let queueResult = await read('a', a, keyB)
      report.queueDrainFirstResult = { state: queueResult.state, error: queueResult.error }
      if (queueResult.state !== 'value') assert.equal(queueResult.error, 'busy', 'Only a still-draining full queue may delay this retry')
      // release() writes bytes; the Host still has to consume the frame and
      // settle its cancelled entries. Only this acceptance probe polls; the
      // production reader does not silently retry the user's request.
      await until(async () => {
        if (queueResult.state === 'value') return true
        queueResult = await read('a', a, keyB)
        if (queueResult.state !== 'value') assert.equal(queueResult.error, 'busy')
        return queueResult.state === 'value'
      }, 'cancelled queue drained before explicit read succeeds')
      const aCommands = proxy.commands.slice(mark).filter(value => value.connectionId === queueHold.connectionId)
      assert.equal(aCommands.filter(value => value.command === 'TYPE').length, 2, 'Only the explicit new String read may issue its two TYPEs')
      report.checks.push('real transport admits one active plus 15 queued commands, rejects the seventeenth as busy, skips all cancelled queue entries and remains reusable without closing B')

      const deadlineHold = proxy.holdNext('GETRANGE', keyA), deadlineActive = new AbortController()
      const blocked = read('a', a, keyA, deadlineActive.signal); await until(() => deadlineHold.received, 'queued-deadline active reply')
      // The public transport deadline surface can be tested directly; production
      // reader RPC still fixes its operation total at ten seconds.
      const { RedisTransport } = await import('../lib/host/redis-transport.js')
      const transport = await RedisTransport.open(proxy.settings, signal())
      try {
        const shortHold = proxy.holdNext('TYPE', keyB)
        const firstType = transport.execute('TYPE', [keyB], signal(), () => undefined)
        await until(() => shortHold.received, 'dedicated actual TYPE held')
        const mark = proxy.commands.length
        await assert.rejects(transport.execute('STRLEN', [keyB], signal(), () => undefined, Date.now() + 100), error => error.code === 'timeout')
        shortHold.release(); assert.equal(await firstType, 'string')
        assert.equal(await transport.execute('TYPE', [keyB], signal(), () => undefined), 'string')
        assert.equal(proxy.commands.slice(mark).filter(value => value.connectionId === shortHold.connectionId && value.command === 'STRLEN').length, 0)
      } finally { transport.close() }
      deadlineActive.abort(); assert.equal((await blocked).error, 'cancelled'); deadlineHold.release(); await checkB()
      report.checks.push('an explicit short queued deadline expires before dispatch on a real transport, is never sent later, and its socket and other sessions recover; production ten-second deadline is tested separately')

      const old = a, switchHold = proxy.holdNext('GETRANGE', keyA)
      const oldRead = read('a', a, keyA); await until(() => switchHold.received, 'generation-change active reply')
      const switchMark = proxy.commands.length
      const queuedOld = connections.read('a', target(a), 'TYPE', [keyB], signal()).then(() => null, error => error)
      const switching = connections.selectDatabase('a', { ...target(a), db: 1 }, signal())
      assert(connections.status('a').generation > a.generation)
      switchHold.release()
      const [oldResult, queuedError, switched] = await Promise.all([oldRead, queuedOld, switching])
      assert.equal(oldResult.error, 'stale'); assert.equal(queuedError.code, 'stale'); a = switched; assert.equal(a.db, 1)
      assert.deepEqual(proxy.commands.slice(switchMark).filter(value => value.connectionId === switchHold.connectionId).map(value => value.command), ['SELECT'])
      assert.equal((await read('a', a, keyA)).base64, Buffer.from('DB1-A').toString('base64'))
      await checkB(); assert.equal((await read('a', old, keyA)).error, 'stale')
      a = await connections.selectDatabase('a', { ...target(a), db: 0 }, signal())
      report.checks.push('real SELECT advances generation before dispatch, discards the old active value and queued old-target command, then reads only the confirmed DB while B stays in DB0')

      const timeoutHold = proxy.holdNext('GETRANGE', keyA), timeoutStart = Date.now(), oldTarget = target(a)
      const timed = read('a', a, keyA); await until(() => timeoutHold.received, 'real production-deadline reply held')
      await checkB(); assert.equal((await timed).error, 'timeout')
      await until(() => connections.status('a').state === 'error', 'owned hard-deadline socket closed')
      report.productionTimeoutMs = Date.now() - timeoutStart
      assert(report.productionTimeoutMs >= 9500 && report.productionTimeoutMs < 20000)
      assert.equal(connections.status('a').error, 'timeout')
      await until(() => proxy.connections.find(value => value.id === timeoutHold.connectionId)?.closed, 'timed-out proxy owner closed')
      timeoutHold.release(); await checkB()
      const reconnectMark = proxy.commands.length
      a = await connections.connect('a', proxy.settings, signal())
      assert(a.generation > oldTarget.generation); assert.equal(a.id, oldTarget.id); assert.equal(a.db, 0)
      assert.deepEqual(proxy.commands.slice(reconnectMark).map(value => value.command), ['AUTH', 'PING'])
      assert.equal((await read('a', { ...a, ...oldTarget }, keyA)).error, 'stale')
      assert.equal((await read('a', a, keyA)).base64, valueA.toString('base64'))
      report.checks.push('actual production ten-second total deadline closes only stalled A, keeps B readable, and explicit reconnect advances generation with handshake only and no replay of old reads')

      const selectHold = proxy.holdNext('SELECT'), selectAbort = new AbortController()
      const uncertain = connections.selectDatabase('a', { ...target(a), db: 1 }, selectAbort.signal)
      await until(() => selectHold.received, 'actual selected DB reply held')
      selectAbort.abort(); const cancelledSelect = await uncertain
      assert.equal(cancelledSelect.state, 'error'); assert.equal(cancelledSelect.error, 'cancelled'); selectHold.release(); await checkB()
      a = await connections.connect('a', proxy.settings, signal()); assert.equal(a.db, 0)
      report.checks.push('cancelling SELECT after the real server changed DB closes its uncertain owned socket; explicit reconnect starts DB0 and never disrupts B')

      const disconnectHold = proxy.holdNext('GETRANGE', keyA)
      const disconnectedRead = read('a', a, keyA); await until(() => disconnectHold.received, 'disconnect active reply held')
      const queuedDisconnect = connections.read('a', target(a), 'TYPE', [keyB], signal()).then(() => null, error => error)
      proxy.disconnect(disconnectHold.connectionId)
      assert.equal((await disconnectedRead).error, 'network'); assert.equal((await queuedDisconnect).code, 'network')
      await until(() => connections.status('a').state === 'error', 'network EOF observed in status')
      assert.equal(connections.status('a').error, 'network'); await checkB()
      const reopenMark = proxy.commands.length, previous = a
      a = await connections.connect('a', proxy.settings, signal())
      assert(a.generation > previous.generation)
      assert.deepEqual(proxy.commands.slice(reopenMark).map(value => value.command), ['AUTH', 'PING'])
      assert.equal((await read('a', a, keyB)).base64, valueB.toString('base64'))
      report.checks.push('actual proxy TCP EOF fails active and queued A reads without reconnect/replay; manual generation replacement reads fresh data and B remains connected')

      assert.deepEqual(await buffers.sendCommand(['DUMP', keyA]), dump); assert.equal(await admin.sendCommand(['PEXPIRETIME', keyA]), expiry)
      assert.deepEqual(await writes(), beforeWrites)
      assert(proxy.commands.every(value => ['AUTH', 'PING', 'SELECT', 'TYPE', 'PTTL', 'STRLEN', 'GETRANGE'].includes(value.command)))
      assert(proxy.commands.some(value => value.command === 'GETRANGE' && value.firstArgumentBase64 === keyMax.toString('base64')))
      assert(!proxy.errors.some(value => value.startsWith('proxy-')))
      report.commandCounts = Object.fromEntries([...new Set(proxy.commands.map(value => value.command))].map(command => [command, proxy.commands.filter(value => value.command === command).length]))
      report.proxyErrors = proxy.errors
      report.checks.push('all production commands remain fixed reads/lifecycle operations; binary and maximum-key identities, source serialized bytes, absolute expiry and monitored data-write counts are unchanged')
    } finally { connections.dispose(); await proxy.close() }
    await until(async () => await clients() === baseline, 'all proxy and viewer sockets released')
  })
  assert(report.fixtures.every(value => value.stopped && value.fixtureRemoved)); report.passed = true
} catch (error) {
  let message = error instanceof Error ? error.stack ?? error.message : String(error)
  for (const secret of secrets) if (secret) message = message.replaceAll(secret, '[redacted]')
  report.error = message; process.exitCode = 1; console.error(message)
} finally {
  report.finishedAt = new Date().toISOString()
  const directory = resolve(import.meta.dirname, '../.scratch/artifacts'); await mkdir(directory, { recursive: true })
  await writeFile(resolve(directory, 'recovery-smoke.json'), JSON.stringify(report, null, 2) + '\n')
  console.log(JSON.stringify({ passed: report.passed, checks: report.checks.length, fixturesStopped: report.fixtures.every(value => value.stopped) }))
}
