/** Exercise MVP Redis transaction assumptions only on the owned test fixture. */
import assert from 'node:assert/strict'
import { createClient } from 'redis'
import { withRedisFixture } from './redis-fixture.mjs'

const result = await withRedisFixture(async ({ admin, settings, metadata }) => {
  const worker = createClient({
    socket: { host: settings.host, port: settings.port, reconnectStrategy: false },
    password: settings.password,
  })
  worker.on('error', () => undefined)
  await worker.connect()
  try {
    await admin.set('mvp:string', 'before')
    await worker.sendCommand(['WATCH', 'mvp:string'])
    assert.equal(await worker.get('mvp:string'), 'before')
    await worker.sendCommand(['MULTI'])
    await worker.sendCommand(['SET', 'mvp:string', 'after'])
    assert.deepEqual(await worker.sendCommand(['EXEC']), ['OK'])
    assert.equal(await admin.get('mvp:string'), 'after')
    assert.equal(await admin.pTTL('mvp:string'), -1)

    await admin.hSet('mvp:hash', { field: 'old', other: 'a' })
    assert.deepEqual(await worker.sendCommand(['HPTTL', 'mvp:hash', 'FIELDS', '1', 'field']), [-1])
    await worker.sendCommand(['WATCH', 'mvp:hash'])
    assert.equal(await worker.hGet('mvp:hash', 'field'), 'old')
    await admin.hSet('mvp:hash', 'other', 'b')
    await worker.sendCommand(['MULTI'])
    await worker.sendCommand(['HSET', 'mvp:hash', 'field', 'new'])
    assert.equal(await worker.sendCommand(['EXEC']), null)
    assert.equal(await admin.hGet('mvp:hash', 'field'), 'old')

    await worker.sendCommand(['WATCH', 'mvp:hash'])
    await worker.sendCommand(['MULTI'])
    await worker.sendCommand(['HSET', 'mvp:hash', 'field', 'new'])
    assert.deepEqual(await worker.sendCommand(['EXEC']), [0])
    assert.equal(await admin.hGet('mvp:hash', 'field'), 'new')

    // A change before WATCH is outside its observation window.
    const confirmedField = await worker.hGet('mvp:hash', 'field')
    await admin.hSet('mvp:hash', 'other', 'changed-before-watch')
    await worker.sendCommand(['WATCH', 'mvp:hash'])
    assert.equal(await worker.hGet('mvp:hash', 'field'), confirmedField)
    await worker.sendCommand(['MULTI'])
    await worker.sendCommand(['HSET', 'mvp:hash', 'field', 'last'])
    assert.deepEqual(await worker.sendCommand(['EXEC']), [0])

    // Overwriting a Hash field can erase its own expiry, so MVP rejects it.
    assert.deepEqual(await admin.sendCommand(['HPEXPIRE', 'mvp:hash', '60000', 'FIELDS', '1', 'field']), [1])
    assert.ok((await admin.sendCommand(['HPTTL', 'mvp:hash', 'FIELDS', '1', 'field']))[0] > 0)
    await admin.hSet('mvp:hash', 'field', 'expiry-cleared')
    assert.deepEqual(await admin.sendCommand(['HPTTL', 'mvp:hash', 'FIELDS', '1', 'field']), [-1])
    return { redisVersion: metadata.redisVersion, stringWriteVerified: true, hashOtherFieldConflict: true, preWatchOtherFieldInvisible: true, hashOverwriteReturn: 0, fieldTtlClearedByHset: true }
  } finally {
    if (worker.isOpen) worker.destroy()
  }
})

assert.equal(result.fixture.stopped, true)
console.log(JSON.stringify({ ...result.value, fixtureStopped: result.fixture.stopped, fixtureRemoved: result.fixture.fixtureRemoved ?? null }))
