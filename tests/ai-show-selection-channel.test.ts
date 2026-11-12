import * as NativeToolExecutor from '@deepseek-ai/dsh-tool-executor-native'
import { executeTool } from './tool-test-utils.ts'
import { Context } from '@deepseek-ai/cordis'
import type { Agent } from '@deepseek-ai/dsh-agent'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime from '@deepseek-ai/dsh-tools'
import { expect, it, vi } from 'vitest'
import type { UiAction, UiChannelInput } from '../src/domain.ts'
import { consumeUiActions } from '../src/client/ui-actions.ts'
import { SelectionEpoch } from '../src/client/selection-epoch.ts'
import { UiPanePresence, showRedisPane } from '../src/client/ui-pane-presence.ts'
import { registerRedisUiTools } from '../src/host/ai-ui-tools.ts'
import { openUiActionChannel } from '../src/host/ui-action-channel.ts'
import { UiActionCoordinator } from '../src/host/ui-action-coordinator.ts'

it('confirms showing the pane even when mounting it invalidates and republishes selection', async () => {
  const ctx = new Context(), actions = new UiActionCoordinator<UiAction>(), epoch = new SelectionEpoch(), panes = new UiPanePresence()
  const abort = new AbortController(), queue: UiChannelInput[] = [], observed: UiChannelInput[] = []
  let wake: (() => void) | undefined, ended = false, detach: (() => void) | undefined
  const notify = () => { const next = wake; wake = undefined; next?.() }
  const uplink: AsyncIterable<UiChannelInput> = { async *[Symbol.asyncIterator]() {
    while (!ended) {
      const value = queue.shift()
      if (value !== undefined) { observed.push(value); yield value; continue }
      await new Promise<void>(resolve => { wake = resolve; if (ended || queue.length > 0) notify() })
    }
  } }
  const publish = vi.fn(() => { actions.invalidateSession('a'); return { accepted: true } })
  const host = openUiActionChannel(actions, 'a', abort.signal, uplink, publish)
  const stream = { send: (frame: UiChannelInput) => { queue.push(frame); notify() }, end: () => undefined, dispose: () => { ended = true; notify() }, [Symbol.asyncIterator]: () => host }
  await ctx.plugin(SystemPrompt); await ctx.plugin(ToolRuntime); await ctx.plugin(NativeToolExecutor)
  await ctx.plugin({ name: 'show-selection-fixture', inject: ['tools'], apply: (scope: Context) => registerRedisUiTools(scope, actions) })
  const agent = { id: 'a', ctx, session: { id: 'a' } } as unknown as Agent
  const client = consumeUiActions(async () => stream, abort.signal, async (request, signal) => {
    if (request.action.kind !== 'show') return 'failed'
    const initial = epoch.snapshot().revision
    const visible = showRedisPane(panes, 'a', () => true, () => {
      const revision = epoch.invalidate()
      detach = panes.attach('a')
      stream.send({ kind: 'publishSelection', requestId: '12345678-1234-1234-1234-123456789abc', revision, request: { target: { id: 'fixture', generation: 1, db: 0 }, selection: { keyBase64: 'aw==', item: null } } })
    }, request.expiresAt, signal)
    // Ensure Host processes both the mount's version change and publication before the visible reply.
    await vi.waitFor(() => { expect(observed.some(frame => 'kind' in frame && frame.kind === 'selection' && frame.revision > initial)).toBe(true); expect(publish).toHaveBeenCalledOnce() })
    return visible
  }, epoch)
  try {
    await vi.waitFor(() => expect(observed.some(frame => 'kind' in frame && frame.kind === 'selection')).toBe(true))
    const result = await executeTool(ctx.tools, { callId: 'show-selection' as string, name: 'redis_viewer_show', arguments: {}, agent, signal: abort.signal })
    const text = result.content.filter(block => block.type === 'text').map(block => block.text).join('')
    expect(panes.count('a')).toBe(1)
    expect(publish).toHaveBeenCalledOnce()
    expect(text).toContain('"outcome":"applied"')
  } finally { detach?.(); abort.abort(); ended = true; notify(); await client; actions.dispose(); await ctx.fiber.dispose() }
})
