import { MAX_DATABASE_ENTRIES, type DatabasesReadRequest, type DatabasesReadResult, type DatabaseCatalog } from './domain.ts'
import type { InvocationDescriptor, TypertSchema } from '@deepseek-ai/dsh-typert-protocol'
import type { UiAction, UiActionAck, UiChannelInput, UiChannelMessage } from './domain.ts'
import type { RedisSelection, RedisSelectionItem, SetSelectionRequest, SelectionAck } from './domain.ts'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { AiBudgetResume, AiBudgetStatus } from './domain.ts'
import type { ConnectionRequest, ConnectionTarget, ConnectionView, ConnectionErrorCode } from './domain.ts'
import { DSH_VERSION, PROTOCOL_VERSION, type EmptyRequest, type RedisHostStatus } from './domain.ts'
import { MAX_PROFILES, type ConnectionSettings, type SavedConnection, type SaveProfileRequest, type ProfileId, type ProfileCollection } from './domain.ts'
import { MAX_KEY_BYTES, MAX_SCAN_KEYS, MAX_SCAN_JSON_BYTES, type DatabaseTarget, type RedisKey, type ScanKeysRequest, type ScanKeysResult } from './domain.ts'
import { MAX_VALUE_BYTES, type StringReadRequest, type StringReadResult, type KeyMetadata } from './domain.ts'
import type { ActionPointReadRequest, ActionPointReadResult, BytePrefix, HashFieldReadRequest, ScanHashRequest, ScanHashResult } from './domain.ts'
import { MAX_LIST_ITEMS, type ListReadRequest, type ListReadResult } from './domain.ts'
import type { ScanSetRequest, ScanSetResult, SetMemberReadRequest } from './domain.ts'
import type { ZSetReadRequest, ZSetReadResult } from './domain.ts'
import { isRedisScore } from './redis-score.ts'
import { MAX_STREAM_MESSAGES, type StreamReadRequest, type StreamReadResult } from './domain.ts'
import { compareStreamIds, isStreamId, isStreamRange, withinStreamRange } from './stream-id.ts'

export const TYPERT_PACKAGE = 'dsh-redis'

function objectAt(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new TypeError('Redis RPC: expected object')
  const object = value as Record<string, unknown>
  if (Object.keys(object).some(key => !keys.includes(key))) throw new TypeError('Redis RPC: unexpected field')
  return object
}

export const emptyRequestSchema: TypertSchema<EmptyRequest> = { parse(value) {
  objectAt(value, [])
  return {}
} }

export const statusSchema: TypertSchema<RedisHostStatus> = { parse(value) {
  const object = objectAt(value, ['state', 'readOnly', 'hostVersion', 'protocolVersion'])
  if (object.state !== 'ready' || object.readOnly !== true || object.hostVersion !== DSH_VERSION || object.protocolVersion !== PROTOCOL_VERSION) throw new TypeError('Redis RPC: invalid Host status')
  return { state: 'ready', readOnly: true, hostVersion: DSH_VERSION, protocolVersion: PROTOCOL_VERSION }
} }

const sessionIdSchema: TypertSchema<SessionId> = { parse(value) {
  if (typeof value !== 'string' || value.length === 0) throw new TypeError('Redis RPC: invalid session')
  return value as SessionId
} }

/** Adapted from Git Graph: strict, Agent-scoped direct invocation with cancellation. */
export function createRedisInvocation(method: string, inputSymbol: string, resultSymbol: string, input: TypertSchema, result: TypertSchema, session: TypertSchema): InvocationDescriptor {
  return {
    id: `${TYPERT_PACKAGE}#redisViewer/${method}`, service: 'redisViewer', namespace: 'redisViewer', method,
    invocation: { kind: 'direct' }, cancellation: { parameter: 'signal' },
    scope: { context: 'agent', wire: 'agentId' },
    parameters: [
      { name: 'agent', wire: 'agentId', source: 'lookup', lookup: 'agent', codec: { mode: 'strict', typeSymbol: '@deepseek-ai/dsh-session/types#SessionId', create: () => session } },
      { name: 'request', wire: 'request', source: 'json', codec: { mode: 'strict', typeSymbol: `${TYPERT_PACKAGE}#${inputSymbol}`, create: () => input } },
    ],
    // rc.2 uses create on the Host, but only decode at the browser wire boundary.
    // Keep one schema for both sides, before any result reaches UI state/cache.
    result: { mode: 'strict', typeSymbol: `${TYPERT_PACKAGE}#${resultSymbol}`, create: () => result, decode: value => result.parse(value) },
  }
}

