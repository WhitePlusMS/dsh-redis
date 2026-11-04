import { existsSync } from 'node:fs'
import { build } from 'esbuild'
import { chromium } from 'playwright-core'
import { expect, it } from 'vitest'

const browserPath = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/chromium', '/usr/bin/chromium-browser'].find(path => existsSync(path))

it.skipIf(browserPath === undefined).each(['json', 'invalid', 'partial', 'hidden', 'manual', 'selection', 'rollback', 'rollback-manual'] as const)('confirms preview format or rejects stale input: %s', async mode => {
  if (browserPath === undefined) throw new Error('Missing browser')
  const source = `
    import React from 'react'
    import { createRoot } from 'react-dom/client'
    import { BytePreview } from './src/client/BytePreview.tsx'
    import { PreviewFormats, useBrowsingFormat } from './src/client/PreviewFormats.tsx'
    import { FormatActionContext } from './src/client/FormatActionContext.ts'
    import { SelectionEpochContext } from './src/client/SelectionEpochContext.ts'
    import { RefreshVisibility } from './src/client/AutoRefresh.tsx'
    import { SelectionEpoch } from './src/client/selection-epoch.ts'
    import { UiPanePresence } from './src/client/ui-pane-presence.ts'
    import { consumeUiActions } from './src/client/ui-actions.ts'
    const mode = ${JSON.stringify(mode)}, target = { id: 'fixture', generation: 1, db: 0 }
    const epoch = new SelectionEpoch(), panes = new UiPanePresence(), abort = new AbortController(), tab = new AbortController(), queue = [], frames = []
    let wake, ended = false, releaseAction, deferred = false
    const notify = () => { const fn = wake; wake = undefined; fn?.() }
    const stream = { send: input => frames.push(input), end: () => {}, dispose: () => { ended = true; notify() }, async *[Symbol.asyncIterator]() { while (!ended) { const value = queue.shift(); if (value) { yield value; continue } await new Promise(resolve => { wake = resolve; if (ended || queue.length) notify() }) } } }
    const raw = mode === 'invalid' ? 'not-json' : '{"n":123}'
    const value = { base64: btoa(raw), prefix: '', suffix: '', offset: '0', complete: mode !== 'partial' }
    function View() {
      const [format, setFormat, actionFormat] = useBrowsingFormat('string')
      window.formatRace = manual => { const rollback = actionFormat('json', () => true); if (manual) setFormat('hex'); rollback() }
      const change = (next, current) => {
        if (mode !== 'manual' && mode !== 'selection') return actionFormat(next, current)
        let rollback = () => {}, cancelled = false
        deferred = true
        releaseAction = () => { if (!cancelled) rollback = actionFormat(next, current) }
        return () => { cancelled = true; rollback() }
      }
      return <div style={{ display: mode === 'hidden' ? 'none' : 'block' }}><BytePreview value={value} t={text => text} format={format} onFormatChange={setFormat} onActionFormatChange={change} actionTarget /></div>
    }
    panes.attach('a')
    const action = { register: handler => panes.registerFormatHandler('a', handler), target, keyBase64: 'aw==' }
    createRoot(document.getElementById('root')).render(<SelectionEpochContext.Provider value={epoch}><RefreshVisibility.Provider value={{ visible: true, signal: tab.signal }}><FormatActionContext.Provider value={action}><PreviewFormats><View /></PreviewFormats></FormatActionContext.Provider></RefreshVisibility.Provider></SelectionEpochContext.Provider>)
    void consumeUiActions(async () => stream, abort.signal, (request, signal) => request.action.kind === 'setFormat' ? panes.setFormat('a', request, signal) : Promise.resolve('stale'), epoch)
    setTimeout(() => epoch.synchronize(epoch.snapshot().revision), 0)
    window.fixture = { epoch, frames, target, abort, deferred: () => deferred, release: () => releaseAction(), push: frame => { queue.push(frame); notify() } }
  `
  const built = await build({ stdin: { contents: source, resolveDir: process.cwd(), loader: 'jsx', sourcefile: 'format-action-harness.jsx' }, bundle: true, platform: 'browser', format: 'iife', jsx: 'automatic', write: false })
  const browser = await chromium.launch({ executablePath: browserPath, headless: true })
  try {
    const page = await browser.newPage()
    page.setDefaultTimeout(5000)
    await page.setContent('<!doctype html><html><body><div id="root"></div></body></html>')
    await page.addScriptTag({ content: built.outputFiles[0]!.text })
    await page.waitForFunction(() => Reflect.get(window, 'fixture').epoch.snapshot().synchronized)
    await page.waitForSelector('select[name="valueFormat"]', { state: 'attached' })
    if (mode === 'rollback' || mode === 'rollback-manual') {
      await page.evaluate(manual => Reflect.get(window, 'formatRace')(manual), mode === 'rollback-manual')
      await expect.poll(() => page.locator('select[name="valueFormat"]').inputValue()).toBe(mode === 'rollback-manual' ? 'hex' : 'text')
      await page.evaluate(() => Reflect.get(window, 'fixture').abort.abort())
      return
    }
    await page.evaluate(() => { const f = Reflect.get(window, 'fixture'); f.push({ kind: 'action', request: { requestId: '12345678-1234-1234-1234-123456789abc', target: f.target, selectionRevision: f.epoch.snapshot().revision, expiresAt: Date.now() + 10000, action: { kind: 'setFormat', keyBase64: 'aw==', format: 'json' } } }) })
    if (mode === 'manual' || mode === 'selection') {
      await page.waitForFunction(() => Reflect.get(window, 'fixture').deferred())
      if (mode === 'manual') await page.locator('select[name="valueFormat"]').selectOption('hex')
      else await page.evaluate(() => Reflect.get(window, 'fixture').epoch.invalidate())
      await page.evaluate(() => Reflect.get(window, 'fixture').release())
    }
    const expected = mode === 'json' ? 'applied' : mode === 'invalid' || mode === 'partial' ? 'failed' : 'stale'
    await page.waitForFunction(outcome => Reflect.get(window, 'fixture').frames.some((frame: { outcome?: string }) => frame.outcome === outcome), expected)
    if (mode === 'json') { expect(await page.locator('select[name="valueFormat"]').inputValue()).toBe('json'); expect(await page.locator('[data-value-preview]').textContent()).toContain('"n": 123') }
    if (mode === 'manual') expect(await page.locator('select[name="valueFormat"]').inputValue()).toBe('hex')
    if (mode === 'selection') expect(await page.locator('select[name="valueFormat"]').inputValue()).toBe('text')
    await page.evaluate(() => Reflect.get(window, 'fixture').abort.abort())
  } finally { await browser.close() }
}, 15000)
