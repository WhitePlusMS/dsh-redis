import type { Context } from '@deepseek-ai/cordis'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { UiChannelInput, UiChannelMessage } from '../src/domain.ts'
import type { RedisWorkspaceInjected } from '../src/client/RedisWorkspace.tsx'
import { apply } from '../src/client/index.ts'
import { UiActionCoordinator } from '../src/host/ui-action-coordinator.ts'
import type { UiAction } from '../src/domain.ts'
import { expect, it, vi } from 'vitest'

function visibleDocument() {
  return Object.assign(new EventTarget(), { visibilityState: 'visible', createElement: () => ({ dataset: {}, textContent: '', remove: () => undefined }), head: { append: () => undefined } })
}

it('releases a hidden browser session channel and restores it when visible', async () => {
  const session = 'visibility-fixture' as SessionId
  const coordinator = new UiActionCoordinator<UiAction>()
  const foreground = vi.fn(async () => { throw new Error('Not dispatched') })
  const unregisterForeground = coordinator.register(session, foreground)
  const cleanups: Array<() => void> = []
  const fakeDocument = Object.assign(new EventTarget(), {
    visibilityState: 'hidden',
    createElement: () => ({ dataset: {}, textContent: '', remove: () => undefined }),
    head: { append: () => undefined },
  })
  vi.stubGlobal('document', fakeDocument)
  const openUiChannel = vi.fn(() => {
    let ended = false, wake: (() => void) | undefined
    const receiver = async () => { throw new Error('Not dispatched') }
    const unregister = coordinator.register(session, receiver)
    return {
      send: () => undefined, end: () => undefined,
      dispose: () => { if (!ended) { ended = true; unregister(); wake?.() } },
      async *[Symbol.asyncIterator]() { if (!ended) await new Promise<void>(resolve => { wake = resolve; if (ended) resolve() }) },
    }
  })
  const ctx = {
    effect: (operation: () => unknown) => { const dispose = operation(); if (typeof dispose === 'function') cleanups.push(dispose as () => void) },
    locale: { register: () => () => undefined, bind: () => (key: string) => key }, sidebarRightTabs: { register: () => () => undefined },
    sidebarRight: { mounted: { getSnapshot: () => session, subscribe: () => () => undefined } },
    slots: { inject: (_name: string, enter: () => unknown) => enter(), register: () => () => undefined },
    remote: { $mount: async () => () => undefined },
    get: (key: string) => key === 'connection' ? { generation: { getSnapshot: () => ({ id: 1 }), subscribe: () => () => undefined } } : ({ openUiChannel }),
  } as unknown as Context
  try {
    apply(ctx)
    await new Promise<void>(resolve => setImmediate(resolve))
    expect(openUiChannel).not.toHaveBeenCalled()
    expect(coordinator.isUniqueReceiver(session, foreground)).toBe(true)
    fakeDocument.visibilityState = 'visible'; fakeDocument.dispatchEvent(new Event('visibilitychange'))
    await vi.waitFor(() => expect(openUiChannel).toHaveBeenCalledTimes(1))
    expect(coordinator.isUniqueReceiver(session, foreground)).toBe(false)
    fakeDocument.visibilityState = 'hidden'; fakeDocument.dispatchEvent(new Event('visibilitychange'))
    expect(coordinator.isUniqueReceiver(session, foreground)).toBe(true)
    fakeDocument.visibilityState = 'visible'; fakeDocument.dispatchEvent(new Event('visibilitychange'))
    await vi.waitFor(() => expect(openUiChannel).toHaveBeenCalledTimes(2))
    expect(coordinator.isUniqueReceiver(session, foreground)).toBe(false)
  } finally {
    for (const cleanup of cleanups.reverse()) cleanup()
    unregisterForeground(); coordinator.dispose(); vi.unstubAllGlobals()
  }
})

