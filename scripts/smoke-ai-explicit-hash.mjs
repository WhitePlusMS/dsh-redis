/** Real Redis and DSH ToolRuntime check; fixture setup owns every write. */
import { executeTool, installNativeTools } from './native-tool-fixture.mjs'
import assert from 'node:assert/strict'
import { Context } from '@deepseek-ai/cordis'
import { RESP_TYPES } from 'redis'
import { RedisConnections } from '../lib/host/connection-service.js'
import { RedisAiReader } from '../lib/host/ai-reader.js'
import { registerRedisTools } from '../lib/host/ai-tools.js'
import { withRedisFixture } from './redis-fixture.mjs'

const signal = new AbortController().signal
const { fixture } = await withRedisFixture(async ({ settings, admin }) => {
  const key = 'fixture:order:1001', binaryField = Buffer.from([0, 255])
  const replacementKey = 'fixture:\ufffd', binaryKey = Buffer.from([0, 255])
  await admin.hSet(key, 'status', 'synthetic-failed')
  await admin.hSet(key, binaryField, 'synthetic-binary-field')
  await admin.set(replacementKey, 'synthetic-replacement-key')
  await admin.sendCommand(['SET', binaryKey, 'synthetic-binary-key'])
  await admin.pExpire(key, 120000)
  const buffers = admin.withTypeMapping({ [RESP_TYPES.BLOB_STRING]: Buffer })
  const before = await buffers.sendCommand(['DUMP', key])
  const expiry = await admin.sendCommand(['PEXPIRETIME', key])
  const connections = new RedisConnections()
  const reader = new RedisAiReader(connections, () => undefined, async () => { throw new Error('Unexpected UI dependency') }, () => false)
  const ctx = new Context()
  try {
    const view = await connections.connect('fixture-session', settings, signal)
    assert.equal(view.state, 'connected')
    await installNativeTools(ctx)
    await ctx.plugin({ name: 'redis-explicit-hash-fixture', inject: ['tools'], apply: scope => registerRedisTools(scope, reader) })
    const agent = { id: 'fixture-agent', ctx, session: { id: 'fixture-session' } }
    const read = async arguments_ => {
      const result = await executeTool(ctx.tools, { callId: 'fixture-call', name: 'redis_viewer_value', arguments: arguments_, agent, signal })
      assert.equal(result.isError, false)
      return JSON.parse(result.content.filter(block => block.type === 'text').map(block => block.text).join(''))
    }
    const typeCount = async () => Number(/^cmdstat_type:calls=(\d+)/mu.exec(await admin.info('commandstats'))?.[1] ?? 0)
    const beforeInvalid = await typeCount()
    for (const arguments_ of [{ key: 'fixture:\ud800' }, { key, match: '\ud800' }]) {
      const invalid = await executeTool(ctx.tools, { callId: 'invalid-text', name: 'redis_viewer_value', arguments: arguments_, agent, signal })
      assert.equal(invalid.isError, true)
    }
    assert.equal(await typeCount(), beforeInvalid)
    assert.equal((await read({ key: replacementKey })).value.text, 'synthetic-replacement-key')
    assert.equal((await read({ keyBase64: binaryKey.toString('base64') })).value.text, 'synthetic-binary-key')
    const found = await read({ key, field: 'status' })
    assert.equal(found.source, 'explicit')
    assert.equal(found.value.state, 'value')
    assert.equal(found.value.cell.text, 'synthetic-failed')
    assert.equal(found.value.cell.complete, true)
    assert(BigInt(found.value.metadata.ttlMs) > 0n)
    assert.equal((await read({ key, fieldBase64: binaryField.toString('base64') })).value.cell.text, 'synthetic-binary-field')
    assert.equal((await read({ key, field: 'missing' })).value.state, 'selection-missing')
    assert.equal((await read({ key: 'fixture:missing', field: 'status' })).value.state, 'missing')
    assert.deepEqual(await buffers.sendCommand(['DUMP', key]), before)
    assert.equal(await admin.sendCommand(['PEXPIRETIME', key]), expiry)
  } finally {
    await ctx.fiber.dispose()
    reader.dispose()
    connections.dispose()
  }
}, { passwordRequired: false })
assert(fixture.stopped)
console.log(JSON.stringify({ passed: true, redisVersion: fixture.redisVersion, backend: fixture.backend ?? 'docker', fixtureStopped: fixture.stopped, checks: ['lossless Key and MATCH text', 'binary Key and field', 'explicit Hash field without UI', 'missing field and Key', 'TTL', 'unchanged serialized data and expiry'] }))
