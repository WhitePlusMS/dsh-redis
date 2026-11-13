/** Exercise real ACL denials through the registered tools on an owned fixture. */
import { executeTool, installNativeTools } from './native-tool-fixture.mjs'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { Context } from '@deepseek-ai/cordis'
import { RESP_TYPES } from 'redis'
import { RedisConnections } from '../lib/host/connection-service.js'
import { RedisAiReader } from '../lib/host/ai-reader.js'
import { registerRedisTools } from '../lib/host/ai-tools.js'
import { withRedisFixture } from './redis-fixture.mjs'

const signal = new AbortController().signal
const { fixture } = await withRedisFixture(async ({ settings, admin }) => {
  const stringKey = 'fixture:acl:string', hashKey = 'fixture:acl:hash'
  const username = 'fixture-' + randomUUID(), password = randomUUID()
  await admin.sendCommand(['SET', stringKey, 'synthetic-allowed'])
  await admin.sendCommand(['HSET', hashKey, 'status', 'synthetic-denied'])
  await admin.sendCommand(['PEXPIRE', stringKey, '120000'])
  await admin.sendCommand(['ACL', 'SETUSER', username, 'reset', 'on', '>' + password, '~fixture:acl:*', '+@read', '+ping', '-hget', '-scan'])
  const names = [stringKey, hashKey], buffers = admin.withTypeMapping({ [RESP_TYPES.BLOB_STRING]: Buffer })
  const before = await Promise.all(names.map(key => buffers.sendCommand(['DUMP', key])))
  const expiry = await Promise.all(names.map(key => admin.sendCommand(['PEXPIRETIME', key])))
  const connections = new RedisConnections()
  const reader = new RedisAiReader(connections, () => undefined, async () => { throw new Error('Explicit reads must not depend on sidebar selection') }, () => false)
  const ctx = new Context()
  // The fixture explicitly permits this fixed scope so Redis ACL remains the tested boundary.
  ctx.provide('approval', { request: async () => 'allowed-once' })
  try {
    assert.equal((await connections.connect('fixture-session', { ...settings, username, password }, signal)).state, 'connected')
    await installNativeTools(ctx)
    await ctx.plugin({ name: 'redis-permission-fixture', inject: ['tools'], apply: scope => registerRedisTools(scope, reader) })
    const agent = { id: 'fixture-agent', ctx, session: { id: 'fixture-session' } }
    let index = 0
    const call = async (name, arguments_) => {
      const result = await executeTool(ctx.tools, { callId: 'fixture-' + ++index, name, arguments: arguments_, agent, signal })
      assert.equal(result.isError, false)
      const text = result.content.filter(block => block.type === 'text').map(block => block.text).join('')
      assert(!text.includes(password)); assert(!text.includes('NOPERM')); assert(!text.includes('synthetic-denied'))
      return JSON.parse(text)
    }
    const allowed = await call('redis_viewer_value', { key: stringKey })
    assert.equal(allowed.value.state, 'value'); assert.equal(allowed.value.text, 'synthetic-allowed')
    const deniedValue = await call('redis_viewer_value', { key: hashKey, field: 'status' })
    assert.equal(deniedValue.value.state, 'failed'); assert.equal(deniedValue.value.error, 'permission')
    const deniedSearch = await call('redis_viewer_keys', { match: 'fixture:acl:*' })
    assert.equal(deniedSearch.state, 'failed'); assert.equal(deniedSearch.error, 'permission')
    const condition = { field: 'status', equals: 'synthetic-query' }
    const deniedFilter = await call('redis_viewer_filter_hash', { match: 'fixture:acl:*', ...condition })
    assert.equal(deniedFilter.state, 'failed'); assert.equal(deniedFilter.error, 'permission')
    assert.deepEqual(deniedFilter.condition, condition); assert.equal(deniedFilter.counts.checked, 0)
    assert.deepEqual(await Promise.all(names.map(key => buffers.sendCommand(['DUMP', key]))), before)
    assert.deepEqual(await Promise.all(names.map(key => admin.sendCommand(['PEXPIRETIME', key]))), expiry)
  } finally { await ctx.fiber.dispose(); reader.dispose(); connections.dispose() }
}, { passwordRequired: false })
assert(fixture.stopped)
console.log(JSON.stringify({ passed: true, redisVersion: fixture.redisVersion, backend: fixture.backend ?? 'docker', fixtureStopped: fixture.stopped, checks: ['authorized String read', 'denied HGET and SCAN reported as permission errors', 'no raw denial or password in results', 'unchanged fixture data and expiry'] }))
