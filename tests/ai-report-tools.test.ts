import { Context } from '@deepseek-ai/cordis'
import type { Agent } from '@deepseek-ai/dsh-agent'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime from '@deepseek-ai/dsh-tools'
import { mkdtemp, readFile, realpath, rm } from 'node:fs/promises'
import { basename, dirname, join, resolve } from 'node:path'
import { expect, it, vi } from 'vitest'
import { RedisAiReader } from '../src/host/ai-reader.ts'
import { RedisReports, registerRedisReportTools } from '../src/host/ai-report-tools.ts'
import { registerRedisTools } from '../src/host/ai-tools.ts'
import { RedisConnections, type RedisLink } from '../src/host/connection-service.ts'
import { RedisReplyError } from '../src/host/resp.ts'
import { MAX_AI_RESULT_BYTES } from '../src/host/ai-budget.ts'

it('saves only an explicitly selected same-session overview sample with no credentials or model text', async () => {
  const runtime = resolve(import.meta.dirname, '../.scratch/runtime'), directory = await mkdtemp(join(runtime, 'ai-report-test-'))
  let denied = false, usedMemory = '1024', commands = 0
  const link: RedisLink = {
    close: () => undefined, onFailure: () => () => undefined,
    async execute(command, _args, signal, guard) { signal.throwIfAborted(); guard(); commands++; if (command !== 'INFO') throw new Error('Unexpected Redis command'); if (denied) throw new RedisReplyError('NOPERM not-in-report'); return Buffer.from(`used_memory:${usedMemory}\r\nused_memory_rss:2048\r\nmaxmemory:0\r\nmem_fragmentation_ratio:1.5\r\nignored:not-in-report\r\n`) },
  }
  const connections = new RedisConnections(async () => link), reader = new RedisAiReader(connections, () => undefined, async () => 0, () => true)
  const samples = reader.reportSamples, reports = new RedisReports(directory), ctx = new Context()
  const connection = await connections.connect('a', { host: '127.0.0.1', port: 6379, username: 'not-in-report', password: 'not-in-report', tls: null }, new AbortController().signal)
  await ctx.plugin(SystemPrompt); await ctx.plugin(ToolRuntime)
  await ctx.plugin({ name: 'redis-report-test', inject: ['tools'], apply: (scope: Context) => { registerRedisTools(scope, reader); registerRedisReportTools(scope, reader, reports) } })
  const agent = (id: string) => ({ id, ctx, session: { id } }) as unknown as Agent
  let index = 0
  const call = (name: string, args: unknown, id = 'a', signal = new AbortController().signal) => ctx.tools.execute({ callId: ('report-' + ++index) as Parameters<typeof ctx.tools.execute>[0]['callId'], name, arguments: args, agent: agent(id), signal })
  const content = (value: Awaited<ReturnType<typeof call>>) => value.content.filter(block => block.type === 'text').map(block => block.text).join('')
  try {
    const prepared = await call('redis_viewer_overview', { section: 'memory' })
    expect(prepared.isError).toBeFalsy()
    const first = JSON.parse(content(prepared)) as { reportSampleId: string; sampledAt: string }
    const sampleId = first.reportSampleId
    usedMemory = '2048'
    const newer = JSON.parse(content(await call('redis_viewer_overview', { section: 'memory' }))) as { reportSampleId: string }
    expect(newer.reportSampleId).not.toBe(sampleId)
    expect(JSON.parse(content(await call('redis_viewer_save_diagnostic_report', { sampleId }, 'b')))).toMatchObject({ outcome: 'missing' })
    expect((await call('redis_viewer_save_diagnostic_report', { sampleId, path: 'elsewhere', text: 'untrusted' })).isError).toBe(true)
    const beforeSave = commands, saved = await call('redis_viewer_save_diagnostic_report', { sampleId })
    expect(commands).toBe(beforeSave)
    expect(saved.isError).toBeFalsy()
    const path = (JSON.parse(content(saved)) as { path: string }).path
    expect(dirname(path)).toBe(join(directory, 'data', 'dsh-redis', 'reports'))
    const file = await readFile(path, 'utf8')
    expect(file).not.toContain('not-in-report')
    expect(JSON.parse(file)).toMatchObject({ kind: 'overview', data: { connection: { id: connection.id, generation: connection.generation, db: connection.db }, section: 'memory', fields: { used_memory: '1024' }, scope: 'server', state: 'value' } })
    expect((JSON.parse(file) as { sampledAt: string }).sampledAt).toBe(first.sampledAt)
    expect((await call('redis_viewer_clients', { key: 'unexpected' })).isError).toBe(true)
    denied = true
    const failed = await call('redis_viewer_overview', { section: 'memory' })
    expect(JSON.parse(content(failed))).toMatchObject({ state: 'failed', error: 'permission' })
    expect(content(failed)).not.toContain('NOPERM')
    denied = false
    const cancelled = new AbortController(), prepare = samples.prepare.bind(samples)
    let cancelledId = ''
    vi.spyOn(samples, 'prepare').mockImplementationOnce((session, kind, input, signal) => {
      const staged = prepare(session, kind, input, signal)
      if (staged.result === null || typeof staged.result !== 'object' || Array.isArray(staged.result) || typeof staged.result.reportSampleId !== 'string') throw new Error('Missing staged sample ID')
      cancelledId = staged.result.reportSampleId; cancelled.abort(); return staged
    })
    expect((await call('redis_viewer_overview', { section: 'memory' }, 'a', cancelled.signal)).isError).toBe(true)
    expect(samples.get('a', cancelledId)).toBeNull()
    const large = { connection: { id: 'fixture', generation: 1, db: 0 }, section: 'memory', scope: 'server', state: 'partial', fields: {}, missing: [], sampledAt: '2026-11-04T00:00:00.000Z', error: null, padding: '' }
    large.padding = 'x'.repeat(MAX_AI_RESULT_BYTES - Buffer.byteLength(JSON.stringify(large)) - 10)
    const oversized = samples.prepare('a', 'overview', large, new AbortController().signal)
    expect(Buffer.byteLength(JSON.stringify(oversized.result))).toBeLessThanOrEqual(MAX_AI_RESULT_BYTES)
    expect(oversized.result).not.toHaveProperty('reportSampleId')
    samples.disposeSession('a')
    expect(JSON.parse(content(await call('redis_viewer_save_diagnostic_report', { sampleId })))).toMatchObject({ outcome: 'missing' })
    const aborted = new AbortController(), save = reports.save.bind(reports)
    const next = await call('redis_viewer_overview', { section: 'memory' })
    const nextId = (JSON.parse(content(next)) as { reportSampleId: string }).reportSampleId
    vi.spyOn(reports, 'save').mockImplementation(async (sample, signal) => { const path = await save(sample, signal); aborted.abort(); return path })
    const interrupted = await call('redis_viewer_save_diagnostic_report', { sampleId: nextId }, 'a', aborted.signal)
    expect(interrupted.isError).toBe(true)
    expect(content(interrupted)).toContain('保存结果未知')
  } finally {
    await ctx.fiber.dispose(); reader.dispose(); connections.dispose(); vi.restoreAllMocks()
    const actual = await realpath(directory)
    if (dirname(actual) !== await realpath(runtime) || !basename(actual).startsWith('ai-report-test-')) throw new Error('Refusing cleanup outside the owned test directory')
    await rm(actual, { recursive: true })
  }
})
