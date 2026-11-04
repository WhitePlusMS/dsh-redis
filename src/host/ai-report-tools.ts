import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { randomUUID } from 'node:crypto'
import { link, mkdir, open, unlink } from 'node:fs/promises'
import { resolve } from 'node:path'
import { z } from 'zod'
import type { RedisAiReader } from './ai-reader.ts'
import type { ReportSample } from './ai-report-samples.ts'

const output = { schema: { type: 'json' as const }, render: (_args: unknown, value: unknown) => [{ type: 'text' as const, text: JSON.stringify(value) }] }

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

/** Save only a diagnostic result actually delivered in this trusted session. */
export function registerRedisReportTools(ctx: Context, reader: RedisAiReader, reports: RedisReports): void {
  ctx.tools.register(defineTool({
    name: 'redis_viewer_save_diagnostic_report',
    description: '仅在用户明确要求保存已有诊断结果时调用，sampleId 必须来自本会话诊断结果的 reportSampleId；原采样不重新读取 Redis。只保存近 16 个采样，旧采样或会话结束后不可用。报告将 Key 和消费组名替换为 SHA-256 标识，排除 Redis 值、凭据、慢日志命令名和自由文本。文件写入 DSH profile 的固定目录；不接收路径。中断后保存结果可能未知，应查看目录后再重试。',
    parameters: { sampleId: { type: 'string', required: true } }, output, timeoutMs: 15000,
    async execute(args, exec) {
      exec.signal.throwIfAborted()
      if (exec.agent === undefined) throw new Error('Redis 工具调用缺少有效的 DSH 对话身份。')
      if (Object.keys(args).some(key => key !== 'sampleId') || !z.uuid().safeParse(args.sampleId).success) throw new Error('报告采样身份无效。')
      const session = exec.agent.session.id, sample = reader.reportSamples.get(session, args.sampleId)
      if (sample === null) return { outcome: 'missing', message: '采样不存在、已过期或不属于当前会话，请重新查询。' }
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
