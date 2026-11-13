/** Real Redis membership checks; only the independently owned fixture is seeded. */
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
  const setKey = 'fixture:members', zsetKey = 'fixture:scores', binary = Buffer.from([0, 255])
  await admin.sendCommand(['SADD', setKey, binary])
  await admin.sendCommand(['ZADD', zsetKey, '3.75', binary])
  const buffers = admin.withTypeMapping({ [RESP_TYPES.BLOB_STRING]: Buffer })
  const before = await Promise.all([buffers.sendCommand(['DUMP', setKey]), buffers.sendCommand(['DUMP', zsetKey])])
  const stats = async () => {
    const info = await admin.info('commandstats')
    return Object.fromEntries(['sadd', 'srem', 'zadd', 'zrem', 'sscan', 'zscan'].map(name => [name, Number(new RegExp('^cmdstat_' + name + ':calls=(\\d+)', 'mu').exec(info)?.[1] ?? 0)]))
  }
  const beforeStats = await stats(), connections = new RedisConnections()
  const reader = new RedisAiReader(connections, () => undefined, async () => { throw new Error('Unexpected UI dependency') }, () => false)
  const ctx = new Context()
  try {
    assert.equal((await connections.connect('fixture-session', settings, signal)).state, 'connected')
    await installNativeTools(ctx)
    await ctx.plugin({ name: 'redis-explicit-member-fixture', inject: ['tools'], apply: scope => registerRedisTools(scope, reader) })
    const agent = { id: 'fixture-agent', ctx, session: { id: 'fixture-session' } }
    const read = async arguments_ => {
      const result = await executeTool(ctx.tools, { callId: 'fixture-call', name: 'redis_viewer_value', arguments: arguments_, agent, signal })
      assert.equal(result.isError, false)
      return JSON.parse(result.content.filter(block => block.type === 'text').map(block => block.text).join(''))
    }
    const memberBase64 = binary.toString('base64')
    const set = await read({ key: setKey, memberBase64 })
    assert.equal(set.source, 'explicit'); assert.equal(set.value.state, 'value'); assert.equal(set.value.metadata.type, 'set')
    const sorted = await read({ key: zsetKey, memberBase64 })
    assert.equal(sorted.value.state, 'value'); assert.equal(sorted.value.metadata.type, 'zset'); assert.equal(sorted.value.score, '3.75')
    assert.equal((await read({ key: setKey, member: 'missing' })).value.state, 'selection-missing')
    assert.equal((await read({ key: 'fixture:missing', member: 'missing' })).value.state, 'missing')
    assert.deepEqual(await Promise.all([buffers.sendCommand(['DUMP', setKey]), buffers.sendCommand(['DUMP', zsetKey])]), before)
    assert.deepEqual(await stats(), beforeStats)
  } finally {
    await ctx.fiber.dispose(); reader.dispose(); connections.dispose()
  }
}, { passwordRequired: false })
assert(fixture.stopped)
console.log(JSON.stringify({ passed: true, redisVersion: fixture.redisVersion, backend: fixture.backend ?? 'docker', fixtureStopped: fixture.stopped, checks: ['exact binary Set membership', 'exact ZSet score', 'missing member and Key', 'no scan or Redis writes'] }))
