import { existsSync } from 'node:fs'
import { build } from 'esbuild'
import { chromium } from 'playwright-core'
import { expect, it } from 'vitest'

const browserPath = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/chromium'].find(path => existsSync(path))

it.skipIf(browserPath === undefined)('locates a List position without losing a manual click or publishing a late action', async () => {
  if (browserPath === undefined) throw new Error('Missing browser')
  const source = `
    import React from 'react'
    import { createRoot } from 'react-dom/client'
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
    const epoch = new SelectionEpoch(), panes = new UiPanePresence(), frames = [], publications = [], queue = [], actions = new Map()
    const abort = new AbortController(), tab = new AbortController(), target = { id: 'fixture', generation: 1, db: 0 }
    let wake, ended = false, delayed = false, releaseRead, readStarted = false, pages = 0
    const notify = () => { const next = wake; wake = undefined; next?.() }
    const stream = { send: frame => frames.push(frame), end: () => {}, dispose: () => { ended = true; notify() }, async *[Symbol.asyncIterator]() { while (!ended) { const value = queue.shift(); if (value) { yield value; continue } await new Promise(resolve => { wake = resolve; if (ended || queue.length) notify() }) } } }
    const key = { base64: 'bGlzdA==', byteLength: 4, label: 'list' }, value = { base64: 'dg==', byteLength: 1, fullByteLength: 1, suffix: '' }
    const entries = Array.from({ length: 30 }, (_, i) => ({ index: String(i), value }))
    const props = { target, selected: key, t: key => key, registerListHandler: handler => panes.registerListHandler('a', handler),
      readList: async request => {
        if (request.count === 1 && delayed) { readStarted = true; await new Promise(resolve => { releaseRead = resolve }) }
        const point = request.count === 1
        if (!point) pages++
        return { ok: true, value: { state: 'page', error: null, metadata: { type: 'list', ttlMs: '-1', length: '500' }, entries: point ? request.offset === '499' ? [] : [{ index: request.offset, value }] : entries, offset: request.offset, nextOffset: point ? null : request.offset === '0' ? '30' : null, sampledAt: '1970-01-01T00:00:00.000Z' } }
      },
      readActionPoint: async request => { const index = actions.get(request.requestId); if (index === undefined) throw new Error('Missing fixture action'); const response = await props.readList({ offset: index, count: 1 }); const cell = response.value.entries[0]?.value ?? null; return { ok: true, value: { state: cell === null ? 'selection-missing' : 'value', error: null, cell, sampledAt: response.value.sampledAt } } } }
    function Holder() { const revision = useSelectionRevision(); return <CurrentSelection target={target} keyBase64={key.base64} revision={revision} suspended={false} publish={async request => { publications.push(request); return { ok: true, value: { accepted: true } } }}><KeyPresentation><KeyAutoRefresh><div className="redis-key-view"><div className="redis-inspector" data-view="data"><ListView {...props} /></div></div></KeyAutoRefresh></KeyPresentation></CurrentSelection> }
    installRedisStyles(); panes.attach('a')
    createRoot(document.getElementById('root')).render(<section className="dsh-redis" style={{ height: 600 }}><div className="redis-connection"><SelectionEpochContext.Provider value={epoch}><RefreshVisibility.Provider value={{ visible: true, signal: tab.signal }}><PreviewFormats><Holder /></PreviewFormats></RefreshVisibility.Provider></SelectionEpochContext.Provider></div></section>)
    void consumeUiActions(async () => stream, abort.signal, (request, signal) => request.action.kind === 'selectListIndex' ? panes.selectListIndex('a', request, signal) : Promise.resolve('stale'), epoch)
    window.fixture = { epoch, frames, publications, abort, target, pages: () => pages, delay: () => { delayed = true; readStarted = false }, reading: () => readStarted, release: () => { delayed = false; releaseRead?.() }, push: frame => { queue.push(frame); notify() }, action: (id, index) => { actions.set(id, index); queue.push({ kind: 'action', request: { requestId: id, target, selectionRevision: epoch.snapshot().revision, expiresAt: Date.now() + 10000, action: { kind: 'selectListIndex', keyBase64: key.base64, index } } }); notify() } }
  `
  const built = await build({ stdin: { contents: source, resolveDir: process.cwd(), loader: 'jsx', sourcefile: 'list-locate-harness.jsx' }, bundle: true, platform: 'browser', format: 'iife', jsx: 'automatic', write: false })
  const browser = await chromium.launch({ executablePath: browserPath, headless: true, ignoreDefaultArgs: ['--hide-scrollbars'] })
  try {
    const page = await browser.newPage()
    page.on('pageerror', error => { console.error('List locate fixture:', error.message) })
    await page.setContent('<!doctype html><html><body><div id="root"></div></body></html>')
    await page.addScriptTag({ content: built.outputFiles[0]!.text })
    await page.locator('[data-row-identity="1"]').click({ timeout: 5000 })
    await page.waitForFunction(() => Reflect.get(window, 'fixture').epoch.snapshot().synchronized, undefined, { timeout: 5000 })
    const originalPages = await page.evaluate(() => Reflect.get(window, 'fixture').pages())
    const id = '12345678-1234-1234-1234-123456789ab0'
    await page.evaluate(value => Reflect.get(window, 'fixture').action(value, '200'), id)
    await page.waitForFunction(() => Reflect.get(window, 'fixture').frames.some((frame: { kind?: string }) => frame.kind === 'commitSelection'), undefined, { timeout: 5000 })
    expect(await page.locator('[data-row-identity="200"]').getAttribute('aria-selected')).toBe('true')
    expect(await page.locator('[data-list-count]').textContent()).toBe('30')
    expect(await page.evaluate(() => Reflect.get(window, 'fixture').pages())).toBe(originalPages)
    await page.evaluate(value => Reflect.get(window, 'fixture').push({ kind: 'selectionResult', requestId: value, accepted: true }), id)
    await page.waitForFunction(() => Reflect.get(window, 'fixture').epoch.snapshot().synchronized && Reflect.get(window, 'fixture').publications.at(-1)?.selection?.item?.index === '200', undefined, { timeout: 5000 })
    expect(await page.locator('.redis-collection-table').getAttribute('data-auto-page')).toBe('false')

    const scrolled = '12345678-1234-1234-1234-123456789ab3'
    await page.evaluate(value => Reflect.get(window, 'fixture').action(value, '203'), scrolled)
    await page.waitForFunction(() => Reflect.get(window, 'fixture').frames.filter((frame: { kind?: string }) => frame.kind === 'commitSelection').length === 2, undefined, { timeout: 5000 })
    const beforeWheel = await page.evaluate(() => Reflect.get(window, 'fixture').epoch.snapshot().revision)
    await page.locator('.redis-collection-table').hover(); await page.mouse.wheel(0, 60)
    await page.waitForFunction(revision => Reflect.get(window, 'fixture').epoch.snapshot().revision > revision && Reflect.get(window, 'fixture').epoch.snapshot().synchronized, beforeWheel, { timeout: 5000 })
    await page.evaluate(value => Reflect.get(window, 'fixture').push({ kind: 'selectionResult', requestId: value, accepted: true }), scrolled)
    expect(await page.evaluate(() => Reflect.get(window, 'fixture').pages())).toBe(originalPages)
    expect(await page.locator('.redis-collection-table').getAttribute('data-auto-page')).toBe('true')
    expect(await page.locator('[data-row-identity="200"]').getAttribute('aria-selected')).toBe('true')

    const competing = '12345678-1234-1234-1234-123456789ab1'
    await page.evaluate(value => Reflect.get(window, 'fixture').action(value, '201'), competing)
    await page.waitForFunction(() => Reflect.get(window, 'fixture').frames.filter((frame: { kind?: string }) => frame.kind === 'commitSelection').length === 3, undefined, { timeout: 5000 })
    const row = page.locator('[data-row-identity="1"]')
    await row.scrollIntoViewIfNeeded()
    const box = await row.boundingBox()
    if (box === null) throw new Error('Missing cached List row')
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down()
    await page.waitForTimeout(50)
    expect((await row.boundingBox())?.y).toBe(box.y)
    await page.mouse.up()
    await page.evaluate(value => Reflect.get(window, 'fixture').push({ kind: 'selectionResult', requestId: value, accepted: true }), competing)
    await page.waitForFunction(() => Reflect.get(window, 'fixture').epoch.snapshot().synchronized && Reflect.get(window, 'fixture').publications.at(-1)?.selection?.item?.index === '1', undefined, { timeout: 5000 })
    expect(await row.getAttribute('aria-selected')).toBe('true')

    const delayed = '12345678-1234-1234-1234-123456789ab2'
    await page.evaluate(value => { const f = Reflect.get(window, 'fixture'); f.delay(); f.action(value, '202') }, delayed)
    await page.waitForFunction(() => Reflect.get(window, 'fixture').reading(), undefined, { timeout: 5000 })
    await page.locator('[data-row-identity="2"]').click()
    await page.evaluate(() => Reflect.get(window, 'fixture').release())
    await page.waitForFunction(() => Reflect.get(window, 'fixture').epoch.snapshot().synchronized && Reflect.get(window, 'fixture').publications.at(-1)?.selection?.item?.index === '2', undefined, { timeout: 5000 })
    expect(await page.evaluate(() => Reflect.get(window, 'fixture').frames.filter((frame: { kind?: string }) => frame.kind === 'commitSelection').length)).toBe(3)
    expect(await page.locator('[data-row-identity="202"]').count()).toBe(0)
  } finally { await browser.close() }
}, 30000)
