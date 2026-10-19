import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import type { ConnectionView } from '../src/domain.ts'
import { ConnectionSync } from '../src/client/connection-sync.ts'

const old: ConnectionView = { id: 'owned', generation: 1, db: 0, state: 'connected', error: null, target: { host: 'synthetic', port: 6379, username: '', tls: false } }
const next: ConnectionView = { ...old, generation: 2, db: 2 }
const ok = (value: ConnectionView): RemoteResult<ConnectionView> => ({ ok: true, value })
const disposers: (() => void)[] = []
beforeEach(() => { vi.useFakeTimers() })
afterEach(() => { for (const dispose of disposers.splice(0)) dispose(); vi.useRealTimers() })

function setup(read: (signal: AbortSignal) => Promise<RemoteResult<ConnectionView>>) {
  const state = { current: old, busy: false, visible: true }
  const apply = vi.fn((value: ConnectionView) => { state.current = value }), failed = vi.fn(), healthy = vi.fn()
  const sync = new ConnectionSync({ read, current: () => state.current, busy: () => state.busy, visible: () => state.visible, apply, failed, healthy })
  disposers.push(() => sync.dispose())
  return { state, sync, apply, failed, healthy }
}

describe('visible sidebar connection synchronization', () => {
  it('applies only changed stable Host state and never publishes SELECT connecting', async () => {
    const read = vi.fn(async () => ok({ ...next, state: 'connecting' })).mockResolvedValueOnce(ok({ ...next, state: 'connecting' })).mockResolvedValue(ok(next))
    const f = setup(read); f.sync.visibilityChanged()
    await vi.advanceTimersByTimeAsync(0); expect(f.apply).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1000); expect(f.apply).toHaveBeenCalledExactlyOnceWith(next)
    await vi.advanceTimersByTimeAsync(1000); expect(f.apply).toHaveBeenCalledTimes(1)
  })
  it('skips manual operations and rejects a late reply after a newer local connection', async () => {
    let release: ((value: RemoteResult<ConnectionView>) => void) | undefined
    const read = vi.fn(() => new Promise<RemoteResult<ConnectionView>>(resolve => { release = resolve }))
    const f = setup(read); f.state.busy = true; f.sync.visibilityChanged()
    await vi.advanceTimersByTimeAsync(1000); expect(read).not.toHaveBeenCalled()
    f.state.busy = false; await vi.advanceTimersByTimeAsync(1000); expect(read).toHaveBeenCalledTimes(1)
    f.sync.visibilityChanged(); expect(read).toHaveBeenCalledTimes(1)
    f.state.current = { ...next, generation: 9, db: 4 }
    if (release === undefined) throw new Error('No pending Host state read')
    release(ok(next)); await vi.advanceTimersByTimeAsync(0); expect(f.apply).not.toHaveBeenCalled()
  })
  it('aborts and stops while hidden and removes pending work on disposal', async () => {
    let signal: AbortSignal | undefined
    const read = vi.fn((current: AbortSignal) => { signal = current; return new Promise<RemoteResult<ConnectionView>>((_resolve, reject) => current.addEventListener('abort', () => reject(current.reason), { once: true })) })
    const f = setup(read); f.sync.visibilityChanged()
    f.state.visible = false; f.sync.visibilityChanged()
    expect(signal?.aborted).toBe(true)
    await vi.advanceTimersByTimeAsync(5000); expect(read).toHaveBeenCalledTimes(1); expect(f.failed).not.toHaveBeenCalled()
    read.mockResolvedValue(ok(next)); f.state.visible = true; f.sync.visibilityChanged()
    await vi.advanceTimersByTimeAsync(0); expect(f.apply).toHaveBeenCalledExactlyOnceWith(next)
    f.sync.dispose(); await vi.advanceTimersByTimeAsync(10000); expect(read).toHaveBeenCalledTimes(2)
  })
  it('reports transport failure and then recovery without reapplying unchanged state', async () => {
    const read = vi.fn(async () => ok(old)).mockRejectedValueOnce(new Error('synthetic offline'))
    const f = setup(read); f.sync.visibilityChanged()
    await vi.advanceTimersByTimeAsync(0); expect(f.failed).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1000); expect(f.healthy).toHaveBeenCalledTimes(1); expect(f.apply).not.toHaveBeenCalled()
  })
})
