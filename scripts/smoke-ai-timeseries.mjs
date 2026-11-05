/** Compare registered bounded reads with a real isolated RedisTimeSeries module. */
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
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
  const key = 'fixture:timeseries', username = 'fixture-' + randomUUID(), password = randomUUID()
  // Only this owned fixture receives setup writes.
  await admin.sendCommand(['TS.CREATE', key])
  for (const [timestamp, value] of [['1000', '1.25'], ['2000', '-3.5'], ['3000', '9']]) await admin.sendCommand(['TS.ADD', key, timestamp, value])
  await admin.sendCommand(['SET', 'fixture:string', 'ordinary'])
  await admin.sendCommand(['PEXPIRE', key, '120000'])
  await admin.sendCommand(['ACL', 'SETUSER', username, 'reset', 'on', '>' + password, '~fixture:*', '+ping', '+type', '-ts.range'])
  const buffers = admin.withTypeMapping({ [RESP_TYPES.BLOB_STRING]: Buffer })
  const before = await buffers.sendCommand(['DUMP', key]), expiry = await admin.sendCommand(['PEXPIRETIME', key])
  const connections = new RedisConnections(), reader = new RedisAiReader(connections, () => undefined, async () => 0, () => false), ctx = new Context()
  try {
    assert.equal((await connections.connect('fixture-session', settings, signal)).state, 'connected')
    assert.equal((await connections.connect('denied-session', { ...settings, username, password }, signal)).state, 'connected')
    await ctx.plugin(SystemPrompt); await ctx.plugin(ToolRuntime)
    await ctx.plugin({ name: 'redis-timeseries-fixture', inject: ['tools'], apply: scope => registerRedisTools(scope, reader) })
    let index = 0
    const read = async (args, session = 'fixture-session') => {
      const agent = { id: 'fixture-agent', ctx, session: { id: session } }
      const reply = await ctx.tools.execute({ callId: 'fixture-' + ++index, name: 'redis_viewer_timeseries', arguments: args, agent, signal })
      assert.equal(reply.isError, false)
      const text = reply.content.filter(block => block.type === 'text').map(block => block.text).join('')
      assert(!text.includes(password)); return JSON.parse(text)
    }
    const first = await read({ key, from: '0', to: '3000', count: 2 })
    assert.equal(first.state, 'value'); assert.equal(first.complete, false); assert.equal(first.nextFrom, '2001')
    const second = await read({ key, from: first.nextFrom, to: '3000', count: 2 })
    assert.equal(second.complete, true); assert.equal(second.nextFrom, null)
    const expected = await admin.sendCommand(['TS.RANGE', key, '0', '3000', 'COUNT', '3'])
    assert.deepEqual([...first.samples, ...second.samples].map(sample => [Number(sample.timestampMs), Number(sample.value)]), expected)
    assert.deepEqual((await read({ key, from: '3001', to: '4000' })).samples, [])
    assert.equal((await read({ key: 'fixture:missing', from: '0', to: '1' })).state, 'missing')
    assert.equal((await read({ key: 'fixture:string', from: '0', to: '1' })).state, 'unsupported')
    assert.equal((await read({ key, from: '0', to: '1' }, 'denied-session')).error, 'permission')
    assert.deepEqual(await buffers.sendCommand(['DUMP', key]), before)
    assert.equal(await admin.sendCommand(['PEXPIRETIME', key]), expiry)
  } finally { await ctx.fiber.dispose(); reader.dispose(); connections.dispose() }
}, { passwordRequired: false })
assert(fixture.stopped)
console.log(JSON.stringify({ passed: true, redisVersion: fixture.redisVersion, backend: fixture.backend ?? 'docker', fixtureStopped: fixture.stopped, checks: ['bounded pages match raw samples', 'empty range, missing and wrong type', 'ACL denial', 'unchanged fixture data and expiry'] }))
