import * as NativeToolExecutor from '@deepseek-ai/dsh-tool-executor-native'
import { executeTool } from './tool-test-utils.ts'
import { Context } from '@deepseek-ai/cordis'
import type { Agent } from '@deepseek-ai/dsh-agent'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime from '@deepseek-ai/dsh-tools'
import { expect, it, vi } from 'vitest'
import type { UiAction } from '../src/domain.ts'
import { RedisAiReader } from '../src/host/ai-reader.ts'
import { registerRedisLocateTool } from '../src/host/ai-locate-tool.ts'
import { RedisConnections, type RedisLink } from '../src/host/connection-service.ts'
import { UiActionCoordinator } from '../src/host/ui-action-coordinator.ts'

it('rejects unpaired text surrogates while preserving non-BMP and Base64 identities', async () => {
  let kind = 'none'
  const identities: string[] = []
  const link: RedisLink = { close: () => undefined, onFailure: () => () => undefined, async execute(command, args, signal, guard) {
    signal.throwIfAborted(); guard()
    if (command === 'TYPE') { if (kind === 'none' && Buffer.isBuffer(args[0])) identities.push(args[0].toString('base64')); return kind }
    if (command === 'PTTL') return -1n
    if (command === 'HGET' || command === 'SISMEMBER' || command === 'ZSCORE') {
      if (!Buffer.isBuffer(args[1])) throw new Error('Missing identity bytes')
      identities.push(args[1].toString('base64'))
      return command === 'SISMEMBER' ? 0n : null
    }
    throw new Error('Unexpected synthetic command')
  } }
  const connections = new RedisConnections(async () => link), actions = new UiActionCoordinator<UiAction>()
  const reader = new RedisAiReader(connections, session => actions.invalidateSession(session), async () => 1, () => true)
  const ctx = new Context(), abort = new AbortController()
  vi.spyOn(console, 'info').mockImplementation(() => undefined)
  await ctx.plugin(SystemPrompt); await ctx.plugin(ToolRuntime); await ctx.plugin(NativeToolExecutor)
  await ctx.plugin({ name: 'unicode-locate-fixture', inject: ['tools'], apply: (scope: Context) => registerRedisLocateTool(scope, reader, actions) })
  const agent = { id: 'a', ctx, session: { id: 'a' } } as unknown as Agent
  const receive = async () => { throw new Error('No action expected for missing members') }
  actions.register('a', receive); actions.setSelectionState('a', receive, 1, true)
  try {
    const connection = await connections.connect('a', { host: 'fixture', port: 6379, username: '', password: '', tls: null }, abort.signal)
    if (connection.id === null) throw new Error('Missing connection')
    reader.setSelection('a', { target: { id: connection.id, generation: connection.generation, db: 0 }, selection: { keyBase64: 'aw==', item: null } })
    const call = (name: string, args: object) => executeTool(ctx.tools, { callId: 'unicode-locate' as string, name, arguments: args, agent, signal: abort.signal })
    for (const [name, field, current] of [
      ['redis_viewer_locate_key', 'key', 'none'],
      ['redis_viewer_locate_hash_field', 'field', 'hash'],
      ['redis_viewer_locate_set_member', 'member', 'set'],
      ['redis_viewer_locate_zset_member', 'member', 'zset'],
    ] as const) {
      kind = current
      for (const invalid of ['\ud800', '\udc00']) {
        const before = identities.length, result = await call(name, { [field]: invalid })
        expect(result.isError).toBe(true)
        expect(identities).toHaveLength(before)
      }
      const text = await call(name, { [field]: '😀' })
      expect(text.isError).toBeFalsy()
      expect(identities.at(-1)).toBe('8J+YgA==')
      const binary = await call(name, { [`${field}Base64`]: 'AP8=' })
      expect(binary.isError).toBeFalsy()
      expect(identities.at(-1)).toBe('AP8=')
    }
  } finally { abort.abort(); reader.dispose(); actions.dispose(); connections.dispose(); await ctx.fiber.dispose(); vi.restoreAllMocks() }
})
