import * as NativeToolExecutor from '@deepseek-ai/dsh-tool-executor-native'
import { executeTool } from './tool-test-utils.ts'
import RemoteAccess from '@deepseek-ai/dsh-api-remote-access'
import { ownerPeer } from './gateway-fixture.ts'
import { Context, symbols } from '@deepseek-ai/cordis'
import Gateway from '@deepseek-ai/dsh-api-gateway'
import Registry from '@deepseek-ai/dsh-typert-registry'
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
import { sampleActionPoint } from './action-point-fixture.ts'
import { RedisReplyError } from '../src/host/resp.ts'
import { RedisRemoteService } from '../src/remote-service.ts'
import { TYPERT } from '../src/typert.host.ts'
import { redisHostDescriptors } from '../src/typert.host.ts'
import { actionPointReadResultSchema, uiChannelMessageSchema } from '../src/typert.shared.ts'

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

it('strictly validates Stream point results on both Host and client faces', () => {
  const descriptor = redisHostDescriptors.find(value => value.method === 'readActionPoint')
  if (descriptor?.result.mode !== 'strict') throw new Error('Missing point result codec')
  const prefix = { base64: 'dg==', byteLength: 1, fullByteLength: 1, suffix: '' }
  const repeated = { field: { base64: 'c2FtZQ==', byteLength: 4, label: 'same' }, value: prefix }
  const binary = { field: { base64: 'AP8=', byteLength: 2, label: 'binary' }, value: prefix }
  const empty = { field: { base64: '', byteLength: 0, label: '' }, value: prefix }
  const message = { id: '9-1', fields: [repeated, repeated, binary, empty] }
  const valid = { state: 'value', error: null, cell: prefix, score: null, streamMessage: message, sampledAt: '2026-01-01T00:00:00.000Z' }
  const old: Record<string, unknown> = { ...valid }; Reflect.deleteProperty(old, 'streamMessage')
  const bigField = Buffer.alloc(60000, 97).toString('base64'), bigValue = Buffer.alloc(65536, 98).toString('base64')
  const largePair = { field: { base64: bigField, byteLength: 60000, label: 'large' }, value: { base64: bigValue, byteLength: 65536, fullByteLength: 65536, suffix: '' } }
  const oversized = { ...valid, cell: largePair.value, streamMessage: { id: '9-1', fields: Array.from({ length: 6 }, () => largePair) } }
  expect(Buffer.byteLength(JSON.stringify(oversized))).toBeGreaterThan(1024 * 1024)
  for (const schema of [descriptor.result.create(), actionPointReadResultSchema]) {
    expect(schema.parse(valid)).toEqual(valid)
    for (const invalid of [
      old,
      { ...valid, streamMessage: { ...message, id: '0-0' } },
      { ...valid, streamMessage: { ...message, id: '9-18446744073709551616' } },
      { ...valid, streamMessage: { ...message, fields: [] } },
      { ...valid, streamMessage: { ...message, fields: [{ ...binary, field: { ...binary.field, byteLength: 1 } }] } },
      { ...valid, streamMessage: { ...message, fields: [{ ...repeated, value: { ...prefix, fullByteLength: 0 } }] } },
      { ...valid, state: 'selection-missing', cell: null },
      { ...valid, state: 'failed', cell: null, error: 'permission' },
      { ...valid, score: '1' },
      { ...valid, command: 'XACK' },
      oversized,
    ]) expect(() => schema.parse(invalid)).toThrow()
  }
})

