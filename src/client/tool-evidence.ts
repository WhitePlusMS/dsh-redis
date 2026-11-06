/** Recorded tool results only: no live selection, network reads or model prose. */
export const evidenceTools = [
  'redis_viewer_status', 'redis_viewer_keys', 'redis_viewer_key_metadata', 'redis_viewer_value',
  'redis_viewer_filter_hash', 'redis_viewer_timeseries', 'redis_viewer_json_path', 'redis_viewer_geo',
  'redis_viewer_bitmap', 'redis_viewer_memory', 'redis_viewer_compare_strings', 'redis_viewer_slowlog',
  'redis_viewer_overview', 'redis_viewer_clients', 'redis_viewer_stream_groups', 'redis_viewer_select_db',
] as const

export type EvidenceNote = 'ttl' | 'scan' | 'memory' | 'explicit' | 'selected' | 'snapshot'
export interface EvidenceRow { readonly label: string; readonly value: string }
export interface RedisEvidence {
  readonly rows: readonly EvidenceRow[]
  readonly values: readonly EvidenceRow[]
  readonly details: readonly EvidenceRow[]
  readonly notes: readonly EvidenceNote[]
  readonly raw: string
}

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null
}
function scalar(value: unknown): string | null {
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' ? String(value) : null
}

/** Do not infer values from call arguments, another call or the current sidebar. */
export function redisEvidence(tool: string, text: string): RedisEvidence | null {
  if (text.length > 131072) return null
  let parsed: unknown
  try { parsed = JSON.parse(text) } catch { return null }
  const data = record(parsed)
  if (data === null || data.readOnly !== true) return null
  const rows: EvidenceRow[] = [], values: EvidenceRow[] = [], details: EvidenceRow[] = [], notes: EvidenceNote[] = []
  const add = (label: string, value: unknown) => { const rendered = scalar(value); if (rendered !== null) rows.push({ label, value: rendered }) }
  // Project only fields actually returned by this call. JSON quoting distinguishes
  // empty text, null and binary cells; ordered arrays retain duplicate Stream fields.
  const addValue = (label: string, value: unknown) => {
    if (value !== undefined) values.push({ label, value: JSON.stringify(value, null, 2) })
  }
  const connection = record(data.connection), value = record(data.value), metadata = record(data.metadata) ?? record(value?.metadata)
  if (connection !== null) {
    for (const key of ['db', 'state']) add(`connection.${key}`, connection[key])
    for (const key of ['id', 'generation']) {
      const rendered = scalar(connection[key])
      if (rendered !== null) details.push({ label: `connection.${key}`, value: rendered })
    }
    const target = record(connection.target)
    for (const key of ['host', 'port', 'tls']) add(`connection.target.${key}`, target?.[key])
  }
  for (const key of ['sampledAt', 'state', 'error', 'errorMessage', 'scope', 'pattern', 'source', 'selectionSync', 'type', 'ttlMs', 'returnedCount', 'totalCount', 'complete', 'scanComplete', 'bytes', 'requestedSamples', 'comparison', 'path', 'matchCount', 'from', 'to', 'count', 'offset', 'unit', 'geoIndexVerified', 'section', 'requestedCount', 'coverage']) add(key, data[key])
  if (data.actualSamples === null) add('actualSamples', 'null')
  for (const key of ['key', 'field', 'member', 'other']) add(`${key}.label`, record(data[key])?.label)
  if (value !== null) {
    for (const key of ['sampledAt', 'state', 'error', 'type', 'complete', 'scanComplete', 'offset', 'nextOffset', 'byteLength', 'score', 'pattern', 'direction', 'start', 'end']) add(`value.${key}`, value[key])
    for (const key of ['text', 'cell', 'entries', 'members', 'messages']) addValue(`value.${key}`, value[key])
    // Binary String windows have no valid UTF-8 text. Preserve their exact bytes.
    if (value.text === null) addValue('value.base64', value.base64)
  }
  for (const key of ['type', 'ttlMs', 'length']) add(`metadata.${key}`, metadata?.[key])
  for (const key of ['keys', 'matches', 'samples', 'coordinates', 'distance', 'bits', 'fields', 'missing', 'entries', 'clients', 'groups', 'left', 'right', 'selected', 'currentSelection']) addValue(key, data[key])
  // JSON.GET returns JSON source inside a string. Do not parse it: large integers
  // would lose precision, and [null] must remain distinct from no matches ([]).
  if (typeof data.matchesJson === 'string') values.push({ label: 'matchesJson', value: data.matchesJson })
  for (const [label, page] of [['cursor', data], ['value.cursor', value]] as const) {
    if (page !== null && Object.hasOwn(page, 'cursor')) addValue(label, page.cursor)
  }
  const counts = record(data.counts)
  if (counts !== null) for (const key of ['checked', 'matched', 'different', 'missingField', 'missingKey', 'notHash', 'typeChanged', 'failed']) add(`counts.${key}`, counts[key])
  if (tool === 'redis_viewer_key_metadata' || typeof metadata?.ttlMs === 'string') notes.push('ttl')
  if (tool === 'redis_viewer_keys' || tool === 'redis_viewer_filter_hash') notes.push('scan')
  if (tool === 'redis_viewer_memory') notes.push('memory')
  if (data.source === 'explicit') notes.push('explicit')
  if (data.source === 'selection') notes.push('selected')
  if (tool !== 'redis_viewer_status' && tool !== 'redis_viewer_select_db') notes.push('snapshot')
  // Keep decimal strings and JSON.GET source strings intact. Never coerce them to numbers.
  return { rows, values, details, notes, raw: JSON.stringify(data, null, 2) }
}
