/** Declared SDK baseline, not a runtime version probe. */
export const DSH_BASELINE = '0.2.1-rc.5' as const
export const PROTOCOL_VERSION = 15 as const
export type EmptyRequest = Record<string, never>

/** Current conversation's AI result budget, without Redis contents. */
export interface AiBudgetStatus { readonly callsUsed: number; readonly maxCalls: number; readonly bytesUsed: number; readonly maxBytes: number; readonly inFlight: number; readonly stopped: boolean }
export interface AiBudgetResume { readonly accepted: boolean; readonly status: AiBudgetStatus }

/** Public Host status contains no connection credentials or Redis data. */
export interface RedisHostStatus {
  readonly state: 'ready'
  readonly readOnly: true
  readonly dshBaseline: typeof DSH_BASELINE
  readonly protocolVersion: typeof PROTOCOL_VERSION
}

/** Credentials are input-only and never appear in a public connection view. */
export interface ConnectionRequest {
  readonly host: string
  readonly port: number
  readonly username: string
  readonly password: string
  /** User-supplied label; an absent label means the environment is unknown. */
  readonly environment?: string
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
  readonly target: { readonly host: string; readonly port: number; readonly username: string; readonly environment?: string; readonly tls: boolean } | null
}

/** Saved connection settings contain no password or live socket identity. */
export type ConnectionSettings = Omit<ConnectionRequest, 'password'>
export interface SavedConnection { readonly id: string; readonly name: string; readonly group?: string; readonly settings: ConnectionSettings }
export interface SaveProfileRequest { readonly id: string | null; readonly name: string; readonly group?: string; readonly settings: ConnectionSettings }
export interface ProfileId { readonly id: string }
export interface ProfileCollection { readonly profiles: readonly SavedConnection[]; readonly selectedId: string | null }
export const MAX_PROFILES = 50
export const MAX_INFO_BYTES = 128 * 1024

/** DB and opaque scan cursors are bound to a Host-issued connection generation. */
export interface DatabaseTarget extends ConnectionTarget { readonly db: number }
/** Write permission is scoped to the current session and exact connection. */
export interface RedisWriteModeRequest { readonly target: DatabaseTarget; readonly enabled: boolean }
export interface RedisWriteModeStatus { readonly connection: ConnectionView; readonly enabled: boolean }
/** Current UI identity only; never cache cell values or credentials here. */
export type RedisSelectionItem =
  | { readonly kind: 'hash'; readonly fieldBase64: string }
  | { readonly kind: 'list'; readonly index: string }
  | { readonly kind: 'set'; readonly memberBase64: string }
  | { readonly kind: 'zset'; readonly memberBase64: string }
  | { readonly kind: 'stream'; readonly id: string; readonly fieldIndex: number; readonly fieldBase64: string }
export interface RedisSelection { readonly keyBase64: string; readonly item: RedisSelectionItem | null }
export interface SetSelectionRequest { readonly target: DatabaseTarget; readonly selection: RedisSelection | null }
export interface SelectionAck { readonly accepted: boolean }

