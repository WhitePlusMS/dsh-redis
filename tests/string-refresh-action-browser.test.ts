import { existsSync } from 'node:fs'
import { build } from 'esbuild'
import { chromium } from 'playwright-core'
import { expect, it } from 'vitest'

const browserPath = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/chromium', '/usr/bin/chromium-browser'].find(path => existsSync(path))

it.skipIf(browserPath === undefined)('confirms only the rendered String refresh and preserves a newer manual read', async () => {
  if (browserPath === undefined) throw new Error('Missing browser')
  const source = `
    import React from 'react'
    import { createRoot } from 'react-dom/client'
    import { KeyDetails } from './src/client/KeyDetails.tsx'
    import { KeyPresentation } from './src/client/KeyPresentation.tsx'
    import { PreviewFormats } from './src/client/PreviewFormats.tsx'
    import { CurrentSelection } from './src/client/CurrentSelection.tsx'
    import { KeyAutoRefresh, RefreshVisibility } from './src/client/AutoRefresh.tsx'
    import { SelectionEpochContext, useSelectionRevision } from './src/client/SelectionEpochContext.ts'
    import { SelectionEpoch } from './src/client/selection-epoch.ts'
    import { UiPanePresence } from './src/client/ui-pane-presence.ts'
    import { consumeUiActions } from './src/client/ui-actions.ts'
    const epoch = new SelectionEpoch(), panes = new UiPanePresence(), abort = new AbortController(), tab = new AbortController()
    const target = { id: 'fixture', generation: 1, db: 0 }, frames = [], queue = [], pending = []
    let wake, ended = false, reads = 0
    const notify = () => { const fn = wake; wake = undefined; fn?.() }
    const stream = { send: input => { frames.push(input); if (input.kind === 'publishSelection') { queue.push({ kind: 'selectionResult', requestId: input.requestId, accepted: true }); notify() } }, end: () => {}, dispose: () => { ended = true; notify() }, async *[Symbol.asyncIterator]() { while (!ended) { const value = queue.shift(); if (value) { yield value; continue } await new Promise(resolve => { wake = resolve; if (ended || queue.length) notify() }) } } }
    const key = { base64: 'aw==', byteLength: 1, label: 'k' }
    const value = text => ({ state: 'value', error: null, metadata: { type: 'string', ttlMs: '-1', length: String(text.length) }, offset: '0', base64: btoa(text), byteLength: text.length, prefix: '', suffix: '', complete: true, nextOffset: null, sampledAt: '2026-01-01T00:00:00Z' })
    const props = { target, selected: key, t: text => text, readString: async () => { reads++; return reads === 1 ? { ok: true, value: value('old') } : await new Promise(resolve => pending.push(text => resolve({ ok: true, value: value(text) }))) } }
    const publish = (request, signal) => epoch.publish(request, epoch.snapshot().revision, signal)
    function Holder() { const revision = useSelectionRevision(); return <CurrentSelection target={target} keyBase64={key.base64} revision={revision} suspended={false} publish={publish}><KeyPresentation><KeyAutoRefresh action={{ register: handler => panes.registerRefreshHandler('a', handler), target, keyBase64: key.base64 }}><KeyDetails {...props} /></KeyAutoRefresh></KeyPresentation></CurrentSelection> }
    panes.attach('a')
    createRoot(document.getElementById('root')).render(<SelectionEpochContext.Provider value={epoch}><RefreshVisibility.Provider value={{ visible: true, signal: tab.signal }}><PreviewFormats><Holder /></PreviewFormats></RefreshVisibility.Provider></SelectionEpochContext.Provider>)
    void consumeUiActions(async () => stream, abort.signal, (request, signal) => request.action.kind === 'refresh' ? panes.refresh('a', request, signal) : Promise.resolve('stale'), epoch)
    window.fixture = { epoch, frames, target, abort, reads: () => reads, release: (index, text) => pending[index](text), push: frame => { queue.push(frame); notify() } }
  `
  const built = await build({ stdin: { contents: source, resolveDir: process.cwd(), loader: 'jsx', sourcefile: 'string-refresh-harness.jsx' }, bundle: true, platform: 'browser', format: 'iife', jsx: 'automatic', write: false })
  const browser = await chromium.launch({ executablePath: browserPath, headless: true })
  try {
    const page = await browser.newPage()
    page.setDefaultTimeout(5000)
    await page.setContent('<!doctype html><html><body><div id="root"></div></body></html>')
    await page.evaluate(() => { let sequence = 0; Object.defineProperty(crypto, 'randomUUID', { value: () => `12345678-1234-1234-1234-${String(++sequence).padStart(12, '0')}` }) })
    await page.addScriptTag({ content: built.outputFiles[0]!.text })
    await page.waitForFunction(() => Reflect.get(window, 'fixture').epoch.snapshot().synchronized)
    await expect.poll(() => page.locator('[data-value-preview]').textContent()).toContain('old')
    const send = async (id: string) => page.evaluate(value => { const f = Reflect.get(window, 'fixture'); f.push({ kind: 'action', request: { requestId: value, target: null, selectionRevision: f.epoch.snapshot().revision, expiresAt: Date.now() + 10000, action: { kind: 'refresh', target: f.target, keyBase64: 'aw==' } } }) }, id)
    await send('12345678-1234-1234-1234-123456789abc')
    await expect.poll(() => page.evaluate(() => Reflect.get(window, 'fixture').reads())).toBe(2)
    expect(await page.evaluate(() => Reflect.get(window, 'fixture').frames.some((frame: { outcome?: string }) => frame.outcome === 'applied'))).toBe(false)
    await page.evaluate(() => Reflect.get(window, 'fixture').release(0, 'new'))
    await page.waitForFunction(() => Reflect.get(window, 'fixture').frames.some((frame: { outcome?: string }) => frame.outcome === 'applied'))
    expect(await page.locator('[data-value-preview]').textContent()).toContain('new')
    await send('12345678-1234-1234-1234-123456789abd')
    await expect.poll(() => page.evaluate(() => Reflect.get(window, 'fixture').reads())).toBe(3)
    await page.evaluate(() => Reflect.get(window, 'fixture').epoch.invalidate())
    await page.getByRole('button', { name: 'value.refresh' }).waitFor({ state: 'visible' })
    await expect.poll(() => page.getByRole('button', { name: 'value.refresh' }).isEnabled()).toBe(true)
    await page.getByRole('button', { name: 'value.refresh' }).click()
    await expect.poll(() => page.evaluate(() => Reflect.get(window, 'fixture').reads())).toBe(4)
    await page.evaluate(() => { const f = Reflect.get(window, 'fixture'); f.release(2, 'manual'); f.release(1, 'late') })
    await expect.poll(() => page.locator('[data-value-preview]').textContent()).toContain('manual')
    expect(await page.evaluate(() => Reflect.get(window, 'fixture').frames.some((frame: { requestId?: string; outcome?: string }) => frame.requestId === '12345678-1234-1234-1234-123456789abd' && frame.outcome === 'applied'))).toBe(false)
    await page.evaluate(() => Reflect.get(window, 'fixture').abort.abort())
  } finally { await browser.close() }
}, 15000)
