import { describe, expect, it, vi } from 'vitest'
import { AiPageCoordinator } from '../src/host/ai-page-coordinator.ts'
import type { PreparedAiPage } from '../src/host/ai-page-store.ts'

function fixture() {
  const slots = [{ disposeSession: vi.fn(), dispose: vi.fn() }, { disposeSession: vi.fn(), dispose: vi.fn() }] as const
  return { slots, coordinator: new AiPageCoordinator(slots) }
}
function page(state = 'page'): PreparedAiPage { return { result: { value: { state } }, commit: vi.fn(), rollback: vi.fn() } }

describe('AI page candidate coordination', () => {
  it('preserves the old slot on candidate failure and promotes only on commit', async () => {
    const { slots, coordinator } = fixture()
    const first = await coordinator.prepare('a', null, 0n, async slot => { expect(slot).toBe(slots[0]); return page() })
    first.commit()
    const revision = coordinator.snapshot('a')
    const cancelled = await coordinator.prepare('a', null, revision, async slot => { expect(slot).toBe(slots[1]); return page() })
    cancelled.rollback(); expect(slots[0].disposeSession).not.toHaveBeenCalled()
    const candidate = await coordinator.prepare('a', null, revision, async slot => { expect(slot).toBe(slots[1]); return page() })
    candidate.commit(); expect(slots[0].disposeSession).toHaveBeenCalledWith('a')
    await expect(coordinator.prepare('a', null, revision, async () => page())).rejects.toMatchObject({ code: 'stale' })
  })
  it('does not commit missing pages and rejects busy work without touching current state', async () => {
    const { slots, coordinator } = fixture()
    const first = await coordinator.prepare('a', null, 0n, async () => page()); first.commit()
    const revision = coordinator.snapshot('a')
    const pending = await coordinator.prepare('a', null, revision, async () => page('missing'))
    await expect(coordinator.prepare('a', null, revision, async () => page())).rejects.toThrow('正在执行')
    pending.commit(); expect(coordinator.snapshot('a')).toBe(revision)
    expect(slots[0].disposeSession).not.toHaveBeenCalled()
    const continuation = await coordinator.prepare('a', 'token', revision, async slot => { expect(slot).toBe(slots[0]); return page() })
    continuation.commit()
  })
  it('isolates sessions and does not let an old rollback clear a disposed session', async () => {
    const { slots, coordinator } = fixture()
    const pending = await coordinator.prepare('a', null, 0n, async () => page())
    coordinator.disposeSession('a')
    const fresh = await coordinator.prepare('a', null, 0n, async () => page()); fresh.commit()
    const count = slots[0].disposeSession.mock.calls.length
    pending.rollback(); expect(slots[0].disposeSession).toHaveBeenCalledTimes(count)
    expect(coordinator.snapshot('b')).toBe(0n)
  })
  it('removes an empty session when a late probe fails after disposal', async () => {
    const { coordinator } = fixture()
    const snapshot = coordinator.snapshot('a')
    coordinator.disposeSession('a')
    await expect(coordinator.prepare('a', null, snapshot, async () => { throw new Error('stale target') })).rejects.toThrow('stale target')
    const sessions = Reflect.get(coordinator, 'sessions') as Map<string, unknown>
    expect(sessions.has('a')).toBe(false)
  })
  it('does not allocate an empty session for an invalid continuation', async () => {
    const { coordinator } = fixture()
    await expect(coordinator.prepare('a', 'invalid', 0n, async () => page())).rejects.toMatchObject({ code: 'stale' })
    const sessions = Reflect.get(coordinator, 'sessions') as Map<string, unknown>
    expect(sessions.has('a')).toBe(false)
  })
  it('does not let an old failed fetch clear a replacement session', async () => {
    const { coordinator } = fixture()
    let ready!: () => void, release!: () => void
    const waiting = new Promise<void>(resolve => { ready = resolve }), hold = new Promise<void>(resolve => { release = resolve })
    const old = coordinator.prepare('a', null, 0n, async () => { ready(); await hold; throw new Error('old failed') })
    const rejected = expect(old).rejects.toThrow('old failed')
    await waiting; coordinator.disposeSession('a')
    const fresh = await coordinator.prepare('a', null, 0n, async () => page()); fresh.commit()
    const revision = coordinator.snapshot('a')
    release(); await rejected
    expect(coordinator.snapshot('a')).toBe(revision)
    const continuation = await coordinator.prepare('a', 'token', revision, async () => page()); continuation.commit()
  })
})