it('opens the active session pane and waits for a visible body before acknowledging', async () => {
  let session: SessionId | undefined, changed: (() => void) | undefined
  let slot: { inject: (id: SessionId) => RedisWorkspaceInjected } | undefined
  const cleanups: Array<() => void> = []
  const queue: UiChannelMessage[] = []
  let wake: (() => void) | undefined, ended = false
  const notify = () => { const waiting = wake; wake = undefined; waiting?.() }
  const send = vi.fn<(input: UiChannelInput) => void>()
  const stream = {
    send, end: () => undefined, dispose: vi.fn(() => { ended = true; notify() }),
    async *[Symbol.asyncIterator]() {
      while (!ended) {
        const next = queue.shift()
        if (next !== undefined) { yield next; continue }
        await new Promise<void>(resolve => { wake = resolve; if (ended || queue.length > 0) notify() })
      }
    },
  }
  const openUiChannel = vi.fn(() => stream), openTab = vi.fn()
  vi.stubGlobal('document', visibleDocument())
  const ctx = {
    effect: (operation: () => unknown) => { const dispose = operation(); if (typeof dispose === 'function') cleanups.push(dispose as () => void) },
    locale: { register: () => () => undefined, bind: () => (key: string) => key },
    sidebarRightTabs: { register: () => () => undefined },
    sidebarRight: { mounted: { getSnapshot: () => session, subscribe: (listener: () => void) => { changed = listener; return () => { changed = undefined } } }, openTab },
    slots: { inject: (_name: string, enter: () => unknown) => enter(), register: (entry: typeof slot) => { slot = entry; return () => undefined } },
    remote: { $mount: async () => () => undefined },
    get: (key: string) => key === 'connection' ? { generation: { getSnapshot: () => ({ id: 1 }), subscribe: () => () => undefined } } : ({ openUiChannel }),
  } as unknown as Context
  try {
    apply(ctx)
    if (slot === undefined || changed === undefined) throw new Error('Missing client registration')
    session = 'a' as SessionId; changed()
    await vi.waitFor(() => expect(openUiChannel).toHaveBeenCalledOnce())
    const request = { requestId: '12345678-1234-1234-1234-123456789abc', action: { kind: 'show' as const }, target: null, selectionRevision: 0, expiresAt: Date.now() + 10000 }
    queue.push({ kind: 'action', request }); notify()
    await vi.waitFor(() => expect(openTab).toHaveBeenCalledExactlyOnceWith('redis'))
    expect(send).toHaveBeenCalledExactlyOnceWith({ kind: 'selection', revision: 1, synchronized: false })
    const release = slot.inject(session).registerVisiblePane()
    await vi.waitFor(() => expect(send).toHaveBeenCalledWith({ requestId: request.requestId, target: null, selectionRevision: 0, outcome: 'applied' }))
    release(); session = undefined; changed()
    expect(stream.dispose).toHaveBeenCalledOnce()
  } finally {
    for (const cleanup of cleanups.reverse()) cleanup()
    vi.unstubAllGlobals()
  }
})

it('disposes the old stream on carrier loss and opens one stream for the new generation', async () => {
  let generation: { id: number } | undefined, generationChanged: (() => void) | undefined
  let session: SessionId | undefined = 'a' as SessionId, sessionChanged: (() => void) | undefined
  const cleanups: Array<() => void> = [], streams: Array<{ dispose: ReturnType<typeof vi.fn> }> = []
  const openUiChannel = vi.fn(() => {
    let ended = false, wake: (() => void) | undefined
    const stream = {
      send: () => undefined, end: () => undefined,
      dispose: vi.fn(() => { ended = true; wake?.() }),
      async *[Symbol.asyncIterator]() { if (!ended) await new Promise<void>(resolve => { wake = resolve; if (ended) resolve() }) },
    }
    streams.push(stream); return stream
  })
  vi.stubGlobal('document', visibleDocument())
  const ctx = {
    effect: (operation: () => unknown) => { const dispose = operation(); if (typeof dispose === 'function') cleanups.push(dispose as () => void) },
    locale: { register: () => () => undefined, bind: () => (key: string) => key }, sidebarRightTabs: { register: () => () => undefined },
    sidebarRight: { mounted: { getSnapshot: () => session, subscribe: (listener: () => void) => { sessionChanged = listener; return () => { sessionChanged = undefined } } } },
    slots: { inject: (_name: string, enter: () => unknown) => enter(), register: () => () => undefined },
    remote: { $mount: async () => () => undefined },
    get: (key: string) => key === 'connection' ? { generation: { getSnapshot: () => generation, subscribe: (listener: () => void) => { generationChanged = listener; return () => { generationChanged = undefined } } } } : ({ openUiChannel }),
  } as unknown as Context
  try {
    apply(ctx)
    if (generationChanged === undefined || sessionChanged === undefined) throw new Error('Missing subscriptions')
    expect(openUiChannel).not.toHaveBeenCalled()
    generation = { id: 1 }; generationChanged()
    await vi.waitFor(() => expect(openUiChannel).toHaveBeenCalledTimes(1))
    generation = undefined; generationChanged()
    expect(streams[0]?.dispose).toHaveBeenCalledOnce()
    generation = { id: 2 }; generationChanged()
    await vi.waitFor(() => expect(openUiChannel).toHaveBeenCalledTimes(2))
    generationChanged(); expect(openUiChannel).toHaveBeenCalledTimes(2)
    session = undefined; sessionChanged()
    expect(streams[1]?.dispose).toHaveBeenCalledOnce()
  } finally {
    for (const cleanup of cleanups.reverse()) cleanup()
    vi.unstubAllGlobals()
  }
})

