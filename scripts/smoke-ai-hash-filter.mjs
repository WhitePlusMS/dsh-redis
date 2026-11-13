/** Verify bounded filtering against a real, independently owned Redis fixture. */
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
  const expected = new Set()
  for (let index = 0; index < 26; index++) {
    const key = 'fixture:order:' + index, status = index % 4 === 0 ? 'synthetic-failed' : 'synthetic-ready'
    await admin.hSet(key, { status, unrelated: 'synthetic-private-value' })
    if (status === 'synthetic-failed') expected.add(key)
  }
  await admin.hSet('fixture:order:missing-field', 'other', 'synthetic-other')
  await admin.set('fixture:order:wrong-type', 'synthetic-string')
  await admin.hSet('fixture:predicate', { '': '', '状态': '待处理\u0000\n' })
  const largeCondition = { field: '\u0000'.repeat(1024), equals: '\u0000'.repeat(4096) }
  const largeKeys = Array.from({ length: 3 }, (_, index) => 'fixture:budget:' + index + ':'.repeat(12000))
  for (const key of largeKeys) await admin.hSet(key, largeCondition.field, largeCondition.equals)
  const buffers = admin.withTypeMapping({ [RESP_TYPES.BLOB_STRING]: Buffer })
  const fixtureKeys = [...Array.from({ length: 26 }, (_, index) => 'fixture:order:' + index), 'fixture:order:missing-field', 'fixture:order:wrong-type', 'fixture:predicate', ...largeKeys]
  const before = await Promise.all(fixtureKeys.map(key => buffers.sendCommand(['DUMP', key])))
  const expiry = await Promise.all(fixtureKeys.map(key => admin.sendCommand(['PEXPIRETIME', key])))
  const stats = async () => {
    const info = await admin.info('commandstats')
    return Object.fromEntries(['hset', 'hdel', 'set', 'del'].map(name => [name, Number(new RegExp('^cmdstat_' + name + ':calls=(\\d+)', 'mu').exec(info)?.[1] ?? 0)]))
  }
  const beforeStats = await stats(), connections = new RedisConnections()
  const reader = new RedisAiReader(connections, () => undefined, async () => { throw new Error('Unexpected UI dependency') }, () => false)
  const ctx = new Context()
  let approved = false, prompts = 0
  // This controlled fixture decision verifies transport boundaries, not real UI approval.
  ctx.provide('approval', { request: async () => { prompts++; return approved ? 'allowed-once' : 'rejected' } })
  try {
    assert.equal((await connections.connect('fixture-session', settings, signal)).state, 'connected')
    await installNativeTools(ctx)
    await ctx.plugin({ name: 'redis-hash-filter-fixture', inject: ['tools'], apply: scope => registerRedisTools(scope, reader) })
    const agent = { id: 'fixture-agent', ctx, session: { id: 'fixture-session' } }
    const scanCount = async () => Number(/^cmdstat_scan:calls=(\d+)/mu.exec(await admin.info('commandstats'))?.[1] ?? 0)
    const scansBefore = await scanCount()
    const missingScope = await executeTool(ctx.tools, { callId: 'missing-scope', name: 'redis_viewer_keys', arguments: {}, agent, signal })
    assert.equal(missingScope.isError, true); assert.equal(await scanCount(), scansBefore)
    const rejected = await executeTool(ctx.tools, { callId: 'rejected-scope', name: 'redis_viewer_keys', arguments: { match: 'fixture:order:*' }, agent, signal })
    assert.equal(rejected.isError, true); assert.equal(await scanCount(), scansBefore)
    approved = true
    const names = new Set(); let namesCursor, nameCalls = 0
    do {
      const result = await executeTool(ctx.tools, { callId: 'names-' + nameCalls, name: 'redis_viewer_keys', arguments: { match: 'fixture:order:*', ...(namesCursor === undefined ? {} : { cursor: namesCursor }) }, agent, signal })
      assert.equal(result.isError, false)
      const text = result.content.filter(block => block.type === 'text').map(block => block.text).join(''), page = JSON.parse(text)
      assert.equal(page.pattern, 'fixture:order:*'); assert(!text.includes('synthetic-private-value'))
      for (const key of page.keys) names.add(Buffer.from(key.base64, 'base64').toString('utf8'))
      namesCursor = page.cursor ?? undefined
      assert(++nameCalls < 20)
    } while (namesCursor !== undefined)
    assert.equal(names.size, 28); assert(await scanCount() > scansBefore)
    const found = new Set(); let cursor, calls = 0, checked = 0, missingField = 0, notHash = 0, typeChanged = 0
    do {
      const result = await executeTool(ctx.tools, { callId: 'fixture-' + calls, name: 'redis_viewer_filter_hash', arguments: { match: 'fixture:order:*', field: 'status', equals: 'synthetic-failed', ...(cursor === undefined ? {} : { cursor }) }, agent, signal })
      assert.equal(result.isError, false)
      const text = result.content.filter(block => block.type === 'text').map(block => block.text).join('')
      assert(!text.includes('synthetic-private-value')); assert(!text.includes('synthetic-ready'))
      const page = JSON.parse(text)
      assert.deepEqual(page.condition, { field: 'status', equals: 'synthetic-failed' })
      assert.equal(page.state, 'page'); assert(page.counts.checked <= 10)
      checked += page.counts.checked; missingField += page.counts.missingField; notHash += page.counts.notHash; typeChanged += page.counts.typeChanged
      for (const key of page.matches) found.add(Buffer.from(key.base64, 'base64').toString('utf8'))
      cursor = page.cursor ?? undefined
      assert(++calls < 20)
    } while (cursor !== undefined)
    assert.deepEqual([...found].sort(), [...expected].sort())
    assert(checked >= 28); assert(missingField >= 1); assert(notHash >= 1); assert.equal(typeChanged, 0)
    // Full predicates must survive UTF-8 and JSON escaping, not display-label truncation.
    for (const condition of [{ field: '', equals: '' }, { field: '状态', equals: '待处理\u0000\n' }]) {
      const result = await executeTool(ctx.tools, { callId: 'predicate-' + condition.field, name: 'redis_viewer_filter_hash', arguments: { match: 'fixture:predicate', ...condition }, agent, signal })
      assert.equal(result.isError, false)
      const page = JSON.parse(result.content.filter(block => block.type === 'text').map(block => block.text).join(''))
      assert.deepEqual(page.condition, condition)
      assert.equal(page.counts.matched, 1); assert.equal(page.scanComplete, true)
    }
    // Escaped conditions consume the same 64 KiB output budget as Key identities.
    const largeFound = new Set(); let largeCursor, largeCalls = 0
    do {
      const result = await executeTool(ctx.tools, { callId: 'large-predicate-' + largeCalls, name: 'redis_viewer_filter_hash', arguments: { match: 'fixture:budget:*', ...largeCondition, ...(largeCursor === undefined ? {} : { cursor: largeCursor }) }, agent, signal })
      assert.equal(result.isError, false)
      const text = result.content.filter(block => block.type === 'text').map(block => block.text).join(''), page = JSON.parse(text)
      assert(Buffer.byteLength(text) <= 65536); assert.deepEqual(page.condition, largeCondition)
      assert.equal(page.state, 'page'); assert.equal(page.counts.failed, 0)
      for (const key of page.matches) largeFound.add(Buffer.from(key.base64, 'base64').toString('utf8'))
      largeCursor = page.cursor ?? undefined
      assert(++largeCalls < 20)
    } while (largeCursor !== undefined)
    assert(largeCalls > 1); assert.deepEqual([...largeFound].sort(), [...largeKeys].sort())
    assert.deepEqual(await Promise.all(fixtureKeys.map(key => buffers.sendCommand(['DUMP', key]))), before)
    assert.deepEqual(await Promise.all(fixtureKeys.map(key => admin.sendCommand(['PEXPIRETIME', key]))), expiry)
    assert.equal(await admin.dbSize(), fixtureKeys.length)
    assert.deepEqual(await stats(), beforeStats)
    assert.equal(prompts, 6) // Rejected/accepted search and four filters; no per-page prompts.
  } finally { await ctx.fiber.dispose(); reader.dispose(); connections.dispose() }
}, { passwordRequired: false })
assert(fixture.stopped)
console.log(JSON.stringify({ passed: true, redisVersion: fixture.redisVersion, backend: fixture.backend ?? 'docker', fixtureStopped: fixture.stopped, checks: ['explicit MATCH required', 'bounded Key search and filter', 'matches and missing fields', 'wrong types', 'no unrelated values or writes'] }))
