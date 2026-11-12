import * as NativeToolExecutor from '@deepseek-ai/dsh-tool-executor-native'
import { executeTool } from './tool-test-utils.ts'
import { Context } from '@deepseek-ai/cordis'
import type { Agent } from '@deepseek-ai/dsh-agent'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime from '@deepseek-ai/dsh-tools'
import { expect, it, vi } from 'vitest'
import type { UiAction, UiChannelInput } from '../src/domain.ts'
import { ConnectionFailure, RedisConnections, type RedisLink } from '../src/host/connection-service.ts'
import { RedisAiReader } from '../src/host/ai-reader.ts'
import { registerRedisLocateTool } from '../src/host/ai-locate-tool.ts'
import { registerRedisTools } from '../src/host/ai-tools.ts'
import { openUiActionChannel } from '../src/host/ui-action-channel.ts'
import { UiActionCoordinator } from '../src/host/ui-action-coordinator.ts'
import { RedisSelectedReader } from '../src/host/selected-reader.ts'
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

it('commits exact ZSet identities through the Host channel and reads the selected score', async () => {
  const commands: string[] = [], rawMembers: string[] = []
  let type = 'zset'
  const link: RedisLink = {
    close: () => undefined, onFailure: () => () => undefined,
    async execute(command, args, abort, guard) {
      abort.throwIfAborted(); guard(); commands.push(command)
      if (command === 'TYPE') return type
      if (command === 'PTTL') return -1n
      if (command === 'ZSCORE' && Buffer.isBuffer(args[1])) {
        rawMembers.push(args[1].toString('base64'))
        if (args[1].equals(Buffer.from([0, 255]))) return Buffer.from('1.2345678901234567e+20')
        if (args[1].length === 0) return Buffer.from('-inf')
        return null
      }
      throw new Error('Unexpected synthetic command')
    },
  }
  const connections = new RedisConnections(async () => link), actions = new UiActionCoordinator<UiAction>()
  const reader = new RedisAiReader(connections, session => actions.invalidateSession(session), async (session, target, expected, abort) => {
    const revision = actions.selectionRevision(session)
    if (revision === null || (expected !== null && revision !== expected)) throw new ConnectionFailure('stale')
    const current = () => actions.selectionRevision(session) === revision
    if (await actions.dispatch(session, { kind: 'confirmSelection' }, target, revision, current, abort) !== 'applied' || !current()) throw new ConnectionFailure('stale')
    return revision
  }, (session, revision) => { const current = actions.selectionRevision(session); return current !== null && (revision === null || current === revision) })
  const ctx = new Context(), abort = new AbortController(), input = uplink()
  vi.spyOn(console, 'info').mockImplementation(() => undefined)
  await ctx.plugin(SystemPrompt); await ctx.plugin(ToolRuntime); await ctx.plugin(NativeToolExecutor)
  await ctx.plugin({ name: 'zset-locate-fixture', inject: ['tools'], apply: (scope: Context) => { registerRedisLocateTool(scope, reader, actions); registerRedisTools(scope, reader) } })
  const agent = { id: 'a', ctx, session: { id: 'a' } } as unknown as Agent
  const call = (name: string, args: unknown) => executeTool(ctx.tools, { callId: 'zset-locate' as string, name, arguments: args, agent, signal: abort.signal })
  const content = (result: Awaited<ReturnType<typeof call>>) => result.content.filter(item => item.type === 'text').map(item => item.text).join('')
  const connection = await connections.connect('a', { host: 'fixture', port: 6379, username: '', password: '', tls: null }, abort.signal)
  if (connection.id === null) throw new Error('Missing connection')
  const target = { id: connection.id, generation: connection.generation, db: 0 }
  reader.setSelection('a', { target, selection: { keyBase64: 'aw==', item: null } })
  const stream = openUiActionChannel(actions, 'a', abort.signal, input, (request, source) => source === 'action' ? reader.commitSelection('a', request) : reader.setSelection('a', request))
  let next = stream.next(), revision = 1
  const confirm = async () => {
    const frame = await next
    if (frame.done || frame.value.kind !== 'action' || frame.value.request.action.kind !== 'confirmSelection') throw new Error('Missing selection confirmation')
    input.send({ requestId: frame.value.request.requestId, target, selectionRevision: revision, outcome: 'applied' }); next = stream.next()
  }
  try {
    input.send({ kind: 'selection', revision, synchronized: true })
    await vi.waitFor(() => expect(actions.selectionRevision('a')).toBe(revision))
    for (const fixture of [{ args: { memberBase64: 'AP8=' }, member: 'AP8=', score: '1.2345678901234567e+20' }, { args: { member: '' }, member: '', score: '-inf' }]) {
      const locate = call('redis_viewer_locate_zset_member', fixture.args)
      await confirm()
      const frame = await next
      if (frame.done || frame.value.kind !== 'action' || frame.value.request.action.kind !== 'selectZSetMember') throw new Error('Missing ZSet action')
      expect(frame.value.request.action).toMatchObject({ keyBase64: 'aw==', member: { base64: fixture.member } })
      expect(await sampleActionPoint(connections, actions, 'a', frame.value.request.requestId, abort.signal)).toMatchObject({ state: 'value', score: fixture.score })
      const id = frame.value.request.requestId
      next = stream.next(); input.send({ kind: 'commitSelection', requestId: id, revision, nextRevision: revision + 1 })
      expect(await next).toMatchObject({ value: { kind: 'selectionResult', accepted: true } })
      expect(actions.selectionRevision('a')).toBeNull()
      revision++; next = stream.next()
      input.send({ kind: 'publishSelection', requestId: '12345678-1234-1234-1234-123456789abc', actionRequestId: id, revision, request: { target, selection: { keyBase64: 'aw==', item: { kind: 'zset', memberBase64: fixture.member } } } })
      expect(await next).toMatchObject({ value: { kind: 'selectionResult', accepted: true } })
      input.send({ kind: 'selection', revision, synchronized: true })
      const located = await locate
      expect(located.isError).toBeFalsy()
      expect(JSON.parse(content(located))).toMatchObject({ outcome: 'applied', score: fixture.score })
      expect(reader.status('a')).toMatchObject({ currentSelection: { selection: { keyBase64: 'aw==', item: { kind: 'zset', memberBase64: fixture.member } } } })
      await vi.waitFor(() => expect(actions.selectionRevision('a')).toBe(revision))
      const value = call('redis_viewer_value', {})
      next = stream.next(); await confirm(); await confirm()
      const read = await value
      expect(read.isError).toBeFalsy()
      expect(content(read)).toContain(fixture.score)
      expect(content(read)).toContain(fixture.member)
    }
    for (const args of [{}, { member: 'x', memberBase64: 'eA==' }, { memberBase64: 'eA=' }, { member: 'x', command: 'ZREM' }]) expect((await call('redis_viewer_locate_zset_member', args)).isError).toBe(true)
    const missing = call('redis_viewer_locate_zset_member', { member: 'missing' })
    await confirm()
    expect(content(await missing)).toContain('采样时该 ZSet 成员不存在')
    type = 'hash'
    const changed = call('redis_viewer_locate_zset_member', { member: 'missing' })
    await confirm()
    expect(content(await changed)).toContain('类型已变化')
    expect(rawMembers).toEqual(['AP8=', 'AP8=', 'AP8=', '', '', '', 'bWlzc2luZw=='])
    expect(commands.every(command => ['TYPE', 'ZSCORE', 'PTTL'].includes(command))).toBe(true)
  } finally { abort.abort(); input.end(); await next; reader.dispose(); actions.dispose(); connections.dispose(); await ctx.fiber.dispose(); vi.restoreAllMocks() }
}, 15000)

