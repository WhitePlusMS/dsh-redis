import { MAX_INFO_BYTES, OVERVIEW_FIELDS, type OverviewField, type OverviewFields } from './domain.ts'

/** INFO is extensible. Only these bounded fields cross the Host/Client boundary. */
export function isOverviewValue(field: OverviewField, value: unknown): value is string {
  if (typeof value !== 'string') return false
  if (field === 'redis_version' || field === 'redis_mode') return /^[A-Za-z0-9_.-]{1,64}$/u.test(value)
  return /^(?:0|[1-9]\d{0,19})$/u.test(value) && BigInt(value) <= 18446744073709551615n
}

/** The interpretation budget is in addition to the existing RESP receive cap.
 * Missing/invalid fields remain null; a repeated selected field is ambiguous.
 */
export function parseRedisInfo(text: string): OverviewFields {
  if (text.length > MAX_INFO_BYTES || new TextEncoder().encode(text).length > MAX_INFO_BYTES) throw new TypeError('Redis INFO: budget exceeded')
  const fields = Object.fromEntries(OVERVIEW_FIELDS.map(field => [field, null])) as Record<OverviewField, string | null>
  const seen = new Set<OverviewField>()
  for (const line of text.split(/\r?\n/u)) {
    const colon = line.indexOf(':')
    if (colon < 1 || line.startsWith('#')) continue
    const name = line.slice(0, colon), field = OVERVIEW_FIELDS.find(field => field === name)
    if (field === undefined) continue
    if (seen.has(field)) throw new TypeError('Redis INFO: repeated field')
    seen.add(field)
    const value = line.slice(colon + 1)
    if (isOverviewValue(field, value)) fields[field] = value
  }
  return fields
}
