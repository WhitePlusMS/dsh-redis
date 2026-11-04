import { describe, expect, it, vi } from 'vitest'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import { MAX_CACHED_KEYS, type RedisKey, type ScanKeysResult } from '../src/domain.ts'
import { AUTO_KEY_SCAN_MS, MAX_AUTO_KEY_PAGES, canResumeKeyLoad, cancelKeyLoad, keyLoadPercent, loadKeysAutomatically, type KeyLoadUpdate } from '../src/client/key-loading.ts'

const key = (index: number): RedisKey => { const bytes = Buffer.from('demo:' + index); return { base64: bytes.toString('base64'), byteLength: bytes.length, label: JSON.stringify(bytes.toString()) } }
const page = (keys: readonly RedisKey[], cursor: string | null): RemoteResult<ScanKeysResult> => ({ ok: true, value: { state: 'page', error: null, keys, cursor, sampledAt: new Date(0).toISOString() } })
const run = (scan: (cursor: string | null, signal: AbortSignal) => Promise<RemoteResult<ScanKeysResult>>, controller = new AbortController(), now?: () => number) => {
  const updates: KeyLoadUpdate[] = []
  return { updates, result: loadKeysAutomatically({ scan, signal: controller.signal, publish: value => updates.push(value), ...(now === undefined ? {} : { now }) }) }
}

