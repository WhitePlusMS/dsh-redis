import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { mkdir, mkdtemp, realpath, rm } from 'node:fs/promises'
import { basename, dirname, join, resolve } from 'node:path'

const runtime = resolve(import.meta.dirname, '../.scratch/runtime')
let directory: string

beforeEach(async () => { await mkdir(runtime, { recursive: true }); directory = await mkdtemp(join(runtime, 'match-preset-cancel-')) })
afterEach(async () => {
  vi.doUnmock('node:fs/promises'); vi.resetModules()
  const actual = await realpath(directory)
  if (dirname(actual) !== await realpath(runtime) || !basename(actual).startsWith('match-preset-cancel-')) throw new Error('Refusing cleanup outside the owned test directory')
  await rm(actual, { recursive: true })
})

it('retains the actual saved result if cancellation arrives immediately after the real link succeeds', async () => {
  const controller = new AbortController(), filesystem = await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises')
  vi.doMock('node:fs/promises', () => ({ ...filesystem, link: async (existing: string, target: string) => { await filesystem.link(existing, target); controller.abort() } }))
  const { RedisMatchPresets } = await import('../src/host/match-preset-store.ts')
  const store = new RedisMatchPresets(directory)
  const saved = await store.save({ name: 'synthetic', pattern: 'fixture:*' }, controller.signal)
  expect(controller.signal.aborted).toBe(true)
  expect(await store.get(saved.id, new AbortController().signal)).toEqual(saved)
})

it.each(['get', 'list'] as const)('observes cancellation while closing a %s read', async mode => {
  const { RedisMatchPresets: ActualStore } = await import('../src/host/match-preset-store.ts')
  const saved = await new ActualStore(directory).save({ name: 'synthetic', pattern: 'fixture:*' }, new AbortController().signal)
  const controller = new AbortController(), filesystem = await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises')
  let release!: () => void, started!: () => void
  const blocked = new Promise<void>(resolve => { release = resolve }), closing = new Promise<void>(resolve => { started = resolve })
  vi.resetModules()
  vi.doMock('node:fs/promises', () => ({ ...filesystem, open: async (path: string, flags: string, permissions?: number) => {
    const file = await filesystem.open(path, flags, permissions)
    if (flags !== 'r') return file
    return new Proxy(file, { get(target, property) {
      if (property === 'close') return async () => { started(); await blocked; await target.close() }
      const value: unknown = Reflect.get(target, property, target)
      return typeof value === 'function' ? value.bind(target) : value
    } })
  } }))
  const { RedisMatchPresets } = await import('../src/host/match-preset-store.ts'), store = new RedisMatchPresets(directory)
  const pending = mode === 'get' ? store.get(saved.id, controller.signal) : store.list(null, controller.signal)
  try {
    await closing; controller.abort(); release()
    await expect(pending).rejects.toMatchObject({ code: 'cancelled' })
  } finally { release() }
})
