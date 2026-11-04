import { Context, symbols } from '@deepseek-ai/cordis'
import type { Agent } from '@deepseek-ai/dsh-agent'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime from '@deepseek-ai/dsh-tools'
import { mkdir, mkdtemp, realpath, rm } from 'node:fs/promises'
import { basename, dirname, join, resolve } from 'node:path'
import { expect, it, vi } from 'vitest'
import { registerRedisConnectionTools } from '../src/host/ai-connection-tools.ts'
import { registerRedisProfileTools } from '../src/host/ai-profile-tools.ts'
import { ConnectionFailure, RedisConnections, type RedisLink, type RedisOpener } from '../src/host/connection-service.ts'
import { RedisProfileSnapshots } from '../src/host/profile-snapshots.ts'
import { RedisProfiles } from '../src/host/profile-store.ts'
import { RedisRemoteService } from '../src/remote-service.ts'

it('connects only an unchanged, current-session profile and keeps the old connection on failure', async () => {
  const runtime = resolve(import.meta.dirname, '../.scratch/runtime')
  await mkdir(runtime, { recursive: true })
  const directory = await mkdtemp(join(runtime, 'ai-connect-test-'))
  const ctx = new Context(), snapshots = new RedisProfileSnapshots(), profiles = new RedisProfiles(directory)
  const signal = new AbortController().signal
  ctx.provide('profileContext', { name: 'fixture', dir: directory, patchPath: '', installAnchor: '', cwd: '.', home: '.', startedBundles: [], overlays: [], telemetryDisabledEnv: undefined })
  await ctx.plugin(SystemPrompt); await ctx.plugin(ToolRuntime); await ctx.plugin(RedisRemoteService)
  const proxy = ctx.get('redisViewer') as unknown as RedisRemoteService & { [symbols.original]?: RedisRemoteService }
  const service = proxy[symbols.original] ?? proxy
  const connections = Reflect.get(service, 'connections') as RedisConnections
  const closeOld = vi.fn(), closeNew = vi.fn(), closeLate = vi.fn()
  const makeLink = (close: () => void): RedisLink => ({ close, execute: async () => null, onFailure: () => () => undefined })
  let release!: (link: RedisLink) => void, started!: () => void
  const waiting = new Promise<RedisLink>(resolve => { release = resolve }), opened = new Promise<void>(resolve => { started = resolve })
  const opener = vi.fn<RedisOpener>(async settings => {
    expect(settings.password).toBe('')
    if (settings.host === 'auth.fixture') throw new ConnectionFailure('auth')
    if (settings.host === 'wait.fixture') { started(); return waiting }
    return makeLink(settings.host === 'old.fixture' ? closeOld : closeNew)
  })
  Reflect.set(connections, 'open', opener)
  const before = await connections.connect('a', { host: 'old.fixture', port: 6379, username: '', password: '', tls: null }, signal)
  const clear = vi.spyOn(service.ai, 'clearTarget')
  const newProfile = (await profiles.save({ id: null, name: 'New fixture', settings: { host: 'new.fixture', port: 6379, username: '', tls: null } }, signal)).profiles[0]!
  const authProfile = (await profiles.save({ id: null, name: 'Auth fixture', settings: { host: 'auth.fixture', port: 6379, username: '', tls: null } }, signal)).profiles.find(p => p.name === 'Auth fixture')!
  const waitProfile = (await profiles.save({ id: null, name: 'Wait fixture', settings: { host: 'wait.fixture', port: 6379, username: '', tls: null } }, signal)).profiles.find(p => p.name === 'Wait fixture')!
  await ctx.plugin({ name: 'ai-connection-test', inject: ['tools'], apply: (scope: Context) => {
    registerRedisProfileTools(scope, service.ai, snapshots, (agent, s) => service.listProfiles(agent, {}, s))
    registerRedisConnectionTools(scope, service.ai, snapshots, (agent, profile, s, current) => service.connectSavedProfile(agent, profile, s, current))
  } })
  const agent = (id: string) => ({ id, ctx, session: { id } }) as unknown as Agent
  const call = (name: string, args: unknown, session = 'a') => ctx.tools.execute({ callId: 'fixture' as Parameters<typeof ctx.tools.execute>[0]['callId'], name, arguments: args, agent: agent(session), signal })
  const content = (result: Awaited<ReturnType<typeof call>>) => result.content.filter(block => block.type === 'text').map(block => block.text).join('')
  const list = async () => JSON.parse(content(await call('redis_viewer_profiles', {}))) as { profiles: Array<{ id: string; snapshotToken: string }> }
  try {
    const listed = await list()
    const token = (id: string) => listed.profiles.find(profile => profile.id === id)!.snapshotToken
    expect((await call('redis_viewer_connect_profile', { id: newProfile.id, snapshotToken: token(newProfile.id) }, 'b')).isError).toBe(true)
    expect((await call('redis_viewer_connect_profile', { id: newProfile.id, snapshotToken: token(newProfile.id), password: 'not-allowed' })).isError).toBe(true)
    expect(opener).toHaveBeenCalledTimes(1); expect(connections.status('a')).toEqual(before)
    const failed = content(await call('redis_viewer_connect_profile', { id: authProfile.id, snapshotToken: token(authProfile.id) }))
    expect(JSON.parse(failed)).toMatchObject({ state: 'failed', error: 'auth', connection: null })
    expect(failed).not.toContain('auth.fixture'); expect(connections.status('a')).toEqual(before); expect(clear).not.toHaveBeenCalled()
    const success = content(await call('redis_viewer_connect_profile', { id: newProfile.id, snapshotToken: token(newProfile.id) }))
    expect(JSON.parse(success)).toMatchObject({ state: 'connected', previousRelease: 'closed', connection: { db: 0, state: 'connected' } })
    expect(success).not.toContain('new.fixture'); expect(closeOld).toHaveBeenCalledOnce(); expect(clear).toHaveBeenCalledOnce()
    const current = connections.status('a')
    const pending = call('redis_viewer_connect_profile', { id: waitProfile.id, snapshotToken: token(waitProfile.id) })
    await opened
    await list() // Reissuing the same profile invalidates the pending token.
    release(makeLink(closeLate))
    expect(JSON.parse(content(await pending))).toMatchObject({ state: 'failed', error: 'stale' })
    expect(connections.status('a')).toEqual(current); expect(closeNew).not.toHaveBeenCalled(); expect(closeLate).toHaveBeenCalledOnce(); expect(clear).toHaveBeenCalledOnce()
  } finally {
    release(makeLink(closeLate)); await ctx.fiber.dispose()
    const actual = await realpath(directory)
    if (dirname(actual) !== await realpath(runtime) || !basename(actual).startsWith('ai-connect-test-')) throw new Error('Refusing cleanup outside the owned test directory')
    await rm(actual, { recursive: true })
  }
})