it('locates a precise ordered Stream field through the real tool and Host handshake', async () => {
  const calls: string[] = [], key = Buffer.from('stream')
  let type = 'stream'
  const fields = [Buffer.from('same'), Buffer.from('first-synthetic'), Buffer.from('same'), Buffer.from('second-synthetic'), Buffer.from([0, 255]), Buffer.from('binary-synthetic'), Buffer.alloc(0), Buffer.from('empty-synthetic')]
  const link: RedisLink = { close: () => undefined, onFailure: () => () => undefined, async execute(command, args, signal, guard) {
    signal.throwIfAborted(); guard(); calls.push(command)
    expect(args[0]).toEqual(key)
    if (command === 'TYPE') return type
    if (command === 'PTTL') return -1n
    if (command === 'XLEN') return 1n
    if (command === 'XRANGE') {
      expect(args.slice(2)).toEqual([args[1], 'COUNT', '1'])
      return args[1] === '9-1' ? [[Buffer.from('9-1'), fields]] : []
    }
    throw new Error('Unexpected or non-read synthetic command')
  } }
  const connections = new RedisConnections(async () => link), actions = new UiActionCoordinator<UiAction>()
  const reader = new RedisAiReader(connections, session => actions.invalidateSession(session), async (session, target, expected, signal) => {
    const revision = actions.selectionRevision(session)
    if (revision === null || (expected !== null && revision !== expected)) throw new ConnectionFailure('stale')
    const current = () => actions.selectionRevision(session) === revision
    if (await actions.dispatch(session, { kind: 'confirmSelection' }, target, revision, current, signal) !== 'applied' || !current()) throw new ConnectionFailure('stale')
    return revision
  }, (session, revision) => { const current = actions.selectionRevision(session); return current !== null && (revision === null || revision === current) })
  const ctx = new Context(), abort = new AbortController(), input = uplink()
  vi.spyOn(console, 'info').mockImplementation(() => undefined)
  await ctx.plugin(SystemPrompt); await ctx.plugin(ToolRuntime); await ctx.plugin(NativeToolExecutor)
  await ctx.plugin({ name: 'stream-locate-fixture', inject: ['tools'], apply: (scope: Context) => { registerRedisLocateTool(scope, reader, actions); registerRedisTools(scope, reader) } })
  const agent = { id: 'a', ctx, session: { id: 'a' } } as unknown as Agent
  const call = (name: string, args: unknown) => executeTool(ctx.tools, { callId: 'stream-locate' as string, name, arguments: args, agent, signal: abort.signal })
  const content = (result: Awaited<ReturnType<typeof call>>) => result.content.filter(item => item.type === 'text').map(item => item.text).join('')
  const connection = await connections.connect('a', { host: 'fixture', port: 6379, username: '', password: '', tls: null }, abort.signal)
  if (connection.id === null) throw new Error('Missing connection')
  const target = { id: connection.id, generation: connection.generation, db: 0 }, keyBase64 = key.toString('base64')
  reader.setSelection('a', { target, selection: { keyBase64, item: null } })
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
    for (const sample of [
      { index: 0, fieldBase64: 'c2FtZQ==', text: 'first-synthetic' },
      { index: 1, fieldBase64: 'c2FtZQ==', text: 'second-synthetic' },
      { index: 2, fieldBase64: 'AP8=', text: 'binary-synthetic' },
      { index: 3, fieldBase64: '', text: 'empty-synthetic' },
    ]) {
      const locate = call('redis_viewer_locate_stream_field', { id: '9-1', fieldIndex: sample.index })
      await confirm()
      const frame = await next
      if (frame.done || frame.value.kind !== 'action') throw new Error('Missing Stream field action')
      expect(frame.value.request.action).toMatchObject({ kind: 'selectStreamField', keyBase64, id: '9-1', fieldIndex: sample.index, fieldBase64: sample.fieldBase64 })
      const actionId = frame.value.request.requestId
      expect(await sampleActionPoint(connections, actions, 'other', actionId, abort.signal)).toMatchObject({ state: 'failed', error: 'stale' })
      expect(await sampleActionPoint(connections, actions, 'a', '12345678-1234-1234-1234-123456789abc', abort.signal)).toMatchObject({ state: 'failed', error: 'stale' })
      const point = await sampleActionPoint(connections, actions, 'a', actionId, abort.signal)
      expect(point).toMatchObject({ state: 'value', streamMessage: { id: '9-1', fields: [{ field: { base64: 'c2FtZQ==' } }, { field: { base64: 'c2FtZQ==' } }, { field: { base64: 'AP8=' } }, { field: { base64: '' } }] } })
      next = stream.next(); input.send({ kind: 'commitSelection', requestId: actionId, revision, nextRevision: revision + 1 })
      expect(await next).toMatchObject({ value: { kind: 'selectionResult', accepted: true } })
      revision++; next = stream.next()
      input.send({ kind: 'publishSelection', requestId: '12345678-1234-1234-1234-123456789abc', actionRequestId: actionId, revision, request: { target, selection: { keyBase64, item: { kind: 'stream', id: '9-1', fieldIndex: sample.index, fieldBase64: sample.fieldBase64 } } } })
      expect(await next).toMatchObject({ value: { kind: 'selectionResult', accepted: true } })
      input.send({ kind: 'selection', revision, synchronized: true })
      const located = await locate
      expect(located.isError).toBeFalsy(); expect(content(located)).toContain('"outcome":"applied"')
      await vi.waitFor(() => expect(actions.selectionRevision('a')).toBe(revision))
      const value = call('redis_viewer_value', {})
      next = stream.next(); await confirm(); await confirm()
      const selected = content(await value)
      expect(selected).toContain(sample.text)
      for (const other of ['first-synthetic', 'second-synthetic', 'binary-synthetic', 'empty-synthetic'].filter(text => text !== sample.text)) expect(selected).not.toContain(other)
    }
    for (const args of [{}, { id: '0-0', fieldIndex: 0 }, { id: '1', fieldIndex: 0 }, { id: '9-1', fieldIndex: -1 }, { id: '9-1', fieldIndex: 1.5 }, { id: '9-1', fieldIndex: 4096 }, { id: '9-1', fieldIndex: 0, command: 'XACK' }]) expect((await call('redis_viewer_locate_stream_field', args)).isError).toBe(true)
    const missing = call('redis_viewer_locate_stream_field', { id: '10-1', fieldIndex: 0 })
    await confirm(); expect(content(await missing)).toContain('missing')
    const missingField = call('redis_viewer_locate_stream_field', { id: '9-1', fieldIndex: 4 })
    await confirm(); expect(content(await missingField)).toContain('missing')
    type = 'hash'
    const changed = call('redis_viewer_locate_stream_field', { id: '9-1', fieldIndex: 0 })
    await confirm(); expect(content(await changed)).toContain('changed')
    expect(calls.every(command => ['TYPE', 'PTTL', 'XLEN', 'XRANGE'].includes(command))).toBe(true)
  } finally { abort.abort(); input.end(); await next; reader.dispose(); actions.dispose(); connections.dispose(); await ctx.fiber.dispose(); vi.restoreAllMocks() }
}, 20000)

