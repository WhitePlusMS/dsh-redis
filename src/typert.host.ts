import { z } from 'zod'
import { PREVIEW_FORMATS } from './domain.ts'
import { browsingStateSchema } from './typert.shared.ts'
import { DSH_VERSION, PROTOCOL_VERSION, MAX_PROFILES } from './domain.ts'
import { createRedisInvocation, TYPERT_PACKAGE, scanKeysRequestSchema, scanKeysResultSchema, stringReadRequestSchema, stringReadResultSchema, scanHashRequestSchema, scanHashResultSchema, listReadRequestSchema, listReadResultSchema, scanSetRequestSchema, scanSetResultSchema } from './typert.shared.ts'
import { zsetReadRequestSchema, zsetReadResultSchema } from './typert.shared.ts'
import { streamReadRequestSchema, streamReadResultSchema } from './typert.shared.ts'
import { jsonReadRequestSchema, jsonReadResultSchema } from './typert.shared.ts'
import { geoReadRequestSchema, geoReadResultSchema, hllReadRequestSchema, hllReadResultSchema } from './typert.shared.ts'
import { timeSeriesReadRequestSchema, timeSeriesReadResultSchema } from './typert.shared.ts'

import { bloomReadRequestSchema, bloomReadResultSchema } from './typert.shared.ts'

const empty = z.object({}).strict()
const error = z.enum(['auth', 'network', 'timeout', 'cancelled', 'stale', 'tls-certificate', 'tls-hostname', 'permission', 'oversize', 'protocol', 'busy', 'database', 'type-changed'])
const host = z.string().min(1).max(253).regex(/^[^\s/\\@?#\0]+$/u)
const address = z.object({ host, port: z.number().int().min(1).max(65535), username: z.string().max(256) }).strict()
const target = address.extend({ tls: z.boolean() }).strict()
const credentials = address.extend({ password: z.string().max(4096), tls: z.object({ caPem: z.string().max(65536) }).strict().nullable() }).strict()
const identity = z.object({ id: z.string().min(1).max(128), generation: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER) }).strict()
const view = z.object({ id: z.string().max(128).nullable(), generation: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER), db: z.number().int().min(0).max(65535), state: z.enum(['connecting', 'connected', 'disconnected', 'error']), error: error.nullable(), target: target.nullable() }).strict()
const tested = z.object({ outcome: z.enum(['passed', 'failed']), error: error.nullable() }).strict().refine(value => (value.outcome === 'passed') === (value.error === null))
const settings = credentials.omit({ password: true }).strict()
const profileId = z.string().min(1).max(128)
const profileName = z.string().min(1).max(80).refine(value => value.trim() === value)
const savedProfile = z.object({ id: profileId, name: profileName, settings }).strict()
const saved = z.object({ profiles: z.array(savedProfile).max(MAX_PROFILES), selectedId: profileId.nullable() }).strict().refine(value => new Set(value.profiles.map(item => item.id)).size === value.profiles.length && (value.selectedId === null || value.profiles.some(item => item.id === value.selectedId)))
const saveProfile = z.object({ id: profileId.nullable(), name: profileName, settings }).strict()
const databaseTarget = identity.extend({ db: z.number().int().min(0).max(65535) }).strict()
const scan = z.object({ target: databaseTarget, pattern: z.string().max(256), cursor: z.string().max(36).nullable() }).strict().transform(value => scanKeysRequestSchema.parse(value))
const scanned = z.object({ state: z.enum(['page', 'failed']), error: error.nullable(), keys: z.array(z.object({ base64: z.string().max(87384), byteLength: z.number().int().min(0).max(65536), label: z.string().max(1024) }).strict()).max(4096), cursor: z.string().max(36).nullable(), sampledAt: z.string().max(24) }).strict().transform(value => scanKeysResultSchema.parse(value))
const stringRead = z.object({ target: databaseTarget, keyBase64: z.string().max(87384), offset: z.string().max(19), count: z.number().int().min(1).max(65536) }).strict().transform(value => stringReadRequestSchema.parse(value))
const stringValue = z.object({ state: z.enum(['value', 'missing', 'unsupported', 'changed', 'failed']), error: error.nullable(), metadata: z.object({ type: z.string().max(128), ttlMs: z.string().max(19), length: z.string().max(19).nullable() }).strict().nullable(), offset: z.string().max(19), base64: z.string().max(87384), byteLength: z.number().int().min(0).max(65536), prefix: z.string().max(4), suffix: z.string().max(4), complete: z.boolean(), nextOffset: z.string().max(19).nullable(), sampledAt: z.string().max(24) }).strict().transform(value => stringReadResultSchema.parse(value))
const hashScan = z.object({ target: databaseTarget, keyBase64: z.string().max(87384), pattern: z.string().max(256), cursor: z.string().max(36).nullable() }).strict().transform(value => scanHashRequestSchema.parse(value))
const bytePrefix = z.object({ base64: z.string().max(87384), byteLength: z.number().int().min(0).max(65536), fullByteLength: z.number().int().min(0).max(1048576), suffix: z.string().max(4) }).strict()
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

