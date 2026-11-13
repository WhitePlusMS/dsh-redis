/** Real Redis MEMORY USAGE via the DSH ToolRuntime, on an owned fixture. */
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
  const key = Buffer.from([0, 255, 1])
  await admin.sendCommand(['SET', key, 'synthetic-only'])
  await admin.sendCommand(['PEXPIRE', key, '120000'])
  const buffers = admin.withTypeMapping({ [RESP_TYPES.BLOB_STRING]: Buffer })
  const before = await buffers.sendCommand(['DUMP', key])
  const expiry = await admin.sendCommand(['PEXPIRETIME', key])
  const expected = await admin.sendCommand(['MEMORY', 'USAGE', key, 'SAMPLES', '5'])
  const connections = new RedisConnections()
  const reader = new RedisAiReader(connections, () => undefined, async () => { throw new Error('Unexpected UI dependency') }, () => false)
  const ctx = new Context()
  try {
    assert.equal((await connections.connect('fixture-session', settings, signal)).state, 'connected')
    await installNativeTools(ctx)
    await ctx.plugin({ name: 'redis-memory-fixture', inject: ['tools'], apply: scope => registerRedisTools(scope, reader) })
    const agent = { id: 'fixture-agent', ctx, session: { id: 'fixture-session' } }
    const read = async arguments_ => {
      const result = await executeTool(ctx.tools, { callId: 'fixture-call', name: 'redis_viewer_memory', arguments: arguments_, agent, signal })
      assert.equal(result.isError, false)
      return JSON.parse(result.content.filter(block => block.type === 'text').map(block => block.text).join(''))
    }
    const result = await read({ keyBase64: key.toString('base64') })
    assert.equal(result.state, 'value'); assert.equal(result.bytes, String(expected)); assert.equal(result.requestedSamples, 5); assert.equal(result.actualSamples, null)
    assert.equal((await read({ key: 'fixture:missing' })).state, 'missing')
    assert.deepEqual(await buffers.sendCommand(['DUMP', key]), before)
    assert.equal(await admin.sendCommand(['PEXPIRETIME', key]), expiry)
  } finally {
    await ctx.fiber.dispose(); reader.dispose(); connections.dispose()
  }
}, { passwordRequired: false })
assert(fixture.stopped)
// The disabled-command case is isolated from the normal Redis fixture.
const { fixture: unavailableFixture } = await withRedisFixture(async ({ settings, admin }) => {
  await admin.set('author', 'synthetic-only')
  const before = await admin.get('author'), connections = new RedisConnections()
  const reader = new RedisAiReader(connections, () => undefined, async () => { throw new Error('Unexpected UI dependency') }, () => false)
  const ctx = new Context()
  try {
    assert.equal((await connections.connect('fixture-session', settings, signal)).state, 'connected')
    await installNativeTools(ctx)
    await ctx.plugin({ name: 'redis-memory-unavailable-fixture', inject: ['tools'], apply: scope => registerRedisTools(scope, reader) })
    const agent = { id: 'fixture-agent', ctx, session: { id: 'fixture-session' } }
    const result = await executeTool(ctx.tools, { callId: 'memory-unavailable', name: 'redis_viewer_memory', arguments: { key: 'author' }, agent, signal })
    assert.equal(result.isError, false)
    const page = JSON.parse(result.content.filter(block => block.type === 'text').map(block => block.text).join(''))
    assert.equal(page.state, 'unavailable'); assert.equal(page.error, null); assert.equal(page.connection.state, 'connected')
    assert.equal(await admin.get('author'), before)
  } finally { await ctx.fiber.dispose(); reader.dispose(); connections.dispose() }
}, { passwordRequired: false, disableMemory: true })
assert(unavailableFixture.stopped)
console.log(JSON.stringify({ passed: true, redisVersion: fixture.redisVersion, backend: fixture.backend ?? 'docker', fixtureStopped: fixture.stopped, checks: ['binary Key and fixed sampling', 'missing Key', 'disabled MEMORY', 'unchanged serialized data and expiry'] }))
