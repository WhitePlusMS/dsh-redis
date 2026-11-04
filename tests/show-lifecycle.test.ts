import { describe, expect, it } from 'vitest'
import type { UiAction, UiActionAck, UiActionRequest } from '../src/domain.ts'
import { UiActionCoordinator } from '../src/host/ui-action-coordinator.ts'

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(done => { resolve = done })
  return { promise, resolve }
}
function acknowledgement(request: UiActionRequest<UiAction>): UiActionAck {
  return { requestId: request.requestId, target: request.target, selectionRevision: request.selectionRevision, outcome: 'applied' }
}
function show(coordinator: UiActionCoordinator<UiAction>, session: string): Promise<import('../src/domain.ts').UiActionOutcome> {
  return coordinator.dispatch(session, { kind: 'show' }, null, 0, () => true, new AbortController().signal)
}

describe('show action lifecycle', () => {
  it('ends a pending show when its session is disposed and ignores the late acknowledgement', async () => {
    const coordinator = new UiActionCoordinator<UiAction>(), delivered = deferred<UiActionRequest<UiAction>>(), pending = deferred<UiActionAck>()
    let deliverySignal: AbortSignal | undefined
    coordinator.register('a', async (request, signal) => { deliverySignal = signal; delivered.resolve(request); return pending.promise })
    coordinator.register('b', async request => acknowledgement(request))
    try {
      const outcome = show(coordinator, 'a'), request = await delivered.promise
      coordinator.disposeSession('a')
      expect(await outcome).toBe('disconnected')
      expect(deliverySignal?.aborted).toBe(true)
      pending.resolve(acknowledgement(request))
      expect(await show(coordinator, 'a')).toBe('no_receiver')
      expect(await show(coordinator, 'b')).toBe('applied')
    } finally { coordinator.dispose() }
  })

  it('reports ambiguity when a second receiver arrives while show is waiting', async () => {
    const coordinator = new UiActionCoordinator<UiAction>(), delivered = deferred<UiActionRequest<UiAction>>(), pending = deferred<UiActionAck>()
    let deliverySignal: AbortSignal | undefined, calls = 0
    coordinator.register('a', async (request, signal) => {
      if (++calls > 1) return acknowledgement(request)
      deliverySignal = signal; delivered.resolve(request); return pending.promise
    })
    try {
      const outcome = show(coordinator, 'a'), request = await delivered.promise
      const detachSecond = coordinator.register('a', async value => acknowledgement(value))
      expect(await outcome).toBe('ambiguous')
      expect(deliverySignal?.aborted).toBe(true)
      pending.resolve(acknowledgement(request))
      detachSecond()
      expect(await show(coordinator, 'a')).toBe('applied')
    } finally { coordinator.dispose() }
  })
})
