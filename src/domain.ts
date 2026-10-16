/** Exact runtime baseline selected by the user. */
export const DSH_VERSION = '0.2.0-rc.2' as const
export const PROTOCOL_VERSION = 1 as const
export type EmptyRequest = Record<string, never>

/** Public Host status contains no connection credentials or Redis data. */
export interface RedisHostStatus {
  readonly state: 'ready'
  readonly readOnly: true
  readonly hostVersion: typeof DSH_VERSION
  readonly protocolVersion: typeof PROTOCOL_VERSION
}

/** Credentials are input-only and never appear in a public connection view. */
export interface ConnectionRequest {
  readonly host: string
  readonly port: number
  readonly username: string
  readonly password: string
  readonly tls: { readonly caPem: string } | null
}
export interface ConnectionTarget { readonly id: string; readonly generation: number }
export type ConnectionErrorCode = 'auth' | 'network' | 'timeout' | 'cancelled' | 'stale' | 'tls-certificate' | 'tls-hostname' | 'permission' | 'oversize' | 'protocol' | 'busy' | 'database' | 'type-changed'
export interface ConnectionView {
  readonly id: string | null
  readonly generation: number
  readonly db: number
  readonly state: 'connecting' | 'connected' | 'disconnected' | 'error'
  readonly error: ConnectionErrorCode | null
  readonly target: { readonly host: string; readonly port: number; readonly username: string; readonly tls: boolean } | null
}
export interface ConnectionTestResult {
  readonly outcome: 'passed' | 'failed'
  readonly error: ConnectionErrorCode | null
}

/** Saved connection settings contain no password or live socket identity. */
export type ConnectionSettings = Omit<ConnectionRequest, 'password'>
export interface SavedConnection { readonly id: string; readonly name: string; readonly settings: ConnectionSettings }
export interface SaveProfileRequest { readonly id: string | null; readonly name: string; readonly settings: ConnectionSettings }
export interface ProfileId { readonly id: string }
export interface ProfileCollection { readonly profiles: readonly SavedConnection[]; readonly selectedId: string | null }
export const MAX_PROFILES = 50

/** DB and opaque scan cursors are bound to a Host-issued connection generation. */
export interface DatabaseTarget extends ConnectionTarget { readonly db: number }
export interface ScanKeysRequest { readonly target: DatabaseTarget; readonly pattern: string; readonly cursor: string | null }
export interface RedisKey { readonly base64: string; readonly byteLength: number; readonly label: string }
export interface ScanKeysResult {
  readonly state: 'page' | 'failed'
  readonly error: ConnectionErrorCode | null
  readonly keys: readonly RedisKey[]
  readonly cursor: string | null
  readonly sampledAt: string
}
export const MAX_KEY_BYTES = 65536
export const MAX_SCAN_KEYS = 4096
export const MAX_SCAN_JSON_BYTES = 1024 * 1024
export const MAX_CACHED_KEYS = 5000
export const MAX_CACHED_KEY_BYTES = 2 * 1024 * 1024

/** Integer text preserves Redis's signed-64-bit positions and millisecond TTLs. */
export interface StringReadRequest { readonly target: DatabaseTarget; readonly keyBase64: string; readonly offset: string; readonly count: number }
export interface KeyMetadata { readonly type: string; readonly ttlMs: string; readonly length: string | null }
export interface StringReadResult {
  readonly state: 'value' | 'missing' | 'unsupported' | 'changed' | 'failed'
  readonly error: ConnectionErrorCode | null
  readonly metadata: KeyMetadata | null
  readonly offset: string
  readonly base64: string
  readonly byteLength: number
  readonly prefix: string
  readonly suffix: string
  readonly complete: boolean
  readonly nextOffset: string | null
  readonly sampledAt: string
}
export const MAX_VALUE_BYTES = 65536

/** HSCAN returns whole values; the wire frame is bounded before decoding, while
 * only this prefix is sent to the UI. A prefix is never a full-value identity.
 */
