import { MAX_DATABASE_ENTRIES } from './domain.ts'
import { databasesReadRequestSchema, databasesReadResultSchema } from './typert.shared.ts'
import { z } from 'zod'
import { DSH_VERSION, PROTOCOL_VERSION, MAX_PROFILES } from './domain.ts'
import { createRedisInvocation, TYPERT_PACKAGE, scanKeysRequestSchema, scanKeysResultSchema, stringReadRequestSchema, stringReadResultSchema, scanHashRequestSchema, scanHashResultSchema, listReadRequestSchema, listReadResultSchema, scanSetRequestSchema, scanSetResultSchema } from './typert.shared.ts'
import { zsetReadRequestSchema, zsetReadResultSchema } from './typert.shared.ts'
import { streamReadRequestSchema, streamReadResultSchema } from './typert.shared.ts'
import { aiBudgetStatusSchema, aiBudgetResumeSchema } from './typert.shared.ts'
import { createRedisUiStreamInvocation, uiChannelInputSchema, uiChannelMessageSchema } from './typert.shared.ts'
import { actionPointReadRequestSchema, actionPointReadResultSchema } from './typert.shared.ts'

const empty = z.object({}).strict()
const error = z.enum(['auth', 'network', 'timeout', 'cancelled', 'stale', 'tls-certificate', 'tls-hostname', 'permission', 'oversize', 'protocol', 'busy', 'database', 'type-changed'])
const host = z.string().min(1).max(253).regex(/^[^\s/\\@?#\0]+$/u)
const address = z.object({ host, port: z.number().int().min(1).max(65535), username: z.string().max(256) }).strict()
const environment = z.string().min(1).max(80).refine(value => value.trim() === value && !/[\u0000-\u001f\u007f]/u.test(value)).optional()
const target = address.extend({ environment, tls: z.boolean() }).strict()
const credentials = address.extend({ password: z.string().max(4096), environment, tls: z.object({ caPem: z.string().max(65536) }).strict().nullable() }).strict()
const identity = z.object({ id: z.string().min(1).max(128), generation: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER) }).strict()
const view = z.object({ id: z.string().max(128).nullable(), generation: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER), db: z.number().int().min(0).max(65535), state: z.enum(['connecting', 'connected', 'disconnected', 'error']), error: error.nullable(), target: target.nullable() }).strict()
const settings = credentials.omit({ password: true }).strict()
const profileId = z.string().min(1).max(128)
const profileName = z.string().min(1).max(80).refine(value => value.trim() === value)
const profileGroup = profileName.optional()
const savedProfile = z.object({ id: profileId, name: profileName, group: profileGroup, settings }).strict()
const saved = z.object({ profiles: z.array(savedProfile).max(MAX_PROFILES), selectedId: profileId.nullable() }).strict().refine(value => new Set(value.profiles.map(item => item.id)).size === value.profiles.length && (value.selectedId === null || value.profiles.some(item => item.id === value.selectedId)))
const saveProfile = z.object({ id: profileId.nullable(), name: profileName, group: profileGroup, settings }).strict()
const databaseTarget = identity.extend({ db: z.number().int().min(0).max(65535) }).strict()
const scan = z.object({ target: databaseTarget, pattern: z.string().max(256), cursor: z.string().max(36).nullable() }).strict().transform(value => scanKeysRequestSchema.parse(value))
const scanned = z.object({ state: z.enum(['page', 'failed']), error: error.nullable(), keys: z.array(z.object({ base64: z.string().max(87384), byteLength: z.number().int().min(0).max(65536), label: z.string().max(1024) }).strict()).max(4096), cursor: z.string().max(36).nullable(), sampledAt: z.string().max(24) }).strict().transform(value => scanKeysResultSchema.parse(value))
const stringRead = z.object({ target: databaseTarget, keyBase64: z.string().max(87384), offset: z.string().max(19), count: z.number().int().min(1).max(65536) }).strict().transform(value => stringReadRequestSchema.parse(value))
const stringValue = z.object({ state: z.enum(['value', 'missing', 'unsupported', 'changed', 'failed']), error: error.nullable(), metadata: z.object({ type: z.string().max(128), ttlMs: z.string().max(19), length: z.string().max(19).nullable() }).strict().nullable(), offset: z.string().max(19), base64: z.string().max(87384), byteLength: z.number().int().min(0).max(65536), prefix: z.string().max(4), suffix: z.string().max(4), complete: z.boolean(), nextOffset: z.string().max(19).nullable(), sampledAt: z.string().max(24) }).strict().transform(value => stringReadResultSchema.parse(value))
const hashScan = z.object({ target: databaseTarget, keyBase64: z.string().max(87384), pattern: z.string().max(256), cursor: z.string().max(36).nullable() }).strict().transform(value => scanHashRequestSchema.parse(value))
const bytePrefix = z.object({ base64: z.string().max(87384), byteLength: z.number().int().min(0).max(65536), fullByteLength: z.number().int().min(0).max(1048576), suffix: z.string().max(4) }).strict()
const actionPointValue = z.object({ state: z.enum(['value', 'selection-missing', 'missing', 'changed', 'failed']), error: error.nullable(), cell: bytePrefix.nullable(), score: z.string().max(128).nullable(), streamMessage: z.object({ id: z.string().max(41), fields: z.array(z.object({ field: z.object({ base64: z.string().max(87384), byteLength: z.number().int().min(0).max(65536), label: z.string().max(1024) }).strict(), value: bytePrefix }).strict()).min(1).max(4096) }).strict().nullable(), sampledAt: z.string().max(24) }).strict().transform(value => actionPointReadResultSchema.parse(value))
const actionPointRead = z.object({ requestId: z.string().max(36) }).strict().transform(value => actionPointReadRequestSchema.parse(value))
const hashPage = z.object({ state: z.enum(['page', 'missing', 'unsupported', 'changed', 'failed']), error: error.nullable(), metadata: z.object({ type: z.string().max(128), ttlMs: z.string().max(19), length: z.string().max(19).nullable() }).strict().nullable(), entries: z.array(z.object({ field: z.object({ base64: z.string().max(87384), byteLength: z.number().int().min(0).max(65536), label: z.string().max(1024) }).strict(), value: z.object({ base64: z.string().max(87384), byteLength: z.number().int().min(0).max(65536), fullByteLength: z.number().int().min(0).max(1048576), suffix: z.string().max(4) }).strict() }).strict()).max(4096), cursor: z.string().max(36).nullable(), sampledAt: z.string().max(24) }).strict().transform(value => scanHashResultSchema.parse(value))
const listRead = z.object({ target: databaseTarget, keyBase64: z.string().max(87384), offset: z.string().max(19), count: z.number().int().min(1).max(100) }).strict().transform(value => listReadRequestSchema.parse(value))
const listPage = z.object({ state: z.enum(['page', 'missing', 'unsupported', 'changed', 'failed']), error: error.nullable(), metadata: z.object({ type: z.string().max(128), ttlMs: z.string().max(19), length: z.string().max(19).nullable() }).strict().nullable(), entries: z.array(z.object({ index: z.string().max(19), value: bytePrefix }).strict()).max(100), offset: z.string().max(19), nextOffset: z.string().max(19).nullable(), sampledAt: z.string().max(24) }).strict().transform(value => listReadResultSchema.parse(value))
const setScan = z.object({ target: databaseTarget, keyBase64: z.string().max(87384), pattern: z.string().max(256), cursor: z.string().max(36).nullable() }).strict().transform(value => scanSetRequestSchema.parse(value))
const setPage = z.object({ state: z.enum(['page', 'missing', 'unsupported', 'changed', 'failed']), error: error.nullable(), metadata: z.object({ type: z.string().max(128), ttlMs: z.string().max(19), length: z.string().max(19).nullable() }).strict().nullable(), members: z.array(z.object({ base64: z.string().max(87384), byteLength: z.number().int().min(0).max(65536), label: z.string().max(1024) }).strict()).max(4096), cursor: z.string().max(36).nullable(), sampledAt: z.string().max(24) }).strict().transform(value => scanSetResultSchema.parse(value))

