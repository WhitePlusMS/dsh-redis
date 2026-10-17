import { describe, expect, it } from 'vitest'
import { appendRows, emptyRowCache } from '../src/client/row-cache.ts'
import { MAX_CACHED_KEYS, MAX_CACHED_KEY_BYTES } from '../src/domain.ts'
describe('bounded live range rows', () => {
  it('retains distinct original positions despite duplicate values and refreshes repeated identities', () => {
    const identity = (row: { index: string; value: string }) => row.index
    let cache = appendRows(emptyRowCache<{ index: string; value: string }>(), [{ index: '9007199254740993', value: 'same' }, { index: '9007199254740994', value: 'same' }], identity)
    cache = appendRows(cache, [{ index: '9007199254740993', value: 'changed' }], identity)
    expect(cache.rows).toEqual([{ index: '9007199254740993', value: 'changed' }, { index: '9007199254740994', value: 'same' }])
    expect(cache.bytes).toBe(cache.rows.reduce((sum, row) => sum + Buffer.byteLength(JSON.stringify(row)), 0))
  })
  it('stops at row and encoded byte limits without discarding successful rows', () => {
    const rows = Array.from({ length: MAX_CACHED_KEYS + 1 }, (_, id) => ({ id, value: 'a' }))
    const limited = appendRows(emptyRowCache<{ id: number; value: string }>(), rows, row => String(row.id))
    expect(limited.rows).toHaveLength(MAX_CACHED_KEYS); expect(limited.limited).toBe(true)
    const prior = appendRows(emptyRowCache<{ id: number; value: string }>(), [{ id: 0, value: 'okay' }], row => String(row.id))
    const big = appendRows(prior, [{ id: 1, value: '界'.repeat(MAX_CACHED_KEY_BYTES) }], row => String(row.id))
    expect(big.rows).toEqual(prior.rows); expect(big.limited).toBe(true); expect(big.bytes).toBe(prior.bytes)
  })
})