it('retries a failed or ended stream with a bounded delay and cancels on unload', async () => {
  vi.useFakeTimers()
  vi.stubGlobal('document', visibleDocument())
  const cleanups: Array<() => void> = []
  const dispose = vi.fn()
  const openUiChannel = vi.fn()
    .mockRejectedValueOnce(new Error('not ready'))
    .mockImplementation(() => ({ send: () => undefined, end: () => undefined, dispose, async *[Symbol.asyncIterator]() {} }))
  const ctx = {
    effect: (operation: () => unknown) => { const result = operation(); if (typeof result === 'function') cleanups.push(result as () => void) },
    locale: { register: () => () => undefined, bind: () => (key: string) => key }, sidebarRightTabs: { register: () => () => undefined },
    sidebarRight: { mounted: { getSnapshot: () => 'a' as SessionId, subscribe: () => () => undefined } },
    slots: { inject: (_name: string, enter: () => unknown) => enter(), register: () => () => undefined },
    remote: { $mount: async () => () => undefined },
    get: (key: string) => key === 'connection' ? { generation: { getSnapshot: () => ({ id: 1 }), subscribe: () => () => undefined } } : ({ openUiChannel }),
  } as unknown as Context
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
  try {
    apply(ctx)
    await vi.advanceTimersByTimeAsync(7000)
    expect(openUiChannel).toHaveBeenCalledTimes(4)
    expect(dispose).toHaveBeenCalledTimes(3)
    await vi.advanceTimersByTimeAsync(10000)
    expect(openUiChannel).toHaveBeenCalledTimes(4)
    for (const cleanup of cleanups.splice(0).reverse()) cleanup()
    openUiChannel.mockRejectedValueOnce(new Error('not ready'))
    apply(ctx)
    await vi.advanceTimersByTimeAsync(0)
    expect(openUiChannel).toHaveBeenCalledTimes(5)
    for (const cleanup of cleanups.splice(0).reverse()) cleanup()
    await vi.advanceTimersByTimeAsync(5000)
    expect(openUiChannel).toHaveBeenCalledTimes(5)
  } finally {
    for (const cleanup of cleanups.reverse()) cleanup()
    warn.mockRestore(); vi.unstubAllGlobals(); vi.useRealTimers()
  }
})

it('keeps manual recovery available after repeated opening failures', async () => {
  vi.useFakeTimers()
  vi.stubGlobal('document', visibleDocument())
  let slot: { inject: (id: SessionId) => RedisWorkspaceInjected } | undefined
  const cleanups: Array<() => void> = []
  const openUiChannel = vi.fn().mockRejectedValue(new Error('not ready'))
  const session = 'a' as SessionId
  const ctx = {
    effect: (operation: () => unknown) => { const result = operation(); if (typeof result === 'function') cleanups.push(result as () => void) },
    locale: { register: () => () => undefined, bind: () => (key: string) => key }, sidebarRightTabs: { register: () => () => undefined },
    sidebarRight: { mounted: { getSnapshot: () => session, subscribe: () => () => undefined } },
    slots: { inject: (_name: string, enter: () => unknown) => enter(), register: (entry: typeof slot) => { slot = entry; return () => undefined } },
    remote: { $mount: async () => () => undefined },
    get: (key: string) => key === 'connection' ? { generation: { getSnapshot: () => ({ id: 1 }), subscribe: () => () => undefined } } : ({ openUiChannel }),
  } as unknown as Context
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
  try {
    apply(ctx)
    if (slot === undefined) throw new Error('Missing client registration')
    const pane = slot.inject(session)
    await vi.advanceTimersByTimeAsync(7000)
    expect(openUiChannel).toHaveBeenCalledTimes(4)
    expect(pane.selectionEpoch.hasFailure()).toBe(true)
    pane.retrySelection()
    expect(pane.selectionEpoch.hasFailure()).toBe(false)
    await vi.advanceTimersByTimeAsync(7000)
    expect(openUiChannel).toHaveBeenCalledTimes(8)
    expect(pane.selectionEpoch.hasFailure()).toBe(true)
    let finish: (() => void) | undefined
    openUiChannel.mockImplementation(() => ({ send: () => undefined, end: () => undefined, dispose: () => finish?.(), async *[Symbol.asyncIterator]() { await new Promise<void>(resolve => { finish = resolve }) } }))
    pane.retrySelection()
    await vi.advanceTimersByTimeAsync(0)
    expect(openUiChannel).toHaveBeenCalledTimes(9)
    expect(pane.selectionEpoch.hasFailure()).toBe(false)
  } finally {
    for (const cleanup of cleanups.reverse()) cleanup()
    warn.mockRestore(); vi.unstubAllGlobals(); vi.useRealTimers()
  }
})