export interface BytePrefix { readonly base64: string; readonly byteLength: number; readonly fullByteLength: number; readonly suffix: string }
export interface HashEntry { readonly field: RedisKey; readonly value: BytePrefix }
export interface ScanHashRequest { readonly target: DatabaseTarget; readonly keyBase64: string; readonly pattern: string; readonly cursor: string | null }
export interface ScanHashResult {
  readonly state: 'page' | 'missing' | 'unsupported' | 'changed' | 'failed'
  readonly error: ConnectionErrorCode | null
  readonly metadata: KeyMetadata | null
  readonly entries: readonly HashEntry[]
  readonly cursor: string | null
  readonly sampledAt: string
}

/** A List row is identified by its original zero-based position, not its value. */
export interface ListReadRequest { readonly target: DatabaseTarget; readonly keyBase64: string; readonly offset: string; readonly count: number }
export interface ListEntry { readonly index: string; readonly value: BytePrefix }
export interface ListReadResult {
  readonly state: 'page' | 'missing' | 'unsupported' | 'changed' | 'failed'
  readonly error: ConnectionErrorCode | null
  readonly metadata: KeyMetadata | null
  readonly entries: readonly ListEntry[]
  readonly offset: string
  readonly nextOffset: string | null
  readonly sampledAt: string
}
export const MAX_LIST_ITEMS = 100

/** Members use the same complete raw-byte identity as keys and Hash fields.
 * Oversized identities are refused, never silently replaced by a prefix.
 */
export interface ScanSetRequest { readonly target: DatabaseTarget; readonly keyBase64: string; readonly pattern: string; readonly cursor: string | null }
export interface ScanSetResult {
  readonly state: 'page' | 'missing' | 'unsupported' | 'changed' | 'failed'
  readonly error: ConnectionErrorCode | null
  readonly metadata: KeyMetadata | null
  readonly members: readonly RedisKey[]
  readonly cursor: string | null
  readonly sampledAt: string
}

/** Rank intervals are ascending score order; scan pages have no rank or sort. */
export type ZSetReadRequest =
  | { readonly target: DatabaseTarget; readonly keyBase64: string; readonly mode: 'range'; readonly offset: string; readonly count: number }
  | { readonly target: DatabaseTarget; readonly keyBase64: string; readonly mode: 'scan'; readonly pattern: string; readonly cursor: string | null }
export interface ZSetEntry { readonly member: RedisKey; readonly score: string; readonly rank: string | null }
export interface ZSetReadResult {
  readonly state: 'page' | 'missing' | 'unsupported' | 'changed' | 'failed'
  readonly error: ConnectionErrorCode | null
  readonly metadata: KeyMetadata | null
  readonly mode: 'range' | 'scan'
  readonly entries: readonly ZSetEntry[]
  readonly offset: string | null
  readonly nextOffset: string | null
  readonly cursor: string | null
  readonly sampledAt: string
}

/** Fields stay in ordered pairs: repeated names are distinct occurrences. */
export interface StreamField { readonly field: RedisKey; readonly value: BytePrefix }
export interface StreamMessage { readonly id: string; readonly fields: readonly StreamField[] }
export interface StreamReadRequest {
  readonly target: DatabaseTarget
  readonly keyBase64: string
  readonly direction: 'forward' | 'reverse'
  readonly start: string
  readonly end: string
  readonly count: number
  readonly cursor: string | null
}
export interface StreamReadResult {
  readonly state: 'page' | 'missing' | 'unsupported' | 'changed' | 'failed'
  readonly error: ConnectionErrorCode | null
  readonly metadata: KeyMetadata | null
  readonly direction: 'forward' | 'reverse'
  readonly start: string
  readonly end: string
  readonly messages: readonly StreamMessage[]
  readonly cursor: string | null
  readonly sampledAt: string
}
export const MAX_STREAM_MESSAGES = 100

