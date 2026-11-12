import * as NativeToolExecutor from '@deepseek-ai/dsh-tool-executor-native'
import { executeTool } from './tool-test-utils.ts'
import { Context } from '@deepseek-ai/cordis'
import type { Agent } from '@deepseek-ai/dsh-agent'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime from '@deepseek-ai/dsh-tools'
import { expect, it, vi } from 'vitest'
import type { UiAction, UiChannelInput } from '../src/domain.ts'
import { RedisAiReader } from '../src/host/ai-reader.ts'
import { registerRedisLocateTool } from '../src/host/ai-locate-tool.ts'
import { registerRedisTools } from '../src/host/ai-tools.ts'
import { RedisConnections, type RedisLink } from '../src/host/connection-service.ts'
import { openUiActionChannel } from '../src/host/ui-action-channel.ts'
import { UiActionCoordinator } from '../src/host/ui-action-coordinator.ts'
import { sampleActionPoint } from './action-point-fixture.ts'

function uplink() {
  const queue: UiChannelInput[] = []
  let wake: (() => void) | undefined, ended = false
  const notify = () => { const next = wake; wake = undefined; next?.() }
  return {
    send(value: UiChannelInput) { queue.push(value); notify() },
    end() { ended = true; notify() },
    async *[Symbol.asyncIterator]() { while (!ended) { const value = queue.shift(); if (value !== undefined) { yield value; continue } await new Promise<void>(resolve => { wake = resolve; if (ended || queue.length > 0) notify() }) } },
  }
}

