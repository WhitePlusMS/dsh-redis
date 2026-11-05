/** Compare registered AI JSON reads against a real isolated RedisJSON module. */
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
  const key = 'fixture:json', username = 'fixture-' + randomUUID(), password = randomUUID()
  // Fixture setup only; no writes are sent by the plugin under test.
  await admin.sendCommand(['JSON.SET', key, '$', '{"large":9007199254740993,"nil":null,"items":[1,2]}'])
  await admin.sendCommand(['SET', 'fixture:string', 'ordinary'])
  await admin.sendCommand(['PEXPIRE', key, '120000'])
  await admin.sendCommand(['ACL', 'SETUSER', username, 'reset', 'on', '>' + password, '~fixture:*', '+ping', '+type', '-json.get'])
  const buffers = admin.withTypeMapping({ [RESP_TYPES.BLOB_STRING]: Buffer })
  const before = await buffers.sendCommand(['DUMP', key]), expiry = await admin.sendCommand(['PEXPIRETIME', key])
  const connections = new RedisConnections(), reader = new RedisAiReader(connections, () => undefined, async () => 0, () => false), ctx = new Context()
  try {
    assert.equal((await connections.connect('fixture-session', settings, signal)).state, 'connected')
    assert.equal((await connections.connect('denied-session', { ...settings, username, password }, signal)).state, 'connected')
    await ctx.plugin(SystemPrompt); await ctx.plugin(ToolRuntime)
    await ctx.plugin({ name: 'redis-json-fixture', inject: ['tools'], apply: scope => registerRedisTools(scope, reader) })
    let index = 0
    const read = async (args, session = 'fixture-session') => {
      const agent = { id: 'fixture-agent', ctx, session: { id: session } }
      const reply = await ctx.tools.execute({ callId: 'fixture-' + ++index, name: 'redis_viewer_json_path', arguments: args, agent, signal })
      assert.equal(reply.isError, false)
      const text = reply.content.filter(block => block.type === 'text').map(block => block.text).join('')
      assert(!text.includes(password)); return JSON.parse(text)
    }
    for (const path of ['$.large', '$.nil', '$.missing', '$.items[*]']) {
      const actual = await read({ key, path }), expected = await admin.sendCommand(['JSON.GET', key, path])
      assert.equal(actual.state, 'value'); assert.equal(actual.matchesJson, expected)
      assert.equal(actual.matchCount, JSON.parse(expected).length)
    }
    assert.equal((await read({ key: 'fixture:missing', path: '$' })).state, 'missing')
    assert.equal((await read({ key: 'fixture:string', path: '$' })).state, 'unsupported')
    assert.equal((await read({ key, path: '$[' })).state, 'query-failed')
    assert.equal((await read({ key, path: '$' }, 'denied-session')).error, 'permission')
    assert.deepEqual(await buffers.sendCommand(['DUMP', key]), before)
    assert.equal(await admin.sendCommand(['PEXPIRETIME', key]), expiry)
  } finally { await ctx.fiber.dispose(); reader.dispose(); connections.dispose() }
}, { passwordRequired: false })
assert(fixture.stopped)
console.log(JSON.stringify({ passed: true, redisVersion: fixture.redisVersion, backend: fixture.backend ?? 'docker', fixtureStopped: fixture.stopped, checks: ['JSONPath raw values and large number', 'null and empty match', 'missing and wrong type', 'invalid path and ACL', 'unchanged fixture data and expiry'] }))
