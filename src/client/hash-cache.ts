import { MAX_CACHED_KEYS, MAX_CACHED_KEY_BYTES, type HashEntry } from '../domain.ts'

export interface HashCache { readonly rows: readonly HashEntry[]; readonly bytes: number; readonly limited: boolean }
export const emptyHashCache = (): HashCache => ({ rows: [], bytes: 0, limited: false })

/** HSCAN may repeat a field with a newer value. Replace by raw identity, budget
 * its replacement too, and explicitly stop if the complete page cannot fit.
 */
export function appendHashEntries(previous: HashCache, incoming: readonly HashEntry[]): HashCache {
  const rows = new Map(previous.rows.map(row => [row.field.base64, row]))
  const size = (row: HashEntry) => new TextEncoder().encode(JSON.stringify(row)).length
  let bytes = previous.bytes
  for (const row of incoming) {
    const old = rows.get(row.field.base64), nextBytes = bytes - (old === undefined ? 0 : size(old)) + size(row)
    if ((old === undefined && rows.size >= MAX_CACHED_KEYS) || nextBytes > MAX_CACHED_KEY_BYTES) return { rows: [...rows.values()], bytes, limited: true }
    rows.set(row.field.base64, row); bytes = nextBytes
  }
  return { rows: [...rows.values()], bytes, limited: previous.limited }
}
