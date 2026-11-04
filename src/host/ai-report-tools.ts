import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { randomUUID } from 'node:crypto'
import { link, mkdir, open, unlink } from 'node:fs/promises'
import { resolve } from 'node:path'
import { z } from 'zod'
import { overviewFields, type RedisAiReader } from './ai-reader.ts'

const sectionSchema = z.enum(['server', 'memory', 'clients', 'stats'])
const overviewSchema = z.object({
  connection: z.object({ id: z.string(), generation: z.number().int().nonnegative(), db: z.number().int().nonnegative() }),
  section: sectionSchema, scope: z.literal('server'), state: z.enum(['value', 'partial', 'failed']),
  fields: z.record(z.string(), z.string()), missing: z.array(z.string()), sampledAt: z.iso.datetime(), error: z.string().nullable(),
})
type ReportSample = z.infer<typeof overviewSchema>
const output = { schema: { type: 'json' as const }, render: (_args: unknown, value: unknown) => [{ type: 'text' as const, text: JSON.stringify(value) }] }

/** A session holds only recent, sanitized overview samples, never arbitrary model text. */
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
      try { await file.writeFile(JSON.stringify({ kind: 'redis-overview-sample', ...sample }, null, 2) + '\n', 'utf8') } finally { await file.close() }
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
    name: 'redis_viewer_prepare_overview_report',
    description: '仅在用户明确要求准备服务器概况报告并指定 server、memory、clients 或 stats 时调用。重新只读采样该类别，结果和 sampleId 只属于当前会话；报告仅含白名单指标、连接身份、时间和状态，不含凭据或 Redis 值。采样不是趋势或一致性快照。',
    parameters: { section: { type: 'string', required: true } }, output, timeoutMs: 15000,
    async execute(args, exec) {
      exec.signal.throwIfAborted()
      if (exec.agent === undefined) throw new Error('Redis 工具调用缺少有效的 DSH 对话身份。')
      if (Object.keys(args).some(key => key !== 'section')) throw new Error('Redis 工具包含不支持的参数。')
      const session = exec.agent.session.id, section = sectionSchema.parse(args.section), id = randomUUID()
      let captured: ReportSample | null = null
      const result = await reader.withBudget(session, exec.signal, async () => {
        const value = overviewSchema.parse(await reader.overview(session, section, exec.signal))
        const allowed: readonly string[] = overviewFields[section]
        if (value.section !== section || Object.keys(value.fields).some(key => !allowed.includes(key)) || value.missing.some(key => !allowed.includes(key))) throw new Error('概况采样包含不支持的字段。')
        captured = value
        return { sampleId: id, sample: value }
      })
      if (captured === null) throw new Error('无法保存概况采样。')
      samples.put(session, id, captured)
      return result
    },
  }))
  ctx.tools.register(defineTool({
    name: 'redis_viewer_save_overview_report',
    description: '仅在用户明确要求将已准备的服务器概况采样保存到本地时调用，sampleId 必须来自当前会话的准备结果。文件写入当前 DSH profile 的固定报告目录；不接收路径和自由文本。中断后保存结果可能未知，应查看目录后再决定是否重试。',
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
          return { outcome: 'saved', path, sampledAt: sample.sampledAt, section: sample.section }
        })
      } catch (error) {
        if (started) throw new Error('报告保存结果未知，请检查本地报告目录后再操作。')
        throw error
      }
    },
  }))
}