const jsonRead = z.object({ target: databaseTarget, keyBase64: z.string().max(87384), path: z.string().max(1024) }).strict().transform(value => jsonReadRequestSchema.parse(value))
const jsonValue = z.object({ state: z.enum(['value', 'missing', 'unsupported', 'changed', 'path-missing', 'unavailable', 'invalid-path', 'failed']), error: error.nullable(), metadata: z.object({ type: z.string().max(128), ttlMs: z.string().max(19), length: z.string().max(19).nullable() }).strict().nullable(), path: z.string().max(1024), matchTypes: z.array(z.enum(['null', 'boolean', 'integer', 'number', 'string', 'object', 'array'])).max(4096), base64: z.string().max(87384), byteLength: z.number().int().min(0).max(65536), sampledAt: z.string().max(24) }).strict().transform(value => jsonReadResultSchema.parse(value))

const geoRead = z.object({ target: databaseTarget, keyBase64: z.string().max(87384), offset: z.string().max(19), count: z.number().int().min(1).max(100) }).strict().transform(value => geoReadRequestSchema.parse(value))
const geoPage = z.object({ state: z.enum(['page', 'missing', 'unsupported', 'changed', 'unavailable', 'failed']), error: error.nullable(), metadata: z.object({ type: z.string().max(128), ttlMs: z.string().max(19), length: z.string().max(19).nullable() }).strict().nullable(), entries: z.array(z.object({ member: z.object({ base64: z.string().max(87384), byteLength: z.number().int().min(0).max(65536), label: z.string().max(1024) }).strict(), score: z.string().max(128), rank: z.string().max(19), position: z.object({ longitude: z.string().max(128), latitude: z.string().max(128) }).strict().nullable() }).strict()).max(100), offset: z.string().max(19), nextOffset: z.string().max(19).nullable(), sampledAt: z.string().max(24) }).strict().transform(value => geoReadResultSchema.parse(value))

const hllRead = z.object({ target: databaseTarget, keyBase64: z.string().max(87384) }).strict().transform(value => hllReadRequestSchema.parse(value))
const hllValue = z.object({ state: z.enum(['value', 'missing', 'unsupported', 'changed', 'invalid', 'unavailable', 'failed']), error: error.nullable(), metadata: z.object({ type: z.string().max(128), ttlMs: z.string().max(19), length: z.string().max(19).nullable() }).strict().nullable(), estimate: z.string().max(19).nullable(), encoding: z.enum(['dense', 'sparse']).nullable(), cacheValid: z.boolean().nullable(), sampledAt: z.string().max(24) }).strict().transform(value => hllReadResultSchema.parse(value))

const timeSeriesRead = z.object({ target: databaseTarget, keyBase64: z.string().max(87384), direction: z.enum(['forward', 'reverse']), start: z.string().max(19), end: z.string().max(19), count: z.number().int().min(1).max(100), cursor: z.string().max(36).nullable() }).strict().transform(value => timeSeriesReadRequestSchema.parse(value))
const timeSeriesPage = z.object({ state: z.enum(['page', 'missing', 'unsupported', 'changed', 'unavailable', 'failed']), error: error.nullable(), metadata: z.object({ type: z.string().max(128), ttlMs: z.string().max(19), length: z.string().max(19).nullable() }).strict().nullable(), direction: z.enum(['forward', 'reverse']), start: z.string().max(19), end: z.string().max(19), samples: z.array(z.object({ timestamp: z.string().max(19), value: z.string().max(128) }).strict()).max(100), info: z.object({ totalSamples: z.string().max(19), firstTimestamp: z.string().max(19), lastTimestamp: z.string().max(19), retentionTime: z.string().max(19) }).strict().nullable(), infoState: z.enum(['available', 'permission', 'unavailable']).nullable(), cursor: z.string().max(36).nullable(), sampledAt: z.string().max(24) }).strict().transform(value => timeSeriesReadResultSchema.parse(value))