it.each(['value', 'bypass', 'missing', 'changed', 'oversize', 'cancel', 'stale', 'denied', 'expired', 'reuse'] as const)('gates the Stream field commit after %s through the real Gateway', async mode => {
  let release!: () => void, entered!: () => void
  const blocked = new Promise<void>(resolve => { release = resolve }), waiting = new Promise<void>(resolve => { entered = resolve })
  let hold = false
  const calls: string[] = [], key = Buffer.from('k')
  const field = mode === 'oversize' ? Buffer.alloc(60000, 97) : Buffer.from([0, 255])
  const fields = mode === 'oversize'
    ? Array.from({ length: 6 }, (_, index) => [Buffer.alloc(60000, 97 + index), Buffer.alloc(65536, 98 + index)]).flat()
    : [field, Buffer.from('synthetic-value')]
  const link: RedisLink = { close: () => undefined, onFailure: () => () => undefined, async execute(command, args, signal, guard) {
    if (hold) { entered(); await blocked }
    signal.throwIfAborted(); guard(); calls.push(command); expect(args[0]).toEqual(key)
    if (command === 'TYPE') return 'stream'
    if (command === 'PTTL') return -1n
    if (command === 'XLEN') return 1n
    if (command === 'XRANGE') {
      expect(args).toEqual([key, '9-1', '9-1', 'COUNT', '1'])
      if (mode === 'denied') throw new RedisReplyError('NOPERM synthetic secret')
      return mode === 'missing' ? [] : [[Buffer.from('9-1'), mode === 'changed' ? [Buffer.from('changed'), Buffer.from('value')] : fields]]
    }
    throw new Error('Unexpected or non-read synthetic command')
  } }
  const connections = new RedisConnections(async () => link), ctx = new Context(), abort = new AbortController(), input = uplink()
  ctx.provide('profileContext', { name: 'fixture', dir: '.', patchPath: '', installAnchor: '', cwd: '.', home: '.', startedBundles: [], overlays: [], telemetryDisabledEnv: undefined })
  await ctx.plugin(Registry); await ctx.plugin(RemoteAccess); await ctx.plugin(Gateway, {}); await ctx.plugin(RedisRemoteService)
  ctx.typert.register({ ...TYPERT, face: 'host' })
  const agents = new Map(['a', 'other'].map(id => [id, { session: { id } } as unknown as Agent]))
  ctx.typert.lookups.register('agent', { parameter: 'agent', wire: 'agentId', hostTypeSymbol: '@deepseek-ai/dsh-agent#Agent', wireTypeSymbol: '@deepseek-ai/dsh-session/types#SessionId', resolve: id => agents.get(id) })
  const receiver = ctx.get('redisViewer') as unknown as RedisRemoteService & { [symbols.original]?: RedisRemoteService }, service = receiver[symbols.original] ?? receiver
  Reflect.set(service, 'connections', connections)
  try {
    const connected = await connections.connect('a', { host: 'fixture', port: 6379, username: '', password: '', tls: null }, abort.signal)
    if (connected.id === null) throw new Error('Missing connection')
    const target = { id: connected.id, generation: connected.generation, db: 0 }
    const handle = await ctx.typertGateway.stream({ peer: ownerPeer(ctx), namespace: 'redisViewer', method: 'openUiChannel', args: { agentId: 'a', request: {} }, uplink: input, signal: abort.signal })
    const iterator = handle[Symbol.asyncIterator](), next = iterator.next()
    input.send({ kind: 'selection', revision: 1, synchronized: true })
    await vi.waitFor(() => expect(service.uiActions.selectionRevision('a')).toBe(1))
    const requested = { kind: 'selectStreamField', keyBase64: key.toString('base64'), id: '9-1', fieldIndex: 0, fieldBase64: field.toString('base64') } as unknown as UiAction
    const outcome = service.uiActions.dispatch('a', requested, target, 1, () => true, abort.signal, mode === 'expired' ? 1000 : 10000)
    const received = await next
    if (received.done) throw new Error('Missing action')
    const frame = uiChannelMessageSchema.parse(received.value)
    if (frame.kind !== 'action') throw new Error('Missing action')
    const requestId = frame.request.requestId
    const invoke = (session: string, request: object, signal = new AbortController().signal) => ctx.typertGateway.invoke({ peer: ownerPeer(ctx), namespace: 'redisViewer', method: 'readActionPoint', args: { agentId: session, request }, signal })
    expect(await invoke('other', { requestId })).toMatchObject({ state: 'failed', error: 'stale' })
    expect(await invoke('a', { requestId: '12345678-1234-1234-1234-123456789abc' })).toMatchObject({ state: 'failed', error: 'stale' })
    await expect(invoke('a', { requestId, fieldIndex: 1 })).rejects.toThrow()
    if (mode === 'cancel' || mode === 'stale') {
      hold = true
      const unary = new AbortController(), point = invoke('a', { requestId }, unary.signal)
      await waiting
      expect(await invoke('a', { requestId })).toMatchObject({ state: 'failed', error: 'stale' })
      if (mode === 'cancel') unary.abort()
      else { input.send({ kind: 'selection', revision: 2, synchronized: false }); expect(await outcome).toBe('stale') }
      release()
      expect(await point).toMatchObject({ state: 'failed', error: mode === 'cancel' ? 'cancelled' : 'stale' })
      expect(calls).toEqual([])
    } else if (mode !== 'bypass') {
      const point = await invoke('a', { requestId })
      expect(point).toMatchObject(mode === 'value' || mode === 'expired' || mode === 'reuse' ? { state: 'value', streamMessage: { id: '9-1' } } : mode === 'oversize' ? { state: 'failed', error: 'oversize' } : mode === 'denied' ? { state: 'failed', error: 'permission' } : { state: mode === 'missing' ? 'selection-missing' : 'changed' })
      expect(JSON.stringify(point)).not.toContain('synthetic secret')
    }
    if (mode === 'reuse' || mode === 'expired') {
      if (mode === 'reuse') service.uiActions.invalidateSession('a')
      expect(await outcome).toBe(mode === 'reuse' ? 'stale' : 'timeout')
      expect(await iterator.next()).toMatchObject({ value: { kind: 'cancel', requestId } })
      let commitId = requestId
      let laterOutcome: Promise<string> | undefined
      if (mode === 'reuse') {
        const nextAction = iterator.next()
        laterOutcome = service.uiActions.dispatch('a', requested, target, 1, () => true, abort.signal)
        const later = await nextAction
        if (later.done) throw new Error('Missing later action')
        const laterFrame = uiChannelMessageSchema.parse(later.value)
        if (laterFrame.kind !== 'action') throw new Error('Missing later action')
        commitId = laterFrame.request.requestId
        expect(commitId).not.toBe(requestId)
      }
      const reply = iterator.next()
      input.send({ kind: 'commitSelection', requestId: commitId, revision: 1, nextRevision: 2 })
      expect(await reply).toMatchObject({ value: { kind: 'selectionResult', accepted: false } })
      if (laterOutcome !== undefined) expect(await laterOutcome).toBe('stale')
    } else if (mode !== 'stale') {
      const reply = iterator.next()
      input.send({ kind: 'commitSelection', requestId, revision: 1, nextRevision: 2 })
      expect(await reply).toMatchObject({ value: { kind: 'selectionResult', accepted: mode === 'value' } })
      if (mode !== 'value') expect(await outcome).toBe('stale')
    }
    expect(calls.every(command => ['TYPE', 'PTTL', 'XLEN', 'XRANGE'].includes(command))).toBe(true)
  } finally { release(); abort.abort(); input.end(); connections.dispose(); await ctx.fiber.dispose() }
}, 15000)