const zsetRead = z.discriminatedUnion('mode', [
  z.object({ target: databaseTarget, keyBase64: z.string().max(87384), mode: z.literal('range'), offset: z.string().max(19), count: z.number().int().min(1).max(100) }).strict(),
  z.object({ target: databaseTarget, keyBase64: z.string().max(87384), mode: z.literal('scan'), pattern: z.string().max(256), cursor: z.string().max(36).nullable() }).strict(),
]).transform(value => zsetReadRequestSchema.parse(value))
const zsetPage = z.object({ state: z.enum(['page', 'missing', 'unsupported', 'changed', 'failed']), error: error.nullable(), metadata: z.object({ type: z.string().max(128), ttlMs: z.string().max(19), length: z.string().max(19).nullable() }).strict().nullable(), mode: z.enum(['range', 'scan']), entries: z.array(z.object({ member: z.object({ base64: z.string().max(87384), byteLength: z.number().int().min(0).max(65536), label: z.string().max(1024) }).strict(), score: z.string().max(128), rank: z.string().max(19).nullable() }).strict()).max(4096), offset: z.string().max(19).nullable(), nextOffset: z.string().max(19).nullable(), cursor: z.string().max(36).nullable(), sampledAt: z.string().max(24) }).strict().transform(value => zsetReadResultSchema.parse(value))

