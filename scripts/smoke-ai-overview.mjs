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
  await admin.sendCommand(['SET', 'fixture:same', 'synthetic-value'])
  await admin.sendCommand(['SET', 'fixture:large', 'x'.repeat(5000)])
  const binaryKey = Buffer.from([0, 255, 1])
  await admin.sendCommand(['SET', binaryKey, 'synthetic-value'])
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
    const clients = await ctx.tools.execute({ callId: 'clients-call', name: 'redis_viewer_clients', arguments: {}, agent, signal })
    assert.equal(clients.isError, false)
    const clientText = clients.content.filter(block => block.type === 'text').map(block => block.text).join('')
    const sample = JSON.parse(clientText)
    assert.equal(sample.state, 'value'); assert.equal(sample.scope, 'server'); assert(sample.totalCount >= 2)
    assert(sample.clients.every(client => Object.keys(client).sort().join(',') === 'ageSeconds,db,flags,id,idleSeconds'))
    assert(!JSON.stringify(sample.clients).includes('127.0.0.1')); assert(!clientText.includes('synthetic-value'))
    for (const [left, right, expected] of [['fixture:key', 'fixture:same', 'equal'], ['fixture:key', 'fixture:large', 'different'], ['fixture:large', 'fixture:large', 'undetermined']]) {
      const comparison = await ctx.tools.execute({ callId: `compare-${expected}`, name: 'redis_viewer_compare_strings', arguments: { left, right }, agent, signal })
      assert.equal(comparison.isError, false)
      const text = comparison.content.filter(block => block.type === 'text').map(block => block.text).join('')
      assert.equal(JSON.parse(text).comparison, expected); assert(!text.includes('synthetic-value'))
    }
    const binaryComparison = await ctx.tools.execute({ callId: 'compare-binary', name: 'redis_viewer_compare_strings', arguments: { leftBase64: binaryKey.toString('base64'), right: 'fixture:key' }, agent, signal })
    assert.equal(binaryComparison.isError, false)
    assert.equal(JSON.parse(binaryComparison.content.find(block => block.type === 'text').text).comparison, 'equal')
    assert.deepEqual(await buffers.sendCommand(['DUMP', 'fixture:key']), before)
  } finally {
    await ctx.fiber.dispose(); reader.dispose(); connections.dispose()
  }
}, { passwordRequired: false })
assert(fixture.stopped)
console.log(JSON.stringify({ passed: true, redisVersion: fixture.redisVersion, backend: fixture.backend ?? 'docker', fixtureStopped: fixture.stopped, checks: ['four fixed INFO sections', 'bounded client metadata', 'bounded String comparison', 'only allowed fields', 'unchanged fixture Key'] }))
