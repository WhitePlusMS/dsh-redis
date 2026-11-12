import * as NativeToolExecutor from '@deepseek-ai/dsh-tool-executor-native'
import { executeTool } from './tool-test-utils.ts'
import { Context } from '@deepseek-ai/cordis'
import type { Agent } from '@deepseek-ai/dsh-agent'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime from '@deepseek-ai/dsh-tools'
import { expect, it } from 'vitest'
import type { RedisSelectionItem } from '../src/domain.ts'
import { RedisAiReader } from '../src/host/ai-reader.ts'
import { registerRedisTools } from '../src/host/ai-tools.ts'
import { RedisConnections, type RedisLink } from '../src/host/connection-service.ts'
import type { RedisReply } from '../src/host/resp.ts'

it.each([
  ['list', 'TYPE', 'revision'],
  ['list', 'LRANGE', 'selection'],
  ['stream', 'TYPE', 'revision'],
  ['stream', 'XRANGE', 'selection'],
] as const)('stops registered AI %s selection reads after %s when %s changes', async (kind, delayed, change) => {
  let release!: (value: RedisReply) => void, entered!: () => void
  const waiting = new Promise<RedisReply>(resolve => { release = resolve })
  const started = new Promise<void>(resolve => { entered = resolve })
  const commands: string[] = []
  let revision = 1
  const link: RedisLink = {
    close: () => undefined,
    onFailure: () => () => undefined,
    async execute(command, _args, signal, guard) {
      signal.throwIfAborted(); guard(); commands.push(command)
      if (command === delayed) { entered(); return waiting }
      if (command === 'TYPE') return kind
      if (command === 'PTTL') return -1n
      if (command === 'LLEN' || command === 'XLEN') return 1n
      throw new Error('Unexpected command: ' + command)
    },
  }
  const connections = new RedisConnections(async () => link)
  const reader = new RedisAiReader(connections, () => undefined, async (_session, _target, expected) => expected ?? revision, (_session, expected) => expected === revision)
  const ctx = new Context()
  const signal = new AbortController().signal
  try {
    const view = await connections.connect('fixture', { host: '127.0.0.1', port: 6379, username: '', password: '', tls: null }, signal)
    if (view.id === null) throw new Error('Missing connection')
    const target = { id: view.id, generation: view.generation, db: 0 }
    const item: RedisSelectionItem = kind === 'list' ? { kind, index: '0' } : { kind, id: '1-0', fieldIndex: 0, fieldBase64: 'Zg==' }
    reader.setSelection('fixture', { target, selection: { keyBase64: 'aw==', item } })
    await ctx.plugin(SystemPrompt); await ctx.plugin(ToolRuntime); await ctx.plugin(NativeToolExecutor)
    await ctx.plugin({ name: 'selected-race-fixture', inject: ['tools'], apply: (scope: Context) => registerRedisTools(scope, reader) })
    const agent = { id: 'fixture-agent', ctx, session: { id: 'fixture' } } as unknown as Agent
    const pending = executeTool(ctx.tools, { callId: 'selection-race' as string, name: 'redis_viewer_value', arguments: {}, agent, signal })
    await started
    const dispatched = [...commands]
    if (change === 'revision') revision += 1
    else reader.setSelection('fixture', { target, selection: { keyBase64: 'bmV3', item: null } })
    release(delayed === 'TYPE' ? kind : delayed === 'LRANGE' ? [Buffer.from('old')] : [[Buffer.from('1-0'), [Buffer.from('f'), Buffer.from('old')]]])
    const result = await pending
    expect(result.isError).toBe(true)
    expect(JSON.stringify(result)).toContain('选择已变化')
    expect(JSON.stringify(result)).not.toContain('old')
    expect(commands).toEqual(dispatched)
  } finally {
    release('none')
    reader.dispose(); connections.dispose(); await ctx.fiber.dispose()
  }
})
