import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { createHash, randomUUID } from 'node:crypto'
import { link, mkdir, open, unlink } from 'node:fs/promises'
import { resolve } from 'node:path'
import { z } from 'zod'
import { overviewFields, type AiJson, type RedisAiReader } from './ai-reader.ts'

const sectionSchema = z.enum(['server', 'memory', 'clients', 'stats'])
const connectionSchema = z.object({ id: z.string(), generation: z.number().int().nonnegative(), db: z.number().int().nonnegative() })
const errorSchema = z.enum(['auth', 'network', 'timeout', 'cancelled', 'stale', 'tls-certificate', 'tls-hostname', 'permission', 'oversize', 'protocol', 'busy', 'database', 'type-changed']).nullable()
const identitySchema = z.object({ base64: z.base64() }).transform(value => 'sha256:' + createHash('sha256').update(Buffer.from(value.base64, 'base64')).digest('hex'))
const overviewSchema = z.object({
  connection: connectionSchema,
  section: sectionSchema, scope: z.literal('server'), state: z.enum(['value', 'partial', 'failed']),
  fields: z.record(z.string(), z.string()), missing: z.array(z.string()), sampledAt: z.iso.datetime(), error: errorSchema,
})
const memorySchema = z.object({ connection: connectionSchema, key: identitySchema, state: z.enum(['value', 'missing', 'failed']), bytes: z.string().nullable(), samples: z.number(), sampledAt: z.iso.datetime(), error: errorSchema })
const slowlogSchema = z.object({ connection: connectionSchema, scope: z.literal('server'), state: z.enum(['value', 'failed']), requestedCount: z.number(), returnedCount: z.number(), entries: z.array(z.object({ id: z.string(), timestampSeconds: z.string(), durationMicroseconds: z.string() })).max(10), sampledAt: z.iso.datetime(), error: errorSchema })
const clientsSchema = z.object({ connection: connectionSchema, scope: z.literal('server'), state: z.enum(['value', 'failed']), clients: z.array(z.object({ id: z.string(), ageSeconds: z.string(), idleSeconds: z.string(), db: z.string(), flags: z.string() })).max(20), totalCount: z.number().nullable(), complete: z.boolean(), sampledAt: z.iso.datetime(), error: errorSchema })
const groupSchema = z.object({ name: identitySchema, consumers: z.string(), pending: z.string(), lastDeliveredId: z.string(), entriesRead: z.string().nullable(), entriesReadReported: z.boolean(), lag: z.string().nullable(), lagStatus: z.enum(['available', 'unknown', 'not-reported']) })
const groupsSchema = z.object({ connection: connectionSchema, key: identitySchema, state: z.enum(['value', 'missing', 'unsupported', 'changed', 'failed']), type: z.string().nullable().transform(value => value === null || value === 'stream' || value === 'none' ? value : 'other'), groups: z.array(groupSchema).max(20), totalCount: z.number().nullable(), complete: z.boolean(), sampledAt: z.iso.datetime(), error: errorSchema })
const sideSchema = z.object({ key: identitySchema, state: z.enum(['value', 'missing', 'unsupported', 'changed', 'failed']), length: z.string().nullable(), complete: z.boolean(), sampledAt: z.iso.datetime(), error: errorSchema })
const compareSchema = z.object({ connection: connectionSchema, comparison: z.enum(['equal', 'different', 'undetermined', 'unavailable']), left: sideSchema, right: sideSchema, bytesComparedPerKey: z.number(), snapshot: z.literal(false) })
const requestSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('overview'), section: sectionSchema }).strict(),
  z.object({ kind: z.literal('slowlog'), count: z.number().int().min(1).max(10).optional() }).strict(),
  z.object({ kind: z.literal('clients') }).strict(),
  z.object({ kind: z.literal('memory'), key: z.string().optional(), keyBase64: z.string().optional() }).strict(),
  z.object({ kind: z.literal('stream_groups'), key: z.string().optional(), keyBase64: z.string().optional() }).strict(),
  z.object({ kind: z.literal('compare_strings'), left: z.string().optional(), leftBase64: z.string().optional(), right: z.string().optional(), rightBase64: z.string().optional() }).strict(),
])
type ReportSample = { readonly kind: z.infer<typeof requestSchema>['kind']; readonly sampledAt: string; readonly data: AiJson }
const output = { schema: { type: 'json' as const }, render: (_args: unknown, value: unknown) => [{ type: 'text' as const, text: JSON.stringify(value) }] }

