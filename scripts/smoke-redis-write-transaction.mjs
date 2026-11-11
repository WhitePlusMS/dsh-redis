/** Run the built Host transport against the owned, password-protected Redis fixture. */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { RedisTransport } from '../lib/host/redis-transport.js'
import { RedisConnections } from '../lib/host/connection-service.js'
import { RedisAiWriter } from '../lib/host/ai-writer.js'
import { RESP_TYPES } from 'redis'
import { withRedisFixture } from './redis-fixture.mjs'

const signal = new AbortController().signal
const { fixture } = await withRedisFixture(async ({ settings, admin }) => {
  await admin.set('fixture:string', 'old')
  await admin.hSet('fixture:hash', { field: 'old', other: 'keep' })
  await admin.set('fixture:ttl', 'old', { PX: 120000 })
  await admin.set('fixture:session', 'old')
  await admin.sendCommand(['SET', 'fixture:coordinator', Buffer.from([0, 255])])
  await admin.hSet('fixture:coordinator-hash', 'field', 'old')
  await admin.set('fixture:preflight-race', 'old')
  await admin.hSet('fixture:fieldttl', 'field', 'old')
  await admin.hSet('fixture:race', { field: 'old', other: 'before' })
  assert.deepEqual(await admin.sendCommand(['HPEXPIRE', 'fixture:fieldttl', '120000', 'FIELDS', '1', 'field']), [1])
  const transport = await RedisTransport.open(settings, signal)
  let submitted = 0
  const readbacks = []
  const execute = request => transport.replaceExisting(request, signal, () => undefined, () => { submitted++ }, value => { readbacks.push(value) })
  try {
    const value = (key, before = 'old', after = 'new') => ({ type: 'string', key: Buffer.from(key), before: Buffer.from(before), after: Buffer.from(after) })
    const field = key => ({ ...value(key), type: 'hash', field: Buffer.from('field') })
    assert.equal(await execute(value('fixture:string')), 'written-verified')
    assert.equal(await admin.get('fixture:string'), 'new')
    assert.equal(await execute(field('fixture:hash')), 'written-verified')
    assert.deepEqual(await admin.hGetAll('fixture:hash'), { field: 'new', other: 'keep' })
    assert.equal(await execute(value('fixture:string', 'wrong')), 'conflict')
    assert.equal(await execute(value('fixture:ttl')), 'conflict')
    assert.equal(await execute(field('fixture:fieldttl')), 'conflict')
    assert.equal(await execute(value('fixture:missing')), 'conflict')
    assert.equal(await admin.get('fixture:string'), 'new')
    assert.equal(await admin.get('fixture:ttl'), 'old')
    assert.equal(await admin.hGet('fixture:fieldttl', 'field'), 'old')
    assert.equal(await admin.exists('fixture:missing'), 0)
    assert.equal(submitted, 2)
    assert.equal(readbacks.length, 2)
    for (const timestamp of readbacks) assert.equal(new Date(timestamp).toISOString(), timestamp)

    // The third guard runs after WATCH returns and before TYPE is dispatched.
    // A separate process waits for its own write receipt while this socket is paused.
    let checks = 0, raced = false
    const concurrent = () => {
      if (++checks !== 3) return
      const script = `import { createClient } from 'redis';
        const c = createClient({ socket: { host: process.env.FIXTURE_HOST, port: Number(process.env.FIXTURE_PORT), reconnectStrategy: false }, password: process.env.FIXTURE_PASSWORD });
        c.on('error', () => {}); await c.connect(); await c.hSet('fixture:race', 'other', 'changed'); await c.quit();`
      const result = spawnSync(process.execPath, ['--input-type=module', '-e', script], {
        cwd: process.cwd(), env: { ...process.env, FIXTURE_HOST: settings.host, FIXTURE_PORT: String(settings.port), FIXTURE_PASSWORD: settings.password },
        encoding: 'utf8', timeout: 10000, windowsHide: true,
      })
      assert.equal(result.status, 0, 'Independent fixture mutation failed')
      raced = true
    }
    assert.equal(await transport.replaceExisting(field('fixture:race'), signal, concurrent, () => { submitted++ }, () => undefined), 'conflict')
    assert.equal(raced, true)
    assert.equal(await admin.hGet('fixture:race', 'field'), 'old')
    assert.equal(await admin.hGet('fixture:race', 'other'), 'changed')
    assert.equal(await transport.execute('TYPE', [Buffer.from('fixture:race')], signal, () => undefined), 'hash')
    assert.equal(submitted, 3)
    const connections = new RedisConnections()
    try {
      const view = await connections.connect('fixture-session', settings, signal)
      assert.equal(view.state, 'connected')
      const target = { id: view.id, generation: view.generation, db: view.db }
      assert.equal(await connections.replaceExisting('other-session', target, value('fixture:session'), signal, () => undefined, () => { throw new Error('Foreign session submitted') }, () => undefined), 'not-executed')
      let sampledAt
      assert.equal(await connections.replaceExisting('fixture-session', target, value('fixture:session'), signal, () => undefined, () => undefined, value => { sampledAt = value }), 'written-verified')
      assert.equal(new Date(sampledAt).toISOString(), sampledAt)
      assert.equal(await admin.get('fixture:session'), 'new')
      const writer = new RedisAiWriter(connections)
      try {
        writer.enable('fixture-session', target)
        const next = Buffer.from([255, 0, 128])
        const stringProposal = await writer.prepare('fixture-session', target, 'turn-1', () => true, { type: 'string', keyBase64: Buffer.from('fixture:coordinator').toString('base64'), fieldBase64: null, afterBase64: next.toString('base64') }, signal)
        assert.equal(stringProposal.beforeBase64, Buffer.from([0, 255]).toString('base64'))
        const stringResult = await writer.execute('fixture-session', 'turn-1', () => true, stringProposal, signal)
        assert.equal(stringResult.state, 'written-verified')
        assert.equal(new Date(stringResult.readbackAt).toISOString(), stringResult.readbackAt)
        assert.deepEqual(await admin.withTypeMapping({ [RESP_TYPES.BLOB_STRING]: Buffer }).get('fixture:coordinator'), next)
        const hashProposal = await writer.prepare('fixture-session', target, 'turn-1', () => true, { type: 'hash', keyBase64: Buffer.from('fixture:coordinator-hash').toString('base64'), fieldBase64: Buffer.from('field').toString('base64'), afterBase64: Buffer.from('new').toString('base64') }, signal)
        const hashResult = await writer.execute('fixture-session', 'turn-1', () => true, hashProposal, signal)
        assert.equal(hashResult.state, 'written-verified')
        assert.equal(await admin.hGet('fixture:coordinator-hash', 'field'), 'new')
        assert.equal(writer.status('other-session', hashProposal.id), null)

        // Change both value and TTL after the preflight PTTL reply; WATCH must
        // reject instead of constructing a mixed-time proposal.
        let checks = 0, changed = false
        const currentTurn = () => {
          if (++checks === 7) {
            const script = `import { createClient } from 'redis';
              const c = createClient({ socket: { host: process.env.FIXTURE_HOST, port: Number(process.env.FIXTURE_PORT), reconnectStrategy: false }, password: process.env.FIXTURE_PASSWORD });
              c.on('error', () => {}); await c.connect(); await c.set('fixture:preflight-race', 'new', { PX: 120000 }); await c.quit();`
            const result = spawnSync(process.execPath, ['--input-type=module', '-e', script], {
              cwd: process.cwd(), env: { ...process.env, FIXTURE_HOST: settings.host, FIXTURE_PORT: String(settings.port), FIXTURE_PASSWORD: settings.password },
              encoding: 'utf8', timeout: 10000, windowsHide: true,
            })
            assert.equal(result.status, 0, 'Independent preflight mutation failed')
            changed = true
          }
          return true
        }
        await assert.rejects(writer.prepare('fixture-session', target, 'turn-1', currentTurn, { type: 'string', keyBase64: Buffer.from('fixture:preflight-race').toString('base64'), fieldBase64: null, afterBase64: Buffer.from('next').toString('base64') }, signal), /并发变化/)
        assert.equal(changed, true)
        assert.equal(await admin.get('fixture:preflight-race'), 'new')
        assert.ok(await admin.pTTL('fixture:preflight-race') > 0)
      } finally { writer.dispose() }
    } finally { connections.dispose() }
  } finally { transport.close() }
})
assert.equal(fixture.stopped, true)
console.log(JSON.stringify({ passed: true, redisVersion: fixture.redisVersion, fixtureStopped: fixture.stopped, fixtureRemoved: fixture.fixtureRemoved ?? null, realDshIntegration: false }))
