import { describe, expect, it } from 'vitest'
import type { RedisKey } from '../src/domain.ts'
import { appendKeys, emptyKeyCache } from '../src/client/key-cache.ts'
import { KEY_ROW_HEIGHT, KeyNamespaces, MAX_NAMESPACE_DEPTH, keyRowId, keyRowWindow, validSeparator } from '../src/client/key-namespaces.ts'

const key = (raw: string | Buffer, label = 'same label'): RedisKey => {
  const bytes = Buffer.from(raw)
  return { base64: bytes.toString('base64'), byteLength: bytes.length, label }
}
function reveal(index: KeyNamespaces, keys: readonly RedisKey[]) {
  return index.rows(new Set(keys.flatMap(value => index.path(value.base64) ?? [])), true)
}

describe('byte-identity namespace index', () => {
  it('separates leaf/folder collisions, empty segments and arbitrary binary prefixes', () => {
    const keys = ['', 'a', 'a:', 'a::x', ':x'].map(value => key(value))
    keys.push(key(Buffer.from([255, 58, 120])), key(Buffer.from([254, 58, 120])), key('�:x'))
    const index = new KeyNamespaces(':'); index.update(keys)
    const rows = reveal(index, keys), leaves = rows.filter(row => row.kind === 'key')
    expect(leaves.map(row => row.key.base64).sort()).toEqual(keys.map(value => value.base64).sort())
    expect(new Set(rows.map(row => row.id)).size).toBe(rows.length)
    expect(index.path(keys[1]!.base64)).toEqual([])
    expect(index.path(keys[2]!.base64)).toEqual(['namespace:YTo='])
    expect(rows.find(row => row.id === 'namespace:YTo=')).toMatchObject({ kind: 'namespace', count: 2 })
    expect(index.path(keys[5]!.base64)).not.toEqual(index.path(keys[6]!.base64))
    expect(index.path(keys[6]!.base64)).not.toEqual(index.path(keys[7]!.base64))
    expect(leaves.find(row => row.key.base64 === '')).toMatchObject({ id: keyRowId(''), depth: 0 })
  })
  it('appends pages without recounting duplicate identities and resets a replacement cache', () => {
    const first = key('one:a'), next = key('one:b'), other = key('two:a')
    const index = new KeyNamespaces(':')
    let cache = appendKeys(emptyKeyCache(), [first]); index.update(cache.keys)
    const initialRevision = index.revision
    expect(index.rows(new Set(), true)).toMatchObject([{ count: 1 }])
    cache = appendKeys(cache, [first, next, other]); index.update(cache.keys); index.update(cache.keys)
    expect(index.revision).toBe(initialRevision)
    expect(index.rows(new Set(), true).map(row => row.kind === 'namespace' ? row.count : 0)).toEqual([2, 1])
    index.update([key('one:c')])
    expect(index.revision).toBeGreaterThan(initialRevision)
    expect(index.path(first.base64)).toBeUndefined()
    expect(reveal(index, [key('one:c')]).filter(row => row.kind === 'key')).toHaveLength(1)
    index.update([]); expect(index.rows(new Set(), true)).toEqual([])
  })
  it('uses complete UTF-8 separator bytes without merging normalized or BOM prefixes', () => {
    const keys = ['a分隔b分隔c', 'a分隔', 'a分隔分隔x', 'é分隔x', 'é分隔x', '\uFEFF分隔x'].map(value => key(value))
    const index = new KeyNamespaces('分隔'); index.update(keys)
    expect(reveal(index, keys).filter(row => row.kind === 'key')).toHaveLength(keys.length)
    expect(index.path(keys[3]!.base64)).not.toEqual(index.path(keys[4]!.base64))
    expect(index.rows(new Set(), true).map(row => row.label)).toContain('"\uFEFF"')
    for (const separator of [':', '::', '/', '分隔', '\uFEFF']) expect(validSeparator(separator)).toBe(true)
    for (const separator of ['', 'x'.repeat(17), '界'.repeat(6), '\ud800']) {
      expect(validSeparator(separator)).toBe(false)
      expect(() => new KeyNamespaces(separator)).toThrow()
    }
  })
  it('bounds deep hierarchy while preserving the full remaining key and selection path', () => {
    const value = key('x:'.repeat(32768)), index = new KeyNamespaces(':')
    index.update([value]); const rows = reveal(index, [value])
    expect(index.path(value.base64)).toHaveLength(MAX_NAMESPACE_DEPTH)
    expect(rows).toHaveLength(MAX_NAMESPACE_DEPTH + 1)
    expect(rows.at(-1)).toMatchObject({ kind: 'key', key: value, depth: MAX_NAMESPACE_DEPTH })
    expect(index.rows(new Set(), false)).toMatchObject([{ key: value, depth: 0, label: value.label }])
  })
  it('honours bounded cache identities and loaded counts across 5000 keys and filter replacement', () => {
    const incoming = Array.from({ length: 5001 }, (_, i) => key(`app:${i % 10}:${i}`))
    const cache = appendKeys(emptyKeyCache(), incoming), index = new KeyNamespaces(':')
    index.update(cache.keys)
    expect(cache.limited).toBe(true)
    expect(index.rows(new Set(), true)).toMatchObject([{ count: 5000 }])
    expect(index.path(incoming[5000]!.base64)).toBeUndefined()
    expect(reveal(index, cache.keys).filter(row => row.kind === 'key')).toHaveLength(5000)
    index.update([incoming[5000]!])
    expect(index.rows(new Set(), true)).toMatchObject([{ count: 1 }])
    expect(index.path(incoming[0]!.base64)).toBeUndefined()
  })
})

describe('large key viewport', () => {
  it('covers visible rows with bounded overscan at top, middle, bottom and after cache shrink', () => {
    for (const count of [0, 1, 5000, 85000]) for (const height of [60, 257, 1000]) for (const scrollTop of [0, 1, 3000, 1e8]) {
      const { start, end } = keyRowWindow(count, scrollTop, height)
      expect(start).toBeGreaterThanOrEqual(0); expect(end).toBeLessThanOrEqual(count)
      expect(end).toBeGreaterThanOrEqual(start)
      expect(end - start).toBeLessThanOrEqual(Math.ceil(height / KEY_ROW_HEIGHT) + 13)
      const actualTop = Math.max(0, Math.min(scrollTop, Math.max(0, count * KEY_ROW_HEIGHT - height)))
      expect(start * KEY_ROW_HEIGHT).toBeLessThanOrEqual(actualTop)
      expect(end * KEY_ROW_HEIGHT).toBeGreaterThanOrEqual(Math.min(count * KEY_ROW_HEIGHT, actualTop + height))
    }
  })
})
