import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdir, mkdtemp, realpath, rm } from 'node:fs/promises'
import { basename, dirname, join, resolve } from 'node:path'
import { RedisProfiles } from '../src/host/profile-store.ts'
import type { SaveProfileRequest } from '../src/domain.ts'

const runtime = resolve(import.meta.dirname, '../.scratch/runtime')
const signal = () => new AbortController().signal
const input: SaveProfileRequest = { id: null, name: 'Synthetic', settings: { host: '127.0.0.1', port: 6379, username: 'reader', tls: null } }
let directory: string

beforeEach(async () => {
  await mkdir(runtime, { recursive: true })
  directory = await mkdtemp(join(runtime, 'profile-transaction-'))
})
afterEach(async () => {
  const actual = await realpath(directory)
  if (dirname(actual) !== await realpath(runtime) || !basename(actual).startsWith('profile-transaction-')) throw new Error('Refusing cleanup outside the owned test directory')
  await rm(actual, { recursive: true })
})

describe('profile transaction within one process', () => {
  it('serializes independent stores using the same normalized path', async () => {
    const first = new RedisProfiles(directory), second = new RedisProfiles(join(directory, '.'))
    await Promise.all(Array.from({ length: 16 }, (_, index) => (index % 2 ? first : second).save({ ...input, name: `Synthetic ${index}` }, signal())))
    const profiles = (await first.list(signal())).profiles
    expect(profiles).toHaveLength(16)
    expect(new Set(profiles.map(value => value.name)).size).toBe(16)
  })

  it('compares the complete snapshot after earlier writes and commits before later writes', async () => {
    const first = new RedisProfiles(directory), second = new RedisProfiles(directory)
    const created = await first.save(input, signal()), original = created.profiles[0]!
    let committed = 0
    const changed = second.save({ ...input, id: original.id, settings: { ...input.settings, port: 6380 } }, signal())
    const stale = first.withVerifiedProfile(original, signal(), () => { committed++; return undefined })
    await changed
    expect(await stale).toBe(false)
    expect(committed).toBe(0)

    const current = (await first.list(signal())).profiles[0]!
    const order: string[] = []
    const verified = first.withVerifiedProfile(current, signal(), () => { order.push('commit'); return undefined })
    const later = second.save({ ...input, id: current.id, name: 'Later' }, signal()).then(() => { order.push('save') })
    expect(await verified).toBe(true)
    await later
    expect(order).toEqual(['commit', 'save'])
  })

  it('snapshots input immediately and rejects deletion or an aborted queued check', async () => {
    const first = new RedisProfiles(directory), second = new RedisProfiles(directory)
    const original = (await first.save(input, signal())).profiles[0]!
    let committed = 0
    const verified = first.withVerifiedProfile(original, signal(), () => { committed++; return undefined })
    Reflect.set(original.settings, 'host', 'changed-after-queue')
    expect(await verified).toBe(true)
    expect(committed).toBe(1)

    const current = (await first.list(signal())).profiles[0]!
    const deleted = second.remove({ id: current.id }, signal())
    const missing = first.withVerifiedProfile(current, signal(), () => { committed++; return undefined })
    await deleted
    expect(await missing).toBe(false)
    const controller = new AbortController()
    const cancelled = first.withVerifiedProfile(current, controller.signal, () => { committed++; return undefined })
    controller.abort()
    await expect(cancelled).rejects.toThrow()
    expect(committed).toBe(1)
  })
})
