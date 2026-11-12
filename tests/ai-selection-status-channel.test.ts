import * as NativeToolExecutor from '@deepseek-ai/dsh-tool-executor-native'
import { executeTool } from './tool-test-utils.ts'
import { Context } from '@deepseek-ai/cordis'
import type { Agent } from '@deepseek-ai/dsh-agent'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime from '@deepseek-ai/dsh-tools'
import { expect, it } from 'vitest'
import type { UiAction, UiChannelInput } from '../src/domain.ts'
import { RedisAiReader } from '../src/host/ai-reader.ts'
import { registerRedisTools } from '../src/host/ai-tools.ts'
import { RedisConnections, type RedisLink } from '../src/host/connection-service.ts'
import { openUiActionChannel } from '../src/host/ui-action-channel.ts'
import { UiActionCoordinator } from '../src/host/ui-action-coordinator.ts'

function uplink() {
  const queue: UiChannelInput[] = []
  let wake: (() => void) | undefined, ended = false
  const notify = () => { const next = wake; wake = undefined; next?.() }
  return {
    send(value: UiChannelInput) { queue.push(value); notify() },
    end() { ended = true; notify() },
    async *[Symbol.asyncIterator]() { while (!ended) { const value = queue.shift(); if (value !== undefined) { yield value; continue } await new Promise<void>(resolve => { wake = resolve; if (ended || queue.length > 0) notify() }) } },
  }
}

it('hides an unconfirmed action selection after stream loss and restores status only after a new stream synchronizes', async () => {
  const link: RedisLink = { close: () => undefined, onFailure: () => () => undefined, execute: async () => { throw new Error('No Redis value command should run') } }
  const connections = new RedisConnections(async () => link), actions = new UiActionCoordinator<UiAction>()
  const reader = new RedisAiReader(connections, session => actions.invalidateSession(session), async (session, _target, expected) => {
    const revision = actions.selectionRevision(session)
    if (revision === null || (expected !== null && revision !== expected)) throw new Error('选择未同步')
    return revision
  }, (session, revision) => { const current = actions.selectionRevision(session); return current !== null && (revision === null || current === revision) })
  const ctx = new Context(), abort = new AbortController()
  await ctx.plugin(SystemPrompt); await ctx.plugin(ToolRuntime); await ctx.plugin(NativeToolExecutor)
  await ctx.plugin({ name: 'selection-status-fixture', inject: ['tools'], apply: (scope: Context) => registerRedisTools(scope, reader) })
  const agent = { id: 'a', ctx, session: { id: 'a' } } as unknown as Agent
  const call = (name: string) => executeTool(ctx.tools, { callId: 'status-fixture' as string, name, arguments: {}, agent, signal: abort.signal })
  const resultJson = (result: Awaited<ReturnType<typeof call>>) => JSON.parse(result.content.filter(item => item.type === 'text').map(item => item.text).join('')) as unknown
  const connection = await connections.connect('a', { host: 'fixture', port: 6379, username: '', password: '', tls: null }, abort.signal)
  if (connection.id === null) throw new Error('Missing fixture connection')
  const target = { id: connection.id, generation: connection.generation, db: 0 }, old = { keyBase64: 'b2xk', item: null }, selected = { keyBase64: 'bmV3', item: null }
  const input = uplink(), firstAbort = new AbortController()
  const open = (signal: AbortSignal, source: ReturnType<typeof uplink>) => openUiActionChannel(actions, 'a', signal, source, (request, origin) => origin === 'action' ? reader.commitSelection('a', request) : reader.setSelection('a', request))
  const first = open(firstAbort.signal, input), waiting = first.next()
  try {
    reader.setSelection('a', { target, selection: old })
    input.send({ kind: 'selection', revision: 1, synchronized: true })
    await viWait(() => actions.selectionRevision('a') === 1)
    expect(resultJson(await call('redis_viewer_status'))).toMatchObject({ selectionSync: 'synchronized', currentSelection: { selection: old } })
    const pending = actions.dispatch('a', { kind: 'selectKey', key: { base64: 'bmV3', byteLength: 3, label: 'new' } }, target, 1, () => true, abort.signal)
    const frame = await waiting
    if (frame.done || frame.value.kind !== 'action') throw new Error('Missing selection action')
    let next = first.next()
    input.send({ kind: 'commitSelection', requestId: frame.value.request.requestId, revision: 1, nextRevision: 2 })
    expect(await next).toMatchObject({ value: { kind: 'selectionResult', accepted: true } })
    next = first.next()
    input.send({ kind: 'publishSelection', requestId: '12345678-1234-1234-1234-123456789abc', actionRequestId: frame.value.request.requestId, revision: 2, request: { target, selection: selected } })
    expect(await next).toMatchObject({ value: { kind: 'selectionResult', accepted: true } })
    expect(resultJson(await call('redis_viewer_status'))).toMatchObject({ selectionSync: 'unavailable', currentSelection: null })
    input.end(); firstAbort.abort(); expect(await pending).toBe('unknown')
    expect(resultJson(await call('redis_viewer_status'))).toMatchObject({ selectionSync: 'unavailable', currentSelection: null })
    expect((await call('redis_viewer_value')).isError).toBe(true)

    const reopened = uplink(), reopenAbort = new AbortController(), second = open(reopenAbort.signal, reopened)
    let response = second.next()
    reopened.send({ kind: 'selection', revision: 3, synchronized: false })
    reopened.send({ kind: 'publishSelection', requestId: '12345678-1234-1234-1234-123456789abd', revision: 3, request: { target, selection: old } })
    expect(await response).toMatchObject({ value: { kind: 'selectionResult', accepted: true } })
    expect(resultJson(await call('redis_viewer_status'))).toMatchObject({ selectionSync: 'unavailable', currentSelection: null })
    reopened.send({ kind: 'selection', revision: 3, synchronized: true })
    await viWait(() => actions.selectionRevision('a') === 3)
    expect(resultJson(await call('redis_viewer_status'))).toMatchObject({ selectionSync: 'synchronized', currentSelection: { selection: old } })
    reopenAbort.abort(); reopened.end(); response = second.next(); expect((await response).done).toBe(true)
  } finally { input.end(); firstAbort.abort(); abort.abort(); reader.dispose(); actions.dispose(); connections.dispose(); await ctx.fiber.dispose() }
})

async function viWait(predicate: () => boolean): Promise<void> {
  for (let i = 0; i < 100; i++) { if (predicate()) return; await new Promise(resolve => setTimeout(resolve, 10)) }
  throw new Error('Timed out waiting for selection state')
}
