import { describe, expect, it, vi } from 'vitest'
import { UiActionCoordinator } from '../src/host/ui-action-coordinator.ts'
import { openUiActionChannel as openChannel } from '../src/host/ui-action-channel.ts'
import type { UiAction, UiChannelInput } from '../src/domain.ts'
import { RedisConnections, type RedisLink } from '../src/host/connection-service.ts'
import { sampleActionPoint } from './action-point-fixture.ts'

function uplink() {
  const values: UiChannelInput[] = []
  let wake: (() => void) | null = null, ended = false
  const notify = () => { const current = wake; wake = null; current?.() }
  return {
    send(value: UiChannelInput) { values.push(value); notify() },
    end() { ended = true; notify() },
    async *[Symbol.asyncIterator]() {
      while (!ended || values.length > 0) {
        const value = values.shift()
        if (value !== undefined) { yield value; continue }
        await new Promise<void>(resolve => { wake = resolve; if (ended || values.length > 0) notify() })
      }
    },
  }
}
const dispatch = (coordinator: UiActionCoordinator<UiAction>, session: string, signal = new AbortController().signal) => coordinator.dispatch(session, { kind: 'show' }, null, 0, () => true, signal)
const openUiActionChannel = (coordinator: UiActionCoordinator<UiAction>, session: string, signal: AbortSignal, input: AsyncIterable<UiChannelInput>) => openChannel(coordinator, session, signal, input, () => ({ accepted: true }))

