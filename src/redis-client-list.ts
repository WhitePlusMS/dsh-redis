import { CLIENT_LIST_FIELDS, MAX_CLIENT_LIST_BYTES, MAX_CLIENT_LIST_ROWS, type ClientListEntry, type ClientListField, type ClientListReadResult } from './domain.ts'

/** Missing fields are null; text is a bounded token, never a replacement decode. */
export function isClientListValue(field: ClientListField, value: unknown): value is string {
  if (typeof value !== 'string') return false
  if (field === 'flags') return /^[A-Za-z]{1,64}$/u.test(value)
  if (field === 'cmd') return /^[A-Za-z][A-Za-z0-9_.|:-]{0,127}$/u.test(value)
  if (field === 'addr' || field === 'name' || field === 'user') {
    if (value.length > 256 || /[\x00-\x20\x7f]/u.test(value) || (field === 'addr' && value.length === 0)) return false
    try { encodeURI(value) } catch { return false }
    return new TextEncoder().encode(value).length <= 512
  }
  return /^(?:0|[1-9]\d{0,19})$/u.test(value) && BigInt(value) <= 18446744073709551615n
}

/** The full bounded reply supplies the observed count. Only the first 200 rows
 * are interpreted/displayed, in server order; there is no server paging promise.
 */
export function parseClientList(text: string): Pick<ClientListReadResult, 'entries' | 'total' | 'limited'> {
  if (text.length > MAX_CLIENT_LIST_BYTES || new TextEncoder().encode(text).length > MAX_CLIENT_LIST_BYTES) throw new TypeError('Redis clients: budget exceeded')
  const lines = text.split(/\r?\n/u).filter(line => line.length > 0)
  const entries: ClientListEntry[] = lines.slice(0, MAX_CLIENT_LIST_ROWS).map(line => {
    const fields = Object.fromEntries(CLIENT_LIST_FIELDS.map(field => [field, null])) as Record<ClientListField, string | null>
    const seen = new Set<ClientListField>()
    for (const token of line.split(' ')) {
      const equal = token.indexOf('=')
      if (equal < 1) continue
      const name = token.slice(0, equal), field = CLIENT_LIST_FIELDS.find(field => field === name)
      if (field === undefined) continue
      if (seen.has(field)) throw new TypeError('Redis clients: repeated field')
      seen.add(field)
      const value = token.slice(equal + 1)
      if (isClientListValue(field, value)) fields[field] = value
    }
    return fields
  })
  const ids = entries.flatMap(entry => entry.id === null ? [] : [entry.id])
  if (new Set(ids).size !== ids.length) throw new TypeError('Redis clients: repeated ID')
  return { entries, total: lines.length, limited: lines.length > entries.length }
}
