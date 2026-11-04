import { describe, expect, it, vi } from 'vitest'
import type { RemoteStreamHandle } from '@deepseek-ai/dsh-typert-protocol'
import type { UiChannelInput, UiChannelMessage } from '../src/domain.ts'
import { consumeUiActions as consume } from '../src/client/ui-actions.ts'
import { SelectionEpoch } from '../src/client/selection-epoch.ts'

const consumeUiActions = (open: Parameters<typeof consume>[0], signal: AbortSignal, apply: Parameters<typeof consume>[2]) => consume(open, signal, apply, new SelectionEpoch())

const id = '12345678-1234-1234-1234-123456789abc'
const message: UiChannelMessage = { kind: 'action', request: { requestId: id, action: { kind: 'show' }, target: null, selectionRevision: 0, expiresAt: Date.now() + 10000 } }
function fixture(items: readonly UiChannelMessage[]) {
  const stream: RemoteStreamHandle<UiChannelMessage, UiChannelInput> = {
    send: vi.fn(), end: vi.fn(), dispose: vi.fn(),
    async *[Symbol.asyncIterator]() { for (const item of items) { yield item; await new Promise<void>(resolve => setTimeout(resolve, 0)) } },
  }
  return stream
}

describe('UI action client', () => {
  it('acknowledges the pane only while it is visible', async () => {
    const stream = fixture([message])
    await consumeUiActions(async () => stream, new AbortController().signal, async () => 'applied')
    expect(stream.send).toHaveBeenCalledWith({ requestId: id, target: null, selectionRevision: 0, outcome: 'applied' })
    expect(stream.dispose).toHaveBeenCalledOnce()
  })
  it('does not acknowledge malformed frames and still releases the stream', async () => {
    const stream = fixture([{ kind: 'action', request: { ...message.request, action: { kind: 'delete' } } } as unknown as UiChannelMessage])
    await expect(consumeUiActions(async () => stream, new AbortController().signal, async () => 'applied')).rejects.toThrow()
    expect(stream.send).toHaveBeenCalledExactlyOnceWith({ kind: 'selection', revision: 1, synchronized: false }); expect(stream.dispose).toHaveBeenCalledOnce()
  })
  it('disposes a stream opened after the owning view was cancelled', async () => {
    const stream = fixture([message]), controller = new AbortController()
    controller.abort()
    await consumeUiActions(async () => stream, controller.signal, async () => 'applied')
    expect(stream.send).not.toHaveBeenCalled(); expect(stream.dispose).toHaveBeenCalledOnce()
  })
  it('does not report success after the pane is hidden or the request expires', async () => {
    for (const item of [message, { ...message, request: { ...message.request, expiresAt: 1 } }]) {
      const stream = fixture([item])
      await consumeUiActions(async () => stream, new AbortController().signal, async () => item !== message ? 'applied' : 'stale')
      expect(stream.send).toHaveBeenCalledWith({ requestId: id, target: null, selectionRevision: 0, outcome: 'stale' })
    }
  })
  it('cancels an in-flight action and ignores its late success', async () => {
    const stream = fixture([message, { kind: 'cancel', requestId: id }])
    let release!: () => void
    const gate = new Promise<void>(resolve => { release = resolve })
    const signals: AbortSignal[] = []
    await consumeUiActions(async () => stream, new AbortController().signal, async (_request, actionSignal) => {
      signals.push(actionSignal); await gate; return 'applied'
    })
    expect(signals[0]?.aborted).toBe(true)
    release(); await Promise.resolve(); await Promise.resolve()
    expect(stream.send).toHaveBeenCalledExactlyOnceWith({ kind: 'selection', revision: 1, synchronized: false })
    expect(stream.dispose).toHaveBeenCalledOnce()
  })
  it('aborts a targeted action synchronously when the user changes selection', async () => {
    const epoch = new SelectionEpoch(), target = { id: 'fixture', generation: 1, db: 0 }
    const targeted: UiChannelMessage = { kind: 'action', request: { ...message.request, action: { kind: 'confirmSelection' }, target, selectionRevision: 1 } }
    let release!: () => void, started!: () => void
    const gate = new Promise<void>(resolve => { release = resolve }), running = new Promise<void>(resolve => { started = resolve })
    let actionSignal: AbortSignal | undefined
    const stream = fixture([targeted])
    vi.mocked(stream.send).mockImplementation(input => { if ('kind' in input && input.kind === 'selection' && input.revision === 1 && !input.synchronized) epoch.synchronize(1) })
    const result = consume(async () => stream, new AbortController().signal, async (_request, signal) => {
      actionSignal = signal; started(); await gate; return 'applied'
    }, epoch)
    await running
    epoch.invalidate()
    expect(actionSignal?.aborted).toBe(true)
    expect(stream.send).toHaveBeenCalledWith({ requestId: id, target, selectionRevision: 1, outcome: 'stale' })
    release(); await result
    expect(stream.send).not.toHaveBeenCalledWith({ requestId: id, target, selectionRevision: 1, outcome: 'applied' })
  })
  it('rejects an old targeted action before applying any UI side effect', async () => {
    const epoch = new SelectionEpoch(), target = { id: 'fixture', generation: 1, db: 0 }
    epoch.synchronize(0); epoch.invalidate()
    const stream = fixture([{ kind: 'action', request: { ...message.request, action: { kind: 'confirmSelection' }, target } }])
    const apply = vi.fn(async () => 'applied' as const)
    await consume(async () => stream, new AbortController().signal, apply, epoch)
    expect(apply).not.toHaveBeenCalled()
    expect(stream.send).toHaveBeenCalledWith({ requestId: id, target, selectionRevision: 0, outcome: 'stale' })
  })
})
