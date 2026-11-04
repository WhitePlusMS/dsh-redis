import { existsSync } from 'node:fs'
import { Context, symbols } from '@deepseek-ai/cordis'
import type { Agent } from '@deepseek-ai/dsh-agent'
import { build } from 'esbuild'
import { chromium } from 'playwright-core'
import { expect, it } from 'vitest'
import type { ActionPointReadRequest, UiChannelInput, UiChannelMessage } from '../src/domain.ts'
import { RedisConnections, type RedisLink } from '../src/host/connection-service.ts'
import { openUiActionChannel } from '../src/host/ui-action-channel.ts'
import { RedisRemoteService } from '../src/remote-service.ts'

const browserPath = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/chromium'].find(path => existsSync(path))

it.skipIf(browserPath === undefined)('locates an exact repeated Stream field in both visible tables without changing pagination', async () => {
  if (browserPath === undefined) throw new Error('Missing browser')
  const commands: string[] = []
  const link: RedisLink = { close: () => undefined, onFailure: () => () => undefined, async execute(command, args, signal, guard) {
    signal.throwIfAborted(); guard(); commands.push(command)
    if (command === 'TYPE') return 'stream'
    if (command === 'PTTL') return -1n
    if (command === 'XLEN') return 2n
    if (command === 'XRANGE') {
      expect(args).toEqual([Buffer.from('stream'), '3-0', '3-0', 'COUNT', '1'])
      return [[Buffer.from('3-0'), [Buffer.from('same'), Buffer.from('first'), Buffer.from('same'), Buffer.from('second'), Buffer.from([0, 255]), Buffer.from('binary'), Buffer.alloc(0), Buffer.alloc(0)]]]
    }
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
    import { StreamView } from './src/client/StreamView.tsx'
    import { CurrentSelection } from './src/client/CurrentSelection.tsx'
    import { SelectionEpochContext, useSelectionRevision } from './src/client/SelectionEpochContext.ts'
    import { SelectionEpoch } from './src/client/selection-epoch.ts'
    import { PreviewFormats } from './src/client/PreviewFormats.tsx'
    import { RefreshVisibility, KeyAutoRefresh } from './src/client/AutoRefresh.tsx'
    import { UiPanePresence } from './src/client/ui-pane-presence.ts'
    import { consumeUiActions } from './src/client/ui-actions.ts'
    import { installRedisStyles } from './src/client/styles.ts'
    import { KeyPresentation } from './src/client/KeyPresentation.tsx'
    const epoch = new SelectionEpoch(), panes = new UiPanePresence(), queue = [], abort = new AbortController(), tab = new AbortController(), target = ${JSON.stringify(target)}
    let wake, ended = false, pages = 0, includeCached = false, delayed = false, readStarted = false, releaseRead
    const notify = () => { const next = wake; wake = undefined; next?.() }
    const stream = { send: frame => { void window.hostSend(frame) }, end: () => {}, dispose: () => { ended = true; notify() }, async *[Symbol.asyncIterator]() { while (!ended) { const value = queue.shift(); if (value) { yield value; continue } await new Promise(resolve => { wake = resolve; if (ended || queue.length) notify() }) } } }
    const key = { base64: 'c3RyZWFt', byteLength: 6, label: 'stream' }, old = { id: '1-0', fields: [{ field: { base64: 'b2xk', byteLength: 3, label: 'old' }, value: { base64: 'b2xk', byteLength: 3, fullByteLength: 3, suffix: '' } }] }, cached = { id: '3-0', fields: [{ field: { base64: 'c2FtZQ==', byteLength: 4, label: 'same' }, value: { base64: 'Y2FjaGVk', byteLength: 6, fullByteLength: 6, suffix: '' } }] }
    const props = { target, selected: key, t: key => key, registerStreamHandler: handler => panes.registerStreamHandler('a', handler),
      readStream: async request => { pages++; return { ok: true, value: { state: 'page', error: null, metadata: { type: 'stream', ttlMs: '-1', length: '2' }, direction: request.direction, start: request.start, end: request.end, messages: includeCached ? [old, cached] : [old], cursor: null, sampledAt: '1970-01-01T00:00:00.000Z' } } },
      readActionPoint: async request => { if (delayed) { readStarted = true; await new Promise(resolve => { releaseRead = resolve }) } return { ok: true, value: await window.hostPoint(request) } } }
    const publish = (request, signal) => epoch.publish(request, epoch.snapshot().revision, signal)
    function Holder() { const revision = useSelectionRevision(); return <CurrentSelection target={target} keyBase64={key.base64} revision={revision} suspended={false} publish={publish}><KeyPresentation><KeyAutoRefresh><div className="redis-key-view"><div className="redis-inspector" data-view="data"><StreamView {...props} /></div></div></KeyAutoRefresh></KeyPresentation></CurrentSelection> }
    installRedisStyles(); const detach = panes.attach('a')
    createRoot(document.getElementById('root')).render(<section className="dsh-redis" style={{ height: 800 }}><div className="redis-connection"><SelectionEpochContext.Provider value={epoch}><RefreshVisibility.Provider value={{ visible: true, signal: tab.signal }}><PreviewFormats><Holder /></PreviewFormats></RefreshVisibility.Provider></SelectionEpochContext.Provider></div></section>)
    void consumeUiActions(async () => stream, abort.signal, (request, signal) => request.action.kind === 'selectStreamField' ? panes.selectStreamField('a', request, signal) : Promise.resolve('stale'), epoch)
    window.fixture = { epoch, abort, hide: () => { epoch.invalidate(); detach(); tab.abort() }, includeCached: () => { includeCached = true }, pages: () => pages, delay: () => { delayed = true; readStarted = false }, reading: () => readStarted, release: () => { delayed = false; releaseRead?.() }, push: frame => { queue.push(frame); notify() } }
  `
  const built = await build({ stdin: { contents: source, resolveDir: process.cwd(), loader: 'jsx', sourcefile: 'stream-locate-browser.jsx' }, bundle: true, platform: 'browser', format: 'iife', jsx: 'automatic', write: false })
  const values: UiChannelInput[] = [], publications: UiChannelInput[] = []
  let wake: (() => void) | undefined, ended = false, actionId: string | undefined, hold = false, held: UiChannelMessage | undefined
  const notify = () => { const next = wake; wake = undefined; next?.() }
  const uplink: AsyncIterable<UiChannelInput> = { async *[Symbol.asyncIterator]() { while (!ended) { const value = values.shift(); if (value !== undefined) { yield value; continue } await new Promise<void>(resolve => { wake = resolve; if (ended || values.length > 0) notify() }) } } }
  const browser = await chromium.launch({ executablePath: browserPath, headless: true })
  let pump: Promise<void> | undefined
  try {
    const page = await browser.newPage()
    await page.exposeFunction('hostSend', (frame: UiChannelInput) => { publications.push(frame); values.push(frame); notify() })
    await page.exposeFunction('hostPoint', (request: ActionPointReadRequest) => service.readActionPoint(agent, request, hostAbort.signal))
    await page.setContent('<!doctype html><html><body><div id="root"></div></body></html>')
    await page.evaluate(() => { let sequence = 0; Object.defineProperty(crypto, 'randomUUID', { value: () => `12345678-1234-1234-1234-${String(++sequence).padStart(12, '0')}` }) })
    const host = openUiActionChannel(coordinator, 'a', hostAbort.signal, uplink, () => ({ accepted: true }))
    pump = (async () => { for await (const frame of host) { if (frame.kind === 'action') actionId = frame.request.requestId; if (hold && frame.kind === 'selectionResult' && frame.requestId === actionId && frame.accepted) { held = frame; continue } await page.evaluate((message: UiChannelMessage) => Reflect.get(window, 'fixture').push(message), frame) } })()
    await page.addScriptTag({ content: built.outputFiles[0]!.text })
    await page.locator('[data-stream-id="1-0"]').click({ timeout: 5000 })
    await expect.poll(() => coordinator.selectionRevision('a'), { timeout: 5000 }).not.toBeNull()
    const locate = async (fieldIndex: number, fieldBase64: string) => {
      const revision = coordinator.selectionRevision('a')
      if (revision === null) throw new Error('Missing synchronized revision')
      return coordinator.dispatch('a', { kind: 'selectStreamField', keyBase64: 'c3RyZWFt', id: '3-0', fieldIndex, fieldBase64 }, target, revision, () => true, new AbortController().signal)
    }
    const originalPages = await page.evaluate(() => Reflect.get(window, 'fixture').pages())
    for (const [index, field] of [[1, 'c2FtZQ=='], [2, 'AP8='], [3, '']] as const) {
      expect(await locate(index, field)).toBe('applied')
      const message = page.locator('[data-stream-id="3-0"]').locator('xpath=ancestor::tr')
      expect(await message.count()).toBe(1); expect(await message.getAttribute('aria-selected')).toBe('true')
      const selectedField = page.locator(`[data-stream-field="${index}"]`).locator('xpath=ancestor::tr')
      expect(await selectedField.getAttribute('aria-selected')).toBe('true')
      if (index === 1) expect(await page.locator('[data-stream-value="1"]').textContent()).toBe('second')
      expect(await page.locator('[data-loaded-messages]').textContent()).toBe('1')
      expect(await page.evaluate(() => Reflect.get(window, 'fixture').pages())).toBe(originalPages)
      expect(publications.some(frame => 'kind' in frame && frame.kind === 'publishSelection' && frame.request.selection?.item?.kind === 'stream' && frame.request.selection.item.fieldIndex === index && frame.request.selection.item.fieldBase64 === field)).toBe(true)
      await expect.poll(() => coordinator.selectionRevision('a'), { timeout: 5000 }).not.toBeNull()
    }
    hold = true
    const interrupted = locate(1, 'c2FtZQ==')
    await expect.poll(() => held, { timeout: 5000 }).toBeDefined()
    await page.locator('[data-stream-field="2"]').click()
    expect(await interrupted).toBe('unknown')
    if (held !== undefined) await page.evaluate((message: UiChannelMessage) => Reflect.get(window, 'fixture').push(message), held)
    await expect.poll(() => coordinator.selectionRevision('a'), { timeout: 5000 }).not.toBeNull()
    expect(await page.locator('[data-stream-field="2"]').locator('xpath=ancestor::tr').getAttribute('aria-selected')).toBe('true')
    hold = false; held = undefined
    await page.evaluate(() => Reflect.get(window, 'fixture').delay())
    const delayed = locate(1, 'c2FtZQ==')
    await page.waitForFunction(() => Reflect.get(window, 'fixture').reading(), undefined, { timeout: 5000 })
    await page.locator('[data-stream-id="1-0"]').click()
    expect(await delayed).toBe('stale')
    await page.evaluate(() => Reflect.get(window, 'fixture').release())
    expect(await page.locator('[data-stream-id="1-0"]').locator('xpath=ancestor::tr').getAttribute('aria-selected')).toBe('true')
    await expect.poll(() => coordinator.selectionRevision('a'), { timeout: 5000 }).not.toBeNull()
    for (const table of ['.redis-stream-body > .redis-collection-table', '.redis-stream-pairs > .redis-collection-table']) {
      await page.evaluate(() => Reflect.get(window, 'fixture').delay())
      const scrolling = locate(1, 'c2FtZQ==')
      await page.waitForFunction(() => Reflect.get(window, 'fixture').reading(), undefined, { timeout: 5000 })
      await page.locator(table).dispatchEvent('wheel', { deltaY: 80 })
      expect(await scrolling).toBe('stale')
      await page.evaluate(() => Reflect.get(window, 'fixture').release())
      await expect.poll(() => coordinator.selectionRevision('a'), { timeout: 5000 }).not.toBeNull()
    }
    await page.evaluate(() => Reflect.get(window, 'fixture').delay())
    const direction = locate(1, 'c2FtZQ==')
    await page.waitForFunction(() => Reflect.get(window, 'fixture').reading(), undefined, { timeout: 5000 })
    await page.locator('select[name="streamDirection"]').selectOption('reverse')
    expect(await direction).toBe('stale')
    await page.evaluate(() => Reflect.get(window, 'fixture').release())
    await expect.poll(() => coordinator.selectionRevision('a'), { timeout: 5000 }).not.toBeNull()
    await page.getByRole('button', { name: 'stream.range' }).click()
    await expect.poll(() => coordinator.selectionRevision('a'), { timeout: 5000 }).not.toBeNull()
    await page.evaluate(() => Reflect.get(window, 'fixture').delay())
    const editing = locate(1, 'c2FtZQ==')
    await page.waitForFunction(() => Reflect.get(window, 'fixture').reading(), undefined, { timeout: 5000 })
    await page.locator('input[name="streamStart"]').fill('invalid')
    expect(await editing).toBe('stale')
    await page.evaluate(() => Reflect.get(window, 'fixture').release())
    await page.locator('input[name="streamStart"]').fill('-')
    await page.getByRole('button', { name: 'stream.range' }).click()
    await expect.poll(() => coordinator.selectionRevision('a'), { timeout: 5000 }).not.toBeNull()
    await page.evaluate(() => Reflect.get(window, 'fixture').includeCached())
    const beforeRefresh = await page.evaluate(() => Reflect.get(window, 'fixture').pages())
    await page.getByRole('button', { name: 'stream.refresh' }).click()
    await page.waitForFunction(count => Reflect.get(window, 'fixture').pages() > count && Reflect.get(window, 'fixture').epoch.snapshot().synchronized, beforeRefresh, { timeout: 5000 })
    expect(await page.locator('[data-loaded-messages]').textContent()).toBe('2')
    expect(await page.locator('[data-stream-id="3-0"]').count()).toBe(1)
    expect(await locate(1, 'c2FtZQ==')).toBe('applied')
    expect(await page.locator('[data-stream-id="3-0"]').count()).toBe(1)
    expect(await page.locator('[data-loaded-messages]').textContent()).toBe('2')
    await expect.poll(() => coordinator.selectionRevision('a'), { timeout: 5000 }).not.toBeNull()
    const beforeReplacement = await page.evaluate(() => Reflect.get(window, 'fixture').pages())
    await page.getByRole('button', { name: 'stream.refresh' }).click()
    await page.waitForFunction(count => Reflect.get(window, 'fixture').pages() > count && Reflect.get(window, 'fixture').epoch.snapshot().synchronized, beforeReplacement, { timeout: 5000 })
    expect(await page.locator('[data-located-stream-message]').count()).toBe(0)
    expect(await page.locator('[data-stream-id="3-0"]').count()).toBe(1)
    expect(await page.locator('[data-stream-value="0"]').textContent()).toBe('cached')
    await page.evaluate(() => Reflect.get(window, 'fixture').delay())
    const hidden = locate(1, 'c2FtZQ==')
    await page.waitForFunction(() => Reflect.get(window, 'fixture').reading(), undefined, { timeout: 5000 })
    await page.evaluate(() => Reflect.get(window, 'fixture').hide())
    expect(await hidden).toBe('stale')
    await page.evaluate(() => Reflect.get(window, 'fixture').release())
    expect(commands.every(command => ['TYPE', 'PTTL', 'XLEN', 'XRANGE'].includes(command))).toBe(true)
    await page.evaluate(() => Reflect.get(window, 'fixture').abort.abort())
  } finally { hostAbort.abort(); ended = true; notify(); await pump; await browser.close(); connections.dispose(); await ctx.fiber.dispose() }
}, 30000)
