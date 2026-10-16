import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import { expect, it, vi } from 'vitest'
import type { Context } from '@deepseek-ai/cordis'
import type { RedisWorkspaceInjected } from '../src/client/RedisWorkspace.tsx'
import { emptyBrowsingState } from '../src/host/browsing-state.ts'
import { DSH_VERSION, PROTOCOL_VERSION } from '../src/domain.ts'

interface BundleRegistration { id: string; factory: (require: (name: string) => unknown) => { apply: (ctx: Context) => void } }
interface SlotEntry { key: string; inject: (sessionId: string) => RedisWorkspaceInjected }
const require = createRequire(import.meta.url)

it('loads the real browser bundle, retries a failed mount and removes all contributions on reload', async () => {
  const contributions = new Set<string>()
  const cleanups: (() => Promise<void>)[] = []
  let slot: SlotEntry | undefined
  let registration: BundleRegistration | undefined
  const importNames: string[] = []
  const unmount = vi.fn(async () => undefined)
  const status = vi.fn(async (_sessionId: string, _request: unknown, _signal: AbortSignal) => ({ ok: true as const, value: { state: 'ready' as const, readOnly: true as const, hostVersion: DSH_VERSION, protocolVersion: PROTOCOL_VERSION } }))
  const loadBrowsingState = vi.fn(async (_sessionId: string) => ({ ok: true as const, value: emptyBrowsingState() }))
  const saveBrowsingState = vi.fn(async (_sessionId: string, value: ReturnType<typeof emptyBrowsingState>) => ({ ok: true as const, value }))
  const mount = vi.fn().mockRejectedValueOnce(new Error('Host not ready')).mockResolvedValue(unmount)
  function register(id: string): () => void {
    if (contributions.has(id)) throw new Error('Duplicate contribution: ' + id)
    contributions.add(id)
    return () => { contributions.delete(id) }
  }
  const style = { dataset: {}, textContent: '', remove: () => { contributions.delete('style') } }
  const document = { createElement: () => style, head: { append: () => { register('style') } } }
  runInNewContext(readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8'), {
    window: { __ModuleLoader__: { load: (value: BundleRegistration) => { registration = value } } }, document,
    console: { info: vi.fn() },
  })
  if (registration === undefined) throw new Error('Bundle did not register')
  expect(registration.id).toBe('dsh-redis')
  const client = registration.factory(name => {
    importNames.push(name)
    // Only these modules are guaranteed by the selected DSH browser runtime.
    if (name !== 'react' && name !== 'react/jsx-runtime') throw new Error('Undeclared browser dependency: ' + name)
    return require(name)
  })
  const context = {
    effect: (execute: () => unknown) => {
      const result = execute()
      const settled = Promise.resolve(result).catch(() => undefined)
      cleanups.push(async () => { const dispose: unknown = await settled; if (typeof dispose === 'function') await dispose() })
    },
    locale: { register: () => register('locale'), bind: () => (key: string) => key },
    sidebarRightTabs: { register: (tab: { id: string }) => register(tab.id) },
    slots: {
      inject: (_name: string, enter: () => unknown) => enter(),
      register: (entry: SlotEntry) => { slot = entry; return register('slot:' + entry.key) },
    },
    remote: { $mount: mount },
    get: () => ({ status, loadBrowsingState, saveBrowsingState }),
  } as unknown as Context
  client.apply(context)
  if (slot === undefined) throw new Error('Missing sidebar body')
  const api = slot.inject('trusted-session')
  await expect(api.status(new AbortController().signal)).rejects.toThrow('Host not ready')
  await expect(api.status(new AbortController().signal)).resolves.toMatchObject({ ok: true, value: { readOnly: true } })
  expect(mount).toHaveBeenCalledTimes(2)
  expect(status.mock.calls[0]?.[0]).toBe('trusted-session')
  const other = slot.inject('another-session')
  expect(api.sessionKey).toBe('trusted-session'); expect(other.sessionKey).toBe('another-session')
  await api.saveBrowsingState({ ...emptyBrowsingState(), db: 2 }, new AbortController().signal)
  await other.loadBrowsingState(new AbortController().signal)
  expect(saveBrowsingState.mock.calls[0]?.[0]).toBe('trusted-session')
  expect(loadBrowsingState.mock.calls[0]?.[0]).toBe('another-session')
  expect(importNames.every(name => !name.startsWith('node:'))).toBe(true)
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup()
  expect(unmount).toHaveBeenCalledTimes(1)
  expect(contributions.size).toBe(0)
  // The same native identities can register again after unloading.
  client.apply(context)
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup()
  expect(contributions.size).toBe(0)
})
