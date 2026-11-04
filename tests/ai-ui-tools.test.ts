import { Context } from '@deepseek-ai/cordis'
import type { Agent } from '@deepseek-ai/dsh-agent'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime from '@deepseek-ai/dsh-tools'
import { expect, it } from 'vitest'
import type { UiAction } from '../src/domain.ts'
import { registerRedisUiTools } from '../src/host/ai-ui-tools.ts'
import { UiActionCoordinator } from '../src/host/ui-action-coordinator.ts'

it('reports only a matching current-session acknowledgement as visible', async () => {
  const ctx = new Context(), actions = new UiActionCoordinator<UiAction>()
  await ctx.plugin(SystemPrompt); await ctx.plugin(ToolRuntime)
  await ctx.plugin({ name: 'redis-ui-test', inject: ['tools'], apply: (scope: Context) => registerRedisUiTools(scope, actions) })
  const agent = { id: 'a', ctx, session: { id: 'a' } } as unknown as Agent
  const call = (args: unknown) => ctx.tools.execute({ callId: 'ui-test' as Parameters<typeof ctx.tools.execute>[0]['callId'], name: 'redis_viewer_show', arguments: args, agent, signal: new AbortController().signal })
  const content = (result: Awaited<ReturnType<typeof call>>) => result.content.filter(item => item.type === 'text').map(item => item.text).join('')
  try {
    expect(content(await call({}))).toContain('no_receiver')
    const other = actions.register('b', async request => ({ requestId: request.requestId, target: request.target, selectionRevision: request.selectionRevision, outcome: 'applied' }))
    expect(content(await call({}))).toContain('no_receiver')
    const first = actions.register('a', async request => ({ requestId: request.requestId, target: request.target, selectionRevision: request.selectionRevision, outcome: 'applied' }))
    const visible = content(await call({}))
    expect(visible).toContain('"outcome":"applied"')
    expect(visible).toContain('已确认可见')
    const second = actions.register('a', async request => ({ requestId: request.requestId, target: request.target, selectionRevision: request.selectionRevision, outcome: 'applied' }))
    expect(content(await call({}))).toContain('ambiguous')
    expect((await call({ sessionId: 'b' })).isError).toBe(true)
    second(); first(); other()
  } finally { actions.dispose(); await ctx.fiber.dispose() }
})