/** A session holds only recent, sanitized diagnostic samples, never arbitrary model text. */
export class RedisReportSamples {
  private readonly sessions = new Map<string, Map<string, ReportSample>>()
  put(session: string, id: string, sample: ReportSample): void {
    let entries = this.sessions.get(session)
    if (entries === undefined) { entries = new Map(); this.sessions.set(session, entries) }
    entries.set(id, structuredClone(sample))
    if (entries.size > 16) { const oldest = entries.keys().next().value; if (oldest !== undefined) entries.delete(oldest) }
  }
  get(session: string, id: string): ReportSample | null { const sample = this.sessions.get(session)?.get(id); return sample === undefined ? null : structuredClone(sample) }
  disposeSession(session: string): void { this.sessions.delete(session) }
  dispose(): void { this.sessions.clear() }
}

/** Reports have generated names under the trusted profile; no caller-controlled path is accepted. */
export class RedisReports {
  private readonly directory: string
  constructor(profileDirectory: string) { this.directory = resolve(profileDirectory, 'data', 'dsh-redis', 'reports') }
  async save(sample: ReportSample, signal: AbortSignal): Promise<string> {
    signal.throwIfAborted()
    const id = randomUUID(), destination = resolve(this.directory, `${id}.json`), temporary = resolve(this.directory, `.staging-${id}.tmp`)
    let created = false
    try {
      await mkdir(this.directory, { recursive: true, mode: 0o700 })
      const file = await open(temporary, 'wx', 0o600)
      created = true
      try { await file.writeFile(JSON.stringify(sample, null, 2) + '\n', 'utf8') } finally { await file.close() }
      signal.throwIfAborted()
      await link(temporary, destination)
      return destination
    } finally { if (created) try { await unlink(temporary) } catch { console.warn('[dsh-redis] Report temporary cleanup failed') } }
  }
}