it('records the score response time before later TTL metadata completes', async () => {
  const start = new Date('2026-01-01T00:00:00.000Z'), later = new Date('2026-01-01T00:00:05.000Z')
  const link: RedisLink = { close: () => undefined, onFailure: () => () => undefined, async execute(command, _args, abort, guard) {
    abort.throwIfAborted(); guard()
    if (command === 'TYPE') return 'zset'
    if (command === 'ZSCORE') return Buffer.from('1.2345678901234567e+20')
    if (command === 'PTTL') { vi.setSystemTime(later); return -1n }
    throw new Error('Unexpected synthetic command')
  } }
  const connections = new RedisConnections(async () => link), signal = new AbortController().signal
  try {
    const connection = await connections.connect('a', { host: 'fixture', port: 6379, username: '', password: '', tls: null }, signal)
    if (connection.id === null) throw new Error('Missing connection')
    vi.useFakeTimers(); vi.setSystemTime(start)
    const result = await new RedisSelectedReader(connections).read('a', { id: connection.id, generation: connection.generation, db: 0 }, 'aw==', { kind: 'zset', memberBase64: 'bQ==' }, signal)
    expect(result).toMatchObject({ state: 'value', score: '1.2345678901234567e+20', sampledAt: start.toISOString() })
    expect(new Date().toISOString()).toBe(later.toISOString())
  } finally { vi.useRealTimers(); connections.dispose() }
})
