/** Verify tool-driven DB changes and session isolation on an owned Redis. */
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
  const key = 'fixture:db:shared', username = 'fixture-' + randomUUID(), password = randomUUID()
  await admin.sendCommand(['SET', key, 'synthetic-db-zero'])
  await admin.sendCommand(['PEXPIRE', key, '120000'])
  const buffers = admin.withTypeMapping({ [RESP_TYPES.BLOB_STRING]: Buffer })
  const zero = await buffers.sendCommand(['DUMP', key]), expiry = await admin.sendCommand(['PEXPIRETIME', key])
  await admin.select(1); await admin.sendCommand(['SET', key, 'synthetic-db-one'])
  const one = await buffers.sendCommand(['DUMP', key]); await admin.select(0)
  await admin.sendCommand(['ACL', 'SETUSER', username, 'reset', 'on', '>' + password, '~fixture:db:*', '+@read', '+ping', '-select'])
  const connections = new RedisConnections()
  const reader = new RedisAiReader(connections, () => undefined, async () => { throw new Error('Explicit reads must not depend on sidebar selection') }, () => false)
  const ctx = new Context()
  try {
    for (const session of ['a', 'b']) assert.equal((await connections.connect(session, settings, signal)).state, 'connected')
    assert.equal((await connections.connect('restricted', { ...settings, username, password }, signal)).state, 'connected')
    await installNativeTools(ctx)
    await ctx.plugin({ name: 'redis-database-fixture', inject: ['tools'], apply: scope => registerRedisTools(scope, reader) })
    let index = 0
    const call = async (session, name, arguments_) => {
      const agent = { id: 'fixture-agent-' + session, ctx, session: { id: session } }
      const result = await executeTool(ctx.tools, { callId: 'fixture-' + ++index, name, arguments: arguments_, agent, signal })
      assert.equal(result.isError, false)
      const text = result.content.filter(block => block.type === 'text').map(block => block.text).join('')
      assert(!text.includes(password)); assert(!text.includes('NOPERM'))
      return JSON.parse(text)
    }
    const value = async session => (await call(session, 'redis_viewer_value', { key })).value.text
    assert.equal(await value('a'), 'synthetic-db-zero'); assert.equal(await value('b'), 'synthetic-db-zero')
    const switched = await call('a', 'redis_viewer_select_db', { db: 1 })
    assert.equal(switched.requestedDb, 1); assert.equal(switched.connection.db, 1); assert.equal(switched.connection.error, null)
    assert.equal(await value('a'), 'synthetic-db-one'); assert.equal(await value('b'), 'synthetic-db-zero')
    const invalid = await call('a', 'redis_viewer_select_db', { db: 65535 })
    assert.equal(invalid.requestedDb, 65535); assert.equal(invalid.connection.db, 1); assert.equal(invalid.connection.error, 'database')
    assert.equal(await value('a'), 'synthetic-db-one')
    const denied = await call('restricted', 'redis_viewer_select_db', { db: 1 })
    assert.equal(denied.requestedDb, 1); assert.equal(denied.connection.db, 0); assert.equal(denied.connection.error, 'permission')
    assert.equal(await value('restricted'), 'synthetic-db-zero')
    assert.deepEqual(await buffers.sendCommand(['DUMP', key]), zero); assert.equal(await admin.sendCommand(['PEXPIRETIME', key]), expiry)
    await admin.select(1); assert.deepEqual(await buffers.sendCommand(['DUMP', key]), one)
  } finally { await ctx.fiber.dispose(); reader.dispose(); connections.dispose() }
}, { passwordRequired: false })
assert(fixture.stopped)
console.log(JSON.stringify({ passed: true, redisVersion: fixture.redisVersion, backend: fixture.backend ?? 'docker', fixtureStopped: fixture.stopped, checks: ['tool-driven DB switch', 'session isolation', 'invalid DB and denied SELECT keep original DB', 'unchanged fixture data and expiry'] }))