/** The first operation samples; the second saves only the selected same-session sample. */
export function registerRedisReportTools(ctx: Context, reader: RedisAiReader, samples: RedisReportSamples, reports: RedisReports): void {
  ctx.effect(() => () => samples.dispose(), 'redis report samples')
  ctx.on('session/disposed', session => samples.disposeSession(session.id))
  ctx.tools.register(defineTool({
    name: 'redis_viewer_prepare_diagnostic_report',
    description: '仅在用户明确要求准备诊断报告时调用，kind 为 overview、slowlog、clients、memory、stream_groups 或 compare_strings。overview 指定 section；memory/stream_groups 指定 key 或 keyBase64；compare_strings 指定 left/leftBase64 和 right/rightBase64；slowlog 可指定 count。重新只读采样，sampleId 仅属当前会话。报告只含诊断元数据，Key 和组名用 SHA-256 标识，不含 Redis 值或凭据；采样不是一致性快照。',
    parameters: { kind: { type: 'string', required: true }, section: { type: 'string' }, count: { type: 'integer' }, key: { type: 'string' }, keyBase64: { type: 'string' }, left: { type: 'string' }, leftBase64: { type: 'string' }, right: { type: 'string' }, rightBase64: { type: 'string' } }, output, timeoutMs: 15000,
    async execute(args, exec) {
      exec.signal.throwIfAborted()
      if (exec.agent === undefined) throw new Error('Redis 工具调用缺少有效的 DSH 对话身份。')
      const request = requestSchema.parse(args), session = exec.agent.session.id, id = randomUUID()
      let captured: ReportSample | null = null
      const result = await reader.withBudget(session, exec.signal, async () => {
        if (request.kind === 'overview') {
          const value = overviewSchema.parse(await reader.overview(session, request.section, exec.signal)), allowed: readonly string[] = overviewFields[request.section]
          if (value.section !== request.section || Object.keys(value.fields).some(key => !allowed.includes(key)) || value.missing.some(key => !allowed.includes(key))) throw new Error('概况采样包含不支持的字段。')
          captured = { kind: request.kind, sampledAt: value.sampledAt, data: value }
        } else if (request.kind === 'slowlog') {
          const value = slowlogSchema.parse(await reader.slowLog(session, request.count ?? 10, exec.signal)); captured = { kind: request.kind, sampledAt: value.sampledAt, data: value }
        } else if (request.kind === 'clients') {
          const value = clientsSchema.parse(await reader.clients(session, exec.signal)); captured = { kind: request.kind, sampledAt: value.sampledAt, data: value }
        } else if (request.kind === 'memory') {
          const value = memorySchema.parse(await reader.memoryUsage(session, { ...(request.key === undefined ? {} : { key: request.key }), ...(request.keyBase64 === undefined ? {} : { keyBase64: request.keyBase64 }) }, exec.signal)); captured = { kind: request.kind, sampledAt: value.sampledAt, data: value }
        } else if (request.kind === 'stream_groups') {
          const value = groupsSchema.parse(await reader.streamGroups(session, { ...(request.key === undefined ? {} : { key: request.key }), ...(request.keyBase64 === undefined ? {} : { keyBase64: request.keyBase64 }) }, exec.signal)); captured = { kind: request.kind, sampledAt: value.sampledAt, data: value }
        } else {
          const value = compareSchema.parse(await reader.compareStrings(session, { ...(request.left === undefined ? {} : { left: request.left }), ...(request.leftBase64 === undefined ? {} : { leftBase64: request.leftBase64 }), ...(request.right === undefined ? {} : { right: request.right }), ...(request.rightBase64 === undefined ? {} : { rightBase64: request.rightBase64 }) }, exec.signal)); captured = { kind: request.kind, sampledAt: value.right.sampledAt, data: value }
        }
        return { sampleId: id, sample: captured }
      })
      if (captured === null) throw new Error('无法保存概况采样。')
      samples.put(session, id, captured)
      return result
    },
  }))
  ctx.tools.register(defineTool({
    name: 'redis_viewer_save_diagnostic_report',
    description: '仅在用户明确要求将已准备的诊断采样保存到本地时调用，sampleId 必须来自当前会话的准备结果。文件写入当前 DSH profile 的固定报告目录；不接收路径和自由文本。中断后保存结果可能未知，应查看目录后再决定是否重试。',
    parameters: { sampleId: { type: 'string', required: true } }, output, timeoutMs: 15000,
    async execute(args, exec) {
      exec.signal.throwIfAborted()
      if (exec.agent === undefined) throw new Error('Redis 工具调用缺少有效的 DSH 对话身份。')
      if (Object.keys(args).some(key => key !== 'sampleId') || !z.uuid().safeParse(args.sampleId).success) throw new Error('报告采样身份无效。')
      const session = exec.agent.session.id, sample = samples.get(session, args.sampleId)
      if (sample === null) return { outcome: 'missing', message: '采样不存在、已过期或不属于当前会话，请重新准备。' }
      let started = false
      try {
        return await reader.withBudget(session, exec.signal, async () => {
          started = true
          const path = await reports.save(sample, exec.signal)
          return { outcome: 'saved', path, sampledAt: sample.sampledAt, kind: sample.kind }
        })
      } catch (error) {
        if (started) throw new Error('报告保存结果未知，请检查本地报告目录后再操作。')
        throw error
      }
    },
  }))
}
