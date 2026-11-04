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

it.skipIf(browserPath === undefined)('locates exact Set identities through the Host stream while preserving scan and user selection', async () => {
  if (browserPath === undefined) throw new Error('Missing browser')
  const link: RedisLink = { close: () => undefined, onFailure: () => () => undefined, async execute(command, _args, signal, guard) {
    signal.throwIfAborted(); guard()
    if (command === 'TYPE') return 'set'
    if (command === 'SISMEMBER') return 1n
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
    import { SetView } from './src/client/SetView.tsx'
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
    let wake, ended = false, scans = 0, delayed = false, readStarted = false, releaseRead, hasMore = false
    const notify = () => { const next = wake; wake = undefined; next?.() }
    const stream = { send: frame => { void window.hostSend(frame) }, end: () => {}, dispose: () => { ended = true; notify() }, async *[Symbol.asyncIterator]() { while (!ended) { const value = queue.shift(); if (value) { yield value; continue } await new Promise(resolve => { wake = resolve; if (ended || queue.length) notify() }) } } }
    const key = { base64: 'c2V0', byteLength: 3, label: 'set' }, old = { base64: 'b2xk', byteLength: 3, label: 'old' }
    const many = Array.from({ length: 30 }, (_, index) => { const text = 'member-' + index; return { base64: btoa(text), byteLength: text.length, label: text } })
    const props = { target, selected: key, t: key => key, registerSetHandler: handler => panes.registerSetHandler('a', handler),
      scanSet: async () => { scans++; return { ok: true, value: { state: 'page', error: null, metadata: { type: 'set', ttlMs: '-1', length: '40' }, members: hasMore ? [old, ...many] : [old], cursor: hasMore ? '1' : null, sampledAt: '1970-01-01T00:00:00.000Z' } } },
      readActionPoint: async request => { const member = actions.get(request.requestId); if (member === undefined) throw new Error('Missing fixture action'); reads.push(member.base64); if (delayed) { readStarted = true; await new Promise(resolve => { releaseRead = resolve }) } return { ok: true, value: await window.hostPoint(request) } } }
    const publish = (request, signal) => epoch.publish(request, epoch.snapshot().revision, signal)
    function Holder() { const revision = useSelectionRevision(); return <CurrentSelection target={target} keyBase64={key.base64} revision={revision} suspended={false} publish={publish}><KeyPresentation><KeyAutoRefresh><div className="redis-key-view"><div className="redis-inspector" data-view="data"><SetView {...props} /></div></div></KeyAutoRefresh></KeyPresentation></CurrentSelection> }
    installRedisStyles(); const detach = panes.attach('a')
    createRoot(document.getElementById('root')).render(<section className="dsh-redis" style={{ height: 600 }}><div className="redis-connection"><SelectionEpochContext.Provider value={epoch}><RefreshVisibility.Provider value={{ visible: true, signal: tab.signal }}><PreviewFormats><Holder /></PreviewFormats></RefreshVisibility.Provider></SelectionEpochContext.Provider></div></section>)
    void consumeUiActions(async () => stream, abort.signal, (request, signal) => request.action.kind === 'selectSetMember' ? panes.selectSetMember('a', request, signal) : Promise.resolve('stale'), epoch)
    window.fixture = { epoch, abort, hide: () => { epoch.invalidate(); detach(); tab.abort() }, scans: () => scans, setHasMore: value => { hasMore = value }, reads, delay: () => { delayed = true; readStarted = false }, reading: () => readStarted, release: () => { delayed = false; releaseRead?.() }, push: frame => { if (frame.kind === 'action' && frame.request.action.kind === 'selectSetMember') actions.set(frame.request.requestId, frame.request.action.member); queue.push(frame); notify() } }
  `
  const built = await build({ stdin: { contents: source, resolveDir: process.cwd(), loader: 'jsx', sourcefile: 'set-locate-browser.jsx' }, bundle: true, platform: 'browser', format: 'iife', jsx: 'automatic', write: false })
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
    await page.getByRole('button', { name: 'set.pattern' }).click()
    await page.locator('input[name="setPattern"]').fill('old')
    await page.locator('.redis-collection-controls button[type="submit"]').click()
    await page.waitForFunction(() => Reflect.get(window, 'fixture').epoch.snapshot().synchronized, undefined, { timeout: 5000 })
    const scans = await page.evaluate(() => Reflect.get(window, 'fixture').scans())
    const locate = async (member: RedisKey) => {
      const revision = coordinator.selectionRevision('a')
      if (revision === null) throw new Error('Missing synchronized revision')
      return coordinator.dispatch('a', { kind: 'selectSetMember', keyBase64: 'c2V0', member }, target, revision, () => true, new AbortController().signal)
    }
    for (const member of [
      { base64: 'b3V0c2lkZQ==', byteLength: 7, label: 'outside' },
      { base64: 'AP8=', byteLength: 2, label: 'binary' },
      { base64: '', byteLength: 0, label: 'empty' },
    ]) {
      expect(await locate(member)).toBe('applied')
      expect(await page.locator('[data-row-identity]').filter({ has: page.locator('[data-set-member]') }).count()).toBe(2)
      expect(await page.locator(`[data-row-identity="${member.base64}"]`).getAttribute('aria-selected')).toBe('true')
      expect(await page.locator('[data-loaded-members]').textContent()).toBe('1')
      expect(await page.evaluate(() => Reflect.get(window, 'fixture').scans())).toBe(scans)
      await expect.poll(() => coordinator.selectionRevision('a'), { timeout: 5000 }).not.toBeNull()
    }
    expect(await page.evaluate(() => Reflect.get(window, 'fixture').reads)).toEqual(['b3V0c2lkZQ==', 'AP8=', ''])
    expect(publications.some(frame => 'kind' in frame && frame.kind === 'publishSelection' && frame.request.selection?.item?.kind === 'set' && frame.request.selection.item.memberBase64 === '')).toBe(true)
    expect(await locate({ base64: 'b2xk', byteLength: 3, label: 'old' })).toBe('applied')
    expect(await page.locator('[data-row-identity="b2xk"]').count()).toBe(1)
    expect(await page.evaluate(() => Reflect.get(window, 'fixture').scans())).toBe(scans)
    await page.locator('[data-row-identity="b2xk"]').click()
    await expect.poll(() => coordinator.selectionRevision('a'), { timeout: 5000 }).not.toBeNull()
    hold = true
    const pending = locate({ base64: 'b3V0c2lkZQ==', byteLength: 7, label: 'outside' })
    await expect.poll(() => held, { timeout: 5000 }).toBeDefined()
    const row = page.locator('[data-row-identity="b2xk"]'), box = await row.boundingBox()
    if (box === null) throw new Error('Missing cached member')
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down()
    await page.waitForTimeout(50)
    expect((await row.boundingBox())?.y).toBe(box.y)
    await page.mouse.up()
    expect(await pending).toBe('unknown')
    if (held !== undefined) await page.evaluate((message: UiChannelMessage) => Reflect.get(window, 'fixture').push(message), held)
    await expect.poll(() => coordinator.selectionRevision('a'), { timeout: 5000 }).not.toBeNull()
    expect(await row.getAttribute('aria-selected')).toBe('true')
    hold = false; held = undefined
    await page.evaluate(() => Reflect.get(window, 'fixture').setHasMore(true))
    const beforeRefresh = await page.evaluate(() => Reflect.get(window, 'fixture').scans())
    await page.getByRole('button', { name: 'keys.scan' }).click()
    await page.waitForFunction(count => Reflect.get(window, 'fixture').scans() > count && Reflect.get(window, 'fixture').epoch.snapshot().synchronized, beforeRefresh, { timeout: 5000 })
    expect(await locate({ base64: 'b3V0c2lkZQ==', byteLength: 7, label: 'outside' })).toBe('applied')
    expect(await page.locator('.redis-collection-table').getAttribute('data-auto-page')).toBe('false')
    hold = true
    const paging = locate({ base64: 'cGFnaW5n', byteLength: 6, label: 'paging' })
    await expect.poll(() => held, { timeout: 5000 }).toBeDefined()
    const beforeWheel = await page.evaluate(() => Reflect.get(window, 'fixture').epoch.snapshot().revision)
    await page.locator('.redis-collection-table').hover(); await page.mouse.wheel(0, 60)
    expect(await paging).toBe('unknown')
    await page.waitForFunction(revision => { const state = Reflect.get(window, 'fixture').epoch.snapshot(); return state.revision > revision && state.synchronized }, beforeWheel, { timeout: 5000 })
    expect(await page.locator('.redis-collection-table').getAttribute('data-auto-page')).toBe('true')
    if (held !== undefined) await page.evaluate((message: UiChannelMessage) => Reflect.get(window, 'fixture').push(message), held)
    await page.evaluate(() => Reflect.get(window, 'fixture').setHasMore(false))
    hold = false; held = undefined
    await page.evaluate(() => Reflect.get(window, 'fixture').delay())
    const delayed = locate({ base64: 'bGF0ZQ==', byteLength: 4, label: 'late' })
    await page.waitForFunction(() => Reflect.get(window, 'fixture').reading(), undefined, { timeout: 5000 })
    await page.getByRole('button', { name: 'set.pattern' }).click()
    await page.locator('input[name="setPattern"]').fill('old*')
    await page.locator('.redis-collection-controls button[type="submit"]').click()
    expect(await delayed).toBe('stale')
    await page.evaluate(() => Reflect.get(window, 'fixture').release())
    await expect.poll(() => coordinator.selectionRevision('a'), { timeout: 5000 }).not.toBeNull()
    expect(await page.locator('[data-row-identity="bGF0ZQ=="]').count()).toBe(0)
    hold = true
    const hidden = locate({ base64: 'AP8=', byteLength: 2, label: 'binary' })
    await expect.poll(() => held, { timeout: 5000 }).toBeDefined()
    await page.evaluate(() => Reflect.get(window, 'fixture').hide())
    expect(await hidden).toBe('unknown')
    if (held !== undefined) await page.evaluate((message: UiChannelMessage) => Reflect.get(window, 'fixture').push(message), held)
    expect(coordinator.selectionRevision('a')).toBeNull()
    await page.evaluate(() => Reflect.get(window, 'fixture').abort.abort())
  } finally { hostAbort.abort(); ended = true; notify(); await pump; await browser.close(); connections.dispose(); await ctx.fiber.dispose() }
}, 30000)
