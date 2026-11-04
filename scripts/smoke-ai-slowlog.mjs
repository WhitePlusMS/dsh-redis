/** Exercise actual Redis slow-log replies without exposing arguments or clearing the log. */
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
  // Configuration and the synthetic write are confined to the owned Redis fixture.
  await admin.sendCommand(['CONFIG', 'SET', 'slowlog-log-slower-than', '0'])
  await admin.sendCommand(['SET', 'fixture:private-key', 'synthetic-secret'])
  await admin.sendCommand(['CONFIG', 'SET', 'slowlog-log-slower-than', '-1'])
  const buffers = admin.withTypeMapping({ [RESP_TYPES.BLOB_STRING]: Buffer })
  const before = await buffers.sendCommand(['DUMP', 'fixture:private-key'])
  const logBefore = await buffers.sendCommand(['SLOWLOG', 'GET', '10'])
  const connections = new RedisConnections()
  const reader = new RedisAiReader(connections, () => undefined, async () => { throw new Error('Unexpected UI dependency') }, () => false)
  const ctx = new Context()
  try {
    assert.equal((await connections.connect('fixture-session', settings, signal)).state, 'connected')
    await ctx.plugin(SystemPrompt); await ctx.plugin(ToolRuntime)
    await ctx.plugin({ name: 'redis-slowlog-fixture', inject: ['tools'], apply: scope => registerRedisTools(scope, reader) })
    const agent = { id: 'fixture-agent', ctx, session: { id: 'fixture-session' } }
    const result = await ctx.tools.execute({ callId: 'fixture-call', name: 'redis_viewer_slowlog', arguments: { count: 10 }, agent, signal })
    assert.equal(result.isError, false)
    const text = result.content.filter(block => block.type === 'text').map(block => block.text).join('')
    const value = JSON.parse(text)
    assert.equal(value.state, 'value'); assert.equal(value.scope, 'server')
    assert(value.entries.some(entry => entry.command === 'SET'))
    assert(!text.includes('fixture:private-key')); assert(!text.includes('synthetic-secret'))
    assert.deepEqual(await buffers.sendCommand(['SLOWLOG', 'GET', '10']), logBefore)
    assert.deepEqual(await buffers.sendCommand(['DUMP', 'fixture:private-key']), before)
  } finally {
    await ctx.fiber.dispose(); reader.dispose(); connections.dispose()
  }
}, { passwordRequired: false })
assert(fixture.stopped)
console.log(JSON.stringify({ passed: true, redisVersion: fixture.redisVersion, backend: fixture.backend ?? 'docker', fixtureStopped: fixture.stopped, checks: ['bounded metadata', 'arguments withheld', 'slow log and Key unchanged'] }))
