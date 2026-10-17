import { MAX_CACHED_KEYS, MAX_CACHED_KEY_BYTES } from '../domain.ts'
export interface RowCache<Row> { readonly rows: readonly Row[]; readonly bytes: number; readonly limited: boolean }
export const emptyRowCache = <Row>(): RowCache<Row> => ({ rows: [], bytes: 0, limited: false })

/** Live range pages retain original identities and share existing row/byte budgets.
 * Repeated identities update a row; this does not claim a transactional snapshot.
 */
export function appendRows<Row>(previous: RowCache<Row>, incoming: readonly Row[], identity: (row: Row) => string): RowCache<Row> {
  const rows = new Map(previous.rows.map(row => [identity(row), row]))
  const size = (row: Row): number => new TextEncoder().encode(JSON.stringify(row)).length
  let bytes = previous.bytes
  for (const row of incoming) {
    const id = identity(row), old = rows.get(id), next = bytes - (old === undefined ? 0 : size(old)) + size(row)
    if ((old === undefined && rows.size >= MAX_CACHED_KEYS) || next > MAX_CACHED_KEY_BYTES) return { rows: [...rows.values()], bytes, limited: true }
    rows.set(id, row); bytes = next
  }
  return { rows: [...rows.values()], bytes, limited: previous.limited }
}