describe('UI action stream channel', () => {
  it('only completes after the matching acknowledgement on its own uplink', async () => {
    const coordinator = new UiActionCoordinator<UiAction>(), input = uplink(), signal = new AbortController()
    const stream = openUiActionChannel(coordinator, 'a', signal.signal, input), next = stream.next()
    const result = dispatch(coordinator, 'a'), frame = await next
    if (frame.done || frame.value.kind !== 'action') throw new Error('Missing action')
    const request = frame.value.request
    input.send({ requestId: '12345678-1234-1234-1234-123456789abc', target: null, selectionRevision: 0, outcome: 'applied' })
    await Promise.resolve()
    input.send({ requestId: request.requestId, target: null, selectionRevision: 0, outcome: 'applied' })
    expect(await result).toBe('applied')
    signal.abort(); input.end(); expect((await stream.next()).done).toBe(true)
  })
  it('sends cancellation after delivery and ignores a late acknowledgement', async () => {
    const coordinator = new UiActionCoordinator<UiAction>(), input = uplink(), signal = new AbortController(), requestSignal = new AbortController()
    const stream = openUiActionChannel(coordinator, 'a', signal.signal, input), next = stream.next()
    const result = dispatch(coordinator, 'a', requestSignal.signal), frame = await next
    if (frame.done || frame.value.kind !== 'action') throw new Error('Missing action')
    requestSignal.abort(); expect(await result).toBe('cancelled')
    input.send({ requestId: frame.value.request.requestId, target: null, selectionRevision: 0, outcome: 'applied' })
    expect(await stream.next()).toEqual({ done: false, value: { kind: 'cancel', requestId: frame.value.request.requestId } })
    signal.abort(); input.end(); expect((await stream.next()).done).toBe(true)
  })
  it('unregisters on uplink end and prevents cross-session or ambiguous delivery', async () => {
    const coordinator = new UiActionCoordinator<UiAction>(), a = uplink(), b = uplink(), abort = new AbortController()
    const first = openUiActionChannel(coordinator, 'a', abort.signal, a), second = openUiActionChannel(coordinator, 'a', abort.signal, b)
    const waiting = first.next(), other = second.next()
    expect(await dispatch(coordinator, 'a')).toBe('ambiguous')
    expect(await dispatch(coordinator, 'b')).toBe('no_receiver')
    b.end(); expect((await other).done).toBe(true)
    const result = dispatch(coordinator, 'a'), frame = await waiting
    if (frame.done || frame.value.kind !== 'action') throw new Error('Missing action')
    a.end(); expect(await result).toBe('disconnected')
    expect((await first.next()).done).toBe(true)
    await vi.waitFor(async () => expect(await dispatch(coordinator, 'a')).toBe('no_receiver'))
  })
  it('closes without waiting for an unresponsive uplink iterator', async () => {
    const coordinator = new UiActionCoordinator<UiAction>(), abort = new AbortController()
    const returned = vi.fn(async () => ({ done: true as const, value: undefined }))
    const input: AsyncIterable<UiChannelInput> = { [Symbol.asyncIterator]: () => ({ next: () => new Promise(() => undefined), return: returned }) }
    const stream = openUiActionChannel(coordinator, 'a', abort.signal, input), waiting = stream.next()
    abort.abort(); expect((await waiting).done).toBe(true)
    expect(returned).toHaveBeenCalledOnce()
    expect(await dispatch(coordinator, 'a')).toBe('no_receiver')
  })
  it('exposes only the unique synchronized stream revision and cancels an older target action', async () => {
    const coordinator = new UiActionCoordinator<UiAction>(), input = uplink(), abort = new AbortController()
    const stream = openUiActionChannel(coordinator, 'a', abort.signal, input), waiting = stream.next()
    expect(coordinator.selectionRevision('a')).toBeNull()
    input.send({ kind: 'selection', revision: 7, synchronized: true })
    await vi.waitFor(() => expect(coordinator.selectionRevision('a')).toBe(7))
    const target = { id: 'fixture', generation: 1, db: 0 }
    const result = coordinator.dispatch('a', { kind: 'confirmSelection' }, target, 7, () => true, abort.signal)
    const frame = await waiting
    if (frame.done || frame.value.kind !== 'action') throw new Error('Missing action')
    input.send({ kind: 'selection', revision: 8, synchronized: false })
    expect(await result).toBe('stale')
    expect(coordinator.selectionRevision('a')).toBeNull()
    expect(await stream.next()).toEqual({ done: false, value: { kind: 'cancel', requestId: frame.value.request.requestId } })
    input.send({ kind: 'selection', revision: 8, synchronized: true })
    await vi.waitFor(() => expect(coordinator.selectionRevision('a')).toBe(8))
    abort.abort(); input.end(); expect((await stream.next()).done).toBe(true)
    expect(coordinator.selectionRevision('a')).toBeNull()
  })
  it('accepts selection publications only from the unique live session stream', async () => {
    const coordinator = new UiActionCoordinator<UiAction>(), a = uplink(), b = uplink(), abort = new AbortController()
    const publish = vi.fn(() => ({ accepted: true }))
    const first = openChannel(coordinator, 'a', abort.signal, a, publish), second = openChannel(coordinator, 'a', abort.signal, b, publish)
    const firstFrame = first.next(), secondFrame = second.next()
    a.send({ kind: 'selection', revision: 1, synchronized: false })
    b.send({ kind: 'selection', revision: 1, synchronized: false })
    const request = { target: { id: 'fixture', generation: 1, db: 0 }, selection: null }
    const id = '12345678-1234-1234-1234-123456789abc'
    a.send({ kind: 'publishSelection', requestId: id, revision: 1, request })
    expect(await firstFrame).toEqual({ done: false, value: { kind: 'selectionResult', requestId: id, accepted: false } })
    expect(publish).not.toHaveBeenCalled()
    b.end(); expect((await secondFrame).done).toBe(true)
    const next = first.next()
    a.send({ kind: 'publishSelection', requestId: id, revision: 1, request })
    expect(await next).toEqual({ done: false, value: { kind: 'selectionResult', requestId: id, accepted: true } })
    expect(publish).toHaveBeenCalledExactlyOnceWith(request, 'manual')
    const stale = first.next()
    a.send({ kind: 'selection', revision: 2, synchronized: false })
    a.send({ kind: 'publishSelection', requestId: id, revision: 1, request })
    expect(await stale).toEqual({ done: false, value: { kind: 'selectionResult', requestId: id, accepted: false } })
    expect(publish).toHaveBeenCalledTimes(1)
    abort.abort(); a.end(); expect((await first.next()).done).toBe(true)
  })
  it('atomically commits only the pending Key action and keeps the new selection unconfirmed until the client synchronizes', async () => {
    const coordinator = new UiActionCoordinator<UiAction>(), input = uplink(), abort = new AbortController()
    const publish = vi.fn(() => ({ accepted: true }))
    const stream = openChannel(coordinator, 'a', abort.signal, input, publish), first = stream.next()
    const target = { id: 'fixture', generation: 1, db: 0 }, key = { base64: 'YQ==', byteLength: 1, label: '"a"' }
    input.send({ kind: 'selection', revision: 3, synchronized: true })
    await vi.waitFor(() => expect(coordinator.selectionRevision('a')).toBe(3))
    const result = coordinator.dispatch('a', { kind: 'selectKey', key }, target, 3, () => true, abort.signal)
    const action = await first
    if (action.done || action.value.kind !== 'action') throw new Error('Missing Key action')
    const id = action.value.request.requestId
    const refused = stream.next()
    const unrelated = '12345678-1234-1234-1234-123456789abc'
    input.send({ kind: 'commitSelection', requestId: unrelated, revision: 3, nextRevision: 5 })
    expect(await refused).toEqual({ done: false, value: { kind: 'selectionResult', requestId: unrelated, accepted: false } })
    expect(publish).not.toHaveBeenCalled()
    const committed = stream.next()
    input.send({ kind: 'commitSelection', requestId: id, revision: 3, nextRevision: 4 })
    expect(await committed).toEqual({ done: false, value: { kind: 'selectionResult', requestId: id, accepted: true } })
    expect(publish).not.toHaveBeenCalled()
    expect(coordinator.selectionRevision('a')).toBeNull()
    const publication = stream.next()
    input.send({ kind: 'publishSelection', requestId: unrelated, actionRequestId: id, revision: 4, request: { target, selection: { keyBase64: key.base64, item: null } } })
    expect(await publication).toMatchObject({ value: { kind: 'selectionResult', accepted: true } })
    expect(publish).toHaveBeenCalledExactlyOnceWith({ target, selection: { keyBase64: key.base64, item: null } }, 'action')
    input.send({ kind: 'selection', revision: 4, synchronized: true })
    expect(await result).toBe('applied')
    await vi.waitFor(() => expect(coordinator.selectionRevision('a')).toBe(4))
    abort.abort(); input.end(); expect((await stream.next()).done).toBe(true)
  })
  it('ends a rejected matching commit immediately and hides the former synchronized revision', async () => {
    const coordinator = new UiActionCoordinator<UiAction>(), input = uplink(), abort = new AbortController()
    const publish = vi.fn(() => ({ accepted: false }))
    let current = true
    const stream = openChannel(coordinator, 'a', abort.signal, input, publish), first = stream.next()
    const target = { id: 'fixture', generation: 1, db: 0 }, key = { base64: 'YQ==', byteLength: 1, label: '"a"' }
    input.send({ kind: 'selection', revision: 1, synchronized: true })
    await vi.waitFor(() => expect(coordinator.selectionRevision('a')).toBe(1))
    const result = coordinator.dispatch('a', { kind: 'selectKey', key }, target, 1, () => current, abort.signal)
    const action = await first
    if (action.done || action.value.kind !== 'action') throw new Error('Missing Key action')
    const next = stream.next(), id = action.value.request.requestId
    current = false
    input.send({ kind: 'commitSelection', requestId: id, revision: 1, nextRevision: 2 })
    expect(await next).toEqual({ done: false, value: { kind: 'selectionResult', requestId: id, accepted: false } })
    expect(await result).toBe('stale')
    expect(coordinator.selectionRevision('a')).toBeNull()
    // No selection-state uplink follows the refusal. Another action must not remain busy.
    const waiting = stream.next(), show = dispatch(coordinator, 'a'), frame = await waiting
    if (frame.done || frame.value.kind !== 'action') throw new Error('Receiver remained busy')
    input.send({ requestId: frame.value.request.requestId, target: null, selectionRevision: 0, outcome: 'applied' })
    expect(await show).toBe('applied')
    abort.abort(); input.end(); expect((await stream.next()).done).toBe(true)
  })
  it('commits only the Hash field identity held by the Host pending action', async () => {
    const coordinator = new UiActionCoordinator<UiAction>(), input = uplink(), abort = new AbortController()
    const link: RedisLink = { close: () => undefined, onFailure: () => () => undefined, async execute(command, _args, signal, guard) { signal.throwIfAborted(); guard(); if (command === 'TYPE') return 'hash'; if (command === 'HGET') return Buffer.from('value'); if (command === 'PTTL') return -1n; throw new Error('Unexpected command') } }
    const connections = new RedisConnections(async () => link), connected = await connections.connect('a', { host: 'fixture', port: 6379, username: '', password: '', tls: null }, abort.signal)
    if (connected.id === null) throw new Error('Missing fixture connection')
    const publish = vi.fn(() => ({ accepted: true }))
    const stream = openChannel(coordinator, 'a', abort.signal, input, publish), first = stream.next()
    const target = { id: connected.id, generation: connected.generation, db: 0 }, field = { base64: 'AP8=', byteLength: 2, label: 'binary' }
    input.send({ kind: 'selection', revision: 2, synchronized: true })
    await vi.waitFor(() => expect(coordinator.selectionRevision('a')).toBe(2))
    const result = coordinator.dispatch('a', { kind: 'selectHashField', keyBase64: 'aw==', field }, target, 2, () => true, abort.signal)
    const action = await first
    if (action.done || action.value.kind !== 'action') throw new Error('Missing field action')
    expect(await sampleActionPoint(connections, coordinator, 'a', action.value.request.requestId, abort.signal)).toMatchObject({ state: 'value' })
    const reply = stream.next()
    input.send({ kind: 'commitSelection', requestId: action.value.request.requestId, revision: 2, nextRevision: 3 })
    expect(await reply).toMatchObject({ value: { kind: 'selectionResult', accepted: true } })
    expect(publish).not.toHaveBeenCalled()
    expect(coordinator.selectionRevision('a')).toBeNull()
    const publication = stream.next()
    input.send({ kind: 'publishSelection', requestId: '12345678-1234-1234-1234-123456789abc', actionRequestId: action.value.request.requestId, revision: 3, request: { target, selection: { keyBase64: 'aw==', item: { kind: 'hash', fieldBase64: 'AP8=' } } } })
    expect(await publication).toMatchObject({ value: { kind: 'selectionResult', accepted: true } })
    expect(publish).toHaveBeenCalledExactlyOnceWith({ target, selection: { keyBase64: 'aw==', item: { kind: 'hash', fieldBase64: 'AP8=' } } }, 'action')
    input.send({ kind: 'selection', revision: 3, synchronized: true })
    expect(await result).toBe('applied')
    await vi.waitFor(() => expect(coordinator.selectionRevision('a')).toBe(3))
    abort.abort(); input.end(); expect((await stream.next()).done).toBe(true); connections.dispose()
  })
  it.each(['before-delivery', 'before-publication', 'wrong-selection'] as const)('reports unknown after a prepared action is interrupted %s', async mode => {
    const coordinator = new UiActionCoordinator<UiAction>(), input = uplink(), abort = new AbortController()
    const publish = vi.fn(() => ({ accepted: true }))
    const stream = openChannel(coordinator, 'a', abort.signal, input, publish), first = stream.next()
    const target = { id: 'fixture', generation: 1, db: 0 }, key = { base64: 'YQ==', byteLength: 1, label: 'a' }
    input.send({ kind: 'selection', revision: 1, synchronized: true })
    await vi.waitFor(() => expect(coordinator.selectionRevision('a')).toBe(1))
    const result = coordinator.dispatch('a', { kind: 'selectKey', key }, target, 1, () => true, abort.signal)
    const frame = await first
    if (frame.done || frame.value.kind !== 'action') throw new Error('Missing Key action')
    const id = frame.value.request.requestId
    input.send({ kind: 'commitSelection', requestId: id, revision: 1, nextRevision: 2 })
    await vi.waitFor(() => expect(coordinator.selectionRevision('a')).toBeNull())
    expect(publish).not.toHaveBeenCalled()
    if (mode !== 'before-delivery') {
      expect(await stream.next()).toMatchObject({ value: { kind: 'selectionResult', requestId: id, accepted: true } })
    }
    if (mode === 'wrong-selection') {
      const published = stream.next()
      input.send({ kind: 'publishSelection', requestId: '12345678-1234-1234-1234-123456789abc', actionRequestId: id, revision: 2, request: { target, selection: { keyBase64: 'Yg==', item: null } } })
      expect(await published).toMatchObject({ value: { kind: 'selectionResult', accepted: false } })
    }
    input.end()
    expect(await result).toBe('unknown')
    abort.abort(); expect((await stream.next()).done).toBe(true)
  })
  it('rejects a synchronized state that has no matching action publication', async () => {
    const coordinator = new UiActionCoordinator<UiAction>(), input = uplink(), abort = new AbortController()
    const stream = openUiActionChannel(coordinator, 'a', abort.signal, input), first = stream.next()
    const target = { id: 'fixture', generation: 1, db: 0 }, key = { base64: 'YQ==', byteLength: 1, label: 'a' }
    input.send({ kind: 'selection', revision: 1, synchronized: true })
    await vi.waitFor(() => expect(coordinator.selectionRevision('a')).toBe(1))
    const result = coordinator.dispatch('a', { kind: 'selectKey', key }, target, 1, () => true, abort.signal)
    const frame = await first
    if (frame.done || frame.value.kind !== 'action') throw new Error('Missing Key action')
    const response = stream.next()
    input.send({ kind: 'commitSelection', requestId: frame.value.request.requestId, revision: 1, nextRevision: 2 })
    expect(await response).toMatchObject({ value: { kind: 'selectionResult', accepted: true } })
    input.send({ kind: 'selection', revision: 2, synchronized: true })
    expect(await result).toBe('unknown')
    expect(coordinator.selectionRevision('a')).toBeNull()
    input.end(); abort.abort(); expect((await stream.next()).done).toBe(true)
  })
  it('rejects a late action token without overwriting the newer manual selection', async () => {
    const coordinator = new UiActionCoordinator<UiAction>(), input = uplink(), abort = new AbortController()
    const publish = vi.fn(() => ({ accepted: true }))
    const stream = openChannel(coordinator, 'a', abort.signal, input, publish), first = stream.next()
    const target = { id: 'fixture', generation: 1, db: 0 }, key = { base64: 'YQ==', byteLength: 1, label: 'a' }
    input.send({ kind: 'selection', revision: 1, synchronized: true })
    await vi.waitFor(() => expect(coordinator.selectionRevision('a')).toBe(1))
    const result = coordinator.dispatch('a', { kind: 'selectKey', key }, target, 1, () => true, abort.signal)
    const frame = await first
    if (frame.done || frame.value.kind !== 'action') throw new Error('Missing Key action')
    const id = frame.value.request.requestId, prepared = stream.next()
    input.send({ kind: 'commitSelection', requestId: id, revision: 1, nextRevision: 2 })
    expect(await prepared).toMatchObject({ value: { kind: 'selectionResult', accepted: true } })
    input.send({ kind: 'selection', revision: 3, synchronized: false })
    const manual = { target, selection: { keyBase64: 'Yg==', item: null } }, manualId = '12345678-1234-1234-1234-123456789abc'
    const cancelled = stream.next()
    input.send({ kind: 'publishSelection', requestId: manualId, revision: 3, request: manual })
    expect(await cancelled).toMatchObject({ value: { kind: 'cancel', requestId: id } })
    expect(await stream.next()).toMatchObject({ value: { kind: 'selectionResult', requestId: manualId, accepted: true } })
    expect(await result).toBe('unknown')
    const lateId = '12345678-1234-1234-1234-123456789abd', late = stream.next()
    input.send({ kind: 'publishSelection', requestId: lateId, actionRequestId: id, revision: 3, request: { target, selection: { keyBase64: key.base64, item: null } } })
    expect(await late).toMatchObject({ value: { kind: 'selectionResult', requestId: lateId, accepted: false } })
    expect(publish).toHaveBeenCalledExactlyOnceWith(manual, 'manual')
    input.end(); abort.abort(); expect((await stream.next()).done).toBe(true)
  })
  it('rejects a plain success acknowledgement and a commit after a newer selection', async () => {
    const coordinator = new UiActionCoordinator<UiAction>(), input = uplink(), abort = new AbortController()
    const publish = vi.fn(() => ({ accepted: true }))
    const stream = openChannel(coordinator, 'a', abort.signal, input, publish), target = { id: 'fixture', generation: 1, db: 0 }
    const key = { base64: '', byteLength: 0, label: '""' }
    let next = stream.next()
    input.send({ kind: 'selection', revision: 1, synchronized: true })
    await vi.waitFor(() => expect(coordinator.selectionRevision('a')).toBe(1))
    let result = coordinator.dispatch('a', { kind: 'selectKey', key }, target, 1, () => true, abort.signal)
    let frame = await next
    if (frame.done || frame.value.kind !== 'action') throw new Error('Missing Key action')
    input.send({ requestId: frame.value.request.requestId, target, selectionRevision: 1, outcome: 'applied' })
    expect(await result).toBe('failed')
    next = stream.next()
    result = coordinator.dispatch('a', { kind: 'selectKey', key }, target, 1, () => true, abort.signal)
    frame = await next
    if (frame.done || frame.value.kind !== 'action') throw new Error('Missing second Key action')
    const id = frame.value.request.requestId
    input.send({ kind: 'selection', revision: 2, synchronized: false })
    expect(await result).toBe('stale')
    expect(await stream.next()).toEqual({ done: false, value: { kind: 'cancel', requestId: id } })
    next = stream.next(); input.send({ kind: 'commitSelection', requestId: id, revision: 1, nextRevision: 2 })
    expect(await next).toEqual({ done: false, value: { kind: 'selectionResult', requestId: id, accepted: false } })
    expect(publish).not.toHaveBeenCalled()
    abort.abort(); input.end(); expect((await stream.next()).done).toBe(true)
  })
})
