import { describe, expect, it, vi } from 'vitest'
import { AiPageStore } from '../src/host/ai-page-store.ts'

interface TestPage { readonly state: 'page'; readonly error: null; readonly cursor: string | null; readonly rows: readonly string[] }
function request(fetch: (cursor: string | null) => Promise<TestPage>, cursor: string | null, signal = new AbortController().signal) {
  return { sessionId: 'a', binding: 'target', selection: null, cursor, signal, fetch, rows: (page: TestPage) => page.rows,
    output: (_page: TestPage, rows: readonly string[], next: string | null) => ({ rows, cursor: next }), validate: () => undefined, discard: () => undefined, oversize: 'too large' }
}

describe('internal AI page transaction', () => {
  it('retains a staged page on rollback and rejects a consumed token', async () => {
    const store = new AiPageStore<TestPage, string>('p:'), fetch = vi.fn(async () => ({ state: 'page' as const, error: null, cursor: 'lower', rows: ['one'] }))
    const first = await store.prepare(request(fetch, null))
    if (first.result === null || typeof first.result !== 'object' || Array.isArray(first.result) || typeof first.result.cursor !== 'string') throw new Error('Missing token')
    first.rollback()
    const retry = await store.prepare(request(fetch, null)); retry.commit()
    if (retry.result === null || typeof retry.result !== 'object' || Array.isArray(retry.result) || typeof retry.result.cursor !== 'string') throw new Error('Missing token')
    expect(fetch).toHaveBeenCalledTimes(1)
    const second = await store.prepare(request(fetch, retry.result.cursor)); second.commit()
    await expect(store.prepare(request(fetch, retry.result.cursor))).rejects.toMatchObject({ code: 'stale' })
  })
  it('saves a successful fetch before late cancellation', async () => {
    const store = new AiPageStore<TestPage, string>('p:'), controller = new AbortController()
    const fetch = vi.fn(async () => { controller.abort(); return { state: 'page' as const, error: null, cursor: null, rows: ['one'] } })
    await expect(store.prepare(request(fetch, null, controller.signal))).rejects.toThrow()
    const retried = await store.prepare(request(fetch, null)); retried.commit()
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(retried.result).toMatchObject({ rows: ['one'], cursor: null })
  })
  it('rejects a single row that exceeds the full JSON budget', async () => {
    const store = new AiPageStore<TestPage, string>('p:'), discard = vi.fn()
    const fetch = async () => ({ state: 'page' as const, error: null, cursor: null, rows: ['x'.repeat(65536)] })
    await expect(store.prepare({ ...request(fetch, null), discard })).rejects.toThrow('too large')
    expect(discard).toHaveBeenCalledTimes(1)
  })
})