/** UI action frames contain identities only, never Redis values or credentials. */
export type UiActionOutcome = 'applied' | 'unknown' | 'unsupported' | 'failed' | 'stale' | 'cancelled' | 'timeout' | 'disconnected' | 'no_receiver' | 'ambiguous' | 'busy'
export type UiAction = { readonly kind: 'show' } | { readonly kind: 'confirmSelection' } | { readonly kind: 'refresh'; readonly target: DatabaseTarget; readonly keyBase64: string } | { readonly kind: 'applyMatch'; readonly target: DatabaseTarget; readonly pattern: string } | { readonly kind: 'setFormat'; readonly keyBase64: string; readonly format: PreviewFormat } | { readonly kind: 'selectKey'; readonly key: RedisKey } | { readonly kind: 'selectHashField'; readonly keyBase64: string; readonly field: RedisKey } | { readonly kind: 'selectListIndex'; readonly keyBase64: string; readonly index: string } | { readonly kind: 'selectSetMember'; readonly keyBase64: string; readonly member: RedisKey } | { readonly kind: 'selectZSetMember'; readonly keyBase64: string; readonly member: RedisKey } | { readonly kind: 'selectStreamField'; readonly keyBase64: string; readonly id: string; readonly fieldIndex: number; readonly fieldBase64: string }
export interface UiActionRequest<Action> { readonly requestId: string; readonly action: Action; readonly target: DatabaseTarget | null; readonly selectionRevision: number; readonly expiresAt: number }
export interface UiActionAck { readonly requestId: string; readonly target: DatabaseTarget | null; readonly selectionRevision: number; readonly outcome: 'applied' | 'unsupported' | 'failed' | 'stale' | 'ambiguous' }
export type UiChannelInput = UiActionAck | { readonly kind: 'selection'; readonly revision: number; readonly synchronized: boolean } | { readonly kind: 'publishSelection'; readonly requestId: string; readonly revision: number; readonly request: SetSelectionRequest; readonly actionRequestId?: string } | { readonly kind: 'commitSelection'; readonly requestId: string; readonly revision: number; readonly nextRevision: number }
export type UiChannelMessage = { readonly kind: 'action'; readonly request: UiActionRequest<UiAction> } | { readonly kind: 'cancel'; readonly requestId: string } | { readonly kind: 'selectionResult'; readonly requestId: string; readonly accepted: boolean }
export interface ScanKeysRequest { readonly target: DatabaseTarget; readonly pattern: string; readonly cursor: string | null }
export interface RedisKey { readonly base64: string; readonly byteLength: number; readonly label: string }
export interface ScanKeysResult {
  readonly state: 'page' | 'failed'
  readonly error: ConnectionErrorCode | null
  readonly keys: readonly RedisKey[]
  readonly cursor: string | null
  readonly sampledAt: string
}
/** Read-only DB directory. Null means metadata is unavailable, never an empty DB. */
export interface DatabaseKeyCount { readonly db: number; readonly keys: string }
export interface DatabaseCatalog {
  readonly databaseCount: number | null
  readonly keyspace: readonly DatabaseKeyCount[] | null
  readonly currentKeys: string | null
}
export interface DatabasesReadRequest { readonly target: DatabaseTarget }
export interface DatabasesReadResult {
  readonly state: 'value' | 'failed'
  readonly error: ConnectionErrorCode | null
  readonly catalog: DatabaseCatalog | null
  readonly sampledAt: string
}
export const MAX_DATABASE_ENTRIES = 4096
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
/** A direct Hash field sample is separate from HSCAN and its pagination state. */
export interface HashFieldReadRequest { readonly target: DatabaseTarget; readonly keyBase64: string; readonly fieldBase64: string }
export interface ActionPointReadResult {
  readonly state: 'value' | 'selection-missing' | 'missing' | 'changed' | 'failed'
  readonly error: ConnectionErrorCode | null
  readonly cell: BytePrefix | null
  readonly score: string | null
  readonly streamMessage: StreamMessage | null
  readonly sampledAt: string
}
/** A UI action samples only the exact item held by its Host-owned request. */
export interface ActionPointReadRequest { readonly requestId: string }
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
/** A direct membership sample never advances the Set scan. */
export interface SetMemberReadRequest { readonly target: DatabaseTarget; readonly keyBase64: string; readonly memberBase64: string }
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

/** UI preferences belong to the trusted Host session, never to a live socket.
 * Only selections survive a sidebar remount; values, credentials and cursors do not.
 */
export const PREVIEW_FORMATS = ['text', 'json', 'hex', 'base64'] as const
export type PreviewFormat = typeof PREVIEW_FORMATS[number]
export const PREVIEW_VIEWS = ['string', 'hash', 'list', 'set', 'zset', 'stream'] as const
export type PreviewView = typeof PREVIEW_VIEWS[number]
