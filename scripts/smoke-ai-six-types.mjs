/** Verify named-Key tool reads against an exclusively owned Redis fixture. */
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
  const keys = Object.fromEntries(['string', 'hash', 'list', 'set', 'zset', 'stream'].map(type => [type, `fixture:six:${type}`]))
  await admin.sendCommand(['SET', keys.string, 'synthetic-string'])
  await admin.sendCommand(['HSET', keys.hash, 'status', 'synthetic-ready'])
  await admin.sendCommand(['RPUSH', keys.list, 'synthetic-first', 'synthetic-second'])
  await admin.sendCommand(['SADD', keys.set, 'synthetic-member'])
  await admin.sendCommand(['ZADD', keys.zset, '3.75', 'synthetic-member'])
  await admin.sendCommand(['XADD', keys.stream, '1-0', 'field', 'synthetic-one', 'field', 'synthetic-two'])
  await admin.sendCommand(['PEXPIRE', keys.string, '120000'])
  const buffers = admin.withTypeMapping({ [RESP_TYPES.BLOB_STRING]: Buffer }), names = Object.values(keys)
  const before = await Promise.all(names.map(key => buffers.sendCommand(['DUMP', key])))
  const expiry = await Promise.all(names.map(key => admin.sendCommand(['PEXPIRETIME', key])))
  const writeStats = async () => {
    const info = await admin.info('commandstats')
    return Object.fromEntries(['set', 'hset', 'rpush', 'sadd', 'zadd', 'xadd', 'del', 'pexpire'].map(name => [name, Number(new RegExp('^cmdstat_' + name + ':calls=(\\d+)', 'mu').exec(info)?.[1] ?? 0)]))
  }
  const writesBefore = await writeStats(), connections = new RedisConnections()
  const reader = new RedisAiReader(connections, () => undefined, async () => { throw new Error('Explicit reads must not depend on sidebar selection') }, () => false)
  const ctx = new Context()
  try {
    assert.equal((await connections.connect('fixture-session', settings, signal)).state, 'connected')
    await ctx.plugin(SystemPrompt); await ctx.plugin(ToolRuntime)
    await ctx.plugin({ name: 'redis-six-types-fixture', inject: ['tools'], apply: scope => registerRedisTools(scope, reader) })
    const agent = { id: 'fixture-agent', ctx, session: { id: 'fixture-session' } }
    let index = 0
    const commandCount = async name => Number(new RegExp('^cmdstat_' + name + ':calls=(\\d+)', 'mu').exec(await admin.info('commandstats'))?.[1] ?? 0)
    const valueCommands = ['getrange', 'hget', 'hscan'], beforeMetadata = await Promise.all(valueCommands.map(commandCount))
    for (const [key, type] of [[keys.string, 'string'], [keys.hash, 'hash']]) {
      const reply = await ctx.tools.execute({ callId: 'metadata-' + type, name: 'redis_viewer_key_metadata', arguments: { key }, agent, signal })
      assert.equal(reply.isError, false)
      const text = reply.content.filter(block => block.type === 'text').map(block => block.text).join(''), metadata = JSON.parse(text)
      assert.equal(metadata.state, 'value'); assert.equal(metadata.type, type); assert(!text.includes('synthetic-string')); assert(!text.includes('synthetic-ready'))
      if (type === 'hash') assert.equal(metadata.ttlMs, '-1')
      else assert(BigInt(metadata.ttlMs) > 0n)
    }
    assert.deepEqual(await Promise.all(valueCommands.map(commandCount)), beforeMetadata)
    const readsBefore = await commandCount('getrange')
    const invalid = await ctx.tools.execute({ callId: 'invalid-range', name: 'redis_viewer_value', arguments: { key: keys.string, match: '*' }, agent, signal })
    assert.equal(invalid.isError, true); assert.equal(await commandCount('getrange'), readsBefore)
    const read = async arguments_ => {
      const result = await ctx.tools.execute({ callId: 'fixture-' + ++index, name: 'redis_viewer_value', arguments: arguments_, agent, signal })
      assert.equal(result.isError, false)
      const value = JSON.parse(result.content.filter(block => block.type === 'text').map(block => block.text).join(''))
      assert.equal(value.readOnly, true); assert.equal(value.source, 'explicit')
      return value.value
    }
    const string = await read({ key: keys.string })
    assert.equal(string.state, 'value'); assert.equal(string.text, 'synthetic-string'); assert.equal(string.complete, true)
    const partial = await read({ key: keys.string, bytes: 4 })
    assert.equal(partial.complete, false); assert.equal(partial.nextOffset, '4')
    const hash = await read({ key: keys.hash })
    assert.equal(hash.state, 'page'); assert.equal(hash.metadata.type, 'hash')
    assert(hash.entries.some(entry => Buffer.from(entry.field.base64, 'base64').toString() === 'status' && entry.value.text === 'synthetic-ready'))
    const list = await read({ key: keys.list })
    assert.equal(list.state, 'page'); assert.deepEqual(list.entries.map(entry => entry.value.text), ['synthetic-first', 'synthetic-second'])
    const set = await read({ key: keys.set })
    assert.equal(set.state, 'page'); assert.deepEqual(set.members.map(member => Buffer.from(member.base64, 'base64').toString()), ['synthetic-member'])
    const zset = await read({ key: keys.zset })
    assert.equal(zset.state, 'page'); assert.equal(zset.entries[0].score, '3.75')
    assert.equal(Buffer.from(zset.entries[0].member.base64, 'base64').toString(), 'synthetic-member')
    const stream = await read({ key: keys.stream })
    assert.equal(stream.state, 'page'); assert.equal(stream.messages[0].id, '1-0')
    assert.deepEqual(stream.messages[0].fields.map(field => [field.index, Buffer.from(field.field.base64, 'base64').toString(), field.value.text]), [[0, 'field', 'synthetic-one'], [1, 'field', 'synthetic-two']])
    assert.equal((await read({ key: 'fixture:six:missing' })).state, 'missing')
    assert.deepEqual(await Promise.all(names.map(key => buffers.sendCommand(['DUMP', key]))), before)
    assert.deepEqual(await Promise.all(names.map(key => admin.sendCommand(['PEXPIRETIME', key]))), expiry)
    assert.deepEqual(await writeStats(), writesBefore)
  } finally { await ctx.fiber.dispose(); reader.dispose(); connections.dispose() }
}, { passwordRequired: false })
assert(fixture.stopped)
console.log(JSON.stringify({ passed: true, redisVersion: fixture.redisVersion, backend: fixture.backend ?? 'docker', fixtureStopped: fixture.stopped, checks: ['metadata without value reads', 'six explicit Key types without sidebar', 'incompatible String scope rejected before GETRANGE', 'truncation and missing Key', 'duplicate Stream fields', 'unchanged fixture data and expiry'] }))