const bloomRead = z.object({ target: databaseTarget, keyBase64: z.string().max(87384), itemBase64: z.string().max(5464).nullable() }).strict().transform(value => bloomReadRequestSchema.parse(value))
const bloomValue = z.object({ state: z.enum(['value', 'missing', 'unsupported', 'changed', 'unavailable', 'failed']), error: error.nullable(), metadata: z.object({ type: z.string().max(128), ttlMs: z.string().max(19), length: z.string().max(19).nullable() }).strict().nullable(), info: z.object({ capacity: z.string().max(19), size: z.string().max(19), filters: z.string().max(19), inserted: z.string().max(19), expansion: z.string().max(19).nullable() }).strict().nullable(), infoState: z.enum(['available', 'permission', 'unavailable']).nullable(), itemBase64: z.string().max(5464).nullable(), membership: z.enum(['absent', 'maybe-present']).nullable(), sampledAt: z.string().max(24) }).strict().transform(value => bloomReadResultSchema.parse(value))

const previewFormat = z.enum(PREVIEW_FORMATS)
const browsingState = z.object({ profileId: profileId.nullable(), db: z.number().int().min(0).max(65535), pattern: z.string().max(256), keyBase64: z.string().max(87384).nullable(), formats: z.object({ string: previewFormat, hash: previewFormat, list: previewFormat, set: previewFormat, zset: previewFormat, stream: previewFormat, geo: previewFormat, json: previewFormat }).strict(), stringOffset: z.string().max(19), stringCount: z.number().int().min(1).max(65536) }).strict().transform(value => browsingStateSchema.parse(value))

/** Host Zod codecs are required by the rc.2 Typert loader. */
export const redisHostDescriptors = [
  createRedisInvocation('status', 'EmptyRequest', 'RedisHostStatus', empty,
    z.object({ state: z.literal('ready'), readOnly: z.literal(true), hostVersion: z.literal(DSH_VERSION), protocolVersion: z.literal(PROTOCOL_VERSION) }).strict(), z.string().min(1)),
  createRedisInvocation('testConnection', 'ConnectionRequest', 'ConnectionTestResult', credentials, tested, z.string().min(1)),
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
  createRedisInvocation('readList', 'ListReadRequest', 'ListReadResult', listRead, listPage, z.string().min(1)),
  createRedisInvocation('scanSet', 'ScanSetRequest', 'ScanSetResult', setScan, setPage, z.string().min(1)),
  createRedisInvocation('readZSet', 'ZSetReadRequest', 'ZSetReadResult', zsetRead, zsetPage, z.string().min(1)),
  createRedisInvocation('readStream', 'StreamReadRequest', 'StreamReadResult', streamRead, streamPage, z.string().min(1)),
  createRedisInvocation('readJson', 'JsonReadRequest', 'JsonReadResult', jsonRead, jsonValue, z.string().min(1)),
  createRedisInvocation('readGeo', 'GeoReadRequest', 'GeoReadResult', geoRead, geoPage, z.string().min(1)),
  createRedisInvocation('readHll', 'HllReadRequest', 'HllReadResult', hllRead, hllValue, z.string().min(1)),
  createRedisInvocation('readTimeSeries', 'TimeSeriesReadRequest', 'TimeSeriesReadResult', timeSeriesRead, timeSeriesPage, z.string().min(1)),
  createRedisInvocation('readBloom', 'BloomReadRequest', 'BloomReadResult', bloomRead, bloomValue, z.string().min(1)),
  createRedisInvocation('loadBrowsingState', 'EmptyRequest', 'SessionBrowsingState', empty, browsingState, z.string().min(1)),
  createRedisInvocation('saveBrowsingState', 'SessionBrowsingState', 'SessionBrowsingState', browsingState, browsingState, z.string().min(1)),
] as const
export const TYPERT = { package: TYPERT_PACKAGE, face: 'host', schemas: [], invocations: redisHostDescriptors, model: { services: [], events: [], objects: [] } }
export default TYPERT
