import { Context } from '@deepseek-ai/cordis'
import type { Agent } from '@deepseek-ai/dsh-agent'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime from '@deepseek-ai/dsh-tools'
import { mkdtemp, realpath, rm } from 'node:fs/promises'
import { basename, dirname, join, resolve } from 'node:path'
import { expect, it, vi } from 'vitest'
import { RedisAiReader } from '../src/host/ai-reader.ts'
import { registerRedisMatchTools } from '../src/host/ai-match-tools.ts'
import { RedisConnections } from '../src/host/connection-service.ts'
import { RedisMatchPresets } from '../src/host/match-preset-store.ts'
import { UiActionCoordinator } from '../src/host/ui-action-coordinator.ts'
import type { UiAction, UiActionRequest } from '../src/domain.ts'

it('uses bounded profile storage through the DSH tool and handles an interrupted save honestly', async () => {
  const runtime = resolve(import.meta.dirname, '../.scratch/runtime')
  const directory = await mkdtemp(join(runtime, 'ai-match-test-'))
  const presets = new RedisMatchPresets(directory), connections = new RedisConnections(), ctx = new Context()
  const reader = new RedisAiReader(connections, () => undefined, async () => 0, () => true)
  const actions = new UiActionCoordinator<UiAction>()
  const log = vi.spyOn(console, 'info').mockImplementation(() => undefined)
  await ctx.plugin(SystemPrompt); await ctx.plugin(ToolRuntime)
  await ctx.plugin({ name: 'redis-match-test', inject: ['tools'], apply: (scope: Context) => registerRedisMatchTools(scope, reader, presets, actions) })
  const agent = { id: 'a', ctx, session: { id: 'a' } } as unknown as Agent
  let index = 0
  const call = (name: string, args: unknown, signal = new AbortController().signal, toolAgent: Agent | null = agent) => ctx.tools.execute({ callId: ('match-' + ++index) as Parameters<typeof ctx.tools.execute>[0]['callId'], name, arguments: args, ...(toolAgent === null ? {} : { agent: toolAgent }), signal })
  const content = (value: Awaited<ReturnType<typeof call>>) => value.content.filter(block => block.type === 'text').map(block => block.text).join('')
  try {
    expect(JSON.parse(content(await call('redis_viewer_match_presets', {})))).toMatchObject({ presets: [], nextCursor: null, snapshot: false })
    const saved = await call('redis_viewer_save_match_preset', { name: 'Synthetic orders', pattern: 'fixture:order:*' })
    expect(saved.isError).toBeFalsy()
    expect(JSON.parse(content(saved))).toMatchObject({ outcome: 'saved', preset: { name: 'Synthetic orders', pattern: 'fixture:order:*' } })
    expect(JSON.parse(content(await call('redis_viewer_save_match_preset', { name: 'Synthetic orders', pattern: 'other:*' })))).toMatchObject({ outcome: 'conflict' })
    expect(JSON.parse(content(await call('redis_viewer_match_presets', {})))).toMatchObject({ presets: [{ name: 'Synthetic orders', pattern: 'fixture:order:*' }] })
    const preset = JSON.parse(content(saved)).preset as { id: string }
    const target = { id: 'fixture', generation: 1, db: 0 }
    vi.spyOn(reader, 'currentTarget').mockReturnValue(target)
    vi.spyOn(reader, 'isCurrentTarget').mockReturnValue(true)
    expect(JSON.parse(content(await call('redis_viewer_apply_match_preset', { id: preset.id })))).toMatchObject({ outcome: 'stale' })
    const receive = async (request: UiActionRequest<UiAction>) => {
      expect(request.action).toEqual({ kind: 'applyMatch', target, pattern: 'fixture:order:*' })
      actions.setSelectionState('a', receive, request.selectionRevision + 1, true)
      return { requestId: request.requestId, target: request.target, selectionRevision: request.selectionRevision, outcome: 'applied' as const }
    }
    const unregister = actions.register('a', receive)
    actions.setSelectionState('a', receive, 5, true)
    expect(JSON.parse(content(await call('redis_viewer_apply_match_preset', { id: preset.id })))).toMatchObject({ outcome: 'applied', preset: { name: 'Synthetic orders', pattern: 'fixture:order:*' } })
    expect(JSON.parse(content(await call('redis_viewer_apply_match_preset', { id: '0'.repeat(64) })))).toMatchObject({ outcome: 'missing' })
    unregister()
    expect((await call('redis_viewer_match_presets', { cursor: '256' })).isError).toBe(true)
    expect((await call('redis_viewer_match_presets', { sessionId: 'other' })).isError).toBe(true)
    expect((await call('redis_viewer_match_presets', {}, undefined, null)).isError).toBe(true)
    const aborted = new AbortController(), save = presets.save.bind(presets)
    vi.spyOn(presets, 'save').mockImplementation(async (input, signal) => { const result = await save(input, signal); aborted.abort(); return result })
    const interrupted = await call('redis_viewer_save_match_preset', { name: 'Synthetic interrupted', pattern: 'fixture:*' }, aborted.signal)
    expect(interrupted.isError).toBe(true)
    expect(content(interrupted)).toContain('保存结果未知')
    expect((await presets.list(null, new AbortController().signal)).presets).toEqual(expect.arrayContaining([expect.objectContaining({ name: 'Synthetic interrupted' })]))
  } finally {
    await ctx.fiber.dispose(); actions.dispose(); reader.dispose(); connections.dispose(); log.mockRestore(); vi.restoreAllMocks()
    const actual = await realpath(directory)
    if (dirname(actual) !== await realpath(runtime) || !basename(actual).startsWith('ai-match-test-')) throw new Error('Refusing cleanup outside the owned test directory')
    await rm(actual, { recursive: true })
  }
})
