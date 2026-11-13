/** Run `node scripts/build.mjs` first. Fixture setup writes synthetic data; the preview tool does not write. */
import { executeTool, installNativeTools } from './native-tool-fixture.mjs'
import assert from 'node:assert/strict'
import { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { RESP_TYPES } from 'redis'
import { RedisConnections } from '../lib/host/connection-service.js'
import { RedisAiReader } from '../lib/host/ai-reader.js'
import { withRedisFixture } from './redis-fixture.mjs'

const signal = new AbortController().signal
const { fixture } = await withRedisFixture(async ({ settings, admin }) => {
  const stringKey = 'fixture:preview:string', hashKey = 'fixture:preview:hash'
  const ttlKey = 'fixture:preview:ttl', longKey = 'fixture:preview:long'
  await admin.set(stringKey, '旧值')
  await admin.hSet(hashKey, '状态', '等待')
  await admin.set(ttlKey, 'temporary', { PX: 120000 })
  await admin.set(longKey, 'x'.repeat(4097))
  const buffers = admin.withTypeMapping({ [RESP_TYPES.BLOB_STRING]: Buffer })
  const keys = [stringKey, hashKey, ttlKey, longKey]
  const before = await Promise.all(keys.map(key => buffers.sendCommand(['DUMP', key])))
  const expiresAt = await Promise.all(keys.map(key => admin.sendCommand(['PEXPIRETIME', key])))
  const keyCount = await admin.dbSize()
  assert.equal(await admin.exists('fixture:missing'), 0)
  const connections = new RedisConnections()
  const reader = new RedisAiReader(connections, () => undefined, async () => { throw new Error('Unexpected UI dependency') }, () => false)
  const ctx = new Context()
  try {
    const view = await connections.connect('preview-session', settings, signal)
    assert.equal(view.state, 'connected')
    await installNativeTools(ctx)
    await ctx.plugin({ name: 'redis-preview-experiment', inject: ['tools'], apply(scope) {
      scope.tools.register(defineTool({
        name: 'redis_preview_experiment',
        description: '仅用于隔离测试的只读预览实验，不执行写入，不形成授权。',
        parameters: { key: { type: 'string', required: true }, field: { type: 'string' }, value: { type: 'string', required: true } },
        output: { schema: { type: 'json' }, render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }] },
        async execute(args, exec) {
          if (exec.agent === undefined) throw new Error('缺少会话身份')
          if (Object.keys(args).some(key => !['key', 'field', 'value'].includes(key))) throw new Error('不支持的参数')
          const next = Buffer.from(args.value, 'utf8')
          if (next.toString('utf8') !== args.value || next.length > 4096) throw new Error('新值编码无效或过长')
          const sessionId = exec.agent.session.id
          return reader.withBudget(sessionId, exec.signal, async stage => {
            const sample = await reader.read(sessionId, { key: args.key, ...(args.field === undefined ? {} : { field: args.field }) }, exec.signal, stage)
            const value = sample?.value
            const cell = args.field === undefined ? value : value?.cell
            const expected = args.field === undefined ? 'string' : 'hash'
            if (value?.state !== 'value' || value?.metadata?.type !== expected || value.metadata.ttlMs !== '-1' || cell?.complete !== true || typeof cell.base64 !== 'string') {
              throw new Error('目标不存在、类型不匹配、有 Key TTL 或值不完整')
            }
            const connection = sample.connection
            if (connection?.state !== 'connected' || connection.target === null) throw new Error('连接不可用')
            return {
              readOnly: true, executable: false, type: expected,
              connection: { id: connection.id, generation: connection.generation, db: connection.db, host: connection.target.host, port: connection.target.port }, target: sample.key,
              field: args.field === undefined ? null : sample.field,
              beforeBase64: cell.base64, afterBase64: next.toString('base64'),
              keyTtl: 'none-at-sampling', fieldTtl: args.field === undefined ? null : 'not-checked',
              note: '非原子预览；没有批准、字段 TTL 验证或写入能力。',
            }
          })
        },
      }))
    } })
    const agent = { id: 'preview-agent', ctx, session: { id: 'preview-session' } }
    const call = (args, agentValue = agent) => executeTool(ctx.tools, { name: 'redis_preview_experiment', arguments: args, ...(agentValue === null ? {} : { agent: agentValue }), callId: 'preview-call', signal })
    const valueOf = result => JSON.parse(result.content.filter(block => block.type === 'text').map(block => block.text).join(''))
    const string = await call({ key: stringKey, value: '新值' })
    assert.equal(string.isError, false)
    assert.deepEqual(valueOf(string), expectPreview('旧值', '新值', null, view))
    const hash = await call({ key: hashKey, field: '状态', value: '完成' })
    assert.equal(hash.isError, false)
    const hashValue = valueOf(hash)
    assert.equal(hashValue.beforeBase64, Buffer.from('等待').toString('base64'))
    assert.equal(hashValue.afterBase64, Buffer.from('完成').toString('base64'))
    assert.equal(hashValue.fieldTtl, 'not-checked')
    assert.equal(hashValue.executable, false)
    assert.equal(hashValue.type, 'hash')
    assert.deepEqual(hashValue.connection, { id: view.id, generation: view.generation, db: view.db, host: settings.host, port: settings.port })
    for (const args of [{ key: ttlKey, value: 'x' }, { key: longKey, value: 'x' }, { key: 'fixture:missing', value: 'x' }, { key: stringKey, value: 'x', confirmed: true }, { key: stringKey, value: '\ud800' }]) {
      assert.equal((await call(args)).isError, true)
    }
    assert.equal((await call({ key: stringKey, value: 'x' }, null)).isError, true)
    assert.deepEqual(await Promise.all(keys.map(key => buffers.sendCommand(['DUMP', key]))), before)
    assert.deepEqual(await Promise.all(keys.map(key => admin.sendCommand(['PEXPIRETIME', key]))), expiresAt)
    assert.equal(await admin.dbSize(), keyCount)
    assert.equal(await admin.exists('fixture:missing'), 0)
  } finally {
    await ctx.fiber.dispose()
    reader.dispose()
    connections.dispose()
  }
})
assert.equal(fixture.stopped, true)
console.log(JSON.stringify({ passed: true, kind: 'native-tool-preview-experiment', redisVersion: fixture.redisVersion, fixtureStopped: fixture.stopped, fixtureRemoved: fixture.fixtureRemoved ?? null, previewToolWritesPossible: false, fieldTtlVerified: false }))

function expectPreview(before, after, field, view) {
  const raw = Buffer.from('fixture:preview:string')
  return {
    readOnly: true, executable: false, type: 'string',
    connection: { id: view.id, generation: view.generation, db: view.db, host: view.target.host, port: view.target.port },
    target: { base64: raw.toString('base64'), byteLength: raw.length, label: JSON.stringify(raw.toString('utf8')) },
    field, beforeBase64: Buffer.from(before).toString('base64'), afterBase64: Buffer.from(after).toString('base64'),
    keyTtl: 'none-at-sampling', fieldTtl: null,
    note: '非原子预览；没有批准、字段 TTL 验证或写入能力。',
  }
}
