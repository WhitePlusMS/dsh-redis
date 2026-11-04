import RemoteAccess from '@deepseek-ai/dsh-api-remote-access'
import { ownerPeer } from './gateway-fixture.ts'
import { Context, symbols } from '@deepseek-ai/cordis'
import Gateway from '@deepseek-ai/dsh-api-gateway'
import Registry from '@deepseek-ai/dsh-typert-registry'
import type { Agent } from '@deepseek-ai/dsh-agent'
import { expect, it, vi } from 'vitest'
import type { UiAction, UiChannelInput } from '../src/domain.ts'
import { RedisConnections, type RedisLink } from '../src/host/connection-service.ts'
import { RedisLists } from '../src/host/list-reader.ts'
import { RedisReplyError } from '../src/host/resp.ts'
import { RedisRemoteService } from '../src/remote-service.ts'
import { TYPERT } from '../src/typert.host.ts'
import { uiChannelMessageSchema } from '../src/typert.shared.ts'

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(done => { resolve = done })
  return { promise, resolve }
}

for (const kind of ['hash', 'list', 'set', 'zset'] as const) it.each(['value', 'cancel', 'stale', 'bypass', 'missing', 'denied', 'reuse', 'expired'] as const)(`guards a %s point read for ${kind}`, async mode => {
  const ctx = new Context(), commands: string[] = []
  let entered = deferred<void>(), release = deferred<void>()
  let blocked = false
  const link: RedisLink = { close: () => undefined, onFailure: () => () => undefined, async execute(command, args, signal, guard) {
    if (blocked) { entered.resolve(); await release.promise }
    signal.throwIfAborted(); guard(); commands.push(command)
    if (mode === 'denied' && ['HGET', 'LRANGE', 'SISMEMBER', 'ZSCORE'].includes(command)) throw new RedisReplyError('NOPERM fixture')
    if (command === 'TYPE') return kind
    if (command === 'SISMEMBER') return mode === 'missing' ? 0n : 1n
    if (command === 'ZSCORE') { expect(args).toEqual([Buffer.from('k'), Buffer.from('m')]); return mode === 'missing' ? null : Buffer.from('1.2345678901234567e+20') }
    if (command === 'PTTL') return -1n
    if (command === 'HGET') return mode === 'missing' ? null : Buffer.from('v')
    if (command === 'LLEN') return 2n
    if (command === 'LRANGE') return mode === 'missing' ? [] : [Buffer.from('v')]
    throw new Error('Unexpected synthetic command')
  } }
  const connections = new RedisConnections(async () => link)
  ctx.provide('profileContext', { name: 'fixture', dir: '.', patchPath: '', installAnchor: '', cwd: '.', home: '.', startedBundles: [], overlays: [], telemetryDisabledEnv: undefined })
  await ctx.plugin(Registry); await ctx.plugin(RemoteAccess); await ctx.plugin(Gateway, {}); await ctx.plugin(RedisRemoteService)
  ctx.typert.register({ ...TYPERT, face: 'host' })
  const agents = new Map(['fixture-session', 'other-session'].map(id => [id, { session: { id } } as unknown as Agent]))
  ctx.typert.lookups.register('agent', { parameter: 'agent', wire: 'agentId', hostTypeSymbol: '@deepseek-ai/dsh-agent#Agent', wireTypeSymbol: '@deepseek-ai/dsh-session/types#SessionId', resolve: id => agents.get(id) })
  const receiver = ctx.get('redisViewer') as unknown as RedisRemoteService & { [symbols.original]?: RedisRemoteService }, service = receiver[symbols.original] ?? receiver
  Reflect.set(service, 'connections', connections)
  Reflect.set(service, 'lists', new RedisLists(connections))
  const queue: UiChannelInput[] = []
  let wake: (() => void) | undefined, ended = false
  const notify = () => { const pending = wake; wake = undefined; pending?.() }
  const uplink: AsyncIterable<UiChannelInput> = { async *[Symbol.asyncIterator]() { while (!ended) { const value = queue.shift(); if (value !== undefined) { yield value; continue } await new Promise<void>(resolve => { wake = resolve; if (ended || queue.length > 0) notify() }) } } }
  const send = (value: UiChannelInput) => { queue.push(value); notify() }
  const controller = new AbortController()
  try {
    const connection = await connections.connect('fixture-session', { host: 'fixture', port: 6379, username: '', password: '', tls: null }, controller.signal)
    if (connection.id === null) throw new Error('Missing fixture connection')
    const target = { id: connection.id, generation: connection.generation, db: 0 }, member = { base64: 'bQ==', byteLength: 1, label: 'm' }
    const stream = await ctx.typertGateway.stream({ peer: ownerPeer(ctx), namespace: 'redisViewer', method: 'openUiChannel', args: { agentId: 'fixture-session', request: {} }, uplink, signal: controller.signal })
    const iterator = stream[Symbol.asyncIterator](), next = iterator.next()
    send({ kind: 'selection', revision: 1, synchronized: true })
    await vi.waitFor(() => expect(service.uiActions.selectionRevision('fixture-session')).toBe(1))
    const requested: UiAction = kind === 'hash' ? { kind: 'selectHashField', keyBase64: 'aw==', field: member } : kind === 'list' ? { kind: 'selectListIndex', keyBase64: 'aw==', index: '1' } : kind === 'set' ? { kind: 'selectSetMember', keyBase64: 'aw==', member } : { kind: 'selectZSetMember', keyBase64: 'aw==', member }
    const outcome = service.uiActions.dispatch('fixture-session', requested, target, 1, () => true, controller.signal, mode === 'expired' ? 1000 : 10000)
    const frame = await next
    if (frame.done) throw new Error('Missing fixture action')
    const action = uiChannelMessageSchema.parse(frame.value)
    if (action.kind !== 'action') throw new Error('Missing fixture action')
    const invoke = (agentId: string, request: object) => ctx.typertGateway.invoke({ peer: ownerPeer(ctx), namespace: 'redisViewer', method: 'readActionPoint', args: { agentId, request }, signal: new AbortController().signal })
    expect(await invoke('other-session', { requestId: action.request.requestId })).toMatchObject({ state: 'failed', error: 'stale' })
    expect(await invoke('fixture-session', { requestId: '12345678-1234-1234-1234-123456789abc' })).toMatchObject({ state: 'failed', error: 'stale' })
    await expect(invoke('fixture-session', { requestId: action.request.requestId, keyBase64: 'forged' })).rejects.toThrow()
    if (mode === 'bypass') {
      // Attempting commit without the bound point read must be rejected.
    } else if (mode === 'missing' || mode === 'denied') {
      expect(await invoke('fixture-session', { requestId: action.request.requestId })).not.toMatchObject({ state: 'value' })
    } else if (mode === 'value' || mode === 'reuse' || mode === 'expired') {
      expect(await invoke('fixture-session', { requestId: action.request.requestId })).toMatchObject({ state: 'value', cell: { base64: kind === 'set' || kind === 'zset' ? 'bQ==' : 'dg==' }, score: kind === 'zset' ? '1.2345678901234567e+20' : null })
      expect(commands).toContain(kind === 'zset' ? 'ZSCORE' : kind === 'set' ? 'SISMEMBER' : kind === 'hash' ? 'HGET' : 'LRANGE')
    } else {
      blocked = true
      const unary = new AbortController()
      const point = ctx.typertGateway.invoke({ peer: ownerPeer(ctx), namespace: 'redisViewer', method: 'readActionPoint', args: { agentId: 'fixture-session', request: { requestId: action.request.requestId } }, signal: unary.signal })
      await entered.promise
      // Repeated and concurrent calls cannot acquire the same action sample.
      expect(await invoke('fixture-session', { requestId: action.request.requestId })).toMatchObject({ state: 'failed', error: 'stale' })
      if (mode === 'cancel') unary.abort()
      else { send({ kind: 'selection', revision: 2, synchronized: false }); expect(await outcome).toBe('stale') }
      release.resolve()
      expect(await point).toMatchObject({ state: 'failed', error: mode === 'cancel' ? 'cancelled' : 'stale' })
      expect(commands).toEqual([])
    }
    if (mode === 'bypass' || mode === 'missing' || mode === 'cancel' || mode === 'denied') {
      const reply = iterator.next()
      send({ kind: 'commitSelection', requestId: action.request.requestId, revision: 1, nextRevision: 2 })
      expect(await reply).toMatchObject({ value: { kind: 'selectionResult', accepted: false } })
      expect(await outcome).toBe('stale')
      const publication = iterator.next()
      send({ kind: 'publishSelection', requestId: '12345678-1234-1234-1234-123456789abc', actionRequestId: action.request.requestId, revision: 2, request: { target, selection: { keyBase64: 'aw==', item: null } } })
      expect(await publication).toMatchObject({ value: { kind: 'selectionResult', accepted: false } })
    } else if (mode === 'reuse' || mode === 'expired') {
      // A successful sample belongs only to this still-current, unexpired action.
      if (mode === 'reuse') service.uiActions.invalidateSession('fixture-session')
      expect(await outcome).toBe(mode === 'reuse' ? 'stale' : 'timeout')
      expect(await iterator.next()).toMatchObject({ value: { kind: 'cancel', requestId: action.request.requestId } })
      let commitId = action.request.requestId
      if (mode === 'reuse') {
        const nextAction = iterator.next()
        const laterOutcome = service.uiActions.dispatch('fixture-session', requested, target, 1, () => true, controller.signal)
        const later = await nextAction
        if (later.done) throw new Error('Missing subsequent fixture action')
        const laterFrame = uiChannelMessageSchema.parse(later.value)
        if (laterFrame.kind !== 'action') throw new Error('Missing subsequent fixture action')
        commitId = laterFrame.request.requestId
        expect(commitId).not.toBe(action.request.requestId)
        const reply = iterator.next()
        send({ kind: 'commitSelection', requestId: commitId, revision: 1, nextRevision: 2 })
        expect(await reply).toMatchObject({ value: { kind: 'selectionResult', accepted: false } })
        expect(await laterOutcome).toBe('stale')
      } else {
        const reply = iterator.next()
        send({ kind: 'commitSelection', requestId: commitId, revision: 1, nextRevision: 2 })
        expect(await reply).toMatchObject({ value: { kind: 'selectionResult', accepted: false } })
      }
    } else if (mode === 'value') {
      const reply = iterator.next()
      send({ kind: 'commitSelection', requestId: action.request.requestId, revision: 1, nextRevision: 2 })
      expect(await reply).toMatchObject({ value: { kind: 'selectionResult', accepted: true } })
    }
    expect(await invoke('fixture-session', { requestId: action.request.requestId })).toMatchObject({ state: 'failed', error: 'stale' })
    if (kind === 'list' && mode !== 'missing' && mode !== 'denied') {
      const page = await ctx.typertGateway.invoke({ peer: ownerPeer(ctx), namespace: 'redisViewer', method: 'readList', args: { agentId: 'fixture-session', request: { target, keyBase64: 'aw==', offset: '1', count: 1 } }, signal: controller.signal })
      expect(page).toMatchObject({ state: 'page', entries: [{ index: '1', value: { base64: 'dg==' } }] })
    }
  } finally { release.resolve(); ended = true; notify(); controller.abort(); connections.dispose(); await ctx.fiber.dispose() }
}, 15000)
