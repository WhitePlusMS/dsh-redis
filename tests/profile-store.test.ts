import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { mkdir, mkdtemp, readFile, readdir, realpath, rm, rmdir, writeFile } from 'node:fs/promises'
import { basename, dirname, join, resolve } from 'node:path'
import { RedisProfiles } from '../src/host/profile-store.ts'
import { RedisConnections, type RedisLink } from '../src/host/connection-service.ts'
import { RedisRemoteService } from '../src/remote-service.ts'
import type { Agent } from '@deepseek-ai/dsh-agent'
import { MAX_PROFILES, type SaveProfileRequest } from '../src/domain.ts'
import { renderLogs } from './log-output.ts'

const runtime = resolve(import.meta.dirname, '../.scratch/runtime')
let directory: string
const signal = () => new AbortController().signal
const input: SaveProfileRequest = { id: null, name: 'Local reader', settings: { host: '127.0.0.1', port: 6379, username: 'reader', tls: null } }
const file = () => join(directory, 'data/dsh-redis/connections.json')
beforeEach(async () => {
  await mkdir(runtime, { recursive: true })
  directory = await mkdtemp(join(runtime, 'profiles-test-'))
  vi.spyOn(console, 'info').mockImplementation(() => undefined)
  vi.spyOn(console, 'warn').mockImplementation(() => undefined)
})
afterEach(async () => {
  vi.restoreAllMocks()
  const actual = await realpath(directory)
  if (dirname(actual) !== await realpath(runtime) || !basename(actual).startsWith('profiles-test-')) throw new Error('Refusing recursive cleanup outside the owned test directory')
  await rm(actual, { recursive: true })
})

