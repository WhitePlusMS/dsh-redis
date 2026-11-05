/** Real Redis MEMORY USAGE via the DSH ToolRuntime, on an owned fixture. */
import assert from 'node:assert/strict'
import { Context } from '@deepseek-ai/cordis'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime from '@deepseek-ai/dsh-tools'
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
    await ctx.plugin(SystemPrompt); await ctx.plugin(ToolRuntime)
    await ctx.plugin({ name: 'redis-memory-fixture', inject: ['tools'], apply: scope => registerRedisTools(scope, reader) })
    const agent = { id: 'fixture-agent', ctx, session: { id: 'fixture-session' } }
    const read = async arguments_ => {
      const result = await ctx.tools.execute({ callId: 'fixture-call', name: 'redis_viewer_memory', arguments: arguments_, agent, signal })
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
console.log(JSON.stringify({ passed: true, redisVersion: fixture.redisVersion, backend: fixture.backend ?? 'docker', fixtureStopped: fixture.stopped, checks: ['binary Key and fixed sampling', 'missing Key', 'unchanged serialized data and expiry'] }))
