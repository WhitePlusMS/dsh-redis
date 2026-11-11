import { afterEach, describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import type { Agent } from '@deepseek-ai/dsh-agent'
import SessionStore from '@deepseek-ai/dsh-session'
import { SessionId } from '@deepseek-ai/dsh-session/types'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime, { type ToolExecutionInput } from '@deepseek-ai/dsh-tools'
import type { ApprovalService } from '@deepseek-ai/dsh-user-approval'
import { RedisConnections, type RedisWritableLink } from '../src/host/connection-service.ts'
import { RedisAiReader } from '../src/host/ai-reader.ts'
import { RedisAiWriter } from '../src/host/ai-writer.ts'
import { registerRedisWriteTools } from '../src/host/ai-write-tools.ts'
import { RedisRemoteService } from '../src/remote-service.ts'

const cleanups: Array<() => Promise<void>> = []
type FixtureApproval = 'allowed-once' | 'rejected' | 'cancelled' | 'unavailable'
afterEach(async () => { for (const cleanup of cleanups.splice(0).reverse()) await cleanup(); vi.restoreAllMocks() })

async function fixture() {
  vi.spyOn(console, 'info').mockImplementation(() => undefined)
  let writes = 0, decision: 'allow' | 'deny' | 'ask' = 'allow', approval: FixtureApproval = 'allowed-once'
  let approvalGate: Promise<FixtureApproval> | undefined
  const ask = vi.fn(async () => approvalGate === undefined ? approval : approvalGate)
  const link: RedisWritableLink = {
    close: () => undefined, onFailure: () => () => undefined, execute: async () => null,
    async sampleExisting(_request, _signal, guard) { guard(); return Buffer.from('old') },
    async replaceExisting(_request, _signal, guard, submitted, readback) { guard(false); submitted(); writes++; readback('2026-11-11T00:00:00.000Z'); return 'written-verified' },
  }
  const connections = new RedisConnections(async () => link)
  const view = await connections.connect('write-a', { host: 'fixture', port: 6379, username: '', password: 'secret', tls: null }, new AbortController().signal)
  if (view.id === null) throw new Error('Missing connection')
  const target = { id: view.id, generation: view.generation, db: view.db }
  const reader = new RedisAiReader(connections, () => undefined, async () => 0, () => false), writer = new RedisAiWriter(connections)
  const ctx = new Context()
  ctx.provide('approval', { request: ask } as unknown as ApprovalService)
  await ctx.plugin(SystemPrompt); await ctx.plugin(ToolRuntime); await ctx.plugin(SessionStore)
  await ctx.plugin({ name: 'redis-write-test', inject: ['tools'], apply(scope: Context) { registerRedisWriteTools(scope, reader, writer) } })
  ctx.on('tools/pre-execute', (exec, next) => {
    if (exec.name !== 'redis_viewer_execute_write' || decision === 'allow') return next()
    return Promise.resolve(decision === 'deny' ? { kind: 'deny' as const, reason: 'fixture-denial' } : { kind: 'ask' as const, reason: 'fixture-ask' })
  })
  const session = ctx.sessions.create(SessionId('write-a'))
  const agent = { id: 'agent-a', ctx, session } as unknown as Agent
  let turn = 1, callId = 0
  session.append('turn/start', { turn })
  const call = (name: string, args: unknown, caller: Agent = agent) => ctx.tools.execute({ name, arguments: args, agent: caller, signal: new AbortController().signal, callId: ('write-' + ++callId) as ToolExecutionInput['callId'] })
  const nextTurn = () => { session.append('turn/end', { turn, reason: { kind: 'completed' } }); session.append('turn/start', { turn: ++turn }) }
  cleanups.push(async () => { await ctx.fiber.dispose(); writer.dispose(); reader.dispose(); connections.dispose() })
  return { ctx, writer, target, session, call, nextTurn, ask, get writes() { return writes }, setDecision(value: typeof decision) { decision = value }, setApproval(value: FixtureApproval) { approval = value }, setApprovalGate(value: Promise<FixtureApproval>) { approvalGate = value } }
}
function json(result: Awaited<ReturnType<ToolRuntime['execute']>>): Record<string, unknown> {
  expect(result.isError).toBe(false)
  return JSON.parse(result.content.filter(block => block.type === 'text').map(block => block.text).join('')) as Record<string, unknown>
}
const prepare = { type: 'string', key: 'key', value: 'new' }

describe('DSH native Redis write tools', () => {
  it('requires the Host switch, binds the exact proposal and returns a session-scoped record', async () => {
    const f = await fixture()
    expect((await f.call('redis_viewer_prepare_write', prepare)).isError).toBe(true)
    f.writer.enable('write-a', f.target)
    const result = json(await f.call('redis_viewer_prepare_write', prepare)), proposal = result.proposal as Record<string, unknown>
    expect(proposal.beforeBase64).toBe(Buffer.from('old').toString('base64'))
    expect((await f.call('redis_viewer_execute_write', { proposal: { ...proposal, afterBase64: 'YmFk' } })).isError).toBe(true)
    const written = json(await f.call('redis_viewer_execute_write', { proposal }))
    expect(written.state).toBe('written-verified'); expect(f.writes).toBe(1)
    expect(json(await f.call('redis_viewer_write_status', { id: proposal.id })).state).toBe('written-verified')
    expect((await f.call('redis_viewer_execute_write', { proposal })).isError).toBe(true)
    const other = f.ctx.sessions.create(SessionId('write-b'))
    const foreign = { id: 'agent-b', ctx: f.ctx, session: other } as unknown as Agent
    expect(json(await f.call('redis_viewer_write_status', { id: proposal.id }, foreign)).state).toBe('unavailable')
    const remote = Object.create(RedisRemoteService.prototype) as RedisRemoteService
    Reflect.set(remote, 'writer', f.writer)
    expect((await remote.writeLookup(foreign, { id: String(proposal.id) }, new AbortController().signal)).record).toBeNull()
    const owner = { session: f.session } as unknown as Agent
    expect((await remote.writeLookup(owner, { id: String(proposal.id) }, new AbortController().signal)).record?.state).toBe('written-verified')
  })

  it('honors DSH deny and ask decisions without a separate mandatory click', async () => {
    const f = await fixture(); f.writer.enable('write-a', f.target)
    const proposal = json(await f.call('redis_viewer_prepare_write', prepare)).proposal
    f.setDecision('deny')
    expect((await f.call('redis_viewer_execute_write', { proposal })).isError).toBe(true)
    f.setDecision('ask'); f.setApproval('rejected')
    expect((await f.call('redis_viewer_execute_write', { proposal })).isError).toBe(true)
    f.setApproval('cancelled')
    expect((await f.call('redis_viewer_execute_write', { proposal })).isError).toBe(true)
    f.setApproval('unavailable')
    expect((await f.call('redis_viewer_execute_write', { proposal })).isError).toBe(true)
    expect(f.writes).toBe(0)
    f.setApproval('allowed-once')
    expect(json(await f.call('redis_viewer_execute_write', { proposal })).state).toBe('written-verified')
    expect(f.writes).toBe(1)
  })

  it('rejects forged parameters and proposals from an earlier turn', async () => {
    const f = await fixture(); f.writer.enable('write-a', f.target)
    for (const args of [{ ...prepare, approved: true }, { ...prepare, keyBase64: 'aw==' }, { ...prepare, value: '\ud800' }, { ...prepare, value: 'x'.repeat(4097) }, { ...prepare, value: undefined, valueBase64: 'A'.repeat(6000) }, { ...prepare, field: 'field' }]) expect((await f.call('redis_viewer_prepare_write', args)).isError).toBe(true)
    const proposal = json(await f.call('redis_viewer_prepare_write', prepare)).proposal
    f.nextTurn()
    expect((await f.call('redis_viewer_execute_write', { proposal })).isError).toBe(true)
    expect(f.writes).toBe(0)
  })

  it('does not execute when the turn ends while DSH approval is pending', async () => {
    const f = await fixture(); f.writer.enable('write-a', f.target)
    const proposal = json(await f.call('redis_viewer_prepare_write', prepare)).proposal
    let release!: (value: 'allowed-once') => void
    const waiting = new Promise<'allowed-once'>(resolve => { release = resolve })
    f.setDecision('ask'); f.setApprovalGate(waiting)
    const pending = f.call('redis_viewer_execute_write', { proposal })
    await vi.waitFor(() => expect(f.ask).toHaveBeenCalledTimes(1))
    f.nextTurn(); release('allowed-once')
    expect((await pending).isError).toBe(true)
    expect(f.writes).toBe(0)
  })
})