describe('profile-owned non-secret connection persistence', () => {
  it('reopens plain/TLS settings from the current profile without creating any connection', async () => {
    const store = new RedisProfiles(directory)
    expect(await store.list(signal())).toEqual({ profiles: [], selectedId: null })
    expect(await readdir(directory)).toEqual([])
    const plain = await store.save(input, signal())
    await store.save({ ...input, name: 'TLS reader', settings: { ...input.settings, tls: { caPem: 'public fixture certificate' } } }, signal())
    const reopened = await new RedisProfiles(directory).list(signal())
    expect(reopened.selectedId).toBeNull()
    expect(reopened.profiles).toHaveLength(2)
    expect(reopened.profiles[0]?.id).toBe(plain.selectedId)
    expect(reopened.profiles[1]?.settings.tls?.caPem).toBe('public fixture certificate')
    expect(await readdir(dirname(file()))).toEqual(['connections.json'])
  })
  it('stores an optional environment label with the selected profile without saving credentials', async () => {
    const store = new RedisProfiles(directory)
    const saved = await store.save({ ...input, settings: { ...input.settings, environment: '测试' } }, signal())
    expect(saved.profiles[0]?.settings.environment).toBe('测试')
    const reopened = await new RedisProfiles(directory).list(signal())
    expect(reopened.profiles[0]?.settings.environment).toBe('测试')
    expect(await readFile(file(), 'utf8')).not.toContain('password')
  })
  it('saving another profile does not change the active connection', async () => {
    const transport: RedisLink = { close: vi.fn(), execute: async () => null, onFailure: () => () => undefined }
    const open = vi.fn(async () => transport), connections = new RedisConnections(open), profiles = new RedisProfiles(directory)
    const remote = Object.create(RedisRemoteService.prototype) as RedisRemoteService
    Reflect.set(remote, 'profiles', profiles); Reflect.set(remote, 'connections', connections)
    const agent = { session: { id: 'a' } } as unknown as Agent
    try {
      const active = await connections.connect('a', { ...input.settings, password: 'ro04-synthetic-password' }, signal())
      expect(active.target).not.toHaveProperty('environment')
      await remote.saveProfile(agent, { ...input, name: 'Other', settings: { ...input.settings, host: 'other.example', environment: 'test' } }, signal())
      expect(connections.status('a')).toEqual(active); expect(open).toHaveBeenCalledTimes(1)
    } finally { connections.dispose() }
  })
  it('updates/removes a stable identity and never silently recreates an unknown profile', async () => {
    const store = new RedisProfiles(directory)
    const created = await store.save(input, signal())
    const id = created.selectedId
    if (id === null) throw new Error('Missing saved identity')
    const updated = await store.save({ ...input, id, name: 'Renamed' }, signal())
    expect(updated.profiles).toHaveLength(1)
    expect(updated.profiles[0]).toMatchObject({ id, name: 'Renamed' })
    expect((await store.remove({ id }, signal())).profiles).toHaveLength(0)
    const before = await readFile(file(), 'utf8')
    await expect(store.save({ ...input, id }, signal())).rejects.toThrow('no longer exists')
    await expect(store.remove({ id }, signal())).rejects.toThrow('no longer exists')
    expect(await readFile(file(), 'utf8')).toBe(before)
  })
  it('serializes concurrent panes without lost updates or leftover temporary files', async () => {
    const store = new RedisProfiles(directory)
    await Promise.all(Array.from({ length: 12 }, (_, index) => store.save({ ...input, name: 'Reader ' + index }, signal())))
    const saved = await new RedisProfiles(directory).list(signal())
    expect(saved.profiles).toHaveLength(12)
    expect(new Set(saved.profiles.map(value => value.name)).size).toBe(12)
    expect(await readdir(dirname(file()))).toEqual(['connections.json'])
  })
  it('rejects a password in saved settings before touching storage', () => {
    const invalid = { ...input, settings: { ...input.settings, password: 'never-persist-this' } }
    expect(() => new RedisProfiles(directory).save(invalid, signal())).toThrow()
  })
  it('does not log injected credentials or storage contents during profile operations', async () => {
    const password = 'ro04-fake-profile-password', marker = 'ro04-fake-profile-marker'
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const store = new RedisProfiles(directory)
    const saved = await store.save({ ...input, name: marker, settings: { ...input.settings, username: marker, tls: { caPem: marker } } }, signal())
    if (saved.selectedId === null) throw new Error('Missing profile identity')
    await store.remove({ id: saved.selectedId }, signal())
    const invalid = { ...input, settings: { ...input.settings, password } }
    let rejection: unknown
    try { store.save(invalid, signal()) } catch (caught) { rejection = caught }
    expect(rejection).toBeInstanceOf(Error); expect(String(rejection)).not.toContain(password)
    await writeFile(file(), password + marker, 'utf8')
    await expect(store.list(signal())).rejects.toThrow('could not be read or saved')
    expect(vi.mocked(console.info).mock.calls.length).toBeGreaterThan(0)
    expect(vi.mocked(console.warn).mock.calls.length).toBeGreaterThan(0)
    const captured = renderLogs([...vi.mocked(console.info).mock.calls, ...vi.mocked(console.warn).mock.calls, ...error.mock.calls])
    expect(captured).not.toContain(password); expect(captured).not.toContain(marker)
  })
  it('preserves corrupt, unknown-version and duplicate-id files on read/save failure', async () => {
    await mkdir(dirname(file()), { recursive: true })
    const saved = { id: 'same', name: input.name, settings: input.settings }
    for (const content of ['invalid JSON', JSON.stringify({ version: 2, profiles: [] }), JSON.stringify({ version: 1, profiles: [saved, saved] })]) {
      await writeFile(file(), content, 'utf8')
      const store = new RedisProfiles(directory)
      await expect(store.list(signal())).rejects.toThrow('could not be read or saved')
      await expect(store.save(input, signal())).rejects.toThrow('could not be read or saved')
      expect(await readFile(file(), 'utf8')).toBe(content)
    }
  })
  it('fails safely for an unavailable storage path and an oversized file', async () => {
    await mkdir(file(), { recursive: true })
    await expect(new RedisProfiles(directory).list(signal())).rejects.toThrow('could not be read or saved')
    await rmdir(file())
    await writeFile(file(), Buffer.alloc(4 * 1024 * 1024 + 1))
    await expect(new RedisProfiles(directory).list(signal())).rejects.toThrow('could not be read or saved')
  })
  it('keeps profiles isolated and cancels a queued save before dispatch', async () => {
    const store = new RedisProfiles(directory)
    const first = store.save(input, signal())
    const controller = new AbortController()
    const second = store.save({ ...input, name: 'Cancelled' }, controller.signal)
    const cancelled = expect(second).rejects.toThrow()
    controller.abort()
    await first; await cancelled
    expect((await store.list(signal())).profiles).toHaveLength(1)
    expect((await new RedisProfiles(join(directory, 'other-profile')).list(signal())).profiles).toHaveLength(0)
  })
  it('enforces the profile limit without overwriting the complete existing file', async () => {
    const store = new RedisProfiles(directory)
    await Promise.all(Array.from({ length: MAX_PROFILES }, (_, index) => store.save({ ...input, name: 'Reader ' + index }, signal())))
    const before = await readFile(file(), 'utf8')
    await expect(store.save(input, signal())).rejects.toThrow('limit')
    expect(await readFile(file(), 'utf8')).toBe(before)
  })
})
