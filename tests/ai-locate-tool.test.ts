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
import { RedisReplyError, type RedisReply } from '../src/host/resp.ts'
import { openUiActionChannel } from '../src/host/ui-action-channel.ts'
import { UiActionCoordinator } from '../src/host/ui-action-coordinator.ts'
import { sampleActionPoint } from './action-point-fixture.ts'

function uplink() {
  const queue: UiChannelInput[] = []
  let wake: (() => void) | undefined, ended = false
  const notify = () => { const fn = wake; wake = undefined; fn?.() }
  return {
    send(value: UiChannelInput) { queue.push(value); notify() },
    end() { ended = true; notify() },
    async *[Symbol.asyncIterator]() { while (!ended) { const value = queue.shift(); if (value !== undefined) { yield value; continue } await new Promise<void>(resolve => { wake = resolve; if (ended || queue.length > 0) notify() }) } },
  }
}

it('locates exact text and binary keys only after the checked UI commit', async () => {
  const commands: string[] = []
  const link: RedisLink = {
    close: () => undefined, onFailure: () => () => undefined,
    async execute(command, args, signal, guard): Promise<RedisReply> {
      signal.throwIfAborted(); guard(); commands.push(command)
      if (!Buffer.isBuffer(args[0])) throw new Error('Unexpected fixture key')
      const key = args[0].toString('utf8')
      if (command === 'PTTL') return -1n
      if (command === 'STRLEN') return 5n
      if (command === 'GETRANGE') return Buffer.from('hello')
      if (command !== 'TYPE') throw new Error('Unexpected fixture command')
      if (key === 'missing') return 'none'
      if (key === 'denied') throw new RedisReplyError('NOPERM synthetic secret')
      return key === 'present' || args[0].length === 65536 ? 'string' : 'hash'
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
  await ctx.plugin({ name: 'redis-locate-test', inject: ['tools'], apply: (scope: Context) => { registerRedisLocateTool(scope, reader, actions); registerRedisTools(scope, reader) } })
  const agent = { id: 'a', ctx, session: { id: 'a' } } as unknown as Agent
  const call = (args: unknown) => executeTool(ctx.tools, { callId: 'locate-test' as string, name: 'redis_viewer_locate_key', arguments: args, agent, signal: abort.signal })
  const value = () => executeTool(ctx.tools, { callId: 'value-test' as string, name: 'redis_viewer_value', arguments: {}, agent, signal: abort.signal })
  const content = (result: Awaited<ReturnType<typeof call>>) => result.content.filter(item => item.type === 'text').map(item => item.text).join('')
  const connection = await connections.connect('a', { host: '127.0.0.1', port: 6379, username: '', password: '', tls: null }, abort.signal)
  if (connection.id === null) throw new Error('Missing connection')
  const target = { id: connection.id, generation: connection.generation, db: 0 }
  const stream = openUiActionChannel(actions, 'a', abort.signal, input, (request, source) => source === 'action' ? reader.commitSelection('a', request) : reader.setSelection('a', request))
  let next = stream.next(), revision = 1
  try {
    input.send({ kind: 'selection', revision, synchronized: true })
    await vi.waitFor(() => expect(actions.selectionRevision('a')).toBe(revision))
    const longest = Buffer.alloc(65536, 255).toString('base64')
    for (const args of [{ key: 'present' }, { keyBase64: 'AP8=' }, { key: '' }, { keyBase64: '' }, { keyBase64: longest }]) {
      const expected = args.keyBase64 ?? Buffer.from(args.key ?? '', 'utf8').toString('base64')
      const result = call(args), frame = await next
      if (frame.done || frame.value.kind !== 'action' || frame.value.request.action.kind !== 'selectKey') throw new Error('Missing locate action')
      const request = frame.value.request
      if (request.action.kind !== 'selectKey') throw new Error('Unexpected action')
      expect(request.action.key.base64).toBe(expected)
      next = stream.next(); input.send({ kind: 'commitSelection', requestId: request.requestId, revision, nextRevision: revision + 1 })
      expect(await next).toMatchObject({ value: { kind: 'selectionResult', accepted: true } })
      expect(actions.selectionRevision('a')).toBeNull()
      revision += 1; next = stream.next()
      input.send({ kind: 'publishSelection', requestId: '12345678-1234-1234-1234-123456789abc', actionRequestId: request.requestId, revision, request: { target, selection: { keyBase64: expected, item: null } } })
      expect(await next).toMatchObject({ value: { kind: 'selectionResult', accepted: true } })
      input.send({ kind: 'selection', revision, synchronized: true })
      const output = content(await result)
      expect(JSON.parse(output)).toMatchObject({ outcome: 'applied', key: { byteLength: Buffer.from(expected, 'base64').length } })
      expect(output).not.toContain(expected === '' ? 'keyBase64' : expected)
      if (expected === longest) expect(() => reader.status('a')).toThrow('预算')
      else expect(reader.status('a')).toMatchObject({ currentSelection: { target, selection: { keyBase64: expected, item: null } } })
      await vi.waitFor(() => expect(actions.selectionRevision('a')).toBe(revision))
      next = stream.next()
      if (expected === Buffer.from('present').toString('base64') || expected === longest) {
        const read = value(), firstConfirmation = await next
        if (firstConfirmation.done || firstConfirmation.value.kind !== 'action' || firstConfirmation.value.request.action.kind !== 'confirmSelection') throw new Error('Missing first selection confirmation')
        const first = firstConfirmation.value.request
        input.send({ requestId: first.requestId, target, selectionRevision: revision, outcome: 'applied' })
        if (expected !== longest) {
          next = stream.next()
          const secondConfirmation = await next
          if (secondConfirmation.done || secondConfirmation.value.kind !== 'action' || secondConfirmation.value.request.action.kind !== 'confirmSelection') throw new Error('Missing final selection confirmation')
          const second = secondConfirmation.value.request
          input.send({ requestId: second.requestId, target, selectionRevision: revision, outcome: 'applied' })
          const readResult = await read
          expect(readResult.isError).toBeFalsy(); expect(content(readResult)).toContain('"text":"hello"'); expect(content(readResult)).toContain('"source":"selection"')
        } else {
          const readResult = await read
          expect(readResult.isError).toBe(true); expect(content(readResult)).toContain('预算')
        }
        next = stream.next()
      }
    }
    expect(content(await call({ key: 'missing' }))).toContain('"outcome":"missing"')
    const denied = content(await call({ key: 'denied' }))
    expect(denied).toContain('"error":"permission"'); expect(denied).not.toContain('synthetic secret')
    for (const args of [{}, { key: 'x', keyBase64: 'eA==' }, { keyBase64: '!' }, { keyBase64: 'eA=' }, { key: 'x'.repeat(65537) }, { keyBase64: Buffer.alloc(65537).toString('base64') }, { key: 'x', sessionId: 'b' }]) expect((await call(args)).isError).toBe(true)
    expect(commands.filter(command => command === 'TYPE')).toHaveLength(11)
    expect(commands.every(command => ['TYPE', 'PTTL', 'STRLEN', 'GETRANGE'].includes(command))).toBe(true)
  } finally {
    abort.abort(); input.end(); await next; reader.dispose(); actions.dispose(); connections.dispose(); await ctx.fiber.dispose(); vi.restoreAllMocks()
  }
})

it.each(['cancel', 'reconnect'] as const)('never dispatches a stale target when TYPE is interrupted by %s', async mode => {
  let release!: (value: RedisReply) => void, started!: () => void
  const gate = new Promise<RedisReply>(resolve => { release = resolve }), reading = new Promise<void>(resolve => { started = resolve })
  const link: RedisLink = { close: () => undefined, onFailure: () => () => undefined, async execute(command) { if (command !== 'TYPE') throw new Error('Unexpected command'); started(); return gate } }
  const connections = new RedisConnections(async () => link), actions = new UiActionCoordinator<UiAction>()
  const reader = new RedisAiReader(connections, session => actions.invalidateSession(session), async () => 0, () => true)
  const ctx = new Context(), operation = new AbortController(), receiver = vi.fn(async () => { throw new Error('A stale action was dispatched') })
  vi.spyOn(console, 'info').mockImplementation(() => undefined)
  await ctx.plugin(SystemPrompt); await ctx.plugin(ToolRuntime); await ctx.plugin(NativeToolExecutor)
  await ctx.plugin({ name: 'redis-locate-interrupt-test', inject: ['tools'], apply: (scope: Context) => registerRedisLocateTool(scope, reader, actions) })
  const signal = new AbortController().signal, settings = { host: '127.0.0.1', port: 6379, username: '', password: '', tls: null }
  await connections.connect('a', settings, signal)
  const unregister = actions.register('a', receiver)
  actions.setSelectionState('a', receiver, 1, true)
  const agent = { id: 'a', ctx, session: { id: 'a' } } as unknown as Agent
  try {
    const result = executeTool(ctx.tools, { callId: 'locate-interrupt' as string, name: 'redis_viewer_locate_key', arguments: { key: 'candidate' }, agent, signal: operation.signal })
    await reading
    if (mode === 'cancel') operation.abort()
    else await connections.connect('a', settings, signal)
    release('string')
    const output = await result
    if (mode === 'cancel') expect(output.isError).toBe(true)
    else expect(output.content.filter(item => item.type === 'text').map(item => item.text).join('')).toContain('"error":"stale"')
    expect(receiver).not.toHaveBeenCalled()
  } finally {
    release('string'); unregister(); reader.dispose(); actions.dispose(); connections.dispose(); await ctx.fiber.dispose(); vi.restoreAllMocks()
  }
})

it('locates an exact Hash field through the tool and Host stream without exposing an old selection', async () => {
  const commands: string[] = []
  const link: RedisLink = {
    close: () => undefined, onFailure: () => () => undefined,
    async execute(command, args, signal, guard): Promise<RedisReply> {
      signal.throwIfAborted(); guard(); commands.push(command)
      if (command === 'TYPE') return 'hash'
      if (command === 'PTTL') return -1n
      if (command === 'HGET' && Buffer.isBuffer(args[1])) return args[1].equals(Buffer.from([0, 255])) ? Buffer.from('synthetic-value') : null
      throw new Error('Unexpected synthetic command')
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
  await ctx.plugin({ name: 'redis-hash-field-locate-test', inject: ['tools'], apply: (scope: Context) => { registerRedisLocateTool(scope, reader, actions); registerRedisTools(scope, reader) } })
  const agent = { id: 'a', ctx, session: { id: 'a' } } as unknown as Agent
  const call = (name: string, args: unknown) => executeTool(ctx.tools, { callId: 'hash-field-test' as string, name, arguments: args, agent, signal: abort.signal })
  const content = (result: Awaited<ReturnType<typeof call>>) => result.content.filter(item => item.type === 'text').map(item => item.text).join('')
  const connection = await connections.connect('a', { host: '127.0.0.1', port: 6379, username: '', password: '', tls: null }, abort.signal)
  if (connection.id === null) throw new Error('Missing connection')
  const target = { id: connection.id, generation: connection.generation, db: 0 }
  reader.setSelection('a', { target, selection: { keyBase64: 'aw==', item: { kind: 'hash', fieldBase64: 'b2xk' } } })
  const stream = openUiActionChannel(actions, 'a', abort.signal, input, (request, source) => source === 'action' ? reader.commitSelection('a', request) : reader.setSelection('a', request))
  let next = stream.next()
  try {
    input.send({ kind: 'selection', revision: 1, synchronized: true })
    await vi.waitFor(() => expect(actions.selectionRevision('a')).toBe(1))
    const locate = call('redis_viewer_locate_hash_field', { fieldBase64: 'AP8=' })
    const confirm = await next
    if (confirm.done || confirm.value.kind !== 'action' || confirm.value.request.action.kind !== 'confirmSelection') throw new Error('Missing selection confirmation')
    input.send({ requestId: confirm.value.request.requestId, target, selectionRevision: 1, outcome: 'applied' })
    next = stream.next()
    const action = await next
    if (action.done || action.value.kind !== 'action' || action.value.request.action.kind !== 'selectHashField') throw new Error('Missing Hash field action')
    expect(action.value.request.action).toMatchObject({ keyBase64: 'aw==', field: { base64: 'AP8=' } })
    expect(await sampleActionPoint(connections, actions, 'a', action.value.request.requestId, abort.signal)).toMatchObject({ state: 'value' })
    next = stream.next()
    input.send({ kind: 'commitSelection', requestId: action.value.request.requestId, revision: 1, nextRevision: 2 })
    expect(await next).toMatchObject({ value: { kind: 'selectionResult', accepted: true } })
    expect(actions.selectionRevision('a')).toBeNull()
    next = stream.next()
    input.send({ kind: 'publishSelection', requestId: '12345678-1234-1234-1234-123456789abc', actionRequestId: action.value.request.requestId, revision: 2, request: { target, selection: { keyBase64: 'aw==', item: { kind: 'hash', fieldBase64: 'AP8=' } } } })
    expect(await next).toMatchObject({ value: { kind: 'selectionResult', accepted: true } })
    input.send({ kind: 'selection', revision: 2, synchronized: true })
    const located = await locate
    expect(located.isError).toBeFalsy(); expect(content(located)).toContain('"outcome":"applied"'); expect(content(located)).not.toContain('synthetic-value')
    expect(reader.status('a')).toMatchObject({ currentSelection: { selection: { keyBase64: 'aw==', item: { kind: 'hash', fieldBase64: 'AP8=' } } } })
    await vi.waitFor(() => expect(actions.selectionRevision('a')).toBe(2))
    const value = call('redis_viewer_value', {})
    for (let i = 0; i < 2; i++) {
      next = stream.next()
      const confirmation = await next
      if (confirmation.done || confirmation.value.kind !== 'action' || confirmation.value.request.action.kind !== 'confirmSelection') throw new Error('Missing value confirmation')
      input.send({ requestId: confirmation.value.request.requestId, target, selectionRevision: 2, outcome: 'applied' })
    }
    const read = await value
    expect(read.isError).toBeFalsy(); expect(content(read)).toContain('synthetic-value'); expect(content(read)).toContain('AP8=')
    for (const args of [{}, { field: 'x', fieldBase64: 'eA==' }, { fieldBase64: 'eA=' }, { field: 'x', sessionId: 'other' }]) {
      expect((await call('redis_viewer_locate_hash_field', args)).isError).toBe(true)
    }
    const missing = call('redis_viewer_locate_hash_field', { field: 'missing' })
    next = stream.next()
    const missingConfirmation = await next
    if (missingConfirmation.done || missingConfirmation.value.kind !== 'action' || missingConfirmation.value.request.action.kind !== 'confirmSelection') throw new Error('Missing field confirmation')
    input.send({ requestId: missingConfirmation.value.request.requestId, target, selectionRevision: 2, outcome: 'applied' })
    expect(content(await missing)).toContain('采样时该 Hash 字段不存在')
    expect(commands).not.toContain('HSCAN')
  } finally {
    abort.abort(); input.end(); await stream.next(); reader.dispose(); actions.dispose(); connections.dispose(); await ctx.fiber.dispose(); vi.restoreAllMocks()
  }
})
