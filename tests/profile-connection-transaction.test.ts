import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdir, mkdtemp, realpath, rm } from 'node:fs/promises'
import { basename, dirname, join, resolve } from 'node:path'
import { RedisConnections, type RedisLink, type RedisOpener } from '../src/host/connection-service.ts'
import { RedisProfiles } from '../src/host/profile-store.ts'
import type { ConnectionRequest, SaveProfileRequest } from '../src/domain.ts'

const runtime = resolve(import.meta.dirname, '../.scratch/runtime')
const signal = () => new AbortController().signal
const profile: SaveProfileRequest = { id: null, name: 'Synthetic', settings: { host: 'new.fixture', port: 6379, username: 'reader', tls: null } }
const oldSettings: ConnectionRequest = { ...profile.settings, host: 'old.fixture', password: '' }
let directory: string
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(done => { resolve = done })
  return { promise, resolve }
}
function link() {
  const close = vi.fn()
  const transport: RedisLink = { close, execute: async () => null, onFailure: () => () => undefined }
  return { close, transport }
}
beforeEach(async () => { await mkdir(runtime, { recursive: true }); directory = await mkdtemp(join(runtime, 'profile-connect-')) })
afterEach(async () => {
  const actual = await realpath(directory)
  if (dirname(actual) !== await realpath(runtime) || !basename(actual).startsWith('profile-connect-')) throw new Error('Refusing cleanup outside the owned test directory')
  await rm(actual, { recursive: true })
})

describe('profile-verified candidate exchange', () => {
  it('rejects a profile changed while the candidate connects, preserving the old socket', async () => {
    const profiles = new RedisProfiles(directory), other = new RedisProfiles(directory)
    const saved = (await profiles.save(profile, signal())).profiles[0]!
    const old = link(), candidate = link(), opening = deferred<RedisLink>(), opened = deferred<void>()
    const open = vi.fn<RedisOpener>().mockResolvedValueOnce(old.transport).mockImplementationOnce(() => { opened.resolve(); return opening.promise })
    const connections = new RedisConnections(open)
    try {
      const before = await connections.connect('session', oldSettings, signal())
      const pending = connections.connectProfileCandidate('session', saved, 'synthetic-password', signal(), profiles)
      await opened.promise
      const update = other.save({ ...profile, id: saved.id, settings: { ...profile.settings, port: 6380 } }, signal())
      opening.resolve(candidate.transport)
      await update
      expect(await pending).toEqual({ state: 'failed', error: 'stale' })
      expect(connections.status('session')).toEqual(before)
      expect(old.close).not.toHaveBeenCalled()
      expect(candidate.close).toHaveBeenCalledTimes(1)
    } finally { connections.dispose() }
  })

  it('binds connection settings to a cloned profile and commits before a later save', async () => {
    const profiles = new RedisProfiles(directory), other = new RedisProfiles(directory)
    const saved = (await profiles.save(profile, signal())).profiles[0]!
    const old = link(), candidate = link(), opening = deferred<RedisLink>(), opened = deferred<void>()
    const open = vi.fn<RedisOpener>().mockResolvedValueOnce(old.transport).mockImplementationOnce(() => { opened.resolve(); return opening.promise })
    const connections = new RedisConnections(open)
    try {
      await connections.connect('session', oldSettings, signal())
      const pending = connections.connectProfileCandidate('session', saved, 'synthetic-password', signal(), profiles)
      Reflect.set(saved.settings, 'host', 'changed-by-caller.fixture')
      await opened.promise
      expect(open.mock.calls[1]?.[0].host).toBe('new.fixture')
      opening.resolve(candidate.transport)
      const result = await pending
      expect(result).toMatchObject({ state: 'connected', previousRelease: 'closed', view: { target: { host: 'new.fixture' } } })
      expect(JSON.stringify(result)).not.toContain('synthetic-password')
      await other.save({ ...profile, id: saved.id, name: 'Changed after commit' }, signal())
      expect(connections.status('session').target?.host).toBe('new.fixture')
      expect(old.close).toHaveBeenCalledTimes(1)
    } finally { connections.dispose() }
  })

  it('does not commit if cancellation occurs while the profile check is queued', async () => {
    const profiles = new RedisProfiles(directory), other = new RedisProfiles(directory)
    const saved = (await profiles.save(profile, signal())).profiles[0]!
    const old = link(), candidate = link(), opening = deferred<RedisLink>(), opened = deferred<void>(), entered = deferred<void>(), controller = new AbortController()
    const connections = new RedisConnections(vi.fn<RedisOpener>().mockResolvedValueOnce(old.transport).mockImplementationOnce(() => { opened.resolve(); return opening.promise }))
    const verify = profiles.withVerifiedProfile.bind(profiles)
    let checks = 0
    vi.spyOn(profiles, 'withVerifiedProfile').mockImplementation((expected, requestSignal, commit) => { if (++checks === 2) entered.resolve(); return verify(expected, requestSignal, commit) })
    try {
      const before = await connections.connect('session', oldSettings, signal())
      const pending = connections.connectProfileCandidate('session', saved, '', controller.signal, profiles)
      await opened.promise
      const update = other.save({ ...profile, id: saved.id, name: 'Queued edit' }, signal())
      opening.resolve(candidate.transport)
      await entered.promise
      controller.abort()
      expect(await pending).toEqual({ state: 'failed', error: 'cancelled' })
      await update
      expect(connections.status('session')).toEqual(before)
      expect(old.close).not.toHaveBeenCalled()
      expect(candidate.close).toHaveBeenCalledTimes(1)
    } finally { connections.dispose() }
  })

  it('does not open the old endpoint if the listed profile already changed', async () => {
    const profiles = new RedisProfiles(directory)
    const saved = (await profiles.save(profile, signal())).profiles[0]!
    await profiles.save({ ...profile, id: saved.id, settings: { ...profile.settings, host: 'updated.fixture' } }, signal())
    const old = link(), open = vi.fn<RedisOpener>().mockResolvedValueOnce(old.transport)
    const connections = new RedisConnections(open)
    try {
      const before = await connections.connect('session', oldSettings, signal())
      expect(await connections.connectProfileCandidate('session', saved, 'synthetic-password', signal(), profiles)).toEqual({ state: 'failed', error: 'stale' })
      expect(open).toHaveBeenCalledTimes(1)
      expect(connections.status('session')).toEqual(before)
      expect(old.close).not.toHaveBeenCalled()
    } finally { connections.dispose() }
  })

  it('does not overwrite a later manual connection while profile preflight is pending', async () => {
    const profiles = new RedisProfiles(directory)
    const saved = (await profiles.save(profile, signal())).profiles[0]!
    const preflight = deferred<boolean>(), entered = deferred<void>()
    vi.spyOn(profiles, 'withVerifiedProfile').mockImplementationOnce(() => { entered.resolve(); return preflight.promise })
    const old = link(), manual = link(), open = vi.fn<RedisOpener>().mockResolvedValueOnce(old.transport).mockResolvedValueOnce(manual.transport)
    const connections = new RedisConnections(open)
    try {
      await connections.connect('session', oldSettings, signal())
      const pending = connections.connectProfileCandidate('session', saved, '', signal(), profiles)
      await entered.promise
      const current = await connections.connect('session', { ...oldSettings, host: 'manual.fixture' }, signal())
      expect(await pending).toEqual({ state: 'failed', error: 'stale' })
      preflight.resolve(true)
      await Promise.resolve()
      expect(connections.status('session')).toEqual(current)
      expect(open).toHaveBeenCalledTimes(2)
      expect(manual.close).not.toHaveBeenCalled()
    } finally { connections.dispose() }
  })
})
