/** Verify consumer-group observations on an isolated Redis fixture only. */
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
  const key = Buffer.from([0, 255, 1]), group = 'fixture-group'
  // The message and consumption state are created solely in the owned fixture.
  await admin.sendCommand(['XADD', key, '1-0', 'field', 'synthetic-value'])
  await admin.sendCommand(['XADD', key, '2-0', 'field', 'synthetic-value'])
  await admin.sendCommand(['XGROUP', 'CREATE', key, group, '0-0'])
  await admin.sendCommand(['XREADGROUP', 'GROUP', group, 'fixture-consumer', 'COUNT', '1', 'STREAMS', key, '>'])
  const buffers = admin.withTypeMapping({ [RESP_TYPES.BLOB_STRING]: Buffer })
  const before = await buffers.sendCommand(['DUMP', key])
  const groupBefore = await buffers.sendCommand(['XINFO', 'GROUPS', key])
  const connections = new RedisConnections()
  const reader = new RedisAiReader(connections, () => undefined, async () => { throw new Error('Unexpected UI dependency') }, () => false)
  const ctx = new Context()
  try {
    assert.equal((await connections.connect('fixture-session', settings, signal)).state, 'connected')
    await ctx.plugin(SystemPrompt); await ctx.plugin(ToolRuntime)
    await ctx.plugin({ name: 'redis-groups-fixture', inject: ['tools'], apply: scope => registerRedisTools(scope, reader) })
    const agent = { id: 'fixture-agent', ctx, session: { id: 'fixture-session' } }
    const result = await ctx.tools.execute({ callId: 'fixture-call', name: 'redis_viewer_stream_groups', arguments: { keyBase64: key.toString('base64') }, agent, signal })
    assert.equal(result.isError, false)
    const text = result.content.filter(block => block.type === 'text').map(block => block.text).join('')
    const value = JSON.parse(text)
    assert.equal(value.state, 'value'); assert.equal(value.complete, true); assert.equal(value.totalCount, 1)
    assert.equal(value.groups[0].pending, '1'); assert.equal(value.groups[0].lag, '1'); assert.equal(value.groups[0].lagStatus, 'available')
    assert.equal(value.groups[0].name.base64, Buffer.from(group).toString('base64')); assert(!text.includes('synthetic-value'))
    assert.deepEqual(await buffers.sendCommand(['XINFO', 'GROUPS', key]), groupBefore)
    assert.deepEqual(await buffers.sendCommand(['DUMP', key]), before)
  } finally {
    await ctx.fiber.dispose(); reader.dispose(); connections.dispose()
  }
}, { passwordRequired: false })
assert(fixture.stopped)
console.log(JSON.stringify({ passed: true, redisVersion: fixture.redisVersion, backend: fixture.backend ?? 'docker', fixtureStopped: fixture.stopped, checks: ['binary Stream Key', 'pending and lag', 'no message content', 'group state and Key unchanged'] }))