const streamRead = z.object({ target: databaseTarget, keyBase64: z.string().max(87384), direction: z.enum(['forward', 'reverse']), start: z.string().max(41), end: z.string().max(41), count: z.number().int().min(1).max(100), cursor: z.string().max(36).nullable() }).strict().transform(value => streamReadRequestSchema.parse(value))
const streamPage = z.object({ state: z.enum(['page', 'missing', 'unsupported', 'changed', 'failed']), error: error.nullable(), metadata: z.object({ type: z.string().max(128), ttlMs: z.string().max(19), length: z.string().max(19).nullable() }).strict().nullable(), direction: z.enum(['forward', 'reverse']), start: z.string().max(41), end: z.string().max(41), messages: z.array(z.object({ id: z.string().max(41), fields: z.array(z.object({ field: z.object({ base64: z.string().max(87384), byteLength: z.number().int().min(0).max(65536), label: z.string().max(1024) }).strict(), value: bytePrefix }).strict()).min(1).max(4096) }).strict()).max(100), cursor: z.string().max(36).nullable(), sampledAt: z.string().max(24) }).strict().transform(value => streamReadResultSchema.parse(value))
const databasesRead = z.object({ target: databaseTarget }).strict().transform(value => databasesReadRequestSchema.parse(value))
const databasesValue = z.object({ state: z.enum(['value', 'failed']), error: error.nullable(), catalog: z.object({ databaseCount: z.number().int().min(1).max(65536).nullable(), keyspace: z.array(z.object({ db: z.number().int().min(0).max(65535), keys: z.string().max(19) }).strict()).max(MAX_DATABASE_ENTRIES).nullable(), currentKeys: z.string().max(19).nullable() }).strict().nullable(), sampledAt: z.string().max(24) }).strict().transform(value => databasesReadResultSchema.parse(value))

/** Host Zod codecs are required by the rc.2 Typert loader. */
export const redisHostDescriptors = [
  createRedisInvocation('status', 'EmptyRequest', 'RedisHostStatus', empty,
    z.object({ state: z.literal('ready'), readOnly: z.literal(true), hostVersion: z.literal(DSH_VERSION), protocolVersion: z.literal(PROTOCOL_VERSION) }).strict(), z.string().min(1)),
  createRedisInvocation('connect', 'ConnectionRequest', 'ConnectionView', credentials, view, z.string().min(1)),
  createRedisInvocation('disconnect', 'ConnectionTarget', 'ConnectionView', identity, view, z.string().min(1)),
  createRedisInvocation('connectionStatus', 'EmptyRequest', 'ConnectionView', empty, view, z.string().min(1)),
  createRedisInvocation('listProfiles', 'EmptyRequest', 'ProfileCollection', empty, saved, z.string().min(1)),
  createRedisInvocation('saveProfile', 'SaveProfileRequest', 'ProfileCollection', saveProfile, saved, z.string().min(1)),
  createRedisInvocation('removeProfile', 'ProfileId', 'ProfileCollection', z.object({ id: profileId }).strict(), saved, z.string().min(1)),
  createRedisInvocation('selectDatabase', 'DatabaseTarget', 'ConnectionView', databaseTarget, view, z.string().min(1)),
  createRedisInvocation('scanKeys', 'ScanKeysRequest', 'ScanKeysResult', scan, scanned, z.string().min(1)),
  createRedisInvocation('readString', 'StringReadRequest', 'StringReadResult', stringRead, stringValue, z.string().min(1)),
  createRedisInvocation('scanHash', 'ScanHashRequest', 'ScanHashResult', hashScan, hashPage, z.string().min(1)),
  createRedisInvocation('readActionPoint', 'ActionPointReadRequest', 'ActionPointReadResult', actionPointRead, actionPointValue, z.string().min(1)),
  createRedisInvocation('readList', 'ListReadRequest', 'ListReadResult', listRead, listPage, z.string().min(1)),
  createRedisInvocation('scanSet', 'ScanSetRequest', 'ScanSetResult', setScan, setPage, z.string().min(1)),
  createRedisInvocation('readZSet', 'ZSetReadRequest', 'ZSetReadResult', zsetRead, zsetPage, z.string().min(1)),
  createRedisInvocation('readStream', 'StreamReadRequest', 'StreamReadResult', streamRead, streamPage, z.string().min(1)),
  createRedisInvocation('readDatabases', 'DatabasesReadRequest', 'DatabasesReadResult', databasesRead, databasesValue, z.string().min(1)),
  createRedisInvocation('aiBudgetStatus', 'EmptyRequest', 'AiBudgetStatus', empty, z.unknown().transform(value => aiBudgetStatusSchema.parse(value)), z.string().min(1)),
  createRedisInvocation('resumeAiBudget', 'EmptyRequest', 'AiBudgetResume', empty, z.unknown().transform(value => aiBudgetResumeSchema.parse(value)), z.string().min(1)),
  createRedisUiStreamInvocation(empty, z.unknown().transform(value => uiChannelMessageSchema.parse(value)), z.unknown().transform(value => uiChannelInputSchema.parse(value)), z.string().min(1)),
] as const
export const TYPERT = { package: TYPERT_PACKAGE, face: 'host', schemas: [], invocations: redisHostDescriptors, model: { services: [], events: [], objects: [] } }
export default TYPERT