/** JSON.GET returns a complete JSONPath match array, never a byte-window page. */
export const JSON_VALUE_TYPES = ['null', 'boolean', 'integer', 'number', 'string', 'object', 'array'] as const
export type JsonValueType = typeof JSON_VALUE_TYPES[number]
export interface JsonReadRequest { readonly target: DatabaseTarget; readonly keyBase64: string; readonly path: string }
export interface JsonReadResult {
  readonly state: 'value' | 'missing' | 'unsupported' | 'changed' | 'path-missing' | 'unavailable' | 'invalid-path' | 'failed'
  readonly error: ConnectionErrorCode | null
  readonly metadata: KeyMetadata | null
  readonly path: string
  readonly matchTypes: readonly JsonValueType[]
  readonly base64: string
  readonly byteLength: number
  readonly sampledAt: string
}

/** Explicit coordinate interpretation, never a new Redis TYPE or Geo detection. */
export interface GeoPosition { readonly longitude: string; readonly latitude: string }
export interface GeoEntry extends ZSetEntry { readonly rank: string; readonly position: GeoPosition | null }
export interface GeoReadRequest { readonly target: DatabaseTarget; readonly keyBase64: string; readonly offset: string; readonly count: number }
export interface GeoReadResult {
  readonly state: 'page' | 'missing' | 'unsupported' | 'changed' | 'unavailable' | 'failed'
  readonly error: ConnectionErrorCode | null
  readonly metadata: KeyMetadata | null
  readonly entries: readonly GeoEntry[]
  readonly offset: string
  readonly nextOffset: string | null
  readonly sampledAt: string
}
export const MAX_GEO_ARGUMENT_BYTES = 96 * 1024

/** HLL is a String interpretation; only a successful server merge validates it. */
export interface HllReadRequest { readonly target: DatabaseTarget; readonly keyBase64: string }
export interface HllReadResult {
  readonly state: 'value' | 'missing' | 'unsupported' | 'changed' | 'invalid' | 'unavailable' | 'failed'
  readonly error: ConnectionErrorCode | null
  readonly metadata: KeyMetadata | null
  readonly estimate: string | null
  readonly encoding: 'dense' | 'sparse' | null
  readonly cacheValid: boolean | null
  readonly sampledAt: string
}

/** Inclusive Unix-millisecond bounds and decimal strings never pass through Number. */
export interface TimeSeriesSample { readonly timestamp: string; readonly value: string }
export interface TimeSeriesInfo { readonly totalSamples: string; readonly firstTimestamp: string; readonly lastTimestamp: string; readonly retentionTime: string }
export interface TimeSeriesReadRequest {
  readonly target: DatabaseTarget
  readonly keyBase64: string
  readonly direction: 'forward' | 'reverse'
  readonly start: string
  readonly end: string
  readonly count: number
  readonly cursor: string | null
}
export interface TimeSeriesReadResult {
  readonly state: 'page' | 'missing' | 'unsupported' | 'changed' | 'unavailable' | 'failed'
  readonly error: ConnectionErrorCode | null
  readonly metadata: KeyMetadata | null
  readonly direction: 'forward' | 'reverse'
  readonly start: string
  readonly end: string
  readonly samples: readonly TimeSeriesSample[]
  readonly info: TimeSeriesInfo | null
  readonly infoState: 'available' | 'permission' | 'unavailable' | null
  readonly cursor: string | null
  readonly sampledAt: string
}
export const MAX_TIMESERIES_SAMPLES = 100

/** One explicit item per query, separate from the information-only first read. */
export const MAX_BLOOM_ITEM_BYTES = 4096
export interface BloomInfo { readonly capacity: string; readonly size: string; readonly filters: string; readonly inserted: string; readonly expansion: string | null }
export interface BloomReadRequest { readonly target: DatabaseTarget; readonly keyBase64: string; readonly itemBase64: string | null }
export interface BloomReadResult {
  readonly state: 'value' | 'missing' | 'unsupported' | 'changed' | 'unavailable' | 'failed'
  readonly error: ConnectionErrorCode | null
  readonly metadata: KeyMetadata | null
  readonly info: BloomInfo | null
  readonly infoState: 'available' | 'permission' | 'unavailable' | null
  readonly itemBase64: string | null
  readonly membership: 'absent' | 'maybe-present' | null
  readonly sampledAt: string
}
