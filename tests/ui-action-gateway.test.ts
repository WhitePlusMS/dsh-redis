import RemoteAccess from '@deepseek-ai/dsh-api-remote-access'
import { ownerPeer } from './gateway-fixture.ts'
import { Context, symbols } from '@deepseek-ai/cordis'
import Gateway from '@deepseek-ai/dsh-api-gateway'
import Registry from '@deepseek-ai/dsh-typert-registry'
import type { Agent } from '@deepseek-ai/dsh-agent'
import { expect, it, vi } from 'vitest'
import type { UiActionAck, UiChannelInput } from '../src/domain.ts'
import { RedisRemoteService } from '../src/remote-service.ts'
import { RedisConnections } from '../src/host/connection-service.ts'
import { TYPERT } from '../src/typert.host.ts'
import { uiChannelMessageSchema } from '../src/typert.shared.ts'

it('rejects inconsistent connection results at the real Host Gateway encoder', async () => {
  const ctx = new Context()
  ctx.provide('profileContext', { name: 'fixture', dir: '.', patchPath: '', installAnchor: '', cwd: '.', home: '.', startedBundles: [], overlays: [], telemetryDisabledEnv: undefined })
  await ctx.plugin(Registry); await ctx.plugin(RemoteAccess); await ctx.plugin(Gateway, {}); await ctx.plugin(RedisRemoteService)
  ctx.typert.register(TYPERT)
  const agent = { session: { id: 'fixture-session' } } as unknown as Agent
  ctx.typert.lookups.register('agent', { parameter: 'agent', wire: 'agentId', hostTypeSymbol: '@deepseek-ai/dsh-agent#Agent', wireTypeSymbol: '@deepseek-ai/dsh-session/types#SessionId', resolve: () => agent })
  const signal = new AbortController().signal
  // Exercise the registered wire entry rather than Gateway.invoke(), which
  // deliberately returns the unencoded business value.
  const gateway = ctx.typertGateway
  const call = () => Reflect.apply(Reflect.get(gateway, 'dispatchRpc'), gateway, ['redisViewer/connectionStatus', { args: { agentId: 'fixture-session', request: {} } }, signal, ownerPeer(ctx)])
  const valid = { id: null, generation: 0, db: 0, target: null, state: 'disconnected', error: null } as const
  const status = vi.spyOn(RedisConnections.prototype, 'status')
  try {
    expect(await call()).toEqual({ ok: true, value: valid })
    status.mockReturnValueOnce({ ...valid, state: 'connected', error: 'auth' })
    expect(await call()).toMatchObject({ ok: false, error: { code: 'gateway/internal' } })
    expect(await call()).toEqual({ ok: true, value: valid })
  } finally { status.mockRestore(); await ctx.fiber.dispose() }
})

it('routes an action and its acknowledgement through the real Host Gateway', async () => {
  const ctx = new Context()
  const profile = { name: 'fixture', dir: '.', patchPath: '', installAnchor: '', cwd: '.', home: '.', startedBundles: [], overlays: [], telemetryDisabledEnv: undefined }
  ctx.provide('profileContext', profile)
  await ctx.plugin(Registry)
  await ctx.plugin(RemoteAccess); await ctx.plugin(Gateway, {})
  await ctx.plugin(RedisRemoteService)
  ctx.typert.register({ ...TYPERT, face: 'host' })
  const agent = { session: { id: 'fixture-session' } } as unknown as Agent
  ctx.typert.lookups.register('agent', {
    parameter: 'agent', wire: 'agentId', hostTypeSymbol: '@deepseek-ai/dsh-agent#Agent',
    wireTypeSymbol: '@deepseek-ai/dsh-session/types#SessionId',
    resolve: id => id === 'fixture-session' ? agent : undefined,
  })
  const receiver = ctx.get('redisViewer') as unknown as RedisRemoteService & { [symbols.original]?: RedisRemoteService }
  const service = receiver[symbols.original] ?? receiver
  const registered = vi.spyOn(service.uiActions, 'register')
  const publish = vi.spyOn(service.ai, 'setSelection').mockReturnValue({ accepted: true })
  const selection = { target: { id: 'fixture', generation: 1, db: 0 }, selection: null }
  const selectionId = '12345678-1234-1234-1234-123456789abc'
  let deliver: ((ack: UiActionAck) => void) | undefined
  const uplink: AsyncIterable<UiChannelInput> = { async *[Symbol.asyncIterator]() {
    yield { kind: 'selection', revision: 3, synchronized: false }
    yield { kind: 'publishSelection', revision: 3, requestId: selectionId, request: selection }
    yield { kind: 'selection', revision: 3, synchronized: true }
    yield await new Promise<UiActionAck>(resolve => { deliver = resolve })
  } }
  const controller = new AbortController()
  try {
    const stream = await ctx.typertGateway.stream({ peer: ownerPeer(ctx), namespace: 'redisViewer', method: 'openUiChannel', args: { agentId: 'fixture-session', request: {} }, uplink, signal: controller.signal })
    const iterator = stream[Symbol.asyncIterator](), first = iterator.next()
    await vi.waitFor(() => expect(registered).toHaveBeenCalledOnce())
    expect(await first).toEqual({ done: false, value: { kind: 'selectionResult', requestId: selectionId, accepted: true } })
    expect(publish).toHaveBeenCalledExactlyOnceWith('fixture-session', selection)
    await vi.waitFor(() => expect(service.uiActions.selectionRevision('fixture-session')).toBe(3))
    expect(await service.uiActions.dispatch('other-session', { kind: 'show' }, null, 0, () => true, controller.signal)).toBe('no_receiver')
    const next = iterator.next()
    const outcome = service.uiActions.dispatch('fixture-session', { kind: 'show' }, null, 0, () => true, controller.signal)
    const frame = await next
    if (frame.done) throw new Error('Gateway stream ended before the action')
    const message = uiChannelMessageSchema.parse(frame.value)
    if (message.kind !== 'action' || deliver === undefined) throw new Error('Gateway action or uplink missing')
    deliver({ requestId: message.request.requestId, target: null, selectionRevision: 0, outcome: 'unsupported' })
    expect(await outcome).toBe('unsupported')
  } finally {
    controller.abort()
    await ctx.fiber.dispose()
  }
})

