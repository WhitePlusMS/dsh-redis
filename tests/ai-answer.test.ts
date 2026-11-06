import { afterEach, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import type { Agent } from '@deepseek-ai/dsh-agent'
import SessionStore from '@deepseek-ai/dsh-session'
import { SessionId } from '@deepseek-ai/dsh-session/types'
import { createToolResultMessage, ToolCallId } from '@deepseek-ai/dsh-llm'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime, { defineTool } from '@deepseek-ai/dsh-tools'
import type { ApprovalService } from '@deepseek-ai/dsh-user-approval'
import { RedisConnections, type RedisLink } from '../src/host/connection-service.ts'
import { RedisAiReader } from '../src/host/ai-reader.ts'
import { registerRedisTools } from '../src/host/ai-tools.ts'
import { registerRedisAnswerTool } from '../src/host/ai-answer.ts'
import { describeRedisResult, parseRedisAnswer, summarizeRedisFilters } from '../src/redis-answer.ts'

const cleanup: Array<() => Promise<void>> = []
afterEach(async () => { for (const close of cleanup.splice(0).reverse()) await close(); vi.restoreAllMocks() })

/** Actual readers, tool runtime and committed session events; only Redis transport
 * and approval UI are synthetic. Ordinary reads must not end the workflow.
 */
async function fixture(approval: 'allowed-once' | 'rejected' = 'allowed-once') {
  vi.spyOn(console, 'info').mockImplementation(() => undefined)
  const commands: string[] = []
  const link: RedisLink = {
    close: () => undefined, onFailure: () => () => undefined,
    async execute(command, args, signal, guard) {
      signal.throwIfAborted(); guard(); commands.push(command)
      if (command === 'SCAN') return [Buffer.from(args[0] === '0' ? '7' : '0'), [Buffer.from('order:1')]]
      if (command === 'TYPE') return args[0]?.toString() === 'missing' ? 'none' : 'hash'
      if (command === 'PTTL') return -1n
      if (command === 'HLEN') return 1n
      if (command === 'HGET') return Buffer.from('failed')
      if (command === 'SELECT') return 'OK'
      throw new Error('Unexpected command ' + command)
    },
  }
  const connections = new RedisConnections(async () => link)
  const reader = new RedisAiReader(connections, () => undefined, async () => 0, () => false)
  const settings = { host: '127.0.0.1', port: 6379, username: '', password: 'not-in-answer', tls: null }
  await connections.connect('answer-a', settings, new AbortController().signal)
  const ctx = new Context()
  ctx.provide('approval', { request: async () => approval } as unknown as ApprovalService)
  await ctx.plugin(SystemPrompt); await ctx.plugin(ToolRuntime); await ctx.plugin(SessionStore)
  const fiber = await ctx.plugin({ name: 'redis-answer-test', inject: ['tools'], apply(scope: Context) { registerRedisTools(scope, reader); registerRedisAnswerTool(scope, reader) } })
  const session = ctx.sessions.create(SessionId('answer-a'))
  const agent = { id: 'agent-a', ctx, session } as unknown as Agent
  let turn = 1, step = 0
  session.append('turn/start', { turn })
  const call = async (name: string, args: unknown, signal = new AbortController().signal) => {
    const callId = ToolCallId('answer-call-' + ++step)
    session.append('tool/call', { turn, step, callId, name, arguments: JSON.stringify(args) })
    const result = await ctx.tools.execute({ callId, name, arguments: args, agent, signal })
    session.append('tool/result', { turn, step, message: createToolResultMessage({ callId, content: result.content, isError: result.isError }) }, { surfaceOp: 'append' })
    return { ...result, callId }
  }
  const nextTurn = () => { session.append('turn/end', { turn, reason: { kind: 'completed' } }); session.append('turn/start', { turn: ++turn }) }
  cleanup.push(async () => { await ctx.fiber.dispose(); reader.dispose(); connections.dispose() })
  return { ctx, session, reader, connections, settings, fiber, call, nextTurn, commands }
}
function content(result: { readonly content: readonly { readonly type: string; readonly text?: string }[] }): string { return result.content.map(block => block.text ?? '').join('') }

it('keeps the turn open for explanation after status → search → read → grounded evidence without another Redis command', async () => {
  const f = await fixture()
  const status = await f.call('redis_viewer_status', {})
  const keys = await f.call('redis_viewer_keys', { match: 'order:*' })
  const read = await f.call('redis_viewer_value', { key: 'order:1', field: 'status' })
  for (const result of [status, keys, read]) { expect(result.isError).toBe(false); expect(result).not.toHaveProperty('concludesTurn') }
  const before = [...f.commands]
  const answer = await f.call('redis_viewer_answer', {})
  expect(answer.isError).toBe(false)
  expect(answer).not.toHaveProperty('concludesTurn')
  expect(f.commands).toEqual(before)
  const sections = parseRedisAnswer(content(answer))
  expect(sections).toHaveLength(2)
  expect(sections?.[0]?.paragraphs.join('')).toContain('扫描尚未结束')
  expect(sections?.[1]?.paragraphs.join('')).toContain('采样时没有设置过期时间')
  expect(sections?.[1]?.values.some(value => value.text.includes('failed'))).toBe(true)
  expect(content(answer)).not.toContain('not-in-answer')
})

it('keeps failed answers open and rejects model-supplied data and historical or foreign observations', async () => {
  const f = await fixture(), read = await f.call('redis_viewer_key_metadata', { key: 'order:1' })
  for (const args of [{ callIds: ['invented'] }, { callIds: [read.callId, read.callId] }, { callIds: [] }, { text: 'fabricated' }]) {
    const result = await f.call('redis_viewer_answer', args)
    expect(result.isError).toBe(true); expect(result).not.toHaveProperty('concludesTurn')
  }
  f.nextTurn()
  expect((await f.call('redis_viewer_answer', {})).isError).toBe(true)
  const other = f.ctx.sessions.create(SessionId('answer-b'))
  other.append('turn/start', { turn: 1 })
  const result = await f.ctx.tools.execute({ callId: ToolCallId('foreign'), name: 'redis_viewer_answer', arguments: {}, agent: { id: 'b', ctx: f.ctx, session: other } as unknown as Agent, signal: new AbortController().signal })
  expect(result.isError).toBe(true); expect(result).not.toHaveProperty('concludesTurn')
})

it('rejects reads from the previous DB or connection and respects cancellation', async () => {
  const f = await fixture()
  await f.call('redis_viewer_key_metadata', { key: 'order:1' })
  await f.reader.selectDatabase('answer-a', 1, new AbortController().signal)
  expect((await f.call('redis_viewer_answer', {})).isError).toBe(true)
  await f.call('redis_viewer_key_metadata', { key: 'order:1' })
  await f.connections.connect('answer-a', f.settings, new AbortController().signal)
  expect((await f.call('redis_viewer_answer', {})).isError).toBe(true)
  const controller = new AbortController(); controller.abort()
  const cancelled = await f.call('redis_viewer_answer', {}, controller.signal)
  expect(cancelled.isError).toBe(true); expect(cancelled).not.toHaveProperty('concludesTurn')
})

it('reports a missing key without inventing its history or reading values', async () => {
  const f = await fixture()
  await f.call('redis_viewer_key_metadata', { key: 'missing' })
  const answer = await f.call('redis_viewer_answer', {})
  expect(answer.isError).toBe(false)
  expect(answer).not.toHaveProperty('concludesTurn')
  expect(content(answer)).toContain('不能判断缺失原因')
  expect(f.commands).toEqual(['TYPE'])
})

it('can answer a disconnected status without reconnecting or sending Redis commands', async () => {
  const f = await fixture()
  f.connections.disposeSession('answer-a')
  await f.call('redis_viewer_status', {})
  const answer = await f.call('redis_viewer_answer', {})
  expect(answer.isError).toBe(false)
  expect(answer).not.toHaveProperty('concludesTurn')
  expect(content(answer)).toContain('disconnected'); expect(f.commands).toEqual([])
})

it('keeps rejection visible after an earlier successful status instead of returning only that status', async () => {
  const f = await fixture('rejected')
  await f.call('redis_viewer_status', {})
  const denied = await f.call('redis_viewer_keys', { match: 'order:*' })
  expect(denied.isError).toBe(true)
  const answer = await f.call('redis_viewer_answer', {})
  expect(answer.isError).toBe(false)
  expect(content(answer)).toContain('拒绝')
  expect(parseRedisAnswer(content(answer))?.[0]?.tool).toBe('redis_viewer_keys')
  expect(f.commands).toEqual([])
})

it('announces omitted early records after the bounded ledger fills', async () => {
  const f = await fixture()
  for (let i = 0; i < 33; i++) await f.call('redis_viewer_status', {})
  const answer = await f.call('redis_viewer_answer', {})
  expect(answer.isError).toBe(false)
  expect(content(answer)).toContain('不是完整查询汇总')
  expect(JSON.parse(content(answer)).omittedCalls).toBe(1)
  expect(content(answer)).toContain('读取')
})

it('retains each professional result target and full binary GEO member identity', () => {
  for (const tool of ['redis_viewer_json_path', 'redis_viewer_timeseries', 'redis_viewer_bitmap', 'redis_viewer_stream_groups', 'redis_viewer_geo']) {
    const result = describeRedisResult(tool, { connection: { db: 0 }, key: { label: '"fixture:target"' }, member: { label: '0xff', base64: '/w==' }, other: { label: '"second"' }, state: 'value' })
    expect(result.paragraphs.join('')).toContain('fixture:target')
    if (tool === 'redis_viewer_geo') { expect(result.paragraphs.join('')).toContain('/w=='); expect(result.paragraphs.join('')).toContain('second') }
  }
})

it('preserves exact JSON, binary values, large integers and partial-result caveats', () => {
  const common = { connection: { db: 0 }, state: 'value' }
  const json = describeRedisResult('redis_viewer_json_path', { ...common, matchesJson: '[9007199254740993,null]' })
  expect(json.values[0]?.text).toBe('[9007199254740993,null]')
  const binary = describeRedisResult('redis_viewer_value', { ...common, value: { state: 'value', text: null, base64: '/w==', complete: false } })
  expect(binary.values[0]?.text).toBe('"/w=="'); expect(binary.paragraphs.join('')).toContain('部分数据')
  const memory = describeRedisResult('redis_viewer_memory', { ...common, bytes: '9007199254740993', requestedSamples: 5, actualSamples: null })
  expect(memory.paragraphs.join('')).toContain('9007199254740993 字节'); expect(memory.paragraphs.join('')).toContain('实际采样数和误差未知')
  for (const raw of ['null', '{}', '[]', '{"state":"answered","readOnly":true,"answers":[{}]}']) expect(parseRedisAnswer(raw)).toBeNull()
})

it('distinguishes Stream range pagination from SCAN and omits inapplicable member scores', () => {
  const stream = describeRedisResult('redis_viewer_value', { connection: { db: 0 }, value: { type: 'stream', state: 'page', scanComplete: true, complete: false, messages: [] } })
  expect(stream.paragraphs.join('')).toContain('指定消息范围的分页读取已结束')
  expect(stream.paragraphs.join('')).not.toContain('SCAN')
  const ranks = describeRedisResult('redis_viewer_value', { connection: { db: 0 }, value: { metadata: { type: 'zset' }, mode: 'range', state: 'page', scanComplete: false, complete: true, nextOffset: null } })
  expect(ranks.paragraphs.join('')).toContain('排名读取已到达末尾')
  expect(ranks.paragraphs.join('')).not.toContain('扫描尚未结束')
  const member = describeRedisResult('redis_viewer_value', { connection: { db: 0 }, member: { label: '"member"' }, value: { state: 'value', metadata: { type: 'set' }, score: null } })
  expect(member.paragraphs.join('')).toContain('采样时存在')
  expect(member.values.some(value => value.label === '分数')).toBe(false)
})

it('sums linked filter pages, deduplicates names, and separates restarted or incomplete iterations', () => {
  const page = (cursor: string | null, matched = 1) => ({ state: 'page', pattern: 'order:*', condition: { field: 'status', equals: 'failed' }, cursor, scanComplete: cursor === null, counts: { checked: 2, matched, different: 0, missingField: 1, missingKey: 0, notHash: 0, typeChanged: 0, failed: 0 }, matches: [{ base64: 'b25l', label: '"one"' }] })
  const result = summarizeRedisFilters([
    { callId: 'first', inputCursor: null, result: page('next') },
    { callId: 'last', inputCursor: 'next', result: page(null) },
    { callId: 'restart', inputCursor: null, result: page(null) },
    { callId: 'orphan', inputCursor: 'old-turn', result: page(null) },
  ])
  expect(result.has('first')).toBe(false)
  expect(result.get('last')?.paragraphs.join('')).toContain('本次迭代汇总：2 批，累计检查 4 次，匹配 2 次，匹配 Key 去重后 1 个')
  expect(result.get('restart')?.paragraphs.join('')).toContain('本次迭代汇总：1 批')
  expect(result.get('orphan')?.paragraphs.join('')).toContain('本轮已记录的连续批次汇总')
  expect(result.get('orphan')?.paragraphs.join('')).not.toContain('本次迭代汇总')
})

it('adds the filter total from committed tool calls without rereading Redis', async () => {
  const f = await fixture(), args = { match: 'order:*', field: 'status', equals: 'failed' }
  const first = await f.call('redis_viewer_filter_hash', args)
  expect(first.isError).toBe(false)
  const cursor = (JSON.parse(content(first)) as { cursor: string }).cursor
  expect((await f.call('redis_viewer_filter_hash', { ...args, cursor })).isError).toBe(false)
  const before = [...f.commands], answer = await f.call('redis_viewer_answer', {})
  expect(answer.isError).toBe(false)
  expect(content(answer)).toContain('本次迭代汇总：2 批，累计检查 2 次，匹配 2 次，匹配 Key 去重后 1 个')
  expect(f.commands).toEqual(before)
})

it('answers UI-only turns from their exact receipt without inventing value samples or extra reads', async () => {
  const f = await fixture()
  f.ctx.tools.register(defineTool({ name: 'redis_viewer_show', description: 'Synthetic UI receipt', parameters: {}, output: { schema: { type: 'json' }, render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }] }, execute: async () => ({ outcome: 'applied', message: '当前对话的 Redis 面板已确认可见。' }) }))
  await f.call('redis_viewer_show', {})
  const answer = await f.call('redis_viewer_answer', {})
  expect(answer.isError).toBe(false)
  expect(answer).not.toHaveProperty('concludesTurn')
  expect(content(answer)).toContain('不证明没有发生名称扫描')
  expect(content(answer)).toContain('界面回执')
  expect(content(answer)).not.toContain('采样时间')
  expect(f.commands).toEqual([])
  f.nextTurn(); f.connections.disposeSession('answer-a')
  await f.call('redis_viewer_show', {})
  const disconnected = await f.call('redis_viewer_answer', {})
  expect(disconnected.isError).toBe(false)
  expect(content(disconnected)).toContain('操作发起时尚未连接 Redis')
  expect(content(disconnected)).not.toContain('undefined')
  const failure = describeRedisResult('redis_viewer_refresh', { kind: 'ui-receipt', connection: { db: 0, target: { host: '127.0.0.1', port: 6379 } }, receipt: { outcome: 'timeout', message: '未能确认刷新结果；读取可能已经发出。' } })
  expect(failure.paragraphs.join('')).toContain('读取可能已经发出')
  expect(failure.values[0]?.text).toContain('timeout')
})

it('does not describe failed or missing results as partial data or unfinished scans', () => {
  for (const state of ['failed', 'query-failed', 'missing', 'unsupported', 'changed', 'unavailable']) {
    const result = describeRedisResult('redis_viewer_timeseries', { state, connection: { db: 0 }, complete: false, scanComplete: false, coverage: '仅包含 TS.RANGE 返回的样本', samples: [], errorMessage: '未取得结果' })
    expect(result.paragraphs.join('')).not.toMatch(/仅返回部分数据|扫描尚未结束|仅包含 TS.RANGE/)
    expect(result.paragraphs.join('')).toContain('未取得结果')
  }
})
