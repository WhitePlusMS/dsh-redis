/** Exercise local overview reports with the owned Redis fixture, not the user's server. */
import assert from 'node:assert/strict'
import { mkdtemp, readFile, realpath, rm } from 'node:fs/promises'
import { basename, dirname, join, resolve } from 'node:path'
import { Context } from '@deepseek-ai/cordis'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime from '@deepseek-ai/dsh-tools'
import { RedisConnections } from '../lib/host/connection-service.js'
import { RedisAiReader } from '../lib/host/ai-reader.js'
import { RedisReports, registerRedisReportTools } from '../lib/host/ai-report-tools.js'
import { registerRedisTools } from '../lib/host/ai-tools.js'
import { withRedisFixture } from './redis-fixture.mjs'

const runtime = resolve(import.meta.dirname, '../.scratch/runtime'), directory = await mkdtemp(join(runtime, 'report-smoke-'))
try {
  const signal = new AbortController().signal
  const { fixture } = await withRedisFixture(async ({ settings, admin }) => {
    const connections = new RedisConnections(), reader = new RedisAiReader(connections, () => undefined, async () => 0, () => false)
    const ctx = new Context(), reports = new RedisReports(directory)
    try {
      await admin.sendCommand(['SET', 'fixture:report', 'synthetic-secret-value'])
      await admin.sendCommand(['SET', 'fixture:report-copy', 'synthetic-secret-value'])
      await admin.sendCommand(['XGROUP', 'CREATE', 'fixture:stream', 'synthetic-group', '0', 'MKSTREAM'])
      const before = await admin.sendCommand(['GET', 'fixture:report'])
      assert.equal((await connections.connect('fixture-session', settings, signal)).state, 'connected')
      await ctx.plugin(SystemPrompt); await ctx.plugin(ToolRuntime)
      await ctx.plugin({ name: 'redis-report-fixture', inject: ['tools'], apply: scope => { registerRedisTools(scope, reader); registerRedisReportTools(scope, reader, reports) } })
      const agent = { id: 'fixture-agent', ctx, session: { id: 'fixture-session' } }
      let index = 0
      const call = async (name, args) => {
        const result = await ctx.tools.execute({ callId: 'report-' + ++index, name, arguments: args, agent, signal })
        assert.equal(result.isError, false)
        return JSON.parse(result.content.filter(block => block.type === 'text').map(block => block.text).join(''))
      }
      for (const [section, field] of [['server', 'redis_version'], ['memory', 'used_memory'], ['clients', 'connected_clients'], ['stats', 'total_commands_processed']]) {
        const prepared = await call('redis_viewer_overview', { section })
        assert.equal(prepared.scope, 'server'); assert.equal(typeof prepared.fields[field], 'string')
        const saved = await call('redis_viewer_save_diagnostic_report', { sampleId: prepared.reportSampleId })
        const text = await readFile(saved.path, 'utf8'), report = JSON.parse(text)
        assert.equal(report.data.section, section); assert.equal(report.data.fields[field], prepared.fields[field]); assert.equal(report.sampledAt, prepared.sampledAt)
        assert(!text.includes(settings.password)); assert(!text.includes('synthetic-secret-value')); assert(!text.includes('127.0.0.1'))
      }
      for (const [kind, args] of [['slowlog', {}], ['clients', {}], ['memory', { key: 'fixture:report' }], ['compare_strings', { left: 'fixture:report', right: 'fixture:report-copy' }], ['stream_groups', { key: 'fixture:stream' }]]) {
        const prepared = await call('redis_viewer_' + kind, args)
        const saved = await call('redis_viewer_save_diagnostic_report', { sampleId: prepared.reportSampleId })
        const text = await readFile(saved.path, 'utf8'), report = JSON.parse(text)
        assert.equal(report.kind, kind); assert(!text.includes(settings.password)); assert(!text.includes('synthetic-secret-value'))
        assert(!text.includes('fixture:report')); assert(!text.includes('fixture:stream')); assert(!text.includes('synthetic-group'))
        if (kind === 'memory' || kind === 'stream_groups') assert.match(report.data.key, /^sha256:[a-f0-9]{64}$/u)
        if (kind === 'compare_strings') assert.equal(report.data.comparison, 'equal')
        if (kind === 'stream_groups') assert.equal(report.data.groups.length, 1)
      }
      assert.equal(await admin.sendCommand(['GET', 'fixture:report']), before)
    } finally { await ctx.fiber.dispose(); reader.dispose(); connections.dispose() }
  })
  assert(fixture.stopped)
  console.log(JSON.stringify({ passed: true, redisVersion: fixture.redisVersion, backend: fixture.backend ?? 'docker', fixtureStopped: fixture.stopped, checks: ['four overview sections and five diagnostic reports', 'secret exclusion', 'unchanged fixture key'] }))
} finally {
  const actual = await realpath(directory)
  if (dirname(actual) !== await realpath(runtime) || !basename(actual).startsWith('report-smoke-')) throw new Error('Refusing cleanup outside the owned report directory')
  await rm(actual, { recursive: true })
}