function stringAt(value: unknown, max: number): string {
  if (typeof value !== 'string' || value.length > max) throw new TypeError('Redis RPC: invalid string')
  return value
}
function integerAt(value: unknown, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min || value > max) throw new TypeError('Redis RPC: invalid integer')
  return value
}
function errorAt(value: unknown): ConnectionErrorCode | null {
  if (value === null || value === 'auth' || value === 'network' || value === 'timeout' || value === 'cancelled' || value === 'stale' || value === 'tls-certificate' || value === 'tls-hostname' || value === 'permission' || value === 'oversize' || value === 'protocol' || value === 'busy' || value === 'database' || value === 'type-changed') return value
  throw new TypeError('Redis RPC: invalid connection error')
}
function address(value: unknown): Pick<ConnectionRequest, 'host' | 'port' | 'username'> {
  const object = objectAt(value, ['host', 'port', 'username'])
  const host = stringAt(object.host, 253)
  if (host.length === 0 || /[\s/\\@?#\0]/u.test(host)) throw new TypeError('Redis RPC: invalid host')
  return { host, port: integerAt(object.port, 1, 65535), username: stringAt(object.username, 256) }
}
function environmentAt(value: unknown): string | undefined {
  if (value === undefined) return undefined
  const environment = stringAt(value, 80)
  if (environment.length === 0 || environment.trim() !== environment || /[\u0000-\u001f\u007f]/u.test(environment)) throw new TypeError('Redis RPC: invalid environment')
  return environment
}
function publicTarget(value: unknown): NonNullable<ConnectionView['target']> {
  const object = objectAt(value, ['host', 'port', 'username', 'environment', 'tls'])
  if (typeof object.tls !== 'boolean') throw new TypeError('Redis RPC: invalid TLS status')
  const environment = environmentAt(object.environment)
  return { ...address({ host: object.host, port: object.port, username: object.username }), ...(environment === undefined ? {} : { environment }), tls: object.tls }
}
export const connectionRequestSchema: TypertSchema<ConnectionRequest> = { parse(value) {
  const object = objectAt(value, ['host', 'port', 'username', 'password', 'environment', 'tls'])
  const tls = object.tls === null ? null : { caPem: stringAt(objectAt(object.tls, ['caPem']).caPem, 65536) }
  const environment = environmentAt(object.environment)
  return { ...address({ host: object.host, port: object.port, username: object.username }), password: stringAt(object.password, 4096), ...(environment === undefined ? {} : { environment }), tls }
} }
export const connectionTargetSchema: TypertSchema<ConnectionTarget> = { parse(value) {
  const object = objectAt(value, ['id', 'generation'])
  const id = stringAt(object.id, 128)
  if (id.length === 0) throw new TypeError('Redis RPC: missing connection identity')
  return { id, generation: integerAt(object.generation, 1, Number.MAX_SAFE_INTEGER) }
} }
export const connectionViewSchema: TypertSchema<ConnectionView> = { parse(value) {
  const object = objectAt(value, ['id', 'generation', 'db', 'state', 'error', 'target'])
  const state = object.state
  if (state !== 'connecting' && state !== 'connected' && state !== 'disconnected' && state !== 'error') throw new TypeError('Redis RPC: invalid state')
  return { id: object.id === null ? null : stringAt(object.id, 128), generation: integerAt(object.generation, 0, Number.MAX_SAFE_INTEGER), db: integerAt(object.db, 0, 65535), state, error: errorAt(object.error), target: object.target === null ? null : publicTarget(object.target) }
} }

function profileIdentity(value: unknown): string {
  const id = stringAt(value, 128)
  if (id.length === 0) throw new TypeError('Redis RPC: missing profile identity')
  return id
}
function profileName(value: unknown): string {
  const name = stringAt(value, 80)
  if (name.length === 0 || name.trim() !== name) throw new TypeError('Redis RPC: invalid profile name')
  return name
}
export const connectionSettingsSchema: TypertSchema<ConnectionSettings> = { parse(value) {
  const object = objectAt(value, ['host', 'port', 'username', 'environment', 'tls'])
  const { password: _password, ...settings } = connectionRequestSchema.parse({ ...object, password: '' })
  return settings
} }
export const saveProfileSchema: TypertSchema<SaveProfileRequest> = { parse(value) {
  const object = objectAt(value, ['id', 'name', 'group', 'settings'])
  return { id: object.id === null ? null : profileIdentity(object.id), name: profileName(object.name), ...(object.group === undefined ? {} : { group: profileName(object.group) }), settings: connectionSettingsSchema.parse(object.settings) }
} }
export const profileIdSchema: TypertSchema<ProfileId> = { parse(value) {
  return { id: profileIdentity(objectAt(value, ['id']).id) }
} }
export const profileCollectionSchema: TypertSchema<ProfileCollection> = { parse(value) {
  const object = objectAt(value, ['profiles', 'selectedId'])
  if (!Array.isArray(object.profiles) || object.profiles.length > MAX_PROFILES) throw new TypeError('Redis RPC: invalid profile list')
  const profiles: SavedConnection[] = object.profiles.map((value: unknown) => {
    const item = objectAt(value, ['id', 'name', 'group', 'settings'])
    return { id: profileIdentity(item.id), name: profileName(item.name), ...(item.group === undefined ? {} : { group: profileName(item.group) }), settings: connectionSettingsSchema.parse(item.settings) }
  })
  const selectedId = object.selectedId === null ? null : profileIdentity(object.selectedId)
  if (new Set(profiles.map(value => value.id)).size !== profiles.length || (selectedId !== null && !profiles.some(value => value.id === selectedId))) throw new TypeError('Redis RPC: invalid profile identities')
  return { profiles, selectedId }
} }

export const databaseTargetSchema: TypertSchema<DatabaseTarget> = { parse(value) {
  const object = objectAt(value, ['id', 'generation', 'db'])
  return { ...connectionTargetSchema.parse({ id: object.id, generation: object.generation }), db: integerAt(object.db, 0, 65535) }
} }

/** Stream frames are parsed on the client too: rc.2 does not decode stream items. */
function uiRequestId(value: unknown): string {
  const id = stringAt(value, 36)
  if (!/^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/u.test(id)) throw new TypeError('Redis RPC: invalid UI request identity')
  return id
}
export const actionPointReadRequestSchema: TypertSchema<ActionPointReadRequest> = { parse(value) {
  return { requestId: uiRequestId(objectAt(value, ['requestId']).requestId) }
} }
export const uiActionAckSchema: TypertSchema<UiActionAck> = { parse(value) {
  const raw = objectAt(value, ['requestId', 'target', 'selectionRevision', 'outcome'])
  if (raw.outcome !== 'applied' && raw.outcome !== 'unsupported' && raw.outcome !== 'failed' && raw.outcome !== 'stale' && raw.outcome !== 'ambiguous') throw new TypeError('Redis RPC: invalid UI outcome')
  return { requestId: uiRequestId(raw.requestId), target: raw.target === null ? null : databaseTargetSchema.parse(raw.target), selectionRevision: integerAt(raw.selectionRevision, 0, Number.MAX_SAFE_INTEGER), outcome: raw.outcome }
} }
export const uiChannelInputSchema: TypertSchema<UiChannelInput> = { parse(value) {
  if (typeof value === 'object' && value !== null && 'kind' in value) {
    const kind = objectAt(value, ['kind', 'revision', 'synchronized', 'requestId', 'request', 'nextRevision', 'actionRequestId']).kind
    if (kind === 'commitSelection') {
      const raw = objectAt(value, ['kind', 'requestId', 'revision', 'nextRevision'])
      return { kind, requestId: uiRequestId(raw.requestId), revision: integerAt(raw.revision, 0, Number.MAX_SAFE_INTEGER), nextRevision: integerAt(raw.nextRevision, 0, Number.MAX_SAFE_INTEGER) }
    }
    if (kind === 'publishSelection') {
      const raw = objectAt(value, ['kind', 'requestId', 'revision', 'request', 'actionRequestId'])
      return { kind, requestId: uiRequestId(raw.requestId), revision: integerAt(raw.revision, 0, Number.MAX_SAFE_INTEGER), request: setSelectionRequestSchema.parse(raw.request), ...(raw.actionRequestId === undefined ? {} : { actionRequestId: uiRequestId(raw.actionRequestId) }) }
    }
    const raw = objectAt(value, ['kind', 'revision', 'synchronized'])
    if (raw.kind !== 'selection' || typeof raw.synchronized !== 'boolean') throw new TypeError('Redis RPC: invalid selection state')
    return { kind: 'selection', revision: integerAt(raw.revision, 0, Number.MAX_SAFE_INTEGER), synchronized: raw.synchronized }
  }
  return uiActionAckSchema.parse(value)
} }
export const uiChannelMessageSchema: TypertSchema<UiChannelMessage> = { parse(value) {
  const kind = objectAt(value, ['kind', 'request', 'requestId', 'accepted']).kind
  if (kind === 'selectionResult') {
    const raw = objectAt(value, ['kind', 'requestId', 'accepted'])
    if (typeof raw.accepted !== 'boolean') throw new TypeError('Redis RPC: invalid selection result')
    return { kind, requestId: uiRequestId(raw.requestId), accepted: raw.accepted }
  }
  if (kind === 'cancel') {
    const raw = objectAt(value, ['kind', 'requestId'])
    return { kind, requestId: uiRequestId(raw.requestId) }
  }
  if (kind !== 'action') throw new TypeError('Redis RPC: invalid UI message')
  const raw = objectAt(value, ['kind', 'request']), request = objectAt(raw.request, ['requestId', 'action', 'target', 'selectionRevision', 'expiresAt'])
  const action = objectAt(request.action, ['kind', 'target', 'pattern', 'key', 'keyBase64', 'format', 'field', 'index', 'member', 'id', 'fieldIndex', 'fieldBase64'])
  if (action.kind !== 'show' && action.kind !== 'confirmSelection' && action.kind !== 'refresh' && action.kind !== 'applyMatch' && action.kind !== 'setFormat' && action.kind !== 'selectKey' && action.kind !== 'selectHashField' && action.kind !== 'selectListIndex' && action.kind !== 'selectSetMember' && action.kind !== 'selectZSetMember' && action.kind !== 'selectStreamField') throw new TypeError('Redis RPC: unsupported UI action')
  let parsedAction: UiAction
  if (action.kind === 'refresh') { const raw = objectAt(request.action, ['kind', 'target', 'keyBase64']); parsedAction = { kind: action.kind, target: databaseTargetSchema.parse(raw.target), keyBase64: byteStringAt(raw.keyBase64, MAX_KEY_BYTES) } }
  else if (action.kind === 'applyMatch') { const raw = objectAt(request.action, ['kind', 'target', 'pattern']); parsedAction = { kind: action.kind, target: databaseTargetSchema.parse(raw.target), pattern: stringAt(raw.pattern, 256) } }
  else if (action.kind === 'setFormat') { const raw = objectAt(request.action, ['kind', 'keyBase64', 'format']); if (raw.format !== 'text' && raw.format !== 'json' && raw.format !== 'hex' && raw.format !== 'base64') throw new TypeError('Redis RPC: invalid preview format'); parsedAction = { kind: action.kind, keyBase64: byteStringAt(raw.keyBase64, MAX_KEY_BYTES), format: raw.format } }
  else if (action.kind === 'selectKey') parsedAction = { kind: action.kind, key: identityAt(objectAt(request.action, ['kind', 'key']).key) }
  else if (action.kind === 'selectHashField') { const raw = objectAt(request.action, ['kind', 'keyBase64', 'field']); parsedAction = { kind: action.kind, keyBase64: byteStringAt(raw.keyBase64, MAX_KEY_BYTES), field: identityAt(raw.field) } }
  else if (action.kind === 'selectListIndex') { const raw = objectAt(request.action, ['kind', 'keyBase64', 'index']); parsedAction = { kind: action.kind, keyBase64: byteStringAt(raw.keyBase64, MAX_KEY_BYTES), index: unsignedIntegerAt(raw.index) } }
  else if (action.kind === 'selectSetMember' || action.kind === 'selectZSetMember') { const raw = objectAt(request.action, ['kind', 'keyBase64', 'member']); parsedAction = { kind: action.kind, keyBase64: byteStringAt(raw.keyBase64, MAX_KEY_BYTES), member: identityAt(raw.member) } }
  else if (action.kind === 'selectStreamField') { const raw = objectAt(request.action, ['kind', 'keyBase64', 'id', 'fieldIndex', 'fieldBase64']), id = stringAt(raw.id, 41); if (!isStreamId(id) || id === '0-0') throw new TypeError('Redis RPC: invalid Stream ID'); parsedAction = { kind: action.kind, keyBase64: byteStringAt(raw.keyBase64, MAX_KEY_BYTES), id, fieldIndex: integerAt(raw.fieldIndex, 0, MAX_SCAN_KEYS - 1), fieldBase64: byteStringAt(raw.fieldBase64, MAX_KEY_BYTES) } }
  else { objectAt(request.action, ['kind']); parsedAction = { kind: action.kind } }
  if ((action.kind === 'show' || action.kind === 'refresh' || action.kind === 'applyMatch') !== (request.target === null)) throw new TypeError('Redis RPC: invalid UI action target')
  return { kind, request: { requestId: uiRequestId(request.requestId), action: parsedAction, target: request.target === null ? null : databaseTargetSchema.parse(request.target), selectionRevision: integerAt(request.selectionRevision, 0, Number.MAX_SAFE_INTEGER), expiresAt: integerAt(request.expiresAt, 1, Number.MAX_SAFE_INTEGER) } }
} }

/** One scoped stream carries Host actions down and their acknowledgements up. */
export function createRedisUiStreamInvocation(input: TypertSchema, output: TypertSchema, ack: TypertSchema, session: TypertSchema): InvocationDescriptor {
  return { ...createRedisInvocation('openUiChannel', 'EmptyRequest', 'UiChannelMessage', input, output, session), mode: 'stream',
    uplink: { codec: { mode: 'strict', typeSymbol: `${TYPERT_PACKAGE}#UiChannelInput`, create: () => ack } } }
}
function scanToken(value: unknown): string | null {
  const cursor = value === null ? null : stringAt(value, 36)
  if (cursor !== null && !/^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/u.test(cursor)) throw new TypeError('Redis RPC: invalid scan token')
  return cursor
}
function byteStringAt(value: unknown, maxBytes: number): string {
  const base64 = stringAt(value, Math.ceil(maxBytes / 3) * 4)
  let decoded: string
  try { decoded = atob(base64) } catch { throw new TypeError('Redis RPC: invalid bytes') }
  if (decoded.length > maxBytes || btoa(decoded) !== base64) throw new TypeError('Redis RPC: invalid bytes')
  return base64
}
function unsignedIntegerAt(value: unknown): string {
  const text = stringAt(value, 19)
  if (!/^(?:0|[1-9]\d{0,18})$/u.test(text) || BigInt(text) > (1n << 63n) - 1n) throw new TypeError('Redis RPC: invalid integer text')
  return text
}
function sampleTimeAt(value: unknown): string {
  const text = stringAt(value, 24)
  if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/u.test(text) || !Number.isFinite(Date.parse(text)) || new Date(text).toISOString() !== text) throw new TypeError('Redis RPC: invalid sample time')
  return text
}
function metadataAt(value: unknown): KeyMetadata | null {
  if (value === null) return null
  const item = objectAt(value, ['type', 'ttlMs', 'length'])
  const type = stringAt(item.type, 128)
  if (!/^[\w-]{1,128}$/u.test(type)) throw new TypeError('Redis RPC: invalid Redis type')
  return { type, ttlMs: item.ttlMs === '-1' ? '-1' : unsignedIntegerAt(item.ttlMs), length: item.length === null ? null : unsignedIntegerAt(item.length) }
}
function identityAt(value: unknown): RedisKey {
  const item = objectAt(value, ['base64', 'byteLength', 'label'])
  const base64 = byteStringAt(item.base64, MAX_KEY_BYTES), byteLength = integerAt(item.byteLength, 0, MAX_KEY_BYTES)
  if (atob(base64).length !== byteLength) throw new TypeError('Redis RPC: invalid byte identity')
  return { base64, byteLength, label: stringAt(item.label, 1024) }
}
export const scanKeysRequestSchema: TypertSchema<ScanKeysRequest> = { parse(value) {
  const object = objectAt(value, ['target', 'pattern', 'cursor'])
  const cursor = scanToken(object.cursor)
  return { target: databaseTargetSchema.parse(object.target), pattern: stringAt(object.pattern, 256), cursor }
} }
export const scanKeysResultSchema: TypertSchema<ScanKeysResult> = { parse(value) {
  const object = objectAt(value, ['state', 'error', 'keys', 'cursor', 'sampledAt'])
  const error = errorAt(object.error)
  if ((object.state !== 'page' && object.state !== 'failed') || (object.state === 'page') !== (error === null)) throw new TypeError('Redis RPC: invalid scan state')
  if (!Array.isArray(object.keys) || object.keys.length > MAX_SCAN_KEYS) throw new TypeError('Redis RPC: invalid key list')
  const keys = object.keys.map((value: unknown) => identityAt(value))
  const cursor = scanToken(object.cursor)
  const sampledAt = sampleTimeAt(object.sampledAt)
  if (object.state === 'failed' && (keys.length !== 0 || cursor !== null)) throw new TypeError('Redis RPC: failed scan contains data')
  const result: ScanKeysResult = { state: object.state, error, keys, cursor, sampledAt }
  if (new TextEncoder().encode(JSON.stringify(result)).length > MAX_SCAN_JSON_BYTES) throw new TypeError('Redis RPC: scan budget exceeded')
  return result
} }

export const stringReadRequestSchema: TypertSchema<StringReadRequest> = { parse(value) {
  const object = objectAt(value, ['target', 'keyBase64', 'offset', 'count'])
  return { target: databaseTargetSchema.parse(object.target), keyBase64: byteStringAt(object.keyBase64, MAX_KEY_BYTES), offset: unsignedIntegerAt(object.offset), count: integerAt(object.count, 1, MAX_VALUE_BYTES) }
} }
export const stringReadResultSchema: TypertSchema<StringReadResult> = { parse(value) {
  const object = objectAt(value, ['state', 'error', 'metadata', 'offset', 'base64', 'byteLength', 'prefix', 'suffix', 'complete', 'nextOffset', 'sampledAt'])
  const state = object.state, error = errorAt(object.error)
  if (state !== 'value' && state !== 'missing' && state !== 'unsupported' && state !== 'changed' && state !== 'failed') throw new TypeError('Redis RPC: invalid value state')
  if ((state === 'failed') !== (error !== null)) throw new TypeError('Redis RPC: invalid read error')
  const metadata = metadataAt(object.metadata)
  const offset = unsignedIntegerAt(object.offset), base64 = byteStringAt(object.base64, MAX_VALUE_BYTES)
  const byteLength = integerAt(object.byteLength, 0, MAX_VALUE_BYTES), prefix = byteStringAt(object.prefix, 3), suffix = byteStringAt(object.suffix, 3)
  if (atob(base64).length !== byteLength || typeof object.complete !== 'boolean') throw new TypeError('Redis RPC: invalid byte window')
  const nextOffset = object.nextOffset === null ? null : unsignedIntegerAt(object.nextOffset)
  if (state === 'value') {
    if (metadata?.type !== 'string' || metadata.length === null) throw new TypeError('Redis RPC: missing String metadata')
    const end = BigInt(offset) + BigInt(byteLength), length = BigInt(metadata.length)
    if (byteLength > 0 && end > length) throw new TypeError('Redis RPC: window past EOF')
    if (BigInt(atob(prefix).length) > (BigInt(offset) < 3n ? BigInt(offset) : 3n) || BigInt(atob(suffix).length) > (length > end ? length - end : 0n)) throw new TypeError('Redis RPC: context past value boundary')
    if (object.complete !== (offset === '0' && BigInt(byteLength) === length) || nextOffset !== (byteLength > 0 && end < length ? String(end) : null)) throw new TypeError('Redis RPC: invalid completeness')
  } else {
    if (base64 !== '' || byteLength !== 0 || prefix !== '' || suffix !== '' || object.complete || nextOffset !== null) throw new TypeError('Redis RPC: non-value response contains bytes')
    if (state === 'unsupported' ? metadata === null || metadata.type === 'string' || metadata.type === 'none' || metadata.length !== null : metadata !== null) throw new TypeError('Redis RPC: invalid non-value metadata')
  }
  return { state, error, metadata, offset, base64, byteLength, prefix, suffix, complete: object.complete, nextOffset, sampledAt: sampleTimeAt(object.sampledAt) }
} }

export const scanHashRequestSchema: TypertSchema<ScanHashRequest> = { parse(value) {
  const object = objectAt(value, ['target', 'keyBase64', 'pattern', 'cursor'])
  return { target: databaseTargetSchema.parse(object.target), keyBase64: byteStringAt(object.keyBase64, MAX_KEY_BYTES), pattern: stringAt(object.pattern, 256), cursor: scanToken(object.cursor) }
} }
function bytePrefixAt(value: unknown): BytePrefix {
  const object = objectAt(value, ['base64', 'byteLength', 'fullByteLength', 'suffix'])
  const base64 = byteStringAt(object.base64, MAX_VALUE_BYTES), suffix = byteStringAt(object.suffix, 3)
  const byteLength = integerAt(object.byteLength, 0, MAX_VALUE_BYTES), fullByteLength = integerAt(object.fullByteLength, 0, MAX_SCAN_JSON_BYTES)
  if (atob(base64).length !== byteLength || byteLength !== Math.min(fullByteLength, MAX_VALUE_BYTES) || atob(suffix).length !== Math.min(3, fullByteLength - byteLength)) throw new TypeError('Redis RPC: invalid Hash value prefix')
  return { base64, byteLength, fullByteLength, suffix }
}
export const hashFieldReadRequestSchema: TypertSchema<HashFieldReadRequest> = { parse(value) {
  const object = objectAt(value, ['target', 'keyBase64', 'fieldBase64'])
  return { target: databaseTargetSchema.parse(object.target), keyBase64: byteStringAt(object.keyBase64, MAX_KEY_BYTES), fieldBase64: byteStringAt(object.fieldBase64, MAX_KEY_BYTES) }
} }
export const actionPointReadResultSchema: TypertSchema<ActionPointReadResult> = { parse(value) {
  const object = objectAt(value, ['state', 'error', 'cell', 'score', 'streamMessage', 'sampledAt'])
  const state = object.state, error = errorAt(object.error)
  if (state !== 'value' && state !== 'selection-missing' && state !== 'missing' && state !== 'changed' && state !== 'failed') throw new TypeError('Redis RPC: invalid action point state')
  if ((state === 'failed') !== (error !== null) || (state === 'value') !== (object.cell !== null)) throw new TypeError('Redis RPC: invalid action point result')
  const cell = object.cell === null ? null : bytePrefixAt(object.cell)
  const score = object.score === null ? null : stringAt(object.score, 128)
  if (score !== null && (state !== 'value' || !isRedisScore(score))) throw new TypeError('Redis RPC: invalid action point score')
  const streamMessage = object.streamMessage === null ? null : (() => {
    const raw = objectAt(object.streamMessage, ['id', 'fields']), id = stringAt(raw.id, 41)
    if (!isStreamId(id) || id === '0-0' || !Array.isArray(raw.fields) || raw.fields.length === 0 || raw.fields.length > MAX_SCAN_KEYS) throw new TypeError('Redis RPC: invalid point Stream message')
    return { id, fields: raw.fields.map((value: unknown) => { const pair = objectAt(value, ['field', 'value']); return { field: identityAt(pair.field), value: bytePrefixAt(pair.value) } }) }
  })()
  if (streamMessage !== null && (state !== 'value' || score !== null)) throw new TypeError('Redis RPC: invalid point Stream state')
  const result: ActionPointReadResult = { state, error, cell, score, streamMessage, sampledAt: sampleTimeAt(object.sampledAt) }
  if (new TextEncoder().encode(JSON.stringify(result)).length > MAX_SCAN_JSON_BYTES) throw new TypeError('Redis RPC: point result budget exceeded')
  return result
} }
export const scanHashResultSchema: TypertSchema<ScanHashResult> = { parse(value) {
  const object = objectAt(value, ['state', 'error', 'metadata', 'entries', 'cursor', 'sampledAt'])
  const state = object.state, error = errorAt(object.error), metadata = metadataAt(object.metadata)
  if (state !== 'page' && state !== 'missing' && state !== 'unsupported' && state !== 'changed' && state !== 'failed') throw new TypeError('Redis RPC: invalid Hash state')
  if ((state === 'failed') !== (error !== null) || !Array.isArray(object.entries) || object.entries.length > MAX_SCAN_KEYS) throw new TypeError('Redis RPC: invalid Hash result')
  const entries = object.entries.map((value: unknown) => {
    const item = objectAt(value, ['field', 'value'])
    return { field: identityAt(item.field), value: bytePrefixAt(item.value) }
  })
  const cursor = scanToken(object.cursor), sampledAt = sampleTimeAt(object.sampledAt)
  if (state === 'page') {
    if (metadata?.type !== 'hash' || metadata.length === null || BigInt(entries.length) > BigInt(metadata.length) || new Set(entries.map(entry => entry.field.base64)).size !== entries.length) throw new TypeError('Redis RPC: invalid Hash page')
  } else {
    if (entries.length !== 0 || cursor !== null) throw new TypeError('Redis RPC: non-page contains Hash data')
    if (state === 'unsupported' ? metadata === null || metadata.type === 'hash' || metadata.type === 'none' || metadata.length !== null : metadata !== null) throw new TypeError('Redis RPC: invalid Hash metadata')
  }
  const result: ScanHashResult = { state, error, metadata, entries, cursor, sampledAt }
  if (new TextEncoder().encode(JSON.stringify(result)).length > MAX_SCAN_JSON_BYTES) throw new TypeError('Redis RPC: Hash result budget exceeded')
  return result
} }

export const listReadRequestSchema: TypertSchema<ListReadRequest> = { parse(value) {
  const object = objectAt(value, ['target', 'keyBase64', 'offset', 'count'])
  return { target: databaseTargetSchema.parse(object.target), keyBase64: byteStringAt(object.keyBase64, MAX_KEY_BYTES), offset: unsignedIntegerAt(object.offset), count: integerAt(object.count, 1, MAX_LIST_ITEMS) }
} }
export const listReadResultSchema: TypertSchema<ListReadResult> = { parse(value) {
  const object = objectAt(value, ['state', 'error', 'metadata', 'entries', 'offset', 'nextOffset', 'sampledAt'])
  const state = object.state, error = errorAt(object.error), metadata = metadataAt(object.metadata)
  if (state !== 'page' && state !== 'missing' && state !== 'unsupported' && state !== 'changed' && state !== 'failed') throw new TypeError('Redis RPC: invalid List state')
  if ((state === 'failed') !== (error !== null) || !Array.isArray(object.entries) || object.entries.length > MAX_LIST_ITEMS) throw new TypeError('Redis RPC: invalid List result')
  const offset = unsignedIntegerAt(object.offset), nextOffset = object.nextOffset === null ? null : unsignedIntegerAt(object.nextOffset)
  const entries = object.entries.map((value: unknown) => {
    const item = objectAt(value, ['index', 'value'])
    return { index: unsignedIntegerAt(item.index), value: bytePrefixAt(item.value) }
  })
  if (state === 'page') {
    if (metadata?.type !== 'list' || metadata.length === null || entries.some((entry, index) => BigInt(entry.index) !== BigInt(offset) + BigInt(index))) throw new TypeError('Redis RPC: invalid List positions')
    const end = BigInt(offset) + BigInt(entries.length), length = BigInt(metadata.length)
    if ((entries.length > 0 && end > length) || (entries.length === 0 && BigInt(offset) < length) || nextOffset !== (entries.length > 0 && end < length ? String(end) : null)) throw new TypeError('Redis RPC: invalid List continuation')
  } else {
    if (entries.length !== 0 || nextOffset !== null) throw new TypeError('Redis RPC: non-page contains List rows')
    if (state === 'unsupported' ? metadata === null || metadata.type === 'list' || metadata.type === 'none' || metadata.length !== null : metadata !== null) throw new TypeError('Redis RPC: invalid List metadata')
  }
  const result: ListReadResult = { state, error, metadata, entries, offset, nextOffset, sampledAt: sampleTimeAt(object.sampledAt) }
  if (new TextEncoder().encode(JSON.stringify(result)).length > MAX_SCAN_JSON_BYTES) throw new TypeError('Redis RPC: List result budget exceeded')
  return result
} }

export const scanSetRequestSchema: TypertSchema<ScanSetRequest> = { parse(value) {
  const object = objectAt(value, ['target', 'keyBase64', 'pattern', 'cursor'])
  return { target: databaseTargetSchema.parse(object.target), keyBase64: byteStringAt(object.keyBase64, MAX_KEY_BYTES), pattern: stringAt(object.pattern, 256), cursor: scanToken(object.cursor) }
} }
export const setMemberReadRequestSchema: TypertSchema<SetMemberReadRequest> = { parse(value) {
  const object = objectAt(value, ['target', 'keyBase64', 'memberBase64'])
  return { target: databaseTargetSchema.parse(object.target), keyBase64: byteStringAt(object.keyBase64, MAX_KEY_BYTES), memberBase64: byteStringAt(object.memberBase64, MAX_KEY_BYTES) }
} }
export const scanSetResultSchema: TypertSchema<ScanSetResult> = { parse(value) {
  const object = objectAt(value, ['state', 'error', 'metadata', 'members', 'cursor', 'sampledAt'])
  const state = object.state, error = errorAt(object.error), metadata = metadataAt(object.metadata)
  if (state !== 'page' && state !== 'missing' && state !== 'unsupported' && state !== 'changed' && state !== 'failed') throw new TypeError('Redis RPC: invalid Set state')
  if ((state === 'failed') !== (error !== null) || !Array.isArray(object.members) || object.members.length > MAX_SCAN_KEYS) throw new TypeError('Redis RPC: invalid Set result')
  const members = object.members.map((value: unknown) => identityAt(value)), cursor = scanToken(object.cursor)
  if (state === 'page') {
    if (metadata?.type !== 'set' || metadata.length === null || BigInt(members.length) > BigInt(metadata.length) || new Set(members.map(member => member.base64)).size !== members.length) throw new TypeError('Redis RPC: invalid Set page')
  } else {
    if (members.length !== 0 || cursor !== null) throw new TypeError('Redis RPC: non-page contains Set members')
    if (state === 'unsupported' ? metadata === null || metadata.type === 'set' || metadata.type === 'none' || metadata.length !== null : metadata !== null) throw new TypeError('Redis RPC: invalid Set metadata')
  }
  const result: ScanSetResult = { state, error, metadata, members, cursor, sampledAt: sampleTimeAt(object.sampledAt) }
  if (new TextEncoder().encode(JSON.stringify(result)).length > MAX_SCAN_JSON_BYTES) throw new TypeError('Redis RPC: Set result budget exceeded')
  return result
} }

export const zsetReadRequestSchema: TypertSchema<ZSetReadRequest> = { parse(value) {
  const mode = objectAt(value, ['target', 'keyBase64', 'mode', 'offset', 'count', 'pattern', 'cursor']).mode
  if (mode === 'range') {
    const object = objectAt(value, ['target', 'keyBase64', 'mode', 'offset', 'count'])
    return { target: databaseTargetSchema.parse(object.target), keyBase64: byteStringAt(object.keyBase64, MAX_KEY_BYTES), mode, offset: unsignedIntegerAt(object.offset), count: integerAt(object.count, 1, MAX_LIST_ITEMS) }
  }
  if (mode !== 'scan') throw new TypeError('Redis RPC: invalid ZSet mode')
  const object = objectAt(value, ['target', 'keyBase64', 'mode', 'pattern', 'cursor'])
  return { target: databaseTargetSchema.parse(object.target), keyBase64: byteStringAt(object.keyBase64, MAX_KEY_BYTES), mode, pattern: stringAt(object.pattern, 256), cursor: scanToken(object.cursor) }
} }
export const zsetReadResultSchema: TypertSchema<ZSetReadResult> = { parse(value) {
  const object = objectAt(value, ['state', 'error', 'metadata', 'mode', 'entries', 'offset', 'nextOffset', 'cursor', 'sampledAt'])
  const state = object.state, mode = object.mode, error = errorAt(object.error), metadata = metadataAt(object.metadata)
  if (state !== 'page' && state !== 'missing' && state !== 'unsupported' && state !== 'changed' && state !== 'failed') throw new TypeError('Redis RPC: invalid ZSet state')
  if (mode !== 'range' && mode !== 'scan') throw new TypeError('Redis RPC: invalid ZSet mode')
  if ((state === 'failed') !== (error !== null) || !Array.isArray(object.entries) || object.entries.length > (mode === 'range' ? MAX_LIST_ITEMS : MAX_SCAN_KEYS)) throw new TypeError('Redis RPC: invalid ZSet rows')
  const entries = object.entries.map((value: unknown) => {
    const item = objectAt(value, ['member', 'score', 'rank']), score = stringAt(item.score, 128)
    if (!isRedisScore(score)) throw new TypeError('Redis RPC: invalid score')
    return { member: identityAt(item.member), score, rank: item.rank === null ? null : unsignedIntegerAt(item.rank) }
  })
  const offset = object.offset === null ? null : unsignedIntegerAt(object.offset), nextOffset = object.nextOffset === null ? null : unsignedIntegerAt(object.nextOffset), cursor = scanToken(object.cursor)
  if (mode === 'range' ? offset === null || cursor !== null || entries.some((entry, index) => entry.rank !== String(BigInt(offset) + BigInt(index))) : offset !== null || nextOffset !== null || entries.some(entry => entry.rank !== null)) throw new TypeError('Redis RPC: mixed ZSet paging modes')
  if (state === 'page') {
    if (metadata?.type !== 'zset' || metadata.length === null || BigInt(entries.length) > BigInt(metadata.length) || new Set(entries.map(entry => entry.member.base64)).size !== entries.length) throw new TypeError('Redis RPC: invalid ZSet metadata')
    if (mode === 'range' && offset !== null) {
      const end = BigInt(offset) + BigInt(entries.length), length = BigInt(metadata.length)
      if ((entries.length > 0 && end > length) || (entries.length === 0 && BigInt(offset) < length) || nextOffset !== (entries.length > 0 && end < length ? String(end) : null)) throw new TypeError('Redis RPC: invalid ZSet range')
    }
  } else {
    if (entries.length !== 0 || nextOffset !== null || cursor !== null) throw new TypeError('Redis RPC: non-page contains ZSet rows')
    if (state === 'unsupported' ? metadata === null || metadata.type === 'zset' || metadata.type === 'none' || metadata.length !== null : metadata !== null) throw new TypeError('Redis RPC: invalid ZSet metadata')
  }
  const result: ZSetReadResult = { state, error, metadata, mode, entries, offset, nextOffset, cursor, sampledAt: sampleTimeAt(object.sampledAt) }
  if (new TextEncoder().encode(JSON.stringify(result)).length > MAX_SCAN_JSON_BYTES) throw new TypeError('Redis RPC: ZSet result budget exceeded')
  return result
} }

function streamRangeAt(object: Record<string, unknown>): Pick<StreamReadRequest, 'direction' | 'start' | 'end'> {
  const direction = object.direction, start = stringAt(object.start, 41), end = stringAt(object.end, 41)
  if ((direction !== 'forward' && direction !== 'reverse') || !isStreamRange(start, end)) throw new TypeError('Redis RPC: invalid Stream range')
  return { direction, start, end }
}
export const streamReadRequestSchema: TypertSchema<StreamReadRequest> = { parse(value) {
  const object = objectAt(value, ['target', 'keyBase64', 'direction', 'start', 'end', 'count', 'cursor'])
  return { target: databaseTargetSchema.parse(object.target), keyBase64: byteStringAt(object.keyBase64, MAX_KEY_BYTES), ...streamRangeAt(object), count: integerAt(object.count, 1, MAX_STREAM_MESSAGES), cursor: scanToken(object.cursor) }
} }
export const streamReadResultSchema: TypertSchema<StreamReadResult> = { parse(value) {
  const object = objectAt(value, ['state', 'error', 'metadata', 'direction', 'start', 'end', 'messages', 'cursor', 'sampledAt'])
  const state = object.state, error = errorAt(object.error), metadata = metadataAt(object.metadata), range = streamRangeAt(object)
  if (state !== 'page' && state !== 'missing' && state !== 'unsupported' && state !== 'changed' && state !== 'failed') throw new TypeError('Redis RPC: invalid Stream state')
  if ((state === 'failed') !== (error !== null) || !Array.isArray(object.messages) || object.messages.length > MAX_STREAM_MESSAGES) throw new TypeError('Redis RPC: invalid Stream result')
  let previous: string | null = null, fields = 0
  const messages = object.messages.map((value: unknown) => {
    const item = objectAt(value, ['id', 'fields']), id = stringAt(item.id, 41)
    if (!isStreamId(id) || id === '0-0' || !withinStreamRange(id, range.start, range.end) || (previous !== null && (range.direction === 'forward' ? compareStreamIds(id, previous) <= 0 : compareStreamIds(id, previous) >= 0)) || !Array.isArray(item.fields) || item.fields.length === 0) throw new TypeError('Redis RPC: invalid Stream message')
    previous = id; fields += item.fields.length
    if (fields > MAX_SCAN_KEYS) throw new TypeError('Redis RPC: Stream fields exceeded')
    return { id, fields: item.fields.map((value: unknown) => { const pair = objectAt(value, ['field', 'value']); return { field: identityAt(pair.field), value: bytePrefixAt(pair.value) } }) }
  })
  const cursor = scanToken(object.cursor)
  if (state === 'page') {
    if (metadata?.type !== 'stream' || metadata.length === null || BigInt(messages.length) > BigInt(metadata.length) || (messages.length === 0 && cursor !== null)) throw new TypeError('Redis RPC: invalid Stream metadata')
  } else {
    if (messages.length !== 0 || cursor !== null) throw new TypeError('Redis RPC: non-page contains Stream data')
    if (state === 'unsupported' ? metadata === null || metadata.type === 'stream' || metadata.type === 'none' || metadata.length !== null : metadata !== null) throw new TypeError('Redis RPC: invalid Stream metadata')
  }
  const result: StreamReadResult = { state, error, metadata, ...range, messages, cursor, sampledAt: sampleTimeAt(object.sampledAt) }
  if (new TextEncoder().encode(JSON.stringify(result)).length > MAX_SCAN_JSON_BYTES) throw new TypeError('Redis RPC: Stream result budget exceeded')
  return result
} }

export const databasesReadRequestSchema: TypertSchema<DatabasesReadRequest> = { parse(value) {
  const object = objectAt(value, ['target'])
  return { target: databaseTargetSchema.parse(object.target) }
} }
export const databasesReadResultSchema: TypertSchema<DatabasesReadResult> = { parse(value) {
  const object = objectAt(value, ['state', 'error', 'catalog', 'sampledAt']), state = object.state, error = errorAt(object.error)
  if ((state !== 'value' && state !== 'failed') || (state === 'value') !== (error === null) || (state === 'value') !== (object.catalog !== null)) throw new TypeError('Redis RPC: invalid database state')
  const catalog: DatabaseCatalog | null = object.catalog === null ? null : (() => {
    const raw = objectAt(object.catalog, ['databaseCount', 'keyspace', 'currentKeys'])
    const databaseCount = raw.databaseCount === null ? null : integerAt(raw.databaseCount, 1, 65536)
    if (raw.keyspace !== null && (!Array.isArray(raw.keyspace) || raw.keyspace.length > MAX_DATABASE_ENTRIES)) throw new TypeError('Redis RPC: invalid database counts')
    const seen = new Set<number>()
    const keyspace = raw.keyspace === null ? null : (raw.keyspace as unknown[]).map(value => {
      const row = objectAt(value, ['db', 'keys']), db = integerAt(row.db, 0, databaseCount === null ? 65535 : databaseCount - 1)
      if (seen.has(db)) throw new TypeError('Redis RPC: duplicate database')
      seen.add(db)
      return { db, keys: unsignedIntegerAt(row.keys) }
    })
    return { databaseCount, keyspace, currentKeys: raw.currentKeys === null ? null : unsignedIntegerAt(raw.currentKeys) }
  })()
  return { state, error, catalog, sampledAt: sampleTimeAt(object.sampledAt) }
} }

function selectionAt(value: unknown): RedisSelection | null {
  if (value === null) return null
  const record = objectAt(value, ['keyBase64', 'item'])
  let item: RedisSelectionItem | null = null
  if (record.item !== null) {
    if (record.item === null || typeof record.item !== 'object' || Array.isArray(record.item)) throw new TypeError('Redis RPC: invalid selection')
    const kind: unknown = Reflect.get(record.item, 'kind')
    if (kind === 'hash') { const raw = objectAt(record.item, ['kind', 'fieldBase64']); item = { kind, fieldBase64: byteStringAt(raw.fieldBase64, MAX_KEY_BYTES) } }
    else if (kind === 'list') { const raw = objectAt(record.item, ['kind', 'index']); item = { kind, index: unsignedIntegerAt(raw.index) } }
    else if (kind === 'set' || kind === 'zset') { const raw = objectAt(record.item, ['kind', 'memberBase64']); item = { kind, memberBase64: byteStringAt(raw.memberBase64, MAX_KEY_BYTES) } }
    else if (kind === 'stream') {
      const raw = objectAt(record.item, ['kind', 'id', 'fieldIndex', 'fieldBase64']), id = stringAt(raw.id, 41)
      if (!isStreamId(id) || id === '0-0') throw new TypeError('Redis RPC: invalid selected message')
      item = { kind, id, fieldIndex: integerAt(raw.fieldIndex, 0, MAX_SCAN_KEYS - 1), fieldBase64: byteStringAt(raw.fieldBase64, MAX_KEY_BYTES) }
    } else throw new TypeError('Redis RPC: invalid selected type')
  }
  return { keyBase64: byteStringAt(record.keyBase64, MAX_KEY_BYTES), item }
}
export const setSelectionRequestSchema: TypertSchema<SetSelectionRequest> = { parse(value) {
  const raw = objectAt(value, ['target', 'selection'])
  return { target: databaseTargetSchema.parse(raw.target), selection: selectionAt(raw.selection) }
} }
export const selectionAckSchema: TypertSchema<SelectionAck> = { parse(value) {
  const raw = objectAt(value, ['accepted'])
  if (typeof raw.accepted !== 'boolean') throw new TypeError('Redis RPC: invalid selection acknowledgement')
  return { accepted: raw.accepted }
} }

export const aiBudgetStatusSchema: TypertSchema<AiBudgetStatus> = { parse(value) {
  const raw = objectAt(value, ['callsUsed', 'maxCalls', 'bytesUsed', 'maxBytes', 'inFlight', 'stopped'])
  const maxCalls = integerAt(raw.maxCalls, 1, Number.MAX_SAFE_INTEGER), maxBytes = integerAt(raw.maxBytes, 1, Number.MAX_SAFE_INTEGER)
  const callsUsed = integerAt(raw.callsUsed, 0, maxCalls), bytesUsed = integerAt(raw.bytesUsed, 0, maxBytes), inFlight = integerAt(raw.inFlight, 0, callsUsed)
  if (typeof raw.stopped !== 'boolean') throw new TypeError('Redis RPC: invalid AI budget')
  return { callsUsed, maxCalls, bytesUsed, maxBytes, inFlight, stopped: raw.stopped }
} }
export const aiBudgetResumeSchema: TypertSchema<AiBudgetResume> = { parse(value) {
  const raw = objectAt(value, ['accepted', 'status'])
  if (typeof raw.accepted !== 'boolean') throw new TypeError('Redis RPC: invalid AI budget acknowledgement')
  return { accepted: raw.accepted, status: aiBudgetStatusSchema.parse(raw.status) }
} }

export const redisDescriptors = [
  createRedisInvocation('status', 'EmptyRequest', 'RedisHostStatus', emptyRequestSchema, statusSchema, sessionIdSchema),
  createRedisInvocation('connect', 'ConnectionRequest', 'ConnectionView', connectionRequestSchema, connectionViewSchema, sessionIdSchema),
  createRedisInvocation('disconnect', 'ConnectionTarget', 'ConnectionView', connectionTargetSchema, connectionViewSchema, sessionIdSchema),
  createRedisInvocation('connectionStatus', 'EmptyRequest', 'ConnectionView', emptyRequestSchema, connectionViewSchema, sessionIdSchema),
  createRedisInvocation('listProfiles', 'EmptyRequest', 'ProfileCollection', emptyRequestSchema, profileCollectionSchema, sessionIdSchema),
  createRedisInvocation('saveProfile', 'SaveProfileRequest', 'ProfileCollection', saveProfileSchema, profileCollectionSchema, sessionIdSchema),
  createRedisInvocation('removeProfile', 'ProfileId', 'ProfileCollection', profileIdSchema, profileCollectionSchema, sessionIdSchema),
  createRedisInvocation('selectDatabase', 'DatabaseTarget', 'ConnectionView', databaseTargetSchema, connectionViewSchema, sessionIdSchema),
  createRedisInvocation('scanKeys', 'ScanKeysRequest', 'ScanKeysResult', scanKeysRequestSchema, scanKeysResultSchema, sessionIdSchema),
  createRedisInvocation('readString', 'StringReadRequest', 'StringReadResult', stringReadRequestSchema, stringReadResultSchema, sessionIdSchema),
  createRedisInvocation('scanHash', 'ScanHashRequest', 'ScanHashResult', scanHashRequestSchema, scanHashResultSchema, sessionIdSchema),
  createRedisInvocation('readActionPoint', 'ActionPointReadRequest', 'ActionPointReadResult', actionPointReadRequestSchema, actionPointReadResultSchema, sessionIdSchema),
  createRedisInvocation('readList', 'ListReadRequest', 'ListReadResult', listReadRequestSchema, listReadResultSchema, sessionIdSchema),
  createRedisInvocation('scanSet', 'ScanSetRequest', 'ScanSetResult', scanSetRequestSchema, scanSetResultSchema, sessionIdSchema),
  createRedisInvocation('readZSet', 'ZSetReadRequest', 'ZSetReadResult', zsetReadRequestSchema, zsetReadResultSchema, sessionIdSchema),
  createRedisInvocation('readStream', 'StreamReadRequest', 'StreamReadResult', streamReadRequestSchema, streamReadResultSchema, sessionIdSchema),
  createRedisInvocation('readDatabases', 'DatabasesReadRequest', 'DatabasesReadResult', databasesReadRequestSchema, databasesReadResultSchema, sessionIdSchema),
  createRedisInvocation('aiBudgetStatus', 'EmptyRequest', 'AiBudgetStatus', emptyRequestSchema, aiBudgetStatusSchema, sessionIdSchema),
  createRedisInvocation('resumeAiBudget', 'EmptyRequest', 'AiBudgetResume', emptyRequestSchema, aiBudgetResumeSchema, sessionIdSchema),
  createRedisUiStreamInvocation(emptyRequestSchema, uiChannelMessageSchema, uiChannelInputSchema, sessionIdSchema),
] as const
