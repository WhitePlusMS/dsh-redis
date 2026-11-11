/** Run the built Host transport against the owned, password-protected Redis fixture. */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { RedisTransport } from '../lib/host/redis-transport.js'
import { withRedisFixture } from './redis-fixture.mjs'

const signal = new AbortController().signal
const { fixture } = await withRedisFixture(async ({ settings, admin }) => {
  await admin.set('fixture:string', 'old')
  await admin.hSet('fixture:hash', { field: 'old', other: 'keep' })
  await admin.set('fixture:ttl', 'old', { PX: 120000 })
  await admin.hSet('fixture:fieldttl', 'field', 'old')
  await admin.hSet('fixture:race', { field: 'old', other: 'before' })
  assert.deepEqual(await admin.sendCommand(['HPEXPIRE', 'fixture:fieldttl', '120000', 'FIELDS', '1', 'field']), [1])
  const transport = await RedisTransport.open(settings, signal)
  let submitted = 0
  const execute = request => transport.replaceExisting(request, signal, () => undefined, () => { submitted++ })
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
    assert.equal(await transport.replaceExisting(field('fixture:race'), signal, concurrent, () => { submitted++ }), 'conflict')
    assert.equal(raced, true)
    assert.equal(await admin.hGet('fixture:race', 'field'), 'old')
    assert.equal(await admin.hGet('fixture:race', 'other'), 'changed')
    assert.equal(await transport.execute('TYPE', [Buffer.from('fixture:race')], signal, () => undefined), 'hash')
    assert.equal(submitted, 3)
  } finally { transport.close() }
})
assert.equal(fixture.stopped, true)
console.log(JSON.stringify({ passed: true, redisVersion: fixture.redisVersion, fixtureStopped: fixture.stopped, fixtureRemoved: fixture.fixtureRemoved ?? null, realDshIntegration: false }))
