import * as NativeToolExecutor from '@deepseek-ai/dsh-tool-executor-native'
import { executeTool } from './tool-test-utils.ts'
import { Context } from '@deepseek-ai/cordis'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime, { defineTool } from '@deepseek-ai/dsh-tools'
import { expect, it, vi } from 'vitest'
import { RedisAiReader } from '../src/host/ai-reader.ts'
import { RedisConnections } from '../src/host/connection-service.ts'

const cancellationMessage = 'Redis 调用已停止，结果可能未确认；请先查询当前状态，不要盲目重试。'

// Exercise the real DSH error renderer, including its non-Error cancellation reasons.
it.each(['return', 'throw'] as const)('reports cancellation after the operation chooses to %s', async outcome => {
  const ctx = new Context(), controller = new AbortController()
  const reader = new RedisAiReader(new RedisConnections(), () => undefined, async () => 0, () => true)
  const commit = vi.fn(), rollback = vi.fn()
  let started!: () => void
  const ready = new Promise<void>(resolve => { started = resolve })
  try {
    await ctx.plugin(SystemPrompt); await ctx.plugin(ToolRuntime); await ctx.plugin(NativeToolExecutor)
    ctx.tools.register(defineTool({
      name: 'fixture_cancel', description: 'Synthetic cancellation only', parameters: {},
      output: { schema: { type: 'json' }, render: (_args: unknown, value: unknown) => [{ type: 'text', text: JSON.stringify(value) }] },
      execute: (_args, exec) => reader.withBudget('fixture', exec.signal, async stage => {
        stage({ result: { cursor: 'undelivered-fixture' }, commit, rollback })
        const pending = new Promise<void>(resolve => exec.signal.addEventListener('abort', () => resolve(), { once: true }))
        started()
        await pending
        if (outcome === 'throw') exec.signal.throwIfAborted()
        return { state: 'failed', error: 'cancelled' }
      }),
    }))
    const pending = executeTool(ctx.tools, { callId: 'fixture' as string, name: 'fixture_cancel', arguments: {}, signal: controller.signal })
    await ready
    controller.abort({ kind: 'user', detail: 'private-fixture-reason' })
    const result = await pending
    expect(result.isError).toBe(true)
    expect(result.content).toEqual([{ type: 'text', text: `Error: ${cancellationMessage}` }])
    expect(JSON.stringify(result)).not.toContain('private-fixture-reason')
    expect(commit).not.toHaveBeenCalled(); expect(rollback).toHaveBeenCalledOnce()
    expect(reader.budgetStatus('fixture')).toMatchObject({ callsUsed: 1, bytesUsed: 0, inFlight: 0 })
    // A stopped call must not leave the next call blocked by a reservation.
    expect(await reader.withBudget('fixture', new AbortController().signal, () => ({ ok: true }))).toEqual({ ok: true })
  } finally { controller.abort(); reader.dispose(); await ctx.fiber.dispose() }
})

it('normalizes already-aborted reasons without running the operation and preserves ordinary errors', async () => {
  const reader = new RedisAiReader(new RedisConnections(), () => undefined, async () => 0, () => true)
  try {
    for (const reason of [{ kind: 'user' }, 'private-fixture-reason', new Error('private-fixture-reason')]) {
      const controller = new AbortController(), operation = vi.fn(() => ({ ok: true }))
      controller.abort(reason)
      await expect(reader.withBudget('fixture', controller.signal, operation)).rejects.toThrow(cancellationMessage)
      expect(operation).not.toHaveBeenCalled()
    }
    const failure = new Error('ordinary fixture failure')
    await expect(reader.withBudget('fixture', new AbortController().signal, () => { throw failure })).rejects.toBe(failure)
    expect(reader.budgetStatus('fixture')).toMatchObject({ callsUsed: 4, bytesUsed: 0, inFlight: 0 })
  } finally { reader.dispose() }
})