describe('automatic bounded Key scanning', () => {
  it('loads all 760 Keys serially, follows the issued cursor and completes without another action', async () => {
    let offset = 0, active = 0, maximum = 0
    const cursors: (string | null)[] = []
    const f = run(async cursor => {
      cursors.push(cursor); maximum = Math.max(maximum, ++active); await Promise.resolve(); --active
      const end = Math.min(offset + 100, 760), rows = Array.from({ length: end - offset }, (_, i) => key(offset + i)); offset = end
      return page(rows, offset === 760 ? null : String(offset))
    })
    const value = await f.result
    expect(value.phase).toBe('complete'); expect(value.cache.keys).toHaveLength(760); expect(value.pages).toBe(8)
    expect(maximum).toBe(1); expect(cursors).toEqual([null, '100', '200', '300', '400', '500', '600', '700'])
    expect(f.updates.map(value => value.cache.keys.length)).toEqual([0, 100, 200, 300, 400, 500, 600, 700, 760])
  })
  it('continues through empty pages, deduplicates raw identities and does not use labels as identity', async () => {
    const scan = vi.fn().mockResolvedValueOnce(page([key(1)], 'a')).mockResolvedValueOnce(page([], 'b')).mockResolvedValueOnce(page([key(1), { ...key(2), label: key(1).label }], null))
    const f = run(scan), value = await f.result
    expect(value.phase).toBe('complete'); expect(value.cache.keys).toHaveLength(2); expect(scan).toHaveBeenCalledTimes(3)
  })
  it('does not dispatch or publish when already cancelled', async () => {
    const controller = new AbortController(); controller.abort(); const scan = vi.fn().mockResolvedValue(page([], null)), f = run(scan, controller)
    expect((await f.result).phase).toBe('cancelled'); expect(scan).not.toHaveBeenCalled(); expect(f.updates).toEqual([])
  })
  it('cannot publish a delayed page or start its successor after cancellation', async () => {
    let release: (value: RemoteResult<ScanKeysResult>) => void = () => undefined
    const scan = vi.fn().mockImplementation(() => new Promise<RemoteResult<ScanKeysResult>>(resolve => { release = resolve }))
    const controller = new AbortController(), f = run(scan, controller); controller.abort(); release(page([key(1)], 'late'))
    expect((await f.result).phase).toBe('cancelled'); expect(scan).toHaveBeenCalledTimes(1); expect(f.updates).toHaveLength(1); expect(f.updates[0]?.cache.keys).toHaveLength(0)
  })
  it('stops on the actual row limit without claiming the DB is complete', async () => {
    let offset = 0
    const scan = vi.fn().mockImplementation(async () => { const rows = Array.from({ length: 1000 }, () => key(offset++)); return page(rows, 'more') })
    const f = run(scan), value = await f.result
    expect(value.phase).toBe('limited'); expect(value.cache.keys).toHaveLength(MAX_CACHED_KEYS); expect(value.cache.limited).toBe(true); expect(scan).toHaveBeenCalledTimes(6)
  })
  it('retains a completed earlier page and stops instead of retrying an explicit Host error', async () => {
    const scan = vi.fn().mockResolvedValueOnce(page([key(1)], 'a')).mockResolvedValueOnce({ ok: true, value: { state: 'failed', error: 'permission', keys: [], cursor: null, sampledAt: new Date(0).toISOString() } })
    const f = run(scan), value = await f.result
    expect(value).toMatchObject({ phase: 'failed', error: 'permission', pages: 1 }); expect(value.cache.keys).toHaveLength(1); expect(scan).toHaveBeenCalledTimes(2)
  })
  it('classifies an RPC rejection and never silently restarts from cursor zero', async () => {
    const scan = vi.fn().mockRejectedValue(new Error('transport failed')), f = run(scan)
    expect(await f.result).toMatchObject({ phase: 'failed', error: 'rpc', pages: 0 }); expect(scan).toHaveBeenCalledTimes(1)
  })
  it('pauses a non-terminating empty source at the page budget', async () => {
    const scan = vi.fn().mockResolvedValue(page([], 'more')), f = run(scan, new AbortController(), () => 0)
    expect((await f.result).phase).toBe('paused'); expect(scan).toHaveBeenCalledTimes(MAX_AUTO_KEY_PAGES)
  })
  it('does not begin a new page after the automatic elapsed-time budget', async () => {
    let time = 0
    const scan = vi.fn().mockImplementation(async () => { time = AUTO_KEY_SCAN_MS; return page([key(1)], 'a') }), f = run(scan, new AbortController(), () => time)
    expect((await f.result).phase).toBe('paused'); expect(scan).toHaveBeenCalledTimes(1)
  })
  it('continues a paused chain with its original cursor and retained cache', async () => {
    let time = 0
    const first = run(async () => { time = AUTO_KEY_SCAN_MS; return page([key(1)], 'safe') }, new AbortController(), () => time)
    const paused = await first.result
    expect(paused).toMatchObject({ phase: 'paused', pages: 1, cursor: 'safe' })
    const scan = vi.fn().mockResolvedValueOnce(page([key(1), key(2)], null)), updates: KeyLoadUpdate[] = []
    const resumed = await loadKeysAutomatically({ scan, signal: new AbortController().signal, resume: paused, publish: value => updates.push(value), now: () => 0 })
    expect(scan.mock.calls[0]?.[0]).toBe('safe')
    expect(resumed).toMatchObject({ phase: 'complete', pages: 2, cursor: null })
    expect(resumed.cache.keys.map(item => item.base64)).toEqual([key(1).base64, key(2).base64])
    expect(updates[0]?.cache.keys).toHaveLength(1)
  })
  it('discards the continuation when a resumed request fails or is cancelled', async () => {
    let time = 0
    const paused = await run(async () => { time = AUTO_KEY_SCAN_MS; return page([key(1)], 'safe') }, new AbortController(), () => time).result
    const failure = vi.fn().mockResolvedValue({ ok: true, value: { state: 'failed', error: 'stale', keys: [], cursor: null, sampledAt: new Date(0).toISOString() } })
    const failed = await loadKeysAutomatically({ scan: failure, signal: new AbortController().signal, resume: paused, publish: () => undefined, now: () => 0 })
    expect(failed).toMatchObject({ phase: 'failed', error: 'stale', cursor: null, pages: 1 })
    expect(failed.cache.keys).toHaveLength(1); expect(failure).toHaveBeenCalledTimes(1)
    let release!: (value: RemoteResult<ScanKeysResult>) => void
    const controller = new AbortController(), scan = vi.fn().mockImplementation(() => new Promise<RemoteResult<ScanKeysResult>>(resolve => { release = resolve }))
    const updates: KeyLoadUpdate[] = []
    const pending = loadKeysAutomatically({ scan, signal: controller.signal, resume: paused, publish: value => updates.push(value), now: () => 0 })
    controller.abort(); release(page([key(2)], 'late'))
    const cancelled = await pending
    expect(cancelled).toMatchObject({ phase: 'cancelled', cursor: null, pages: 1 })
    expect(cancelled.cache.keys).toHaveLength(1); expect(updates).toHaveLength(1)
  })
  it('renews the page budget on explicit continuation without resetting total pages', async () => {
    const scan = vi.fn().mockResolvedValue(page([], 'next'))
    const first = await run(scan, new AbortController(), () => 0).result
    expect(first).toMatchObject({ phase: 'paused', pages: MAX_AUTO_KEY_PAGES, cursor: 'next' })
    const second = await loadKeysAutomatically({ scan, signal: new AbortController().signal, resume: first, publish: () => undefined, now: () => 0 })
    expect(second).toMatchObject({ phase: 'paused', pages: MAX_AUTO_KEY_PAGES * 2, cursor: 'next' })
    expect(scan).toHaveBeenCalledTimes(MAX_AUTO_KEY_PAGES * 2)
  })
  it('does not retain a continuation after partial cache overflow, failure or cancellation', async () => {
    const large = Array.from({ length: MAX_CACHED_KEYS + 1 }, (_, i) => key(i))
    const limited = await run(async () => page(large, 'unsafe')).result
    expect(limited).toMatchObject({ phase: 'limited', cursor: null }); expect(limited.cache.keys).toHaveLength(MAX_CACHED_KEYS)
    await expect(loadKeysAutomatically({ scan: vi.fn(), signal: new AbortController().signal, resume: limited, publish: () => undefined })).rejects.toThrow('Invalid Key scan continuation')
    const failed = await run(vi.fn().mockResolvedValueOnce(page([key(1)], 'safe')).mockRejectedValueOnce(new Error('rpc'))).result
    expect(failed).toMatchObject({ phase: 'failed', cursor: null, pages: 1 })
    const controller = new AbortController(), scan = vi.fn().mockImplementation(async () => { controller.abort(); return page([key(1)], 'unsafe') })
    expect(await run(scan, controller).result).toMatchObject({ phase: 'cancelled', cursor: null })
  })
  it('only offers continuation before a cache batch has been dropped', async () => {
    let time = 0
    const scan = vi.fn().mockResolvedValueOnce(page(Array.from({ length: 2500 }, (_, i) => key(i)), 'first'))
      .mockImplementationOnce(async () => { time = AUTO_KEY_SCAN_MS; return page(Array.from({ length: 2500 }, (_, i) => key(i + 2500)), 'safe') })
      .mockResolvedValueOnce(page([key(MAX_CACHED_KEYS)], 'lost-tail'))
    const paused = await run(scan, new AbortController(), () => time).result
    expect(paused.cache.keys).toHaveLength(MAX_CACHED_KEYS); expect(canResumeKeyLoad(paused)).toBe(true)
    expect(canResumeKeyLoad(cancelKeyLoad(paused))).toBe(false)
    const limited = await loadKeysAutomatically({ scan, signal: new AbortController().signal, resume: paused, publish: () => undefined, now: () => 0 })
    expect(limited).toMatchObject({ phase: 'limited', cursor: null }); expect(canResumeKeyLoad(limited)).toBe(false)
    const exact = await run(vi.fn().mockResolvedValueOnce(page(Array.from({ length: 2500 }, (_, i) => key(i)), 'first')).mockResolvedValueOnce(page(Array.from({ length: 2500 }, (_, i) => key(i + 2500)), null))).result
    expect(exact).toMatchObject({ phase: 'complete', cursor: null }); expect(exact.cache.keys).toHaveLength(MAX_CACHED_KEYS)
  })
  it('keeps progress exact and distinguishes filtering, unknown totals, live changes and cursor completion', () => {
    expect(keyLoadPercent(102, '760', '*', 'loading')).toBe(13)
    expect(keyLoadPercent(760, '760', '*', 'loading')).toBe(99)
    expect(keyLoadPercent(760, '760', '*', 'complete')).toBe(100)
    expect(keyLoadPercent(759, '760', '*', 'complete')).toBeNull()
    expect(keyLoadPercent(1, '760', 'demo:*', 'loading')).toBeNull()
    expect(keyLoadPercent(1, null, '*', 'loading')).toBeNull()
    expect(keyLoadPercent(0, '0', '*', 'complete')).toBe(100)
    expect(keyLoadPercent(5000, '9223372036854775807', '*', 'loading')).toBe(0)
  })
})