it('commits an exact List index through the registered tool and rejects a forged applied acknowledgement', async () => {
  const commands: string[] = []
  const values = [Buffer.from('first'), Buffer.from('second'), Buffer.from('synthetic-value')]
  const link: RedisLink = {
    close: () => undefined, onFailure: () => () => undefined,
    async execute(command, args, signal, guard) {
      signal.throwIfAborted(); guard(); commands.push(command)
      if (command === 'TYPE') return 'list'
      if (command === 'PTTL') return -1n
      if (command === 'LLEN') return BigInt(values.length)
      if (command === 'LRANGE') return values.slice(Number(args[1]), Number(args[2]) + 1)
      throw new Error('Unexpected command: ' + command)
    },
  }
  const connections = new RedisConnections(async () => link), actions = new UiActionCoordinator<UiAction>()
  const reader = new RedisAiReader(connections, session => actions.invalidateSession(session), async (session, target, expected, signal) => {
    const revision = actions.selectionRevision(session)
    if (revision === null || (expected !== null && revision !== expected)) throw new Error('选择未同步')
    const current = () => actions.selectionRevision(session) === revision
    if (await actions.dispatch(session, { kind: 'confirmSelection' }, target, revision, current, signal) !== 'applied' || !current()) throw new Error('选择已变化')
    return revision
  }, (session, revision) => { const current = actions.selectionRevision(session); return current !== null && (revision === null || current === revision) })
  const ctx = new Context(), abort = new AbortController(), input = uplink()
  vi.spyOn(console, 'info').mockImplementation(() => undefined)
  await ctx.plugin(SystemPrompt); await ctx.plugin(ToolRuntime); await ctx.plugin(NativeToolExecutor)
  await ctx.plugin({ name: 'list-locate-fixture', inject: ['tools'], apply: (scope: Context) => { registerRedisLocateTool(scope, reader, actions); registerRedisTools(scope, reader) } })
  const agent = { id: 'a', ctx, session: { id: 'a' } } as unknown as Agent
  const call = (name: string, args: unknown) => executeTool(ctx.tools, { callId: 'list-locate' as string, name, arguments: args, agent, signal: abort.signal })
  const content = (result: Awaited<ReturnType<typeof call>>) => result.content.filter(item => item.type === 'text').map(item => item.text).join('')
  const connection = await connections.connect('a', { host: '127.0.0.1', port: 6379, username: '', password: '', tls: null }, abort.signal)
  if (connection.id === null) throw new Error('Missing fixture connection')
  const target = { id: connection.id, generation: connection.generation, db: 0 }
  reader.setSelection('a', { target, selection: { keyBase64: 'aw==', item: { kind: 'list', index: '0' } } })
  const stream = openUiActionChannel(actions, 'a', abort.signal, input, (request, source) => source === 'action' ? reader.commitSelection('a', request) : reader.setSelection('a', request))
  let next = stream.next(), revision = 1
  async function confirm(): Promise<void> {
    const frame = await next
    if (frame.done || frame.value.kind !== 'action' || frame.value.request.action.kind !== 'confirmSelection') throw new Error('Missing selection confirmation')
    input.send({ requestId: frame.value.request.requestId, target, selectionRevision: revision, outcome: 'applied' })
    next = stream.next()
  }
  try {
    input.send({ kind: 'selection', revision, synchronized: true })
    await vi.waitFor(() => expect(actions.selectionRevision('a')).toBe(revision))
    const locate = call('redis_viewer_locate_list_index', { index: '2' })
    await confirm()
    const frame = await next
    if (frame.done || frame.value.kind !== 'action' || frame.value.request.action.kind !== 'selectListIndex') throw new Error('Missing List index action')
    expect(frame.value.request.action).toEqual({ kind: 'selectListIndex', keyBase64: 'aw==', index: '2' })
    expect(await sampleActionPoint(connections, actions, 'a', frame.value.request.requestId, abort.signal)).toMatchObject({ state: 'value' })
    next = stream.next()
    input.send({ kind: 'commitSelection', requestId: frame.value.request.requestId, revision, nextRevision: revision + 1 })
    expect(await next).toMatchObject({ value: { kind: 'selectionResult', accepted: true } })
    expect(actions.selectionRevision('a')).toBeNull()
    revision += 1; next = stream.next()
    input.send({ kind: 'publishSelection', requestId: '12345678-1234-1234-1234-123456789abc', actionRequestId: frame.value.request.requestId, revision, request: { target, selection: { keyBase64: 'aw==', item: { kind: 'list', index: '2' } } } })
    expect(await next).toMatchObject({ value: { kind: 'selectionResult', accepted: true } })
    input.send({ kind: 'selection', revision, synchronized: true })
    const located = await locate
    expect(located.isError).toBeFalsy(); expect(content(located)).toContain('"outcome":"applied"'); expect(content(located)).not.toContain('synthetic-value')
    expect(reader.status('a')).toMatchObject({ currentSelection: { selection: { keyBase64: 'aw==', item: { kind: 'list', index: '2' } } } })
    await vi.waitFor(() => expect(actions.selectionRevision('a')).toBe(revision))
    next = stream.next()
    const value = call('redis_viewer_value', {})
    await confirm(); await confirm()
    expect(content(await value)).toContain('synthetic-value')

    const forged = call('redis_viewer_locate_list_index', { index: '1' })
    await confirm()
    const candidate = await next
    if (candidate.done || candidate.value.kind !== 'action' || candidate.value.request.action.kind !== 'selectListIndex') throw new Error('Missing second action')
    input.send({ requestId: candidate.value.request.requestId, target, selectionRevision: revision, outcome: 'applied' })
    expect(content(await forged)).toContain('"outcome":"failed"')
    expect(reader.status('a')).toMatchObject({ currentSelection: { selection: { item: { kind: 'list', index: '2' } } } })

    next = stream.next()
    const missing = call('redis_viewer_locate_list_index', { index: '9' })
    await confirm()
    expect(content(await missing)).toContain('采样时该 List 下标不存在')
    for (const args of [{}, { index: '-1' }, { index: '01' }, { index: '9223372036854775808' }, { index: '0', command: 'LPOP' }]) expect((await call('redis_viewer_locate_list_index', args)).isError).toBe(true)
    expect(commands.every(command => ['TYPE', 'PTTL', 'LLEN', 'LRANGE'].includes(command))).toBe(true)
  } finally {
    abort.abort(); input.end(); await next; reader.dispose(); actions.dispose(); connections.dispose(); await ctx.fiber.dispose(); vi.restoreAllMocks()
  }
}, 15000)
