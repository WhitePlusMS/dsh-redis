import { existsSync } from 'node:fs'
import { build } from 'esbuild'
import { chromium } from 'playwright-core'
import { expect, it } from 'vitest'
import { Context, symbols } from '@deepseek-ai/cordis'
import type { Agent } from '@deepseek-ai/dsh-agent'
import type { ActionPointReadRequest, UiAction, UiChannelInput, UiChannelMessage } from '../src/domain.ts'
import { RedisConnections, type RedisLink } from '../src/host/connection-service.ts'
import { openUiActionChannel } from '../src/host/ui-action-channel.ts'
import { RedisRemoteService } from '../src/remote-service.ts'

const browserPath = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/chromium'].find(path => existsSync(path))

it.skipIf(browserPath === undefined).each(['hash', 'list'] as const)('commits a %s browser point only after the real Host read', async kind => {
  if (browserPath === undefined) throw new Error('Missing browser')
  const commands: string[] = []
  const link: RedisLink = { close: () => undefined, onFailure: () => () => undefined, async execute(command, _args, signal, guard) {
    signal.throwIfAborted(); guard(); commands.push(command)
    if (command === 'TYPE') return kind
    if (command === 'PTTL') return -1n
    if (command === 'LLEN') return 10n
    if (command === 'LRANGE') return [Buffer.from('v')]
    if (command === 'HGET') return Buffer.from('v')
    throw new Error('Unexpected synthetic command')
  } }
  const connections = new RedisConnections(async () => link), ctx = new Context(), hostAbort = new AbortController()
  ctx.provide('profileContext', { name: 'fixture', dir: '.', patchPath: '', installAnchor: '', cwd: '.', home: '.', startedBundles: [], overlays: [], telemetryDisabledEnv: undefined })
  await ctx.plugin(RedisRemoteService)
  const proxy = ctx.get('redisViewer') as unknown as RedisRemoteService & { [symbols.original]?: RedisRemoteService }, service = proxy[symbols.original] ?? proxy
  Reflect.set(service, 'connections', connections)
  const coordinator = service.uiActions, agent = { session: { id: 'a' } } as unknown as Agent
  const connection = await connections.connect('a', { host: 'fixture', port: 6379, username: '', password: '', tls: null }, hostAbort.signal)
  if (connection.id === null) throw new Error('Missing synthetic connection')
  const target = { id: connection.id, generation: connection.generation, db: 0 }
  const source = `
    import React from 'react'
    import { createRoot } from 'react-dom/client'
    import { HashView } from './src/client/HashView.tsx'
    import { ListView } from './src/client/ListView.tsx'
    import { CurrentSelection } from './src/client/CurrentSelection.tsx'
    import { SelectionEpochContext, useSelectionRevision } from './src/client/SelectionEpochContext.ts'
    import { SelectionEpoch } from './src/client/selection-epoch.ts'
    import { PreviewFormats } from './src/client/PreviewFormats.tsx'
    import { RefreshVisibility, KeyAutoRefresh } from './src/client/AutoRefresh.tsx'
    import { UiPanePresence } from './src/client/ui-pane-presence.ts'
    import { consumeUiActions } from './src/client/ui-actions.ts'
    import { installRedisStyles } from './src/client/styles.ts'
    import { KeyPresentation } from './src/client/KeyPresentation.tsx'
    const kind = ${JSON.stringify(kind)}, target = ${JSON.stringify(target)}, epoch = new SelectionEpoch(), panes = new UiPanePresence(), queue = []
    const abort = new AbortController(), tab = new AbortController()
    let wake, ended = false
    const notify = () => { const next = wake; wake = undefined; next?.() }
    const stream = { send: frame => { void window.hostSend(frame) }, end: () => {}, dispose: () => { ended = true; notify() }, async *[Symbol.asyncIterator]() { while (!ended) { const value = queue.shift(); if (value) { yield value; continue } await new Promise(resolve => { wake = resolve; if (ended || queue.length) notify() }) } } }
    const key = { base64: 'aw==', byteLength: 1, label: 'k' }, old = { base64: 'b2xk', byteLength: 3, label: 'old' }, value = { base64: 'dg==', byteLength: 1, fullByteLength: 1, suffix: '' }
    const props = { target, selected: key, t: key => key, registerHashHandler: handler => panes.registerHashHandler('a', handler), registerListHandler: handler => panes.registerListHandler('a', handler), readActionPoint: async request => ({ ok: true, value: await window.hostPoint(request) }),
      scanHash: async () => ({ ok: true, value: { state: 'page', error: null, metadata: { type: 'hash', ttlMs: '-1', length: '1' }, entries: [{ field: old, value }], cursor: null, sampledAt: '1970-01-01T00:00:00.000Z' } }),
      readList: async request => ({ ok: true, value: { state: 'page', error: null, metadata: { type: 'list', ttlMs: '-1', length: '1' }, entries: [{ index: request.offset, value }], offset: request.offset, nextOffset: null, sampledAt: '1970-01-01T00:00:00.000Z' } }) }
    const publish = (request, signal) => epoch.publish(request, epoch.snapshot().revision, signal)
    function Holder() { const revision = useSelectionRevision(); return <CurrentSelection target={target} keyBase64={key.base64} revision={revision} suspended={false} publish={publish}><KeyPresentation><KeyAutoRefresh><div className="redis-key-view"><div className="redis-inspector" data-view="data">{kind === 'hash' ? <HashView {...props} /> : <ListView {...props} />}</div></div></KeyAutoRefresh></KeyPresentation></CurrentSelection> }
    installRedisStyles(); panes.attach('a')
    createRoot(document.getElementById('root')).render(<section className="dsh-redis" style={{ height: 600 }}><div className="redis-connection"><SelectionEpochContext.Provider value={epoch}><RefreshVisibility.Provider value={{ visible: true, signal: tab.signal }}><PreviewFormats><Holder /></PreviewFormats></RefreshVisibility.Provider></SelectionEpochContext.Provider></div></section>)
    void consumeUiActions(async () => stream, abort.signal, (request, signal) => request.action.kind === 'selectHashField' ? panes.selectHashField('a', request, signal) : request.action.kind === 'selectListIndex' ? panes.selectListIndex('a', request, signal) : Promise.resolve('stale'), epoch)
    window.fixture = { abort, push: frame => { queue.push(frame); notify() } }
  `
  const built = await build({ stdin: { contents: source, resolveDir: process.cwd(), loader: 'jsx', sourcefile: 'hash-list-host-point.jsx' }, bundle: true, platform: 'browser', format: 'iife', jsx: 'automatic', write: false })
  const values: UiChannelInput[] = []
  let wake: (() => void) | undefined, ended = false
  const notify = () => { const next = wake; wake = undefined; next?.() }
  const uplink: AsyncIterable<UiChannelInput> = { async *[Symbol.asyncIterator]() { while (!ended) { const value = values.shift(); if (value !== undefined) { yield value; continue } await new Promise<void>(resolve => { wake = resolve; if (ended || values.length > 0) notify() }) } } }
  const browser = await chromium.launch({ executablePath: browserPath, headless: true })
  let pump: Promise<void> | undefined
  try {
    const page = await browser.newPage()
    await page.exposeFunction('hostSend', (frame: UiChannelInput) => { values.push(frame); notify() })
    await page.exposeFunction('hostPoint', (request: ActionPointReadRequest) => service.readActionPoint(agent, request, hostAbort.signal))
    await page.setContent('<!doctype html><html><body><div id="root"></div></body></html>')
    await page.evaluate(() => { let sequence = 0; Object.defineProperty(crypto, 'randomUUID', { value: () => `12345678-1234-1234-1234-${String(++sequence).padStart(12, '0')}` }) })
    const host = openUiActionChannel(coordinator, 'a', hostAbort.signal, uplink, () => ({ accepted: true }))
    pump = (async () => { for await (const frame of host) await page.evaluate((message: UiChannelMessage) => Reflect.get(window, 'fixture').push(message), frame) })()
    await page.addScriptTag({ content: built.outputFiles[0]!.text })
    await page.locator(kind === 'hash' ? '[data-row-identity="b2xk"]' : '[data-row-identity="0"]').click({ timeout: 5000 })
    await expect.poll(() => coordinator.selectionRevision('a'), { timeout: 5000 }).not.toBeNull()
    const revision = coordinator.selectionRevision('a')
    if (revision === null) throw new Error('Missing selection revision')
    const action: UiAction = kind === 'hash' ? { kind: 'selectHashField', keyBase64: 'aw==', field: { base64: 'bQ==', byteLength: 1, label: 'm' } } : { kind: 'selectListIndex', keyBase64: 'aw==', index: '2' }
    expect(await coordinator.dispatch('a', action, target, revision, () => true, hostAbort.signal)).toBe('applied')
    expect(await page.locator(kind === 'hash' ? '[data-row-identity="bQ=="]' : '[data-row-identity="2"]').getAttribute('aria-selected')).toBe('true')
    expect(commands).toContain(kind === 'hash' ? 'HGET' : 'LRANGE')
    await page.evaluate(() => Reflect.get(window, 'fixture').abort.abort())
  } finally { hostAbort.abort(); ended = true; notify(); await pump; await browser.close(); connections.dispose(); await ctx.fiber.dispose() }
}, 15000)

