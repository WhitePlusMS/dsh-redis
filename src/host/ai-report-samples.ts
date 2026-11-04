import { createHash, randomUUID } from 'node:crypto'
import { z } from 'zod'
import { MAX_AI_RESULT_BYTES } from './ai-budget.ts'
import type { PreparedAiPage } from './ai-page-store.ts'

export const overviewFields = {
  server: ['redis_version', 'uptime_in_seconds'],
  memory: ['used_memory', 'used_memory_rss', 'maxmemory', 'mem_fragmentation_ratio'],
  clients: ['connected_clients', 'blocked_clients'],
  stats: ['total_connections_received', 'total_commands_processed', 'instantaneous_ops_per_sec', 'rejected_connections', 'evicted_keys', 'expired_keys', 'keyspace_hits', 'keyspace_misses'],
} as const

const sectionSchema = z.enum(['server', 'memory', 'clients', 'stats'])
const connectionSchema = z.object({ id: z.string(), generation: z.number().int().nonnegative(), db: z.number().int().nonnegative() })
const errorSchema = z.enum(['auth', 'network', 'timeout', 'cancelled', 'stale', 'tls-certificate', 'tls-hostname', 'permission', 'oversize', 'protocol', 'busy', 'database', 'type-changed']).nullable()
const identitySchema = z.object({ base64: z.base64() }).transform(value => 'sha256:' + createHash('sha256').update(Buffer.from(value.base64, 'base64')).digest('hex'))
const overviewSchema = z.object({ connection: connectionSchema, section: sectionSchema, scope: z.literal('server'), state: z.enum(['value', 'partial', 'failed']), fields: z.record(z.string(), z.string()), missing: z.array(z.string()), sampledAt: z.iso.datetime(), error: errorSchema })
const memorySchema = z.object({ connection: connectionSchema, key: identitySchema, state: z.enum(['value', 'missing', 'failed']), bytes: z.string().nullable(), samples: z.number(), sampledAt: z.iso.datetime(), error: errorSchema })
const slowlogSchema = z.object({ connection: connectionSchema, scope: z.literal('server'), state: z.enum(['value', 'failed']), requestedCount: z.number(), returnedCount: z.number(), entries: z.array(z.object({ id: z.string(), timestampSeconds: z.string(), durationMicroseconds: z.string() })).max(10), sampledAt: z.iso.datetime(), error: errorSchema })
const clientsSchema = z.object({ connection: connectionSchema, scope: z.literal('server'), state: z.enum(['value', 'failed']), clients: z.array(z.object({ id: z.string(), ageSeconds: z.string(), idleSeconds: z.string(), db: z.string(), flags: z.string() })).max(20), totalCount: z.number().nullable(), complete: z.boolean(), sampledAt: z.iso.datetime(), error: errorSchema })
const groupSchema = z.object({ name: identitySchema, consumers: z.string(), pending: z.string(), lastDeliveredId: z.string(), entriesRead: z.string().nullable(), entriesReadReported: z.boolean(), lag: z.string().nullable(), lagStatus: z.enum(['available', 'unknown', 'not-reported']) })
const groupsSchema = z.object({ connection: connectionSchema, key: identitySchema, state: z.enum(['value', 'missing', 'unsupported', 'changed', 'failed']), type: z.string().nullable().transform(value => value === null || value === 'stream' || value === 'none' ? value : 'other'), groups: z.array(groupSchema).max(20), totalCount: z.number().nullable(), complete: z.boolean(), sampledAt: z.iso.datetime(), error: errorSchema })
const sideSchema = z.object({ key: identitySchema, state: z.enum(['value', 'missing', 'unsupported', 'changed', 'failed']), length: z.string().nullable(), complete: z.boolean(), sampledAt: z.iso.datetime(), error: errorSchema })
const compareSchema = z.object({ connection: connectionSchema, comparison: z.enum(['equal', 'different', 'undetermined', 'unavailable']), left: sideSchema, right: sideSchema, bytesComparedPerKey: z.number(), snapshot: z.literal(false) })
type AiJson = z.infer<ReturnType<typeof z.json>>
export type ReportKind = 'overview' | 'memory' | 'slowlog' | 'clients' | 'stream_groups' | 'compare_strings'
export type ReportSample = { readonly kind: ReportKind; readonly sampledAt: string; readonly data: AiJson }

function project(kind: ReportKind, input: AiJson): ReportSample {
  if (kind === 'overview') {
    const data = overviewSchema.parse(input), allowed: readonly string[] = overviewFields[data.section]
    if (Object.keys(data.fields).some(key => !allowed.includes(key)) || data.missing.some(key => !allowed.includes(key))) throw new Error('概况采样包含不支持的字段。')
    return { kind, sampledAt: data.sampledAt, data }
  }
  if (kind === 'memory') { const data = memorySchema.parse(input); return { kind, sampledAt: data.sampledAt, data } }
  if (kind === 'slowlog') { const data = slowlogSchema.parse(input); return { kind, sampledAt: data.sampledAt, data } }
  if (kind === 'clients') { const data = clientsSchema.parse(input); return { kind, sampledAt: data.sampledAt, data } }
  if (kind === 'stream_groups') { const data = groupsSchema.parse(input); return { kind, sampledAt: data.sampledAt, data } }
  const data = compareSchema.parse(input)
  return { kind, sampledAt: data.right.sampledAt, data }
}

/** Store sanitized metadata only after the corresponding tool result commits. */
export class RedisReportSamples {
  private readonly sessions = new Map<string, Map<string, ReportSample>>()

  prepare(session: string, kind: ReportKind, input: AiJson, signal: AbortSignal): PreparedAiPage {
    const original = z.record(z.string(), z.json()).parse(input), sample = project(kind, input), id = randomUUID()
    const result = { ...original, reportSampleId: id }
    // A nearly full diagnostic result remains readable; it simply cannot be saved as a report.
    if (Buffer.byteLength(JSON.stringify(result)) > MAX_AI_RESULT_BYTES) return { result: original, commit: () => undefined, rollback: () => undefined }
    return { result, commit: () => {
      signal.throwIfAborted()
      let entries = this.sessions.get(session)
      if (entries === undefined) { entries = new Map(); this.sessions.set(session, entries) }
      entries.set(id, sample)
      if (entries.size > 16) { const oldest = entries.keys().next().value; if (oldest !== undefined) entries.delete(oldest) }
    }, rollback: () => undefined }
  }

  get(session: string, id: string): ReportSample | null { const sample = this.sessions.get(session)?.get(id); return sample === undefined ? null : structuredClone(sample) }
  disposeSession(session: string): void { this.sessions.delete(session) }
  dispose(): void { this.sessions.clear() }
}
