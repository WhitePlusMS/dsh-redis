/** Verify fixed server overview fields against an owned real Redis. */
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
  await admin.sendCommand(['SET', 'fixture:key', 'synthetic-value'])
  const buffers = admin.withTypeMapping({ [RESP_TYPES.BLOB_STRING]: Buffer })
  const before = await buffers.sendCommand(['DUMP', 'fixture:key'])
  const connections = new RedisConnections()
  const reader = new RedisAiReader(connections, () => undefined, async () => { throw new Error('Unexpected UI dependency') }, () => false)
  const ctx = new Context()
  try {
    assert.equal((await connections.connect('fixture-session', settings, signal)).state, 'connected')
    await ctx.plugin(SystemPrompt); await ctx.plugin(ToolRuntime)
    await ctx.plugin({ name: 'redis-overview-fixture', inject: ['tools'], apply: scope => registerRedisTools(scope, reader) })
    const agent = { id: 'fixture-agent', ctx, session: { id: 'fixture-session' } }
    for (const [section, field] of [['server', 'redis_version'], ['memory', 'used_memory'], ['clients', 'connected_clients'], ['stats', 'total_commands_processed']]) {
      const result = await ctx.tools.execute({ callId: 'fixture-call', name: 'redis_viewer_overview', arguments: { section }, agent, signal })
      assert.equal(result.isError, false)
      const text = result.content.filter(block => block.type === 'text').map(block => block.text).join('')
      const value = JSON.parse(text)
      assert.equal(value.scope, 'server'); assert.equal(value.section, section); assert.notEqual(value.state, 'failed')
      assert.equal(typeof value.fields[field], 'string'); assert(!text.includes('synthetic-value'))
    }
    assert.deepEqual(await buffers.sendCommand(['DUMP', 'fixture:key']), before)
  } finally {
    await ctx.fiber.dispose(); reader.dispose(); connections.dispose()
  }
}, { passwordRequired: false })
assert(fixture.stopped)
console.log(JSON.stringify({ passed: true, redisVersion: fixture.redisVersion, backend: fixture.backend ?? 'docker', fixtureStopped: fixture.stopped, checks: ['four fixed INFO sections', 'only allowed metrics', 'unchanged fixture Key'] }))
