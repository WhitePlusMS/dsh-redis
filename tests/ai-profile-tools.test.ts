import { Context } from '@deepseek-ai/cordis'
import type { Agent } from '@deepseek-ai/dsh-agent'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime from '@deepseek-ai/dsh-tools'
import { mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import { basename, dirname, join, resolve } from 'node:path'
import { expect, it, vi } from 'vitest'
import { RedisAiReader } from '../src/host/ai-reader.ts'
import { RedisConnections } from '../src/host/connection-service.ts'
import { RedisProfiles } from '../src/host/profile-store.ts'
import { registerRedisProfileTools } from '../src/host/ai-profile-tools.ts'
import { RedisProfileSnapshots } from '../src/host/profile-snapshots.ts'

it('lists bounded profile summaries through the real tool without connection settings', async () => {
  const runtime = resolve(import.meta.dirname, '../.scratch/runtime')
  const directory = await mkdtemp(join(runtime, 'ai-profiles-test-'))
  const store = new RedisProfiles(directory), connections = new RedisConnections(), snapshots = new RedisProfileSnapshots()
  const reader = new RedisAiReader(connections, () => undefined, async () => 0, () => true)
  const ctx = new Context(), signal = new AbortController().signal
  const log = vi.spyOn(console, 'info').mockImplementation(() => undefined)
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
  await ctx.plugin(SystemPrompt); await ctx.plugin(ToolRuntime)
  const fiber = await ctx.plugin({ name: 'redis-profile-test', inject: ['tools'], apply: (scope: Context) => registerRedisProfileTools(scope, reader, snapshots, (_agent, requestSignal) => store.list(requestSignal)) })
  const agent = { id: 'a', ctx, session: { id: 'a' } } as unknown as Agent
  const call = (args: unknown, requestSignal = signal, toolAgent: Agent | null = agent) => ctx.tools.execute({ callId: 'profile-test' as Parameters<typeof ctx.tools.execute>[0]['callId'], name: 'redis_viewer_profiles', arguments: args, ...(toolAgent === null ? {} : { agent: toolAgent }), signal: requestSignal })
  const content = (result: Awaited<ReturnType<typeof call>>) => result.content.filter(item => item.type === 'text').map(item => item.text).join('')
  try {
    expect(JSON.parse(content(await call({})))).toMatchObject({ profiles: [], total: 0, nextOffset: null, snapshot: false })
    for (let index = 0; index < 12; index += 1) await store.save({ id: null, name: index < 2 ? 'Synthetic shared' : 'Synthetic ' + index, group: index % 2 ? 'B' : 'A', settings: { host: 'private-host.example', port: 6379, username: 'private-user', tls: { caPem: 'private-certificate' } } }, signal)
    const first = content(await call({})), next = content(await call({ offset: 10 }))
    expect(JSON.parse(first)).toMatchObject({ profiles: expect.arrayContaining([expect.objectContaining({ id: expect.any(String), name: 'Synthetic shared', group: 'A', snapshotToken: expect.any(String) }), expect.objectContaining({ id: expect.any(String), name: 'Synthetic shared', group: 'B', snapshotToken: expect.any(String) })]), total: 12, nextOffset: 10, snapshot: false })
    expect(JSON.parse(first).profiles).toHaveLength(10)
    expect(JSON.parse(next)).toMatchObject({ profiles: expect.arrayContaining([expect.objectContaining({ id: expect.any(String), name: 'Synthetic 11', group: 'B', snapshotToken: expect.any(String) })]), total: 12, nextOffset: null })
    for (const secret of ['private-host.example', 'private-user', 'private-certificate']) expect(first + next + JSON.stringify(log.mock.calls)).not.toContain(secret)
    expect(reader.budgetStatus('a').callsUsed).toBe(3)
    const listed: { id: string; snapshotToken: string } = JSON.parse(first).profiles[0]
    const saved = (await store.list(signal)).profiles[0]!
    expect(snapshots.resolve('a', listed.id, listed.snapshotToken)).toEqual(saved)
    expect(snapshots.resolve('b', listed.id, listed.snapshotToken)).toBeUndefined()
    await store.save({ ...saved, name: 'Renamed', settings: { ...saved.settings, port: 6380 } }, signal)
    const relisted: { profiles: { id: string; snapshotToken: string }[] } = JSON.parse(content(await call({})))
    const current = relisted.profiles.find(value => value.id === listed.id)
    if (current === undefined) throw new Error('Missing relisted profile')
    expect(current.snapshotToken).not.toBe(listed.snapshotToken)
    expect(snapshots.resolve('a', listed.id, listed.snapshotToken)).toBeUndefined()
    expect(snapshots.resolve('a', listed.id, current.snapshotToken)?.settings.port).toBe(6380)
    ctx.emit('session/disposed', agent.session)
    expect(snapshots.resolve('a', listed.id, current.snapshotToken)).toBeUndefined()
    for (const args of [{ offset: -1 }, { offset: 51 }, { offset: 0.5 }, { sessionId: 'other' }]) expect((await call(args)).isError).toBe(true)
    const cancelled = new AbortController(); cancelled.abort()
    expect((await call({}, cancelled.signal)).isError).toBe(true)
    expect((await call({}, signal, null)).isError).toBe(true)
    await writeFile(join(directory, 'data/dsh-redis/connections.json'), 'invalid synthetic storage', 'utf8')
    expect((await call({})).isError).toBe(true)
    const disposable = snapshots.issue('disposable', saved)
    if (disposable === null) throw new Error('Missing disposable token')
    await fiber.dispose(); expect(ctx.tools.schemas()).toHaveLength(0)
    expect(snapshots.resolve('disposable', saved.id, disposable)).toBeUndefined()
  } finally {
    await ctx.fiber.dispose(); reader.dispose(); connections.dispose(); log.mockRestore(); warn.mockRestore()
    const actual = await realpath(directory)
    if (dirname(actual) !== await realpath(runtime) || !basename(actual).startsWith('ai-profiles-test-')) throw new Error('Refusing cleanup outside the owned test directory')
    await rm(actual, { recursive: true })
  }
})

it('rolls back staged tokens when a tool call is cancelled before budget commit', async () => {
  const connections = new RedisConnections(), snapshots = new RedisProfileSnapshots(), ctx = new Context()
  const reader = new RedisAiReader(connections, () => undefined, async () => 0, () => true)
  const profile = { id: 'fixture', name: 'Fixture', settings: { host: 'private-host.example', port: 6379, username: '', tls: null } }
  const first = snapshots.issue('a', profile)
  if (first === null) throw new Error('Missing fixture token')
  const cancelled = new AbortController(), prepare = snapshots.prepare.bind(snapshots)
  vi.spyOn(snapshots, 'prepare').mockImplementation((session, profiles) => { const staged = prepare(session, profiles); queueMicrotask(() => cancelled.abort()); return staged })
  await ctx.plugin(SystemPrompt); await ctx.plugin(ToolRuntime)
  await ctx.plugin({ name: 'redis-profile-stage-cancel-test', inject: ['tools'], apply: (scope: Context) => registerRedisProfileTools(scope, reader, snapshots, async () => ({ profiles: [profile], selectedId: null })) })
  try {
    const agent = { id: 'a', ctx, session: { id: 'a' } } as unknown as Agent
    const result = await ctx.tools.execute({ callId: 'stage-cancel' as Parameters<typeof ctx.tools.execute>[0]['callId'], name: 'redis_viewer_profiles', arguments: {}, agent, signal: cancelled.signal })
    expect(result.isError).toBe(true)
    expect(snapshots.resolve('a', profile.id, first)).toEqual(profile)
    expect(reader.budgetStatus('a')).toMatchObject({ bytesUsed: 0, inFlight: 0 })
  } finally { await ctx.fiber.dispose(); reader.dispose(); connections.dispose() }
})

it('returns an explicit null token when the shared capacity is exhausted', async () => {
  const connections = new RedisConnections(), snapshots = new RedisProfileSnapshots(), ctx = new Context()
  const reader = new RedisAiReader(connections, () => undefined, async () => 0, () => true)
  const profile = { id: 'fixture', name: 'Fixture', settings: { host: 'private-host.example', port: 6379, username: '', tls: null } }
  for (let session = 0; session < 5; session++) for (let index = 0; index < 50; index++) expect(snapshots.issue(`s${session}`, { ...profile, id: `p${index}` })).not.toBeNull()
  await ctx.plugin(SystemPrompt); await ctx.plugin(ToolRuntime)
  await ctx.plugin({ name: 'redis-profile-capacity-test', inject: ['tools'], apply: (scope: Context) => registerRedisProfileTools(scope, reader, snapshots, async () => ({ profiles: [profile], selectedId: null })) })
  try {
    const agent = { id: 'overflow', ctx, session: { id: 'overflow' } } as unknown as Agent
    const result = await ctx.tools.execute({ callId: 'capacity' as Parameters<typeof ctx.tools.execute>[0]['callId'], name: 'redis_viewer_profiles', arguments: {}, agent, signal: new AbortController().signal })
    const text = result.content.filter(item => item.type === 'text').map(item => item.text).join('')
    expect(JSON.parse(text)).toMatchObject({ profiles: [{ id: 'fixture', snapshotToken: null }] })
    expect(text).not.toContain('private-host.example')
  } finally { await ctx.fiber.dispose(); reader.dispose(); connections.dispose() }
})

it('discards a cancelled profile read without charging another session', async () => {
  const connections = new RedisConnections()
  const snapshots = new RedisProfileSnapshots()
  const reader = new RedisAiReader(connections, () => undefined, async () => 0, () => true)
  const ctx = new Context()
  await ctx.plugin(SystemPrompt); await ctx.plugin(ToolRuntime)
  let release!: () => void, started!: () => void
  const waiting = new Promise<void>(resolve => { release = resolve })
  const observed = new Promise<void>(resolve => { started = resolve })
  await ctx.plugin({ name: 'redis-profile-cancel-test', inject: ['tools'], apply: (scope: Context) => registerRedisProfileTools(scope, reader, snapshots, async () => {
    started(); await waiting
    return { profiles: [], selectedId: null }
  }) })
  const agent = (id: string) => ({ id, ctx, session: { id } }) as unknown as Agent
  const call = (id: string, signal: AbortSignal) => ctx.tools.execute({ callId: ('profile-' + id) as Parameters<typeof ctx.tools.execute>[0]['callId'], name: 'redis_viewer_profiles', arguments: {}, agent: agent(id), signal })
  const cancelled = new AbortController()
  try {
    const first = call('a', cancelled.signal)
    await observed
    const second = call('b', new AbortController().signal)
    cancelled.abort(); release()
    expect((await first).isError).toBe(true)
    expect((await second).isError).toBeFalsy()
    expect(reader.budgetStatus('a')).toMatchObject({ callsUsed: 1, bytesUsed: 0, inFlight: 0 })
    expect(reader.budgetStatus('b').callsUsed).toBe(1)
    expect(reader.budgetStatus('b').bytesUsed).toBeGreaterThan(0)
  } finally { release(); await ctx.fiber.dispose(); reader.dispose(); connections.dispose() }
})
