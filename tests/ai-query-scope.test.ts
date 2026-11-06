import { afterEach, describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import type { Agent } from '@deepseek-ai/dsh-agent'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime, { type ToolExecutionInput } from '@deepseek-ai/dsh-tools'
import type { ApprovalOutcome, ApprovalRequest, ApprovalService } from '@deepseek-ai/dsh-user-approval'
import { RedisConnections, type RedisLink } from '../src/host/connection-service.ts'
import { RedisAiReader } from '../src/host/ai-reader.ts'
import { registerRedisTools } from '../src/host/ai-tools.ts'

const cleanups: Array<() => Promise<void>> = []
afterEach(async () => { for (const cleanup of cleanups.splice(0).reverse()) await cleanup(); vi.restoreAllMocks() })

/** Real tool pipeline and readers, with synthetic transport and a controlled answerer. */
async function fixture(answer: ((request: ApprovalRequest) => Promise<ApprovalOutcome>) | null = async () => 'allowed-once') {
  vi.spyOn(console, 'info').mockImplementation(() => undefined)
  const commands: string[] = []
  const link: RedisLink = {
    close: () => undefined, onFailure: () => () => undefined,
    async execute(command, args, signal, guard) {
      signal.throwIfAborted(); guard(); commands.push(command)
      if (command === 'SCAN') return [Buffer.from(args[0] === '0' ? '7' : '0'), [Buffer.from('order:1')]]
      if (command === 'TYPE') return 'hash'
      if (command === 'PTTL') return -1n
      if (command === 'HGET') return Buffer.from('failed')
      if (command === 'SELECT') return 'OK'
      throw new Error('Unexpected fixture command: ' + command)
    },
  }
  const settings = { host: '127.0.0.1', port: 6379, username: '', password: 'fixture-secret', tls: null }
  const connections = new RedisConnections(async () => link)
  const reader = new RedisAiReader(connections, () => undefined, async () => 0, () => false)
  const reconnect = (session = 'a') => connections.connect(session, settings, new AbortController().signal)
  await reconnect()
  const ctx = new Context(), ask = vi.fn(answer ?? (async () => 'unavailable' as const))
  if (answer !== null) ctx.provide('approval', { request: ask } as unknown as ApprovalService)
  await ctx.plugin(SystemPrompt); await ctx.plugin(ToolRuntime)
  const fiber = await ctx.plugin({ name: 'scope-test', inject: ['tools'], apply: (scope: Context) => registerRedisTools(scope, reader) })
  const agent = (session: string) => ({ id: 'agent-' + session, ctx, session: { id: session } }) as unknown as Agent
  let count = 0
  const call = (name: string, args: unknown, options: { session?: string; signal?: AbortSignal; callId?: string } = {}) => ctx.tools.execute({
    name, arguments: args, agent: agent(options.session ?? 'a'),
    signal: options.signal ?? new AbortController().signal,
    callId: (options.callId ?? 'scope-' + ++count) as ToolExecutionInput['callId'],
  })
  cleanups.push(async () => { await ctx.fiber.dispose(); reader.dispose(); connections.dispose() })
  return { ctx, fiber, reader, connections, commands, ask, call, reconnect }
}
function page(result: Awaited<ReturnType<ToolRuntime['execute']>>) {
  expect(result.isError).toBe(false)
  const raw: unknown = JSON.parse(result.content.filter(block => block.type === 'text').map(block => block.text).join(''))
  if (raw === null || typeof raw !== 'object' || !('cursor' in raw) || !(raw.cursor === null || typeof raw.cursor === 'string')) throw new Error('Missing page cursor')
  return raw
}
function pendingAnswer() {
  let release!: (outcome: ApprovalOutcome) => void
  const pending = new Promise<ApprovalOutcome>(resolve => { release = resolve })
  const answer = async (request: ApprovalRequest): Promise<ApprovalOutcome> => {
    // Match ApprovalService cancellation, without requiring a real session log.
    const signal = request.signal
    if (signal === undefined) return pending
    if (signal.aborted) return 'cancelled'
    let cancelled!: () => void
    const withdrawn = new Promise<ApprovalOutcome>(resolve => { cancelled = () => resolve('cancelled'); signal.addEventListener('abort', cancelled, { once: true }) })
    try { return await Promise.race([pending, withdrawn]) }
    finally { signal.removeEventListener('abort', cancelled) }
  }
  return { release, answer }
}

describe('Redis first-query scope confirmation', () => {
  it('waits before dispatch or budget admission and displays the exact query', async () => {
    const approval = pendingAnswer(), f = await fixture(approval.answer)
    const dispatch = vi.fn()
    f.ctx.on('tools/execute', async (_exec, next) => { dispatch(); return next() })
    const pending = f.call('redis_viewer_filter_hash', { match: 'order:*', field: 'status', equals: 'failed' })
    await vi.waitFor(() => expect(f.ask).toHaveBeenCalledTimes(1))
    expect(f.commands).toEqual([]); expect(dispatch).not.toHaveBeenCalled()
    expect(f.reader.budgetStatus('a').callsUsed).toBe(0)
    const request = f.ask.mock.calls[0]![0]
    expect(request.toolName).toBe('redis_viewer_filter_hash')
    expect(request.displayReason?.zh).toContain('127.0.0.1')
    expect(request.displayReason?.zh).toContain('DB 0')
    expect(request.displayReason?.zh).toContain('"match":"order:*","field":"status","equals":"failed"')
    expect(request.displayReason?.zh).toContain('整个键空间')
    expect(JSON.stringify(request.displayReason)).not.toContain('fixture-secret')
    approval.release('allowed-once')
    expect((await pending).isError).toBe(false); expect(f.commands).toContain('HGET')
  })

  it.each(['rejected', 'unavailable', 'cancelled'] as const)('sends no commands for %s', async outcome => {
    const f = await fixture(async () => outcome)
    expect((await f.call('redis_viewer_keys', { match: '*' })).isError).toBe(true)
    expect(f.commands).toEqual([]); expect(f.reader.budgetStatus('a').callsUsed).toBe(0)
  })

  it('preserves rejection separately from unavailable confirmation in the actual tool result', async () => {
    const rejected = await fixture(async () => 'rejected')
    const unavailable = await fixture(async () => 'unavailable')
    const deniedResult = await rejected.call('redis_viewer_keys', { match: 'order:*' })
    const unavailableResult = await unavailable.call('redis_viewer_keys', { match: 'order:*' })
    const text = (result: typeof deniedResult) => result.content.filter(block => block.type === 'text').map(block => block.text).join('')
    expect(text(deniedResult)).toContain('查询已被拒绝')
    expect(text(deniedResult)).not.toContain('澄清范围')
    expect(text(unavailableResult)).toContain('确认服务不可用')
    expect(text(unavailableResult)).not.toContain('已被拒绝')
    expect(rejected.commands).toEqual([]); expect(unavailable.commands).toEqual([])
    expect(rejected.reader.budgetStatus('a').callsUsed).toBe(0)
    expect(unavailable.reader.budgetStatus('a').callsUsed).toBe(0)
  })

  it('fails closed without approval and leaves explicit metadata reads available', async () => {
    const f = await fixture(null)
    expect((await f.call('redis_viewer_keys', { match: '*' })).isError).toBe(true)
    expect(f.commands).toEqual([])
    expect((await f.call('redis_viewer_key_metadata', { key: 'order:1' })).isError).toBe(false)
    expect(f.commands).toEqual(['TYPE', 'PTTL', 'TYPE']); expect(f.ask).not.toHaveBeenCalled()
  })

  it('rejects malformed and model-claimed approvals before prompting', async () => {
    const f = await fixture()
    for (const args of [{}, { match: '*' , approved: true }, { match: '\ud800' }, { match: 'x'.repeat(257) }, { match: '*', cursor: null }]) expect((await f.call('redis_viewer_keys', args)).isError).toBe(true)
    for (const args of [{ match: '*', field: 'x' }, { match: '*', field: '中'.repeat(400), equals: 'x' }, { match: '*', field: 'x', equals: '\ud800' }]) expect((await f.call('redis_viewer_filter_hash', args)).isError).toBe(true)
    expect(f.ask).not.toHaveBeenCalled(); expect(f.commands).toEqual([])
  })

  it.each(['redis_viewer_keys', 'redis_viewer_filter_hash'])('binds %s continuation to conditions and session without asking twice', async name => {
    const f = await fixture(), args = name === 'redis_viewer_keys' ? { match: 'order:*' } : { match: 'order:*', field: 'status', equals: 'failed' }
    const first = page(await f.call(name, args)), before = f.commands.length
    const changed = name === 'redis_viewer_keys' ? [{ match: 'other:*' }] : [{ ...args, match: 'other:*' }, { ...args, field: 'other' }, { ...args, equals: 'other' }]
    for (const conditions of changed) expect((await f.call(name, { ...conditions, cursor: first.cursor })).isError).toBe(true)
    await f.reconnect('b')
    expect((await f.call(name, { ...args, cursor: first.cursor }, { session: 'b' })).isError).toBe(true)
    expect((await f.call(name, { ...args, cursor: '00000000-0000-0000-0000-000000000000' })).isError).toBe(true)
    expect(f.commands).toHaveLength(before); expect(f.ask).toHaveBeenCalledTimes(1)
    expect(page(await f.call(name, { ...args, cursor: first.cursor })).cursor).toBe(null)
    expect(f.ask).toHaveBeenCalledTimes(1)
    expect((await f.call(name, args)).isError).toBe(false); expect(f.ask).toHaveBeenCalledTimes(2)
  })

  it.each(['pending', 'dispatch'] as const)('rejects a connection replaced during %s', async timing => {
    const approval = pendingAnswer(), f = await fixture(approval.answer)
    if (timing === 'dispatch') f.ctx.on('tools/execute', async (_exec, next) => { await f.reconnect(); return next() })
    const pending = f.call('redis_viewer_keys', { match: '*' })
    await vi.waitFor(() => expect(f.ask).toHaveBeenCalledTimes(1))
    if (timing === 'pending') await f.reconnect()
    approval.release('allowed-once')
    expect((await pending).isError).toBe(true); expect(f.commands).toEqual([])
  })

  it('rejects a DB change during confirmation and invalidates old continuations', async () => {
    const approval = pendingAnswer(), f = await fixture(approval.answer)
    const pending = f.call('redis_viewer_keys', { match: '*' })
    await vi.waitFor(() => expect(f.ask).toHaveBeenCalledTimes(1))
    await f.reader.selectDatabase('a', 1, new AbortController().signal)
    approval.release('allowed-once'); expect((await pending).isError).toBe(true)
    expect(f.commands).toEqual(['SELECT'])
    const first = page(await f.call('redis_viewer_keys', { match: '*' }))
    await f.reader.selectDatabase('a', 0, new AbortController().signal)
    const before = f.commands.length
    expect((await f.call('redis_viewer_keys', { match: '*', cursor: first.cursor })).isError).toBe(true)
    expect(f.commands).toHaveLength(before)
  })

  it.each(['caller', 'plugin'] as const)('withdraws a pending prompt when %s ends', async source => {
    const approval = pendingAnswer(), f = await fixture(approval.answer), controller = new AbortController()
    const pending = f.call('redis_viewer_keys', { match: '*' }, { signal: controller.signal })
    await vi.waitFor(() => expect(f.ask).toHaveBeenCalledTimes(1))
    if (source === 'caller') controller.abort()
    else await f.fiber.dispose()
    expect((await pending).isError).toBe(true)
    approval.release('allowed-once'); expect(f.commands).toEqual([])
  })

  it('does not override another policy or reuse permission by callId', async () => {
    const f = await fixture()
    const deny = f.ctx.on('tools/pre-execute', async () => ({ kind: 'deny', reason: 'fixture-denial' }))
    expect((await f.call('redis_viewer_keys', { match: '*' })).isError).toBe(true)
    expect(f.commands).toEqual([]); deny()
    const otherAsk = f.ctx.on('tools/pre-execute', async () => ({ kind: 'ask', reason: 'other-policy' }))
    expect((await f.call('redis_viewer_keys', { match: '*' })).isError).toBe(false)
    expect(f.ask).toHaveBeenCalledTimes(2); otherAsk()
    f.ask.mockClear()
    for (let i = 0; i < 2; i++) expect((await f.call('redis_viewer_keys', { match: '*' }, { callId: 'same' })).isError).toBe(false)
    expect(f.ask).toHaveBeenCalledTimes(2)
  })

  it('refuses the body if an earlier policy skips the confirmation middleware', async () => {
    const f = await fixture()
    await f.fiber.dispose()
    // Register the short-circuit before reinstalling this plugin.
    f.ctx.on('tools/pre-execute', async () => ({ kind: 'allow' }))
    await f.ctx.plugin({ name: 'scope-reinstalled', inject: ['tools'], apply: (ctx: Context) => registerRedisTools(ctx, f.reader) })
    expect((await f.call('redis_viewer_keys', { match: '*' })).isError).toBe(true)
    expect(f.commands).toEqual([]); expect(f.ask).not.toHaveBeenCalled()
  })
})
