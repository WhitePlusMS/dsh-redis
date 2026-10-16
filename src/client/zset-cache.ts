import { MAX_CACHED_KEYS, MAX_CACHED_KEY_BYTES, type ZSetEntry } from '../domain.ts'

export interface ZSetCache { readonly rows: readonly ZSetEntry[]; readonly bytes: number; readonly limited: boolean }
export const emptyZSetCache = (): ZSetCache => ({ rows: [], bytes: 0, limited: false })

/** Repeated ZSCAN members update their score, without inventing a global order. */
export function appendZSetRows(previous: ZSetCache, incoming: readonly ZSetEntry[]): ZSetCache {
  const rows = new Map(previous.rows.map(row => [row.member.base64, row]))
  let bytes = previous.bytes
  const size = (row: ZSetEntry): number => new TextEncoder().encode(JSON.stringify(row)).length
  for (const row of incoming) {
    const old = rows.get(row.member.base64), nextBytes = bytes - (old === undefined ? 0 : size(old)) + size(row)
    if ((old === undefined && rows.size >= MAX_CACHED_KEYS) || nextBytes > MAX_CACHED_KEY_BYTES) return { rows: [...rows.values()], bytes, limited: true }
    rows.set(row.member.base64, row); bytes = nextBytes
  }
  return { rows: [...rows.values()], bytes, limited: previous.limited }
}
