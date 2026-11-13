import type { ZSetEntry } from '../domain.ts'
import { appendRows, emptyRowCache, type RowCache } from './row-cache.ts'

export type ZSetCache = RowCache<ZSetEntry>
export const emptyZSetCache = emptyRowCache<ZSetEntry>

export function appendZSetRows(previous: ZSetCache, incoming: readonly ZSetEntry[]): ZSetCache {
  return appendRows(previous, incoming, row => row.member.base64)
}