it.skipIf(browserPath === undefined)('commits only a visible point field, restores rejected selection, and respects a later manual choice', async () => {
  if (browserPath === undefined) throw new Error('Missing browser')
  const source = `
    import React from 'react'
    import { createRoot } from 'react-dom/client'
    import { HashView } from './src/client/HashView.tsx'
    import { CurrentSelection } from './src/client/CurrentSelection.tsx'
    import { SelectionEpochContext, useSelectionRevision } from './src/client/SelectionEpochContext.ts'
    import { SelectionEpoch } from './src/client/selection-epoch.ts'
    import { PreviewFormats } from './src/client/PreviewFormats.tsx'
    import { RefreshVisibility, KeyAutoRefresh, RefreshControls } from './src/client/AutoRefresh.tsx'
    import { UiPanePresence } from './src/client/ui-pane-presence.ts'
    import { consumeUiActions } from './src/client/ui-actions.ts'
    import { installRedisStyles } from './src/client/styles.ts'
    import { KeyPresentation } from './src/client/KeyPresentation.tsx'
    const epoch = new SelectionEpoch(), panes = new UiPanePresence(), frames = [], publications = [], queue = []
    const abort = new AbortController(), tab = new AbortController(), target = { id: 'fixture', generation: 1, db: 0 }
    let wake, ended = false, scans = 0, delayed = false, releaseRead, readStarted = false, hasMore = false
    const notify = () => { const next = wake; wake = undefined; next?.() }
    const stream = { send: frame => frames.push(frame), end: () => {}, dispose: () => { ended = true; notify() }, async *[Symbol.asyncIterator]() { while (!ended) { const value = queue.shift(); if (value) { yield value; continue } await new Promise(resolve => { wake = resolve; if (ended || queue.length) notify() }) } } }
    const key = { base64: 'aGFzaA==', byteLength: 4, label: '"hash"' }
    const identity = text => ({ base64: btoa(text), byteLength: text.length, label: JSON.stringify(text) })
    const value = { base64: 'dg==', byteLength: 1, fullByteLength: 1, suffix: '' }
    const entries = Array.from({ length: 30 }, (_, i) => ({ field: identity(i === 0 ? 'old' : 'f' + i), value }))
    const props = { target, selected: key, t: key => key, registerHashHandler: handler => panes.registerHashHandler('a', handler),
      scanHash: async request => { scans++; return { ok: true, value: { state: 'page', error: null, metadata: { type: 'hash', ttlMs: '-1', length: '100' }, entries, cursor: hasMore || request.cursor === null ? '1' : null, sampledAt: '1970-01-01T00:00:00.000Z' } } },
      readActionPoint: async () => { if (delayed) { readStarted = true; await new Promise(resolve => { releaseRead = resolve }) } return { ok: true, value: { state: 'value', error: null, cell: value, sampledAt: '1970-01-01T00:00:00.000Z' } } } }
    function Holder() { const revision = useSelectionRevision(); return <CurrentSelection target={target} keyBase64={key.base64} revision={revision} suspended={false} publish={async request => { publications.push(request); return { ok: true, value: { accepted: true } } }}><KeyPresentation><KeyAutoRefresh><div className="redis-key-view"><div className="redis-inspector-toolbar"><div className="redis-inspector-tabs" /><RefreshControls t={props.t} /></div><div className="redis-inspector" data-view="data"><HashView {...props} /></div></div></KeyAutoRefresh></KeyPresentation></CurrentSelection> }
    installRedisStyles(); panes.attach('a')
    createRoot(document.getElementById('root')).render(<section className="dsh-redis" style={{ height: 600 }}><div className="redis-connection"><SelectionEpochContext.Provider value={epoch}><RefreshVisibility.Provider value={{ visible: true, signal: tab.signal }}><PreviewFormats><Holder /></PreviewFormats></RefreshVisibility.Provider></SelectionEpochContext.Provider></div></section>)
    void consumeUiActions(async () => stream, abort.signal, (request, signal) => request.action.kind === 'selectHashField' ? panes.selectHashField('a', request, signal) : Promise.resolve('stale'), epoch)
    window.fixture = { epoch, frames, publications, abort, target, identity, scans: () => scans, setHasMore: value => { hasMore = value }, delay: () => { delayed = true; readStarted = false }, reading: () => readStarted, release: () => { delayed = false; releaseRead?.() }, push: frame => { queue.push(frame); notify() }, action: (id, field) => { queue.push({ kind: 'action', request: { requestId: id, target, selectionRevision: epoch.snapshot().revision, expiresAt: Date.now() + 10000, action: { kind: 'selectHashField', keyBase64: key.base64, field: identity(field) } } }); notify() } }
  `
  const built = await build({ stdin: { contents: source, resolveDir: process.cwd(), loader: 'jsx', sourcefile: 'hash-locate-harness.jsx' }, bundle: true, platform: 'browser', format: 'iife', jsx: 'automatic', write: false })
  const browser = await chromium.launch({ executablePath: browserPath, headless: true, ignoreDefaultArgs: ['--hide-scrollbars'] })
  try {
    const page = await browser.newPage()
    page.on('pageerror', error => { console.error('Hash locate fixture:', error.message) })
    await page.setContent('<!doctype html><html><body><div id="root"></div></body></html>')
    await page.addScriptTag({ content: built.outputFiles[0]!.text })
    await page.locator('[data-row-identity="b2xk"]').click({ timeout: 5000 })
    await page.waitForFunction(() => Reflect.get(window, 'fixture').epoch.snapshot().synchronized, undefined, { timeout: 5000 })
    await page.locator('input[name="hashSearch"]').fill('old')
    await page.waitForFunction(() => Reflect.get(window, 'fixture').epoch.snapshot().synchronized, undefined, { timeout: 5000 })
    const scans = await page.evaluate(() => Reflect.get(window, 'fixture').scans())
    const start = await page.evaluate(() => Reflect.get(window, 'fixture').publications.length)
    const id = '12345678-1234-1234-1234-123456789abc'
    await page.evaluate(value => Reflect.get(window, 'fixture').action(value, 'outside'), id)
    await page.waitForFunction(() => Reflect.get(window, 'fixture').frames.some((frame: { kind?: string }) => frame.kind === 'commitSelection'), undefined, { timeout: 5000 })
    expect(await page.locator('[data-row-identity="b3V0c2lkZQ=="]').getAttribute('aria-selected')).toBe('true')
    expect(await page.locator('[data-loaded-fields]').textContent()).toBe('30')
    await page.waitForTimeout(160)
    expect(await page.evaluate(() => Reflect.get(window, 'fixture').publications.length)).toBe(start)
    expect(await page.evaluate(() => Reflect.get(window, 'fixture').scans())).toBe(scans)
    await page.evaluate(value => Reflect.get(window, 'fixture').push({ kind: 'selectionResult', requestId: value, accepted: true }), id)
    await page.waitForFunction(() => Reflect.get(window, 'fixture').epoch.snapshot().synchronized && Reflect.get(window, 'fixture').publications.at(-1)?.selection?.item?.fieldBase64 === 'b3V0c2lkZQ==', undefined, { timeout: 5000 })
    const rejected = '12345678-1234-1234-1234-123456789abd'
    await page.evaluate(value => Reflect.get(window, 'fixture').action(value, 'rejected'), rejected)
    await page.waitForFunction(() => Reflect.get(window, 'fixture').frames.filter((frame: { kind?: string }) => frame.kind === 'commitSelection').length === 2, undefined, { timeout: 5000 })
    await page.evaluate(value => Reflect.get(window, 'fixture').push({ kind: 'selectionResult', requestId: value, accepted: false }), rejected)
    await page.waitForFunction(() => Reflect.get(window, 'fixture').epoch.snapshot().synchronized, undefined, { timeout: 5000 })
    expect(await page.locator('[data-row-identity="b3V0c2lkZQ=="]').getAttribute('aria-selected')).toBe('true')
    const competing = '12345678-1234-1234-1234-123456789abe'
    await page.evaluate(value => Reflect.get(window, 'fixture').action(value, 'competing'), competing)
    await page.waitForFunction(() => Reflect.get(window, 'fixture').frames.filter((frame: { kind?: string }) => frame.kind === 'commitSelection').length === 3, undefined, { timeout: 5000 })
    await page.locator('[data-row-identity="b2xk"]').click()
    await page.evaluate(value => Reflect.get(window, 'fixture').push({ kind: 'selectionResult', requestId: value, accepted: true }), competing)
    await page.waitForFunction(() => Reflect.get(window, 'fixture').epoch.snapshot().synchronized && Reflect.get(window, 'fixture').publications.at(-1)?.selection?.item?.fieldBase64 === 'b2xk', undefined, { timeout: 5000 })
    expect(await page.locator('[data-row-identity="b2xk"]').getAttribute('aria-selected')).toBe('true')
    const scrolled = '12345678-1234-1234-1234-123456789abf'
    await page.evaluate(value => Reflect.get(window, 'fixture').action(value, 'scroll-target'), scrolled)
    await page.waitForFunction(() => Reflect.get(window, 'fixture').frames.filter((frame: { kind?: string }) => frame.kind === 'commitSelection').length === 4, undefined, { timeout: 5000 })
    const beforeWheel = await page.evaluate(() => Reflect.get(window, 'fixture').epoch.snapshot().revision)
    await page.locator('.redis-collection-table').hover(); await page.mouse.wheel(0, 60)
    await page.waitForFunction(revision => Reflect.get(window, 'fixture').epoch.snapshot().revision > revision, beforeWheel, { timeout: 5000 })
    await page.evaluate(value => Reflect.get(window, 'fixture').push({ kind: 'selectionResult', requestId: value, accepted: true }), scrolled)
    try { await page.waitForFunction(() => Reflect.get(window, 'fixture').epoch.snapshot().synchronized && Reflect.get(window, 'fixture').publications.at(-1)?.selection?.item?.fieldBase64 === 'b2xk', undefined, { timeout: 5000 }) }
    catch (error) { console.info('Hash wheel state:', await page.evaluate(() => { const f = Reflect.get(window, 'fixture'); return { snapshot: f.epoch.snapshot(), frames: f.frames.slice(-8), publications: f.publications.slice(-4), rows: Array.from(document.querySelectorAll('[data-row-identity]'), row => [row.getAttribute('data-row-identity'), row.getAttribute('aria-selected')]) } })); throw error }
    expect(await page.locator('[data-row-identity="b2xk"]').getAttribute('aria-selected')).toBe('true')
    const delayed = '12345678-1234-1234-1234-123456789ac0'
    await page.evaluate(value => { const f = Reflect.get(window, 'fixture'); f.delay(); f.action(value, 'late') }, delayed)
    await page.waitForFunction(() => Reflect.get(window, 'fixture').reading(), undefined, { timeout: 5000 })
    await page.locator('input[name="hashSearch"]').fill('old ')
    await page.evaluate(() => Reflect.get(window, 'fixture').release())
    await page.waitForFunction(() => Reflect.get(window, 'fixture').epoch.snapshot().synchronized, undefined, { timeout: 5000 })
    expect(await page.evaluate(() => Reflect.get(window, 'fixture').frames.filter((frame: { kind?: string }) => frame.kind === 'commitSelection').length)).toBe(4)
    expect(await page.locator('[data-row-identity="b2xk"]').getAttribute('aria-selected')).toBe('true')
    const empty = '12345678-1234-1234-1234-123456789ac1'
    await page.evaluate(value => Reflect.get(window, 'fixture').action(value, ''), empty)
    await page.waitForFunction(() => Reflect.get(window, 'fixture').frames.filter((frame: { kind?: string }) => frame.kind === 'commitSelection').length === 5, undefined, { timeout: 5000 })
    expect(await page.locator('[data-row-identity=""]').getAttribute('aria-selected')).toBe('true')
    await page.evaluate(value => Reflect.get(window, 'fixture').push({ kind: 'selectionResult', requestId: value, accepted: true }), empty)
    await page.waitForFunction(() => Reflect.get(window, 'fixture').epoch.snapshot().synchronized && Reflect.get(window, 'fixture').publications.at(-1)?.selection?.item?.fieldBase64 === '', undefined, { timeout: 5000 })
    await page.getByRole('button', { name: 'hash.refresh' }).click()
    await page.waitForFunction(() => Reflect.get(window, 'fixture').epoch.snapshot().synchronized && Reflect.get(window, 'fixture').publications.at(-1)?.selection?.item === null, undefined, { timeout: 5000 })
    expect(await page.locator('[data-located-hash-field]').count()).toBe(0)
    const noSelection = '12345678-1234-1234-1234-123456789ac2'
    await page.evaluate(value => { const f = Reflect.get(window, 'fixture'); f.delay(); f.action(value, 'late-no-selection') }, noSelection)
    await page.waitForFunction(() => Reflect.get(window, 'fixture').reading(), undefined, { timeout: 5000 })
    await page.locator('input[name="hashSearch"]').fill('old')
    await page.evaluate(() => Reflect.get(window, 'fixture').release())
    await page.waitForFunction(() => Reflect.get(window, 'fixture').epoch.snapshot().synchronized, undefined, { timeout: 5000 })
    expect(await page.evaluate(() => Reflect.get(window, 'fixture').frames.filter((frame: { kind?: string }) => frame.kind === 'commitSelection').length)).toBe(5)
    const filtered = '12345678-1234-1234-1234-123456789ac3'
    await page.evaluate(value => { const f = Reflect.get(window, 'fixture'); f.delay(); f.action(value, 'late-pattern') }, filtered)
    await page.waitForFunction(() => Reflect.get(window, 'fixture').reading(), undefined, { timeout: 5000 })
    await page.getByRole('button', { name: 'hash.filter' }).click()
    await page.locator('input[name="hashPattern"]').fill('f*')
    await page.locator('.redis-hash-filter button[type="submit"]').click()
    await page.evaluate(() => Reflect.get(window, 'fixture').release())
    await page.waitForFunction(() => Reflect.get(window, 'fixture').epoch.snapshot().synchronized, undefined, { timeout: 5000 })
    expect(await page.evaluate(() => Reflect.get(window, 'fixture').frames.filter((frame: { kind?: string }) => frame.kind === 'commitSelection').length)).toBe(5)
    const binary = '12345678-1234-1234-1234-123456789ac4'
    await page.evaluate(value => Reflect.get(window, 'fixture').action(value, '\u00ff'), binary)
    await page.waitForFunction(() => Reflect.get(window, 'fixture').frames.filter((frame: { kind?: string }) => frame.kind === 'commitSelection').length === 6, undefined, { timeout: 5000 })
    expect(await page.locator('[data-row-identity="/w=="]').getAttribute('aria-selected')).toBe('true')
    await page.evaluate(value => Reflect.get(window, 'fixture').push({ kind: 'selectionResult', requestId: value, accepted: true }), binary)
    await page.waitForFunction(() => Reflect.get(window, 'fixture').epoch.snapshot().synchronized && Reflect.get(window, 'fixture').publications.at(-1)?.selection?.item?.fieldBase64 === '/w==', undefined, { timeout: 5000 })
    const beforeMore = await page.evaluate(() => Reflect.get(window, 'fixture').scans())
    await page.getByRole('button', { name: 'keys.more' }).click()
    await page.waitForFunction(count => Reflect.get(window, 'fixture').scans() > count && Reflect.get(window, 'fixture').epoch.snapshot().synchronized, beforeMore, { timeout: 5000 })
    expect(await page.locator('[data-row-identity="/w=="]').getAttribute('aria-selected')).toBe('true')
    await page.locator('input[name="hashSearch"]').fill('')
    await page.locator('[data-row-identity="ZjI5"]').click()
    await page.waitForFunction(() => Reflect.get(window, 'fixture').epoch.snapshot().synchronized, undefined, { timeout: 5000 })
    const previousScroll = await page.locator('.redis-collection-table').evaluate(element => element.scrollTop)
    await page.evaluate(() => Reflect.set(window, 'previousFocus', document.activeElement))
    const restore = '12345678-1234-1234-1234-123456789ac5'
    await page.evaluate(value => Reflect.get(window, 'fixture').action(value, 'scroll-restore'), restore)
    await page.waitForFunction(() => Reflect.get(window, 'fixture').frames.filter((frame: { kind?: string }) => frame.kind === 'commitSelection').length === 7, undefined, { timeout: 5000 })
    expect(await page.locator('.redis-collection-table').evaluate(element => element.scrollTop)).toBeLessThan(previousScroll)
    await page.evaluate(value => Reflect.get(window, 'fixture').push({ kind: 'selectionResult', requestId: value, accepted: false }), restore)
    await page.waitForFunction(() => Reflect.get(window, 'fixture').epoch.snapshot().synchronized, undefined, { timeout: 5000 })
    expect(await page.locator('.redis-collection-table').evaluate(element => element.scrollTop)).toBe(previousScroll)
    expect(await page.evaluate(() => document.activeElement === Reflect.get(window, 'previousFocus'))).toBe(true)
    await page.addStyleTag({ content: '.redis-collection-table::-webkit-scrollbar{width:16px}.redis-collection-table::-webkit-scrollbar-thumb{background:black}' })
    const dragId = '12345678-1234-1234-1234-123456789ac6'
    await page.evaluate(value => { const f = Reflect.get(window, 'fixture'); f.delay(); f.action(value, 'drag-late') }, dragId)
    await page.waitForFunction(() => Reflect.get(window, 'fixture').reading(), undefined, { timeout: 5000 })
    const table = page.locator('.redis-collection-table'), box = await table.boundingBox()
    if (box === null) throw new Error('Missing Hash table')
    expect(await table.evaluate(element => element.scrollHeight > element.clientHeight)).toBe(true)
    await page.mouse.move(box.x + box.width - 8, box.y + box.height - 15); await page.mouse.down()
    await page.waitForFunction(() => !Reflect.get(window, 'fixture').epoch.snapshot().synchronized, undefined, { timeout: 5000 })
    await page.waitForTimeout(250)
    expect(await page.evaluate(() => Reflect.get(window, 'fixture').epoch.snapshot().synchronized)).toBe(false)
    await page.mouse.move(box.x + box.width - 8, box.y + box.height * 0.5, { steps: 4 })
    await page.evaluate(() => Reflect.get(window, 'fixture').release())
    expect(await page.evaluate(() => Reflect.get(window, 'fixture').frames.filter((frame: { kind?: string }) => frame.kind === 'commitSelection').length)).toBe(7)
    await page.mouse.up()
    await page.waitForFunction(() => Reflect.get(window, 'fixture').epoch.snapshot().synchronized, undefined, { timeout: 5000 })
    const auto = '12345678-1234-1234-1234-123456789ac7'
    await page.locator('select[name="autoRefreshInterval"]').selectOption('1000')
    await page.evaluate(value => { const f = Reflect.get(window, 'fixture'); f.delay(); f.action(value, 'auto-late') }, auto)
    await page.waitForFunction(() => Reflect.get(window, 'fixture').reading(), undefined, { timeout: 5000 })
    const beforeAuto = await page.evaluate(() => Reflect.get(window, 'fixture').scans())
    expect(await page.getByRole('button', { name: 'auto.title' }).evaluate(button => { const r = button.getBoundingClientRect(); return button.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)) })).toBe(true)
    await page.getByRole('button', { name: 'auto.title' }).click()
    await page.waitForFunction(count => Reflect.get(window, 'fixture').scans() > count, beforeAuto, { timeout: 5000 })
    await page.evaluate(() => Reflect.get(window, 'fixture').release())
    await page.waitForFunction(() => Reflect.get(window, 'fixture').epoch.snapshot().synchronized, undefined, { timeout: 5000 })
    expect(await page.evaluate(() => Reflect.get(window, 'fixture').frames.filter((frame: { kind?: string }) => frame.kind === 'commitSelection').length)).toBe(7)
    await page.getByRole('button', { name: 'auto.title' }).click()
    // A user can press a cached row while a different field is awaiting Host acceptance.
    // The row must stay under the pointer until mouseup, even if that press cancels the action.
    for (const [index, field] of ['pointer-race', 'f5'].entries()) {
      const requestId = '12345678-1234-1234-1234-123456789ad' + index
      const before = await page.evaluate(() => Reflect.get(window, 'fixture').frames.filter((frame: { kind?: string }) => frame.kind === 'commitSelection').length)
      await page.evaluate(value => Reflect.get(window, 'fixture').action(value.requestId, value.field), { requestId, field })
      await page.waitForFunction(count => Reflect.get(window, 'fixture').frames.filter((frame: { kind?: string }) => frame.kind === 'commitSelection').length > count, before, { timeout: 5000 })
      const pressedRow = page.locator('[data-row-identity="ZjE="]')
      const pressed = await pressedRow.boundingBox()
      if (pressed === null) throw new Error('Missing cached field row')
      await page.mouse.move(pressed.x + pressed.width / 2, pressed.y + pressed.height / 2)
      await page.mouse.down()
      // The table's gesture timeout must not move the pressed row while the mouse remains down.
      await page.waitForTimeout(index === 1 ? 10200 : 50)
      const afterDown = await pressedRow.boundingBox()
      expect(afterDown?.y).toBe(pressed.y)
      await page.mouse.up()
      await page.waitForFunction(() => Reflect.get(window, 'fixture').epoch.snapshot().synchronized && Reflect.get(window, 'fixture').publications.at(-1)?.selection?.item?.fieldBase64 === 'ZjE=', undefined, { timeout: 5000 })
      await page.locator('[data-row-identity="ZjI5"]').click()
      await page.waitForFunction(() => Reflect.get(window, 'fixture').epoch.snapshot().synchronized, undefined, { timeout: 5000 })
    }
    for (const [index, ending] of ['pointercancel', 'blur', 'touchcancel', 'release-outside'].entries()) {
      const requestId = '12345678-1234-1234-1234-123456789ae' + index
      const before = await page.evaluate(() => Reflect.get(window, 'fixture').frames.filter((frame: { kind?: string }) => frame.kind === 'commitSelection').length)
      await page.evaluate(value => Reflect.get(window, 'fixture').action(value, 'pointer-end'), requestId)
      await page.waitForFunction(count => Reflect.get(window, 'fixture').frames.filter((frame: { kind?: string }) => frame.kind === 'commitSelection').length > count, before, { timeout: 5000 })
      await page.locator('[data-row-identity="ZjE="]').dispatchEvent('pointerdown', { pointerId: 23, pointerType: ending === 'touchcancel' ? 'touch' : 'mouse', button: 0, buttons: 1 })
      await page.evaluate(kind => {
        if (kind === 'blur') window.dispatchEvent(new Event('blur'))
        else if (kind === 'release-outside') window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 23, pointerType: 'mouse', buttons: 0 }))
        else {
          window.dispatchEvent(new PointerEvent('pointercancel', { pointerId: 23, pointerType: kind === 'touchcancel' ? 'touch' : 'mouse' }))
          if (kind === 'touchcancel') window.dispatchEvent(new TouchEvent('touchcancel', { touches: [] }))
        }
      }, ending)
      await page.waitForFunction(() => Reflect.get(window, 'fixture').epoch.snapshot().synchronized && document.querySelector('[data-row-identity="cG9pbnRlci1lbmQ="]') === null, undefined, { timeout: 5000 })
    }
    await page.locator('.redis-collection-table').evaluate(element => { element.scrollTop = 0 })
    await page.evaluate(() => Reflect.get(window, 'fixture').setHasMore(true))
    await page.getByRole('button', { name: 'hash.refresh' }).click()
    await page.waitForFunction(() => Reflect.get(window, 'fixture').epoch.snapshot().synchronized, undefined, { timeout: 5000 })
    for (const [index, interaction] of ['wheel', 'drag'].entries()) {
      const pagePaused = '12345678-1234-1234-1234-123456789af' + (index * 2)
      let previousCommits = await page.evaluate(() => Reflect.get(window, 'fixture').frames.filter((frame: { kind?: string }) => frame.kind === 'commitSelection').length)
      await page.evaluate(value => Reflect.get(window, 'fixture').action(value, 'pause-page'), pagePaused)
      await page.waitForFunction(count => Reflect.get(window, 'fixture').frames.filter((frame: { kind?: string }) => frame.kind === 'commitSelection').length > count, previousCommits, { timeout: 5000 })
      await page.evaluate(value => Reflect.get(window, 'fixture').push({ kind: 'selectionResult', requestId: value, accepted: true }), pagePaused)
      await page.waitForFunction(() => Reflect.get(window, 'fixture').epoch.snapshot().synchronized, undefined, { timeout: 5000 })
      expect(await page.locator('.redis-collection-table').getAttribute('data-auto-page')).toBe('false')
      previousCommits = await page.evaluate(() => Reflect.get(window, 'fixture').frames.filter((frame: { kind?: string }) => frame.kind === 'commitSelection').length)
      await page.evaluate(value => Reflect.get(window, 'fixture').action(value, 'page-interaction'), '12345678-1234-1234-1234-123456789af' + (index * 2 + 1))
      await page.waitForFunction(count => Reflect.get(window, 'fixture').frames.filter((frame: { kind?: string }) => frame.kind === 'commitSelection').length > count, previousCommits, { timeout: 5000 })
      const beforePagingInteraction = await page.evaluate(() => Reflect.get(window, 'fixture').epoch.snapshot().revision)
      if (interaction === 'wheel') { await page.locator('.redis-collection-table').hover(); await page.mouse.wheel(0, 60) }
      else {
        const row = await page.locator('[data-row-identity="ZjE="]').boundingBox()
        if (row === null) throw new Error('Missing drag field row')
        await page.mouse.move(row.x + 20, row.y + row.height / 2); await page.mouse.down()
        await page.mouse.move(row.x + 40, row.y + row.height / 2); await page.mouse.up()
      }
      await page.waitForFunction(revision => { const snapshot = Reflect.get(window, 'fixture').epoch.snapshot(); return snapshot.revision > revision && snapshot.synchronized }, beforePagingInteraction, { timeout: 5000 })
      expect(await page.locator('.redis-collection-table').getAttribute('data-auto-page')).toBe('true')
    }
    await page.evaluate(() => Reflect.get(window, 'fixture').setHasMore(false))
    await page.locator('[data-row-identity="ZjI5"]').click()
    await page.waitForFunction(() => Reflect.get(window, 'fixture').epoch.snapshot().synchronized, undefined, { timeout: 5000 })
    const cancelled = '12345678-1234-1234-1234-123456789ac8'
    await page.evaluate(value => Reflect.get(window, 'fixture').action(value, 'cancelled'), cancelled)
    await page.waitForFunction(() => Reflect.get(window, 'fixture').frames.filter((frame: { kind?: string }) => frame.kind === 'commitSelection').length === 18, undefined, { timeout: 5000 })
    await page.evaluate(value => Reflect.get(window, 'fixture').push({ kind: 'cancel', requestId: value }), cancelled)
    await page.waitForFunction(() => Reflect.get(window, 'fixture').epoch.snapshot().synchronized, undefined, { timeout: 5000 })
    expect(await page.locator('[data-row-identity="ZjI5"]').getAttribute('aria-selected')).toBe('true')
    const disconnected = '12345678-1234-1234-1234-123456789ac9'
    await page.evaluate(value => Reflect.get(window, 'fixture').action(value, 'disconnect'), disconnected)
    await page.waitForFunction(() => Reflect.get(window, 'fixture').frames.filter((frame: { kind?: string }) => frame.kind === 'commitSelection').length === 19, undefined, { timeout: 5000 })
    await page.evaluate(() => Reflect.get(window, 'fixture').abort.abort())
    await expect.poll(() => page.locator('[data-row-identity="ZjI5"]').getAttribute('aria-selected')).toBe('true')
  } finally { await browser.close() }
}, 60000)
