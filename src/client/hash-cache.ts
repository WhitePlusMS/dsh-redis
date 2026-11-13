import type { HashEntry } from '../domain.ts'
import { appendRows, emptyRowCache, type RowCache } from './row-cache.ts'

export type HashCache = RowCache<HashEntry>
export const emptyHashCache = emptyRowCache<HashEntry>

export function appendHashEntries(previous: HashCache, incoming: readonly HashEntry[]): HashCache {
  return appendRows(previous, incoming, row => row.field.base64)
}
