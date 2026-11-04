import { existsSync } from 'node:fs'
import { build } from 'esbuild'
import { chromium } from 'playwright-core'
import { expect, it } from 'vitest'
import { Context, symbols } from '@deepseek-ai/cordis'
import type { Agent } from '@deepseek-ai/dsh-agent'
import type { ActionPointReadRequest, RedisKey, UiChannelInput, UiChannelMessage } from '../src/domain.ts'
import { RedisConnections, type RedisLink } from '../src/host/connection-service.ts'
import { openUiActionChannel } from '../src/host/ui-action-channel.ts'
import { RedisRemoteService } from '../src/remote-service.ts'

const browserPath = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/chromium'].find(path => existsSync(path))

it.skipIf(browserPath === undefined)('locates exact ZSet members and preserves paging and user selection', async () => {
  if (browserPath === undefined) throw new Error('Missing browser')
  const link: RedisLink = { close: () => undefined, onFailure: () => () => undefined, async execute(command, args, signal, guard) {
    signal.throwIfAborted(); guard()
    if (command === 'TYPE') return 'zset'
    if (command === 'ZSCORE' && Buffer.isBuffer(args[1])) return Buffer.from(args[1].toString('base64') === 'b2xk' ? '9.1250000000000001e+20' : '-inf')
    if (command === 'PTTL') return -1n
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
    import { ZSetView } from './src/client/ZSetView.tsx'
    import { CurrentSelection } from './src/client/CurrentSelection.tsx'
    import { SelectionEpochContext, useSelectionRevision } from './src/client/SelectionEpochContext.ts'
    import { SelectionEpoch } from './src/client/selection-epoch.ts'
    import { PreviewFormats } from './src/client/PreviewFormats.tsx'
    import { RefreshVisibility, KeyAutoRefresh } from './src/client/AutoRefresh.tsx'
    import { UiPanePresence } from './src/client/ui-pane-presence.ts'
    import { consumeUiActions } from './src/client/ui-actions.ts'
    import { installRedisStyles } from './src/client/styles.ts'
    import { KeyPresentation } from './src/client/KeyPresentation.tsx'
    const epoch = new SelectionEpoch(), panes = new UiPanePresence(), queue = [], reads = [], actions = new Map()
    const abort = new AbortController(), tab = new AbortController(), target = ${JSON.stringify(target)}
    let wake, ended = false, pages = 0, delayed = false, readStarted = false, releaseRead
    const notify = () => { const next = wake; wake = undefined; next?.() }
    const stream = { send: frame => { void window.hostSend(frame) }, end: () => {}, dispose: () => { ended = true; notify() }, async *[Symbol.asyncIterator]() { while (!ended) { const value = queue.shift(); if (value) { yield value; continue } await new Promise(resolve => { wake = resolve; if (ended || queue.length) notify() }) } } }
    const key = { base64: 'enNldA==', byteLength: 4, label: 'zset' }, old = { base64: 'b2xk', byteLength: 3, label: 'old' }
    const props = { target, selected: key, t: key => key, registerZSetHandler: handler => panes.registerZSetHandler('a', handler),
      readZSet: async request => { pages++; return { ok: true, value: { state: 'page', error: null, metadata: { type: 'zset', ttlMs: '-1', length: '1' }, mode: request.mode, entries: [{ member: old, score: '1', rank: request.mode === 'range' ? request.offset : null }], offset: request.mode === 'range' ? request.offset : null, nextOffset: null, cursor: null, sampledAt: '1970-01-01T00:00:00.000Z' } } },
      readActionPoint: async request => { const member = actions.get(request.requestId); if (member === undefined) throw new Error('Missing fixture action'); reads.push(member.base64); if (delayed) { readStarted = true; await new Promise(resolve => { releaseRead = resolve }) } return { ok: true, value: await window.hostPoint(request) } } }
    const publish = (request, signal) => epoch.publish(request, epoch.snapshot().revision, signal)
    function Holder() { const revision = useSelectionRevision(); return <CurrentSelection target={target} keyBase64={key.base64} revision={revision} suspended={false} publish={publish}><KeyPresentation><KeyAutoRefresh><div className="redis-key-view"><div className="redis-inspector" data-view="data"><ZSetView {...props} /></div></div></KeyAutoRefresh></KeyPresentation></CurrentSelection> }
    installRedisStyles(); const detach = panes.attach('a')
    createRoot(document.getElementById('root')).render(<section className="dsh-redis" style={{ height: 600 }}><div className="redis-connection"><SelectionEpochContext.Provider value={epoch}><RefreshVisibility.Provider value={{ visible: true, signal: tab.signal }}><PreviewFormats><Holder /></PreviewFormats></RefreshVisibility.Provider></SelectionEpochContext.Provider></div></section>)
    void consumeUiActions(async () => stream, abort.signal, (request, signal) => request.action.kind === 'selectZSetMember' ? panes.selectZSetMember('a', request, signal) : Promise.resolve('stale'), epoch)
    window.fixture = { epoch, abort, hide: () => { epoch.invalidate(); detach(); tab.abort() }, pages: () => pages, reads, delay: () => { delayed = true; readStarted = false }, reading: () => readStarted, release: () => { delayed = false; releaseRead?.() }, push: frame => { if (frame.kind === 'action' && frame.request.action.kind === 'selectZSetMember') actions.set(frame.request.requestId, frame.request.action.member); queue.push(frame); notify() } }
  `
  const built = await build({ stdin: { contents: source, resolveDir: process.cwd(), loader: 'jsx', sourcefile: 'zset-locate-browser.jsx' }, bundle: true, platform: 'browser', format: 'iife', jsx: 'automatic', write: false })
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
    pump = (async () => {
      for await (const frame of host) {
        if (frame.kind === 'action') actionId = frame.request.requestId
        if (hold && frame.kind === 'selectionResult' && frame.requestId === actionId && frame.accepted) { held = frame; continue }
        await page.evaluate((message: UiChannelMessage) => Reflect.get(window, 'fixture').push(message), frame)
      }
    })()
    await page.addScriptTag({ content: built.outputFiles[0]!.text })
    await page.locator('[data-row-identity="b2xk"]').click({ timeout: 5000 })
    await expect.poll(() => coordinator.selectionRevision('a'), { timeout: 5000 }).not.toBeNull()
    const locate = async (member: RedisKey) => {
      const revision = coordinator.selectionRevision('a')
      if (revision === null) throw new Error('Missing synchronized revision')
      return coordinator.dispatch('a', { kind: 'selectZSetMember', keyBase64: 'enNldA==', member }, target, revision, () => true, new AbortController().signal)
    }
    const originalPages = await page.evaluate(() => Reflect.get(window, 'fixture').pages())
    const members = [
      { base64: 'b3V0c2lkZQ==', byteLength: 7, label: 'outside' },
      { base64: 'AP8=', byteLength: 2, label: 'binary' },
      { base64: '', byteLength: 0, label: 'empty' },
    ]
    for (const member of members) {
      expect(await locate(member)).toBe('applied')
      const row = page.locator(`[data-row-identity="${member.base64}"]`)
      expect(await row.count()).toBe(1)
      expect(await row.getAttribute('aria-selected')).toBe('true')
      expect(await row.locator('[data-column="rank"]').textContent()).toBe('')
      expect(await row.locator('[data-zset-score]').textContent()).toBe('-inf')
      expect(await page.locator('[data-loaded-zset]').textContent()).toBe('1')
      expect(await page.evaluate(() => Reflect.get(window, 'fixture').pages())).toBe(originalPages)
      await expect.poll(() => coordinator.selectionRevision('a'), { timeout: 5000 }).not.toBeNull()
    }
    expect(await page.evaluate(() => Reflect.get(window, 'fixture').reads)).toEqual(['b3V0c2lkZQ==', 'AP8=', ''])
    expect(publications.some(frame => 'kind' in frame && frame.kind === 'publishSelection' && frame.request.selection?.item?.kind === 'zset' && frame.request.selection.item.memberBase64 === '')).toBe(true)
    expect(await locate({ base64: 'b2xk', byteLength: 3, label: 'old' })).toBe('applied')
    const cached = page.locator('[data-row-identity="b2xk"]')
    expect(await cached.count()).toBe(1)
    expect(await cached.locator('[data-zset-score]').textContent()).toBe('9.1250000000000001e+20')
    expect(await cached.locator('[data-column="rank"]').textContent()).toBe('')
    expect(await page.locator('[data-loaded-zset]').textContent()).toBe('1')
    const beforeRefresh = await page.evaluate(() => Reflect.get(window, 'fixture').pages())
    await page.getByRole('button', { name: 'value.refresh' }).click()
    await page.waitForFunction(count => Reflect.get(window, 'fixture').pages() > count && Reflect.get(window, 'fixture').epoch.snapshot().synchronized, beforeRefresh, { timeout: 5000 })
    await expect.poll(() => cached.locator('[data-zset-score]').textContent()).toBe('1')
    expect(await cached.locator('[data-column="rank"]').textContent()).toBe('0')
    expect(await page.locator('[data-loaded-zset]').textContent()).toBe('1')
    await cached.click()
    await expect.poll(() => coordinator.selectionRevision('a'), { timeout: 5000 }).not.toBeNull()
    hold = true
    const interrupted = locate(members[0]!)
    await expect.poll(() => held, { timeout: 5000 }).toBeDefined()
    await cached.click()
    expect(await interrupted).toBe('unknown')
    if (held !== undefined) await page.evaluate((message: UiChannelMessage) => Reflect.get(window, 'fixture').push(message), held)
    await expect.poll(() => coordinator.selectionRevision('a'), { timeout: 5000 }).not.toBeNull()
    expect(await cached.getAttribute('aria-selected')).toBe('true')
    hold = false; held = undefined
    await page.locator('select[name="zsetMode"]').selectOption('scan')
    await page.waitForFunction(() => Reflect.get(window, 'fixture').epoch.snapshot().synchronized, undefined, { timeout: 5000 })
    await page.getByRole('button', { name: 'read.range' }).click()
    await page.locator('input[name="zsetPattern"]').fill('old*')
    await page.locator('.redis-collection-controls button[type="submit"]').click()
    await page.waitForFunction(() => Reflect.get(window, 'fixture').epoch.snapshot().synchronized, undefined, { timeout: 5000 })
    const scanPages = await page.evaluate(() => Reflect.get(window, 'fixture').pages())
    expect(await locate(members[1]!)).toBe('applied')
    expect(await page.locator('[data-row-identity="AP8="]').getAttribute('aria-selected')).toBe('true')
    expect(await page.evaluate(() => Reflect.get(window, 'fixture').pages())).toBe(scanPages)
    await expect.poll(() => coordinator.selectionRevision('a'), { timeout: 5000 }).not.toBeNull()
    await page.evaluate(() => Reflect.get(window, 'fixture').delay())
    const delayed = locate(members[0]!)
    await page.waitForFunction(() => Reflect.get(window, 'fixture').reading(), undefined, { timeout: 5000 })
    await page.locator('[data-row-identity="b2xk"]').click()
    expect(await delayed).toBe('stale')
    await page.evaluate(() => Reflect.get(window, 'fixture').release())
    expect(await page.locator('[data-row-identity="b3V0c2lkZQ=="]').count()).toBe(0)
    await page.evaluate(() => Reflect.get(window, 'fixture').abort.abort())
  } finally { hostAbort.abort(); ended = true; notify(); await pump; await browser.close(); connections.dispose(); await ctx.fiber.dispose() }
}, 30000)
