import { existsSync } from 'node:fs'
import { Context } from '@deepseek-ai/cordis'
import type { Agent } from '@deepseek-ai/dsh-agent'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime from '@deepseek-ai/dsh-tools'
import { build } from 'esbuild'
import { chromium } from 'playwright-core'
import { expect, it, vi } from 'vitest'
import type { UiAction, UiChannelInput, UiChannelMessage } from '../src/domain.ts'
import { RedisAiReader } from '../src/host/ai-reader.ts'
import { registerRedisLocateTool } from '../src/host/ai-locate-tool.ts'
import { RedisConnections, type RedisLink } from '../src/host/connection-service.ts'
import { openUiActionChannel } from '../src/host/ui-action-channel.ts'
import { UiActionCoordinator } from '../src/host/ui-action-coordinator.ts'

const browserPath = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome',
].find(path => existsSync(path))

it.skipIf(browserPath === undefined).each(['field', 'focus', 'folder', 'locate', 'metadata', 'view', 'filter', 'wheel', 'drag', 'native_drag'] as const)('handles a delayed TYPE lookup after user %s interaction', async interaction => {
  if (browserPath === undefined) throw new Error('Missing browser')
  let release!: (value: string) => void, started!: () => void
  const gate = new Promise<string>(resolve => { release = resolve }), reading = new Promise<void>(resolve => { started = resolve })
  const commands: string[] = []
  const link: RedisLink = { close: () => undefined, onFailure: () => () => undefined, async execute(command) { commands.push(command); if (command !== 'TYPE') throw new Error('Unexpected command'); started(); return gate } }
  const actions = new UiActionCoordinator<UiAction>(), connections = new RedisConnections(async () => link)
  const reader = new RedisAiReader(connections, session => actions.invalidateSession(session), async () => 0, () => true)
  const ctx = new Context(), abort = new AbortController(), frames: UiChannelMessage[] = [], input: UiChannelInput[] = []
  let wake: (() => void) | undefined, ended = false
  const notify = () => { const fn = wake; wake = undefined; fn?.() }
  const uplink: AsyncIterable<UiChannelInput> = { async *[Symbol.asyncIterator]() { while (!ended) { const value = input.shift(); if (value !== undefined) { yield value; continue } await new Promise<void>(resolve => { wake = resolve; if (ended || input.length > 0) notify() }) } } }
  vi.spyOn(console, 'info').mockImplementation(() => undefined)
  await ctx.plugin(SystemPrompt); await ctx.plugin(ToolRuntime)
  await ctx.plugin({ name: 'redis-locate-browser-test', inject: ['tools'], apply: (scope: Context) => registerRedisLocateTool(scope, reader, actions) })
  const connection = await connections.connect('a', { host: '127.0.0.1', port: 6379, username: '', password: '', tls: null }, abort.signal)
  if (connection.id === null) throw new Error('Missing connection')
  const target = { id: connection.id, generation: connection.generation, db: 0 }
  const source = `
    import React from 'react'
    import { createRoot } from 'react-dom/client'
    import { SelectionEpoch } from './src/client/selection-epoch.ts'
    import { SelectionEpochContext } from './src/client/SelectionEpochContext.ts'
    import { KeyBrowser } from './src/client/KeyBrowser.tsx'
    import { PreviewFormats } from './src/client/PreviewFormats.tsx'
    import { RefreshVisibility } from './src/client/AutoRefresh.tsx'
    import { UiPanePresence } from './src/client/ui-pane-presence.ts'
    import { installRedisStyles } from './src/client/styles.ts'
    import { consumeUiActions } from './src/client/ui-actions.ts'
    const epoch = new SelectionEpoch(), queue = [], abort = new AbortController(), tab = new AbortController(), panes = new UiPanePresence()
    const tracked = new Map(['pointerup', 'pointercancel', 'lostpointercapture', 'blur'].map(name => [name, new Set()]))
    const addWindow = window.addEventListener.bind(window), removeWindow = window.removeEventListener.bind(window)
    window.addEventListener = (name, listener, options) => { if (!String(listener).includes('this._hitTargetInterceptor')) tracked.get(name)?.add(listener); addWindow(name, listener, options) }
    window.removeEventListener = (name, listener, options) => { tracked.get(name)?.delete(listener); removeWindow(name, listener, options) }
    let wake, ended = false, sending = Promise.resolve()
    const notify = () => { const fn = wake; wake = undefined; fn?.() }
    const stream = { send: frame => { sending = sending.then(() => window.toHost(frame)) }, end: () => {}, dispose: () => { ended = true; notify() }, async *[Symbol.asyncIterator]() { while (!ended) { const value = queue.shift(); if (value) { yield value; continue } await new Promise(resolve => { wake = resolve; if (ended || queue.length) notify() }) } } }
    const extraKeys = window.fixtureMany ? Array.from({ length: 200 }, (_, index) => { const text = 'synthetic-' + String(index).padStart(3, '0'); return { base64: btoa(text), byteLength: text.length, label: JSON.stringify(text) } }) : []
    const props = {
      t: key => key,
      connection: { ...window.fixtureTarget, state: 'connected', error: null, target: { host: 'fixture', port: 6379, username: '', tls: false } },
      configure: () => {}, acceptConnection: () => {}, registerKeyHandler: handler => panes.registerKeyHandler('a', handler), registerRefreshHandler: handler => panes.registerRefreshHandler('a', handler), registerHashHandler: handler => panes.registerHashHandler('a', handler), readActionPoint: async () => ({ ok: false }),
      setSelection: (request, signal) => epoch.publish(request, epoch.snapshot().revision, signal),
      readDatabases: async () => ({ ok: false }),
      scanKeys: async () => ({ ok: true, value: { state: 'page', error: null, keys: [{ base64: 'aGFzaA==', byteLength: 4, label: '"hash"' }, { base64: 'Zm9sZGVyOm9uZQ==', byteLength: 10, label: '"folder:one"' }, { base64: 'Zm9sZGVyOnR3bw==', byteLength: 10, label: '"folder:two"' }, ...extraKeys], cursor: null, sampledAt: '1970-01-01T00:00:00.000Z' } }),
      readString: async () => ({ ok: true, value: { state: 'unsupported', error: null, metadata: { type: 'hash', ttlMs: '-1', length: null }, offset: '0', base64: '', byteLength: 0, prefix: '', suffix: '', complete: false, nextOffset: null, sampledAt: '1970-01-01T00:00:00.000Z' } }),
      scanHash: async () => ({ ok: true, value: { state: 'page', error: null, metadata: { type: 'hash', ttlMs: '-1', length: '1' }, entries: [{ field: { base64: 'ZmllbGQ=', byteLength: 5, label: '"field"' }, value: { base64: 'dmFsdWU=', byteLength: 5, fullByteLength: 5, suffix: '' } }], cursor: null, sampledAt: '1970-01-01T00:00:00.000Z' } }),
    }
    const root = createRoot(document.getElementById('root'))
    window.fixture = { epoch, push: frame => { queue.push(frame); notify() }, abort, root, tracked }
    installRedisStyles(); panes.attach('a')
    root.render(<section className="dsh-redis" style={{ height: 600 }}><div className="redis-connection"><SelectionEpochContext.Provider value={epoch}><RefreshVisibility.Provider value={{ visible: true, signal: tab.signal }}><PreviewFormats><KeyBrowser {...props} /></PreviewFormats></RefreshVisibility.Provider></SelectionEpochContext.Provider></div></section>)
    void consumeUiActions(async () => stream, abort.signal, (request, signal) => request.action.kind === 'selectKey' ? panes.selectKey('a', request, signal) : Promise.resolve('applied'), epoch)
  `
  const built = await build({ stdin: { contents: source, resolveDir: process.cwd(), loader: 'jsx', sourcefile: 'locate-inflight-harness.jsx' }, bundle: true, platform: 'browser', format: 'iife', jsx: 'automatic', write: false })
  const browser = await chromium.launch({ executablePath: browserPath, headless: true, ...(interaction === 'native_drag' ? { ignoreDefaultArgs: ['--hide-scrollbars'] } : {}) }), page = await browser.newPage()
  const stream = openUiActionChannel(actions, 'a', abort.signal, uplink, (request, source) => source === 'action' ? reader.commitSelection('a', request) : reader.setSelection('a', request))
  const pump = (async () => { for await (const frame of stream) { frames.push(frame); await page.evaluate(value => Reflect.get(window, 'fixture').push(value), frame) } })()
  try {
    await page.exposeFunction('toHost', (frame: UiChannelInput) => { input.push(frame); notify() })
    await page.route('http://127.0.0.1:1/**', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><body><div id="root"></div></body></html>' }))
    await page.goto('http://127.0.0.1:1/fixture')
    await page.evaluate(value => { Reflect.set(window, 'fixtureTarget', value.target); Reflect.set(window, 'fixtureMany', value.many) }, { target, many: interaction === 'native_drag' })
    await page.addScriptTag({ content: built.outputFiles[0]!.text })
    await page.waitForFunction(() => Array.from(Reflect.get(window, 'fixture').tracked.values(), (set: Set<unknown>) => set.size).every(size => size > 0), undefined, { timeout: 5000 })
    await page.evaluate(() => { const fixture = Reflect.get(window, 'fixture'); fixture.mountListeners = new Map(Array.from(fixture.tracked, ([name, listeners]: [string, Set<unknown>]) => [name, new Set(listeners)])) })
    await page.locator('[data-key-base64="aGFzaA=="]').click({ timeout: 5000 })
    await page.locator('[data-row-identity="ZmllbGQ="]').click()
    if (interaction === 'folder') await page.locator('[data-namespace-id]').click()
    await vi.waitFor(() => {
      expect(reader.status('a')).toMatchObject({ currentSelection: { selection: { keyBase64: 'aGFzaA==', item: { kind: 'hash', fieldBase64: 'ZmllbGQ=' } } } })
      expect(actions.selectionRevision('a')).not.toBeNull()
    }, { timeout: 5000 })
    const oldRevision = actions.selectionRevision('a')
    const agent = { id: 'a', ctx, session: { id: 'a' } } as unknown as Agent
    if (interaction === 'native_drag') {
      await page.addStyleTag({ content: '.redis-key-list::-webkit-scrollbar{width:16px}.redis-key-list::-webkit-scrollbar-thumb{background:black}' })
      const list = page.locator('.redis-key-list'), box = await list.boundingBox()
      if (box === null) throw new Error('Missing Key list bounds')
      expect(await list.evaluate(element => element.scrollHeight > element.clientHeight)).toBe(true)
      await page.mouse.move(box.x + box.width - 8, box.y + 10); await page.mouse.down()
      await vi.waitFor(() => expect(actions.selectionRevision('a')).toBeNull(), { timeout: 5000 })
      await page.waitForTimeout(250)
      await page.mouse.move(box.x + box.width - 8, box.y + box.height * 0.65, { steps: 6 })
      expect(await list.evaluate(element => element.scrollTop)).toBeGreaterThan(0)
      const blocked = await ctx.tools.execute({ callId: 'locate-native-drag' as Parameters<typeof ctx.tools.execute>[0]['callId'], name: 'redis_viewer_locate_key', arguments: { key: 'candidate' }, agent, signal: abort.signal })
      expect(blocked.content.filter(item => item.type === 'text').map(item => item.text).join('')).toContain('"outcome":"stale"')
      expect(commands).toEqual([])
      await page.mouse.up()
      await vi.waitFor(() => expect(actions.selectionRevision('a')).not.toBeNull(), { timeout: 5000 })
      expect(frames.some(frame => frame.kind === 'action' && frame.request.action.kind === 'selectKey')).toBe(false)
      return
    }
    if (interaction === 'drag') {
      const begin = async () => {
        await page.locator('.redis-key-list').dispatchEvent('pointerdown', { pointerId: 17, button: 0, buttons: 1 })
        await vi.waitFor(() => expect(actions.selectionRevision('a')).toBeNull(), { timeout: 5000 })
      }
      const finish = async (event: 'pointerup' | 'pointercancel' | 'lostpointercapture' | 'blur') => {
        await page.evaluate(kind => { window.dispatchEvent(kind === 'blur' ? new Event('blur') : new PointerEvent(kind, { pointerId: 17 })) }, event)
        await vi.waitFor(() => expect(actions.selectionRevision('a')).not.toBeNull(), { timeout: 5000 })
      }
      await begin(); await page.waitForTimeout(250)
      const blocked = await ctx.tools.execute({ callId: 'locate-drag' as Parameters<typeof ctx.tools.execute>[0]['callId'], name: 'redis_viewer_locate_key', arguments: { key: 'candidate' }, agent, signal: abort.signal })
      expect(blocked.content.filter(item => item.type === 'text').map(item => item.text).join('')).toContain('"outcome":"stale"')
      expect(commands).toEqual([])
      await finish('pointerup')
      for (const event of ['pointercancel', 'lostpointercapture', 'blur'] as const) { await begin(); await finish(event) }
      await begin()
      await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' }); document.dispatchEvent(new Event('visibilitychange')) })
      await page.evaluate(() => { const epoch = Reflect.get(window, 'fixture').epoch; epoch.synchronize(epoch.snapshot().revision) })
      expect(await page.evaluate(() => Reflect.get(window, 'fixture').epoch.snapshot().synchronized)).toBe(true)
      await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' }); document.dispatchEvent(new Event('visibilitychange')); Reflect.get(window, 'fixture').epoch.invalidate() })
      await vi.waitFor(() => expect(actions.selectionRevision('a')).not.toBeNull(), { timeout: 5000 })
      await begin()
      await page.evaluate(() => { const fixture = Reflect.get(window, 'fixture'); fixture.root.unmount(); fixture.epoch.synchronize(fixture.epoch.snapshot().revision) })
      expect(await page.evaluate(() => Reflect.get(window, 'fixture').epoch.snapshot().synchronized)).toBe(true)
      expect(await page.evaluate(() => {
        const fixture = Reflect.get(window, 'fixture')
        return Array.from(fixture.mountListeners, ([name, listeners]: [string, Set<unknown>]) => [...listeners].filter(listener => fixture.tracked.get(name)?.has(listener)).length)
      })).toEqual([0, 0, 0, 0])
      return
    }
    if (interaction === 'wheel') {
      await page.locator('.redis-key-list').hover()
      await page.mouse.wheel(0, 60)
      await vi.waitFor(() => expect(actions.selectionRevision('a')).toBeNull(), { timeout: 5000 })
      await page.waitForTimeout(80)
      await page.mouse.wheel(0, 60)
      const blocked = await ctx.tools.execute({ callId: 'locate-wheel' as Parameters<typeof ctx.tools.execute>[0]['callId'], name: 'redis_viewer_locate_key', arguments: { key: 'candidate' }, agent, signal: abort.signal })
      expect(blocked.content.filter(item => item.type === 'text').map(item => item.text).join('')).toContain('"outcome":"stale"')
      expect(commands).toEqual([])
      await vi.waitFor(() => expect(actions.selectionRevision('a')).not.toBeNull(), { timeout: 5000 })
      return
    }
    const result = ctx.tools.execute({ callId: 'locate-inflight' as Parameters<typeof ctx.tools.execute>[0]['callId'], name: 'redis_viewer_locate_key', arguments: { key: 'candidate' }, agent, signal: abort.signal })
    await reading
    if (interaction === 'field') await page.locator('[data-row-identity="ZmllbGQ="]').click()
    if (interaction === 'focus') await page.getByRole('button', { name: 'content.focus' }).click()
    if (interaction === 'folder') await page.locator('[data-namespace-id]').click()
    if (interaction === 'locate') await page.getByRole('button', { name: 'namespace.locate' }).click()
    if (interaction === 'metadata') await page.getByRole('tab', { name: 'ui.metadata' }).click()
    if (interaction === 'view') await page.getByRole('button', { name: 'namespace.list' }).click()
    if (interaction === 'filter') {
      await page.getByRole('button', { name: 'workbench.filter' }).click()
      expect(actions.selectionRevision('a')).toBe(oldRevision)
      release('hash')
      const output = (await result).content.filter(item => item.type === 'text').map(item => item.text).join('')
      expect(output).toContain('"outcome":"applied"')
      expect(frames.some(frame => frame.kind === 'action' && frame.request.action.kind === 'selectKey')).toBe(true)
      return
    }
    await vi.waitFor(() => { const current = actions.selectionRevision('a'); expect(current).not.toBeNull(); expect(current).not.toBe(oldRevision) }, { timeout: 5000 })
    release('hash')
    const output = (await result).content.filter(item => item.type === 'text').map(item => item.text).join('')
    expect(output).toContain('"error":"stale"')
    expect(frames.some(frame => frame.kind === 'action' && frame.request.action.kind === 'selectKey')).toBe(false)
    if (interaction === 'focus') expect(await page.locator('.redis-keys').getAttribute('data-focused')).toBe('true')
    if (interaction === 'folder') expect(await page.locator('[data-namespace-id]').getAttribute('aria-expanded')).toBe('false')
    if (interaction === 'metadata') expect(await page.getByRole('tab', { name: 'ui.metadata' }).getAttribute('aria-selected')).toBe('true')
    if (interaction === 'view') expect(await page.getByRole('button', { name: 'namespace.list' }).getAttribute('aria-pressed')).toBe('true')
    expect(reader.status('a')).toMatchObject({ currentSelection: { selection: { keyBase64: 'aGFzaA==', item: { kind: 'hash', fieldBase64: 'ZmllbGQ=' } } } })
    expect(commands).toEqual(['TYPE'])
  } finally {
    release('hash'); abort.abort(); ended = true; notify(); await pump
    await browser.close(); reader.dispose(); actions.dispose(); connections.dispose(); await ctx.fiber.dispose(); vi.restoreAllMocks()
  }
}, 30000)
