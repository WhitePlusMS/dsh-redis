import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import { expect, it, vi } from 'vitest'
import type { Context } from '@deepseek-ai/cordis'
import type { ConversationNodeDefinition, ConversationNodeContext } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { ReactNode } from 'react'
import type { TypertRemoteContribution } from '@deepseek-ai/dsh-typert-protocol'
import type { RedisWorkspaceInjected } from '../src/client/RedisWorkspace.tsx'
import { DSH_BASELINE, PROTOCOL_VERSION } from '../src/domain.ts'

interface BundleRegistration { id: string; factory: (require: (name: string) => unknown) => { apply: (ctx: Context) => void } }
interface SlotEntry { name: string; key?: string; id?: string; inject: (sessionId: string) => RedisWorkspaceInjected }
const require = createRequire(import.meta.url)

it('loads the real browser bundle, retries a failed mount and removes all contributions on reload', async () => {
  const contributions = new Set<string>()
  const cleanups: (() => Promise<void>)[] = []
  let slot: SlotEntry | undefined
  let answerDefinition: ConversationNodeDefinition | undefined
  let turnAnswer: ((props: Record<string, unknown>) => ReactNode) | undefined
  const toolViews = new Map<string, (props: Record<string, unknown>) => ReactNode>()
  let registration: BundleRegistration | undefined
  const importNames: string[] = []
  const unmount = vi.fn(async () => undefined)
  const status = vi.fn(async (_sessionId: string, _request: unknown, _signal: AbortSignal) => ({ ok: true as const, value: { state: 'ready' as const, readOnly: true as const, dshBaseline: DSH_BASELINE, protocolVersion: PROTOCOL_VERSION } }))
  const aiBudgetStatus = vi.fn(async (_sessionId: string, _request: unknown, _signal: AbortSignal) => ({ ok: true as const, value: { callsUsed: 0, maxCalls: 32, bytesUsed: 0, maxBytes: 1048576, inFlight: 0, stopped: false } }))
  const resumeAiBudget = vi.fn(async (_sessionId: string, _request: unknown, _signal: AbortSignal) => ({ ok: true as const, value: { accepted: true, status: { callsUsed: 0, maxCalls: 32, bytesUsed: 0, maxBytes: 1048576, inFlight: 0, stopped: false } } }))
  const stream = { send: vi.fn(), end: vi.fn(), dispose: vi.fn(), async *[Symbol.asyncIterator]() {} }
  const openUiChannel = vi.fn(() => stream)
  const mount = vi.fn(async (_contribution: TypertRemoteContribution) => unmount).mockRejectedValueOnce(new Error('Host not ready'))
  function register(id: string): () => void {
    if (contributions.has(id)) throw new Error('Duplicate contribution: ' + id)
    contributions.add(id)
    return () => { contributions.delete(id) }
  }
  const style = { dataset: {}, textContent: '', remove: () => { contributions.delete('style') } }
  const document = Object.assign(new EventTarget(), { visibilityState: 'visible', createElement: () => style, head: { append: () => { register('style') } } })
  const addListener = vi.spyOn(document, 'addEventListener'), removeListener = vi.spyOn(document, 'removeEventListener')
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
    locale: { register: (namespace: string) => register('locale:' + namespace), bind: () => (key: string) => key },
    sidebarRightTabs: { register: (tab: { id: string }) => register(tab.id) },
    sidebarRight: { mounted: { getSnapshot: () => undefined, subscribe: () => () => undefined } },
    uiConversation: { events: { register: (definition: ConversationNodeDefinition) => { answerDefinition = definition; return register('event:' + definition.kind) } } },
    slots: {
      inject: (_name: string, enter: () => unknown) => enter(),
      register: (entry: SlotEntry, view: (props: Record<string, unknown>) => ReactNode) => {
        if (entry.name === 'sidebar.right.pane.tab') slot = entry
        if (entry.name === 'tool.call.toolview' && entry.key !== undefined) toolViews.set(entry.key, view)
        if (entry.name === 'conversation.chat.turnTail') turnAnswer = view
        return register('slot:' + (entry.key ?? entry.id))
      },
    },
    remote: { $mount: mount },
    get: (key: string) => key === 'connection' ? { generation: { getSnapshot: () => undefined, subscribe: () => () => undefined } } : ({ status, aiBudgetStatus, resumeAiBudget, openUiChannel }),
  } as unknown as Context
  client.apply(context)
  expect(contributions.has('slot:redis_viewer_key_metadata')).toBe(true)
  expect(contributions.has('slot:redis_viewer_filter_hash')).toBe(true)
  // Render the registered production bundle, not a second test-only component.
  const valueView = toolViews.get('redis_viewer_value')
  if (valueView === undefined) throw new Error('Missing value evidence view')
  const { renderToStaticMarkup } = require('react-dom/server') as { renderToStaticMarkup: (node: ReactNode) => string }
  const html = renderToStaticMarkup(valueView({ phase: 'result', toolName: 'redis_viewer_value', callId: 'fixture-call', t: (key: string) => key,
    block: { content: [{ type: 'text', text: JSON.stringify({ readOnly: true, connection: { id: 'fixture-id', db: 1 }, value: { text: '<script>bad()</script>', complete: false } }) }] },
  }))
  const visible = html.split('<details>')[0] ?? ''
  expect(visible).toContain('&lt;script&gt;bad()&lt;/script&gt;')
  expect(visible).toContain('value.complete')
  expect(visible).not.toContain('connection.id')
  expect(html).toContain('<details><summary>details</summary>')
  expect(html).not.toContain('<script>')
  expect(html).toContain('data-call-id="fixture-call"')
  const answerView = toolViews.get('redis_viewer_answer')
  if (answerView === undefined) throw new Error('Missing final answer view')
  const answerHtml = renderToStaticMarkup(answerView({ phase: 'result', toolName: 'redis_viewer_answer', callId: 'answer-call', t: (key: string) => key,
    block: { content: [{ type: 'text', text: JSON.stringify({ readOnly: true, state: 'answered', answers: [{ callId: 'read-call', tool: 'redis_viewer_value', paragraphs: ['采样时没有设置过期时间。'], values: [{ label: '值', text: '<script>bad()</script>' }] }] }) }] },
  }))
  expect(answerHtml).toContain('采样时没有设置过期时间。')
  expect(answerHtml).toContain('&lt;script&gt;bad()&lt;/script&gt;')
  expect(answerHtml).not.toContain('<script>')
  // The completed-turn extension remains outside the collapsed process. Drive
  // its registered event projection and render the actual production component.
  if (answerDefinition === undefined || turnAnswer === undefined) throw new Error('Missing transcript answer')
  const definition = answerDefinition
  type Match = Parameters<typeof definition.start>[1]
  const call = { event: { type: 'tool/call', data: { turn: 2, name: 'redis_viewer_answer', callId: 'answer-call' } }, role: 'start', location: { kind: 'unresolved' } } as Match
  expect(definition.match(call.event)).toEqual({ id: '2', role: 'start' })
  const answerContext: ConversationNodeContext = { key: 'redis-answer:2', kind: 'redis-answer', id: '2', matches: [call], start: call, current: new Map(), state: undefined }
  const initial = definition.start(answerContext, call, { previous: () => undefined })
  const result = { ...call, role: 'update', event: { type: 'tool/result', data: { turn: 2, message: { toolCallId: 'answer-call', content: [{ type: 'text', text: JSON.stringify({ readOnly: true, state: 'answered', answers: [{ callId: 'read-call', tool: 'redis_viewer_value', paragraphs: ['本轮答案'], values: [{ label: '值', text: '<script>bad()</script>' }] }] }) }] } } } } as Parameters<typeof definition.update>[1]
  const answered = definition.update({ ...answerContext, state: initial }, result)
  const data = definition.buildLocationData?.({ ...answerContext, state: answered }, 'turn', null)
  expect(data).toMatchObject({ kind: 'turn', turn: 2, key: 'redis-answer' })
  const tailHtml = renderToStaticMarkup(require('react').createElement(turnAnswer, { turn: { turn: 2, data: { source: () => ({ subscribe: () => () => undefined, getSnapshot: () => data?.value }) } }, t: (key: string) => key }))
  expect(tailHtml).toContain('data-redis-turn-answer="2"')
  expect(tailHtml).toContain('本轮答案')
  expect(tailHtml).toContain('&lt;script&gt;bad()&lt;/script&gt;')
  expect(tailHtml).not.toContain('<details>')
  const failed = { ...result, event: { ...result.event, data: { ...result.event.data, message: { toolCallId: 'answer-call', isError: true, content: [{ type: 'text', text: 'denied' }] } } } } as typeof result
  expect(definition.buildLocationData?.({ ...answerContext, state: definition.update({ ...answerContext, state: initial }, failed) }, 'turn', null)).toBeNull()
  if (slot === undefined) throw new Error('Missing sidebar body')
  const api = slot.inject('trusted-session')
  await expect(api.status(new AbortController().signal)).rejects.toThrow('Host not ready')
  await expect(api.status(new AbortController().signal)).resolves.toMatchObject({ ok: true, value: { readOnly: true } })
  expect(mount).toHaveBeenCalledTimes(2)
  // Inspect the actual emitted browser contribution, not only TS source schemas.
  // rc.2 invokes decode on successful HTTP replies; create alone is insufficient.
  const descriptors = mount.mock.calls[1]?.[0].descriptors
  expect(descriptors).toHaveLength(20)
  for (const descriptor of descriptors ?? []) {
    const codec = descriptor.result
    if (codec.mode !== 'strict' || codec.decode === undefined) throw new Error('Missing browser decoder: ' + descriptor.method)
    expect(() => codec.decode?.(null), descriptor.method).toThrow()
    expect(() => codec.decode?.({ injected: true }), descriptor.method).toThrow()
  }
  const statusCodec = descriptors?.find(descriptor => descriptor.method === 'status')?.result
  if (statusCodec?.mode !== 'strict' || statusCodec.decode === undefined) throw new Error('Missing status decoder')
  const validStatus = { state: 'ready', readOnly: true, dshBaseline: DSH_BASELINE, protocolVersion: PROTOCOL_VERSION }
  expect(statusCodec.decode(validStatus)).toEqual(validStatus)
  expect(() => statusCodec.decode?.({ ...validStatus, readOnly: false })).toThrow()
  expect(status.mock.calls[0]?.[0]).toBe('trusted-session')
  const other = slot.inject('another-session')
  expect(api.sessionKey).toBe('trusted-session'); expect(other.sessionKey).toBe('another-session')
  await api.aiBudgetStatus(new AbortController().signal)
  await other.resumeAiBudget(new AbortController().signal)
  expect(aiBudgetStatus.mock.calls[0]?.slice(0, 2)).toEqual(['trusted-session', {}])
  expect(resumeAiBudget.mock.calls[0]?.slice(0, 2)).toEqual(['another-session', {}])
  const releasePane = api.registerVisiblePane(); releasePane()
  expect(descriptors?.some(descriptor => descriptor.method === 'setSelection')).toBe(false)
  expect(importNames.every(name => !name.startsWith('node:'))).toBe(true)
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup()
  expect(unmount).toHaveBeenCalledTimes(1)
  expect(addListener).toHaveBeenCalledWith('visibilitychange', expect.any(Function))
  expect(removeListener).toHaveBeenCalledWith('visibilitychange', addListener.mock.calls[0]?.[1])
  expect(contributions.size).toBe(0)
  // The same native identities can register again after unloading.
  client.apply(context)
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup()
  expect(contributions.size).toBe(0)
})