it('commits a Key selection through the real Gateway stream before acknowledging the action', async () => {
  const ctx = new Context()
  const profile = { name: 'fixture', dir: '.', patchPath: '', installAnchor: '', cwd: '.', home: '.', startedBundles: [], overlays: [], telemetryDisabledEnv: undefined }
  ctx.provide('profileContext', profile)
  await ctx.plugin(Registry); await ctx.plugin(RemoteAccess); await ctx.plugin(Gateway, {}); await ctx.plugin(RedisRemoteService)
  ctx.typert.register({ ...TYPERT, face: 'host' })
  const agent = { session: { id: 'fixture-session' } } as unknown as Agent
  ctx.typert.lookups.register('agent', { parameter: 'agent', wire: 'agentId', hostTypeSymbol: '@deepseek-ai/dsh-agent#Agent', wireTypeSymbol: '@deepseek-ai/dsh-session/types#SessionId', resolve: id => id === 'fixture-session' ? agent : undefined })
  const receiver = ctx.get('redisViewer') as unknown as RedisRemoteService & { [symbols.original]?: RedisRemoteService }, service = receiver[symbols.original] ?? receiver
  const commit = vi.spyOn(service.ai, 'commitSelection').mockReturnValue({ accepted: true })
  vi.spyOn(service.ai, 'setSelection').mockReturnValue({ accepted: true })
  const queue: UiChannelInput[] = []
  let wake: (() => void) | undefined, ended = false
  const notify = () => { const pending = wake; wake = undefined; pending?.() }
  const uplink: AsyncIterable<UiChannelInput> = { async *[Symbol.asyncIterator]() { while (!ended) { const value = queue.shift(); if (value !== undefined) { yield value; continue } await new Promise<void>(resolve => { wake = resolve; if (ended || queue.length > 0) notify() }) } } }
  const send = (value: UiChannelInput) => { queue.push(value); notify() }
  const controller = new AbortController(), target = { id: 'fixture', generation: 1, db: 0 }, key = { base64: 'AP8=', byteLength: 2, label: '0x00ff' }
  try {
    const stream = await ctx.typertGateway.stream({ peer: ownerPeer(ctx), namespace: 'redisViewer', method: 'openUiChannel', args: { agentId: 'fixture-session', request: {} }, uplink, signal: controller.signal })
    const iterator = stream[Symbol.asyncIterator](), next = iterator.next()
    send({ kind: 'selection', revision: 4, synchronized: true })
    await vi.waitFor(() => expect(service.uiActions.selectionRevision('fixture-session')).toBe(4))
    const result = service.uiActions.dispatch('fixture-session', { kind: 'selectKey', key }, target, 4, () => true, controller.signal)
    const frame = await next
    if (frame.done) throw new Error('Gateway stream ended')
    const action = uiChannelMessageSchema.parse(frame.value)
    if (action.kind !== 'action') throw new Error('Missing Key action')
    const response = iterator.next()
    send({ kind: 'commitSelection', requestId: action.request.requestId, revision: 4, nextRevision: 5 })
    const committed = await response
    if (committed.done) throw new Error('Missing commit result')
    expect(uiChannelMessageSchema.parse(committed.value)).toEqual({ kind: 'selectionResult', requestId: action.request.requestId, accepted: true })
    expect(commit).not.toHaveBeenCalled()
    expect(service.uiActions.selectionRevision('fixture-session')).toBeNull()
    const published = iterator.next()
    send({ kind: 'publishSelection', requestId: '12345678-1234-1234-1234-123456789abc', actionRequestId: action.request.requestId, revision: 5, request: { target, selection: { keyBase64: 'AP8=', item: null } } })
    expect(await published).toMatchObject({ value: { kind: 'selectionResult', accepted: true } })
    expect(commit).toHaveBeenCalledExactlyOnceWith('fixture-session', { target, selection: { keyBase64: 'AP8=', item: null } })
    send({ kind: 'selection', revision: 5, synchronized: true })
    expect(await result).toBe('applied')
    await vi.waitFor(() => expect(service.uiActions.selectionRevision('fixture-session')).toBe(5))
  } finally {
    ended = true; notify(); controller.abort(); await ctx.fiber.dispose()
  }
})
