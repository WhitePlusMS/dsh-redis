import { describe, expect, it, vi } from 'vitest'
import { UiActionCoordinator } from '../src/host/ui-action-coordinator.ts'
import type { UiActionAck, UiActionRequest } from '../src/domain.ts'

type Action = { readonly kind: 'open' }
const action: Action = { kind: 'open' }, target = { id: 'fixture', generation: 1, db: 0 }
function ack(request: UiActionRequest<Action>): UiActionAck { return { requestId: request.requestId, target: request.target, selectionRevision: request.selectionRevision, outcome: 'applied' } }
function deferred() {
  let resolve!: (value: UiActionAck) => void
  const result = new Promise<UiActionAck>(done => { resolve = done })
  return { result, resolve }
}
const dispatch = (coordinator: UiActionCoordinator<Action>, session = 'a', signal = new AbortController().signal, isCurrent = () => true, timeout = 10000) => coordinator.dispatch(session, action, target, 4, isCurrent, signal, timeout)

describe('UI action coordination', () => {
  it('requires exactly one receiver and accepts only its matching result', async () => {
    const c = new UiActionCoordinator<Action>(), receive = vi.fn(async (request: UiActionRequest<Action>) => ack(request))
    expect(await dispatch(c)).toBe('no_receiver')
    const close = c.register('a', receive), other = c.register('a', async request => ack(request))
    expect(await dispatch(c)).toBe('ambiguous'); expect(receive).not.toHaveBeenCalled()
    other(); expect(await dispatch(c)).toBe('applied'); expect(await dispatch(c, 'b')).toBe('no_receiver')
    close(); expect(await dispatch(c)).toBe('no_receiver')
  })
  it('rejects mismatched acknowledgements and outdated targets or selections', async () => {
    const c = new UiActionCoordinator<Action>()
    let valid = true
    const close = c.register('a', async request => ({ ...ack(request), requestId: 'wrong' }))
    expect(await dispatch(c)).toBe('stale'); close()
    c.register('a', async request => { valid = false; return ack(request) })
    expect(await dispatch(c, 'a', new AbortController().signal, () => valid)).toBe('stale')
    expect(await dispatch(c, 'a', new AbortController().signal, () => false)).toBe('stale')
  })
  it('preserves an ambiguous result reported by the receiving client', async () => {
    const c = new UiActionCoordinator<Action>()
    c.register('a', async request => ({ ...ack(request), outcome: 'ambiguous' }))
    expect(await dispatch(c)).toBe('ambiguous'); c.dispose()
  })
  it('keeps a target snapshot and rejects invalid runtime outcomes', async () => {
    const c = new UiActionCoordinator<Action>(), mutable = { ...target }, wait = deferred()
    let request: UiActionRequest<Action> | undefined
    c.register('a', async value => { request = value; return wait.result })
    const pending = c.dispatch('a', action, mutable, 4, () => true, new AbortController().signal)
    await vi.waitFor(() => expect(request).toBeDefined())
    mutable.generation = 2
    if (request === undefined) throw new Error('Missing request')
    expect(request.target?.generation).toBe(1)
    wait.resolve({ ...ack(request), outcome: 'unknown' as UiActionAck['outcome'] })
    expect(await pending).toBe('failed'); c.dispose()
  })
  it('copies nested action identity before the caller can mutate it', async () => {
    const c = new UiActionCoordinator<{ kind: 'select'; member: { base64: string } }>()
    const original = { kind: 'select' as const, member: { base64: 'bQ==' } }
    let snapshot = ''
    c.register('a', async request => {
      snapshot = request.action.member.base64
      return { requestId: request.requestId, target: request.target, selectionRevision: request.selectionRevision, outcome: 'applied' }
    })
    const result = c.dispatch('a', original, target, 4, () => true, new AbortController().signal)
    original.member.base64 = 'eA=='
    expect(await result).toBe('applied')
    expect(snapshot).toBe('bQ==')
    c.dispose()
  })
  it('keeps the shared action and target immutable for the receiver and active lookup', async () => {
    type MemberAction = { readonly kind: 'selectSetMember'; readonly keyBase64: string; readonly member: { readonly base64: string; readonly byteLength: number; readonly label: string } }
    const c = new UiActionCoordinator<MemberAction>(), wait = deferred()
    let delivered: UiActionRequest<MemberAction> | undefined, receiverMutation: boolean | undefined
    const receive = async (request: UiActionRequest<MemberAction>) => {
      delivered = request
      receiverMutation = Reflect.set(request.action.member, 'base64', 'eA==')
      return wait.result
    }
    c.register('a', receive); c.setSelectionState('a', receive, 4, true)
    const result = c.dispatch('a', { kind: 'selectSetMember', keyBase64: 'aw==', member: { base64: 'bQ==', byteLength: 1, label: 'm' } }, target, 4, () => true, new AbortController().signal)
    await vi.waitFor(() => expect(delivered).toBeDefined())
    if (delivered === undefined) throw new Error('Missing request')
    const active = c.activeRequest('a', delivered.requestId)
    if (active === null || active.target === null) throw new Error('Missing active request')
    expect(active).toBe(delivered)
    expect(receiverMutation).toBe(false)
    expect(Reflect.set(active.action.member, 'base64', 'eA==')).toBe(false)
    expect(Reflect.set(active.action, 'keyBase64', 'eA==')).toBe(false)
    expect(Reflect.set(active.target, 'db', 1)).toBe(false)
    expect(Reflect.set(active, 'selectionRevision', 5)).toBe(false)
    expect(active).toMatchObject({ action: { keyBase64: 'aw==', member: { base64: 'bQ==' } }, target: { db: 0 }, selectionRevision: 4 })
    expect(c.claimPoint('a', active)).toBe(true)
    wait.resolve({ requestId: active.requestId, target: active.target, selectionRevision: active.selectionRevision, outcome: 'applied' })
    expect(await result).toBe('applied'); c.dispose()
  })
  it('allows one point claim per action and resets the claim for a separate action', async () => {
    const c = new UiActionCoordinator<Action>()
    let wait = deferred(), request: UiActionRequest<Action> | undefined
    const receive = async (value: UiActionRequest<Action>) => { request = value; return wait.result }
    c.register('a', receive); c.setSelectionState('a', receive, 4, true)
    const first = dispatch(c)
    await vi.waitFor(() => expect(request).toBeDefined())
    if (request === undefined) throw new Error('Missing first request')
    const firstRequest = request
    expect(c.claimPoint('a', firstRequest)).toBe(true)
    expect(c.claimPoint('a', firstRequest)).toBe(false)
    wait.resolve(ack(firstRequest)); expect(await first).toBe('applied')
    wait = deferred(); request = undefined
    const second = dispatch(c)
    await vi.waitFor(() => expect(request).toBeDefined())
    if (request === undefined) throw new Error('Missing second request')
    expect(c.claimPoint('a', firstRequest)).toBe(false)
    expect(c.claimPoint('a', request)).toBe(true)
    wait.resolve(ack(request)); expect(await second).toBe('applied')
    c.dispose()
  })
  it('cancels pending delivery and ignores a late successful acknowledgement', async () => {
    const c = new UiActionCoordinator<Action>(), wait = deferred(), controller = new AbortController()
    let delivered: AbortSignal | undefined, request: UiActionRequest<Action> | undefined
    c.register('a', async (value, signal) => { request = value; delivered = signal; return wait.result })
    const first = dispatch(c, 'a', controller.signal); await vi.waitFor(() => expect(request).toBeDefined())
    expect(await dispatch(c)).toBe('busy'); controller.abort(); expect(await first).toBe('cancelled'); expect(delivered?.aborted).toBe(true)
    if (request === undefined) throw new Error('Missing request')
    wait.resolve(ack(request)); await Promise.resolve()
    c.dispose()
  })
  it('terminates on timeout, user change, receiver disconnect and multiple views', async () => {
    vi.useFakeTimers()
    try {
      const c = new UiActionCoordinator<Action>(), wait = deferred(), receive = vi.fn(async () => wait.result)
      let close = c.register('a', receive)
      let pending = dispatch(c, 'a', new AbortController().signal, () => true, 100)
      await vi.advanceTimersByTimeAsync(100); expect(await pending).toBe('timeout')
      pending = dispatch(c); c.invalidateSession('a'); expect(await pending).toBe('stale')
      pending = dispatch(c); close(); expect(await pending).toBe('disconnected')
      close = c.register('a', receive); pending = dispatch(c)
      const second = c.register('a', async request => ack(request)); expect(await pending).toBe('ambiguous')
      second(); close(); c.dispose()
    } finally { vi.useRealTimers() }
  })
  it('does not let an old disposer affect a replacement session', async () => {
    const c = new UiActionCoordinator<Action>(), old = c.register('a', async request => ack(request))
    c.disposeSession('a'); c.register('a', async request => ack(request)); old()
    expect(await dispatch(c)).toBe('applied'); c.dispose()
  })
  it('invalidates action-bound lookups for another session, another receiver and expiry', async () => {
    const c = new UiActionCoordinator<Action>(), wait = deferred()
    let request: UiActionRequest<Action> | undefined
    const receive = async (value: UiActionRequest<Action>) => { request = value; return wait.result }
    c.register('a', receive); c.setSelectionState('a', receive, 4, true)
    const first = dispatch(c)
    await vi.waitFor(() => expect(request).toBeDefined())
    if (request === undefined) throw new Error('Missing request')
    expect(c.activeRequest('b', request.requestId)).toBeNull()
    expect(c.activeRequest('a', request.requestId)).toBe(request)
    const detach = c.register('a', async value => ack(value))
    expect(await first).toBe('ambiguous')
    expect(c.activeRequest('a', request.requestId)).toBeNull()
    detach(); c.dispose()

    const timed = new UiActionCoordinator<Action>()
    let expiring: UiActionRequest<Action> | undefined
    const recipient = async (value: UiActionRequest<Action>) => { expiring = value; return deferred().result }
    timed.register('a', recipient); timed.setSelectionState('a', recipient, 4, true)
    const timeout = dispatch(timed, 'a', new AbortController().signal, () => true, 20)
    await vi.waitFor(() => expect(expiring).toBeDefined(), { interval: 1 })
    if (expiring === undefined) throw new Error('Missing expiring request')
    expect(await timeout).toBe('timeout')
    expect(timed.activeRequest('a', expiring.requestId)).toBeNull()
    timed.dispose()
  })
})
