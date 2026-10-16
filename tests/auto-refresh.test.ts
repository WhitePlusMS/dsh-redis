import { afterEach, describe, expect, it, vi } from 'vitest'
import { AutoRefreshClock, type RefreshDelay } from '../src/client/auto-refresh.ts'

afterEach(() => vi.useRealTimers())
const sample = (state = 'value') => ({ state, sampledAt: '2026-10-16T03:00:00.000Z' })
function fixture() {
  vi.useFakeTimers()
  let visible = true
  const refresh = vi.fn(), cancel = vi.fn(), owner = Symbol('selected reader')
  const delay: RefreshDelay = (run, milliseconds) => { const timer = setTimeout(run, milliseconds); return () => clearTimeout(timer) }
  const clock = new AutoRefreshClock(delay, () => visible)
  const detach = clock.attach(owner, { refresh, cancel })
  return { clock, owner, refresh, cancel, detach, hide: () => { visible = false }, show: () => { visible = true } }
}

describe('current Key auto refresh lifecycle', () => {
  it('requires a successful read and explicit enable; rejects subsecond and unsupported intervals', () => {
    const { clock, owner, refresh } = fixture()
    clock.enable(); vi.advanceTimersByTime(30000); expect(refresh).not.toHaveBeenCalled()
    clock.report(owner, false, sample(), false)
    clock.setInterval(1); clock.setInterval(999); clock.setInterval(2000)
    expect(clock.getSnapshot().intervalMs).toBe(5000)
    clock.enable(); vi.advanceTimersByTime(4999); expect(refresh).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1); expect(refresh).toHaveBeenCalledTimes(1)
  })
  it('waits a complete minimum interval after slow settlement, with no overlapping tick or catch-up', () => {
    const { clock, owner, refresh } = fixture()
    clock.report(owner, false, sample(), false); clock.setInterval(1000); clock.enable()
    vi.advanceTimersByTime(1000); expect(refresh).toHaveBeenCalledTimes(1)
    // Old React render before the queued read effect must not arm another timer.
    clock.report(owner, false, sample(), false)
    vi.advanceTimersByTime(30000); expect(refresh).toHaveBeenCalledTimes(1); expect(vi.getTimerCount()).toBe(0)
    expect(clock.begin(owner)).toBe(true)
    clock.report(owner, true, null, false); vi.advanceTimersByTime(30000)
    expect(refresh).toHaveBeenCalledTimes(1)
    clock.report(owner, false, sample(), false); vi.advanceTimersByTime(999)
    expect(refresh).toHaveBeenCalledTimes(1); vi.advanceTimersByTime(1); expect(refresh).toHaveBeenCalledTimes(2)
  })
  it('manual reads clear the waiting timer; interval edits remain one-shot', () => {
    const { clock, owner, refresh } = fixture()
    clock.report(owner, false, sample(), false); clock.enable(); vi.advanceTimersByTime(4999)
    clock.begin(owner); vi.advanceTimersByTime(20000); expect(refresh).not.toHaveBeenCalled()
    clock.report(owner, false, sample('page'), false); clock.setInterval(1000)
    expect(vi.getTimerCount()).toBe(1); vi.advanceTimersByTime(1000); expect(refresh).toHaveBeenCalledTimes(1)
  })
  it('hide cancels an active read, discards its pending timer and never reenables on show', () => {
    const f = fixture(); f.clock.report(f.owner, false, sample(), false); f.clock.setInterval(1000); f.clock.enable()
    vi.advanceTimersByTime(1000); f.clock.begin(f.owner); f.hide(); f.clock.visibilityChanged()
    expect(f.cancel).toHaveBeenCalledOnce(); expect(f.clock.getSnapshot().reason).toBe('hidden')
    f.show(); f.clock.visibilityChanged(); f.clock.report(f.owner, false, sample(), false)
    vi.advanceTimersByTime(30000); expect(f.refresh).toHaveBeenCalledOnce(); expect(f.clock.getSnapshot().enabled).toBe(false)
  })
  it('checks visibility at the tick even before an event is delivered', () => {
    const f = fixture(); f.clock.report(f.owner, false, sample(), false); f.clock.enable(); f.hide()
    vi.advanceTimersByTime(5000); expect(f.refresh).not.toHaveBeenCalled(); expect(f.clock.getSnapshot().reason).toBe('hidden')
  })
  it('Off between a tick and the React effect denies that queued automatic read', () => {
    const f = fixture(); f.clock.report(f.owner, false, sample(), false); f.clock.enable(); vi.advanceTimersByTime(5000)
    f.clock.stop(); expect(f.clock.begin(f.owner)).toBe(false); expect(f.cancel).toHaveBeenCalledOnce()
    expect(f.clock.begin(f.owner)).toBe(true) // the next explicitly requested read is permitted
  })
  it('failure, disappearance or type change stop without reconnect/replay and keep only last success time', () => {
    for (const state of ['failed', 'missing', 'changed', 'unsupported', 'unavailable', 'invalid']) {
      const f = fixture(); f.clock.report(f.owner, false, sample(), false); f.clock.enable(); f.clock.begin(f.owner)
      f.clock.report(f.owner, false, { state, sampledAt: '2026-10-16T04:00:00.000Z' }, false)
      expect(f.clock.getSnapshot()).toMatchObject({ enabled: false, ready: false, reason: 'failed', sampledAt: sample().sampledAt })
      f.clock.report(f.owner, false, sample(), false); vi.advanceTimersByTime(30000); expect(f.refresh).not.toHaveBeenCalled()
    }
  })
  it('cancel or draft reset stops; stale owners cannot report, cancel, detach or dispatch for a replacement', () => {
    const f = fixture(); f.clock.report(f.owner, false, sample(), false); f.clock.enable(); f.clock.reset(f.owner, 'cancelled')
    expect(f.clock.getSnapshot()).toMatchObject({ enabled: false, reason: 'cancelled' })
    const next = Symbol('new reader'), nextRefresh = vi.fn()
    f.clock.attach(next, { refresh: nextRefresh, cancel: vi.fn() }); f.clock.report(next, false, sample('page'), false); f.clock.enable()
    f.clock.report(f.owner, false, sample('failed'), true); f.clock.reset(f.owner); f.detach()
    expect(f.clock.begin(f.owner)).toBe(false); vi.advanceTimersByTime(5000)
    expect(nextRefresh).toHaveBeenCalledOnce(); expect(f.refresh).not.toHaveBeenCalled()
  })
  it('detach removes the only timer; unsubscribed listeners and unchanged snapshots stay stable', () => {
    const f = fixture(), listener = vi.fn(), unsubscribe = f.clock.subscribe(listener)
    f.clock.report(f.owner, false, sample(), false); const stable = f.clock.getSnapshot(); f.clock.setInterval(5000)
    expect(f.clock.getSnapshot()).toBe(stable); unsubscribe(); const before = listener.mock.calls.length
    f.clock.enable(); f.detach(); vi.advanceTimersByTime(30000)
    expect(vi.getTimerCount()).toBe(0); expect(f.refresh).not.toHaveBeenCalled(); expect(listener).toHaveBeenCalledTimes(before)
  })
})
