import { existsSync } from 'node:fs'
import { build } from 'esbuild'
import { chromium } from 'playwright-core'
import { expect, it } from 'vitest'

const browserPath = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome',
].find(path => existsSync(path))

it.skipIf(browserPath === undefined)('keeps unscanned targets separate and never lets a delayed commit overwrite a manual choice', async () => {
  if (browserPath === undefined) throw new Error('Missing browser')
  const source = `
    import React from 'react'
    import { createRoot } from 'react-dom/client'
    import { KeyBrowser } from './src/client/KeyBrowser.tsx'
    import { PreviewFormats } from './src/client/PreviewFormats.tsx'
    import { installRedisStyles } from './src/client/styles.ts'
    import { SelectionEpoch } from './src/client/selection-epoch.ts'
    import { SelectionEpochContext } from './src/client/SelectionEpochContext.ts'
    import { RefreshVisibility } from './src/client/AutoRefresh.tsx'
    import { UiPanePresence } from './src/client/ui-pane-presence.ts'
    import { consumeUiActions } from './src/client/ui-actions.ts'
    const epoch = new SelectionEpoch(), panes = new UiPanePresence(), frames = [], publications = [], queue = []
    const abort = new AbortController(), tab = new AbortController(), target = { id: 'fixture', generation: 1, db: 0 }
    let wake, ended = false
    const notify = () => { const fn = wake; wake = undefined; fn?.() }
    const stream = {
      send: input => frames.push(input), end: () => {}, dispose: () => { ended = true; notify() },
      async *[Symbol.asyncIterator]() { while (!ended) { const value = queue.shift(); if (value) { yield value; continue } await new Promise(resolve => { wake = resolve; if (ended || queue.length) notify() }) } },
    }
    const id = '12345678-1234-1234-1234-123456789abc'
    const key = { base64: 'bG9jYXRlZA==', byteLength: 7, label: '"located"' }
    const old = { base64: 'b2xk', byteLength: 3, label: '"old"' }
    const nested = { base64: 'Zm9sZGVyOm9uZQ==', byteLength: 10, label: '"folder:one"' }
    const sibling = { base64: 'Zm9sZGVyOnR3bw==', byteLength: 10, label: '"folder:two"' }
    const props = {
      t: key => key,
      connection: { ...target, state: 'connected', target: { host: 'fixture', port: 6379 } },
      configure: () => {}, acceptConnection: () => {}, registerKeyHandler: handler => panes.registerKeyHandler('a', handler), registerRefreshHandler: handler => panes.registerRefreshHandler('a', handler), registerHashHandler: handler => panes.registerHashHandler('a', handler), readActionPoint: async () => ({ ok: false }),
      setSelection: async request => { publications.push(request); return { ok: true, value: { accepted: true } } },
      readDatabases: async () => ({ ok: false }),
      scanKeys: async () => ({ ok: true, value: { state: 'page', error: null, keys: [old, nested, sibling], cursor: null, sampledAt: '1970-01-01T00:00:00.000Z' } }),
      readString: async () => ({ ok: true, value: { state: 'unsupported', error: null, metadata: { type: 'hash', ttlMs: '-1', length: null }, offset: '0', base64: '', byteLength: 0, prefix: '', suffix: '', complete: false, nextOffset: null, sampledAt: '1970-01-01T00:00:00.000Z' } }),
      scanHash: async () => ({ ok: true, value: { state: 'page', error: null, metadata: { type: 'hash', ttlMs: '-1', length: '1' }, entries: [{ field: { base64: 'ZmllbGQ=', byteLength: 5, label: '"field"' }, value: { base64: 'dmFsdWU=', byteLength: 5, fullByteLength: 5, suffix: '' } }], cursor: null, sampledAt: '1970-01-01T00:00:00.000Z' } }),
    }
    installRedisStyles()
    panes.attach('a')
    createRoot(document.getElementById('root')).render(<section className="dsh-redis" style={{ height: 600 }}><div className="redis-connection"><SelectionEpochContext.Provider value={epoch}><RefreshVisibility.Provider value={{ visible: true, signal: tab.signal }}><PreviewFormats><KeyBrowser {...props} /></PreviewFormats></RefreshVisibility.Provider></SelectionEpochContext.Provider></div></section>)
    void consumeUiActions(async () => stream, abort.signal, (request, signal) => request.action.kind === 'selectKey' ? panes.selectKey('a', request, signal) : Promise.resolve('applied'), epoch)
    window.fixture = { epoch, frames, publications, abort, push: frame => { queue.push(frame); notify() }, target, id, key, nested }
  `
  const built = await build({ stdin: { contents: source, resolveDir: process.cwd(), loader: 'jsx', sourcefile: 'key-locate-harness.jsx' }, bundle: true, platform: 'browser', format: 'iife', jsx: 'automatic', write: false })
  const browser = await chromium.launch({ executablePath: browserPath, headless: true })
  try {
    const page = await browser.newPage()
    page.setDefaultTimeout(5000)
    page.on('pageerror', error => { console.error('Key locate fixture:', error.message) })
    await page.setContent('<!doctype html><html><body><div id="root"></div></body></html>')
    await page.addScriptTag({ content: built.outputFiles[0]!.text })
    await page.waitForFunction(() => Reflect.get(window, 'fixture').epoch.snapshot().synchronized, undefined, { timeout: 5000 })
    await page.waitForSelector('[data-key-load-phase="complete"]', { timeout: 5000 })
    await page.locator('[data-key-base64="b2xk"]').click()
    await page.locator('.redis-key-view:visible [data-row-identity="ZmllbGQ="]').click({ timeout: 5000 })
    await page.waitForFunction(() => Reflect.get(window, 'fixture').epoch.snapshot().synchronized, undefined, { timeout: 5000 })
    await page.getByRole('tab', { name: 'ui.metadata' }).click()
    await page.waitForFunction(() => Reflect.get(window, 'fixture').epoch.snapshot().synchronized, undefined, { timeout: 5000 })
    await page.evaluate(() => { Reflect.set(window, 'oldView', document.querySelector('.redis-key-view:not([hidden])')) })
    await page.getByRole('button', { name: 'content.focus' }).click()
    expect(await page.locator('.redis-keys').getAttribute('data-focused')).toBe('true')
    expect(await page.locator('.redis-key-catalog').isVisible()).toBe(false)
    await page.waitForFunction(() => Reflect.get(window, 'fixture').epoch.snapshot().synchronized, undefined, { timeout: 5000 })
    await page.evaluate(() => {
      const f = Reflect.get(window, 'fixture'), revision = f.epoch.snapshot().revision
      f.push({ kind: 'action', request: { requestId: f.id, target: f.target, selectionRevision: revision, expiresAt: Date.now() + 10000, action: { kind: 'selectKey', key: f.key } } })
    })
    await page.waitForFunction(() => Reflect.get(window, 'fixture').frames.some((frame: { kind?: string }) => frame.kind === 'commitSelection'), undefined, { timeout: 5000 })
    expect(await page.locator('.redis-keys').getAttribute('data-focused')).toBe('false')
    expect(await page.locator('[data-located-key="bG9jYXRlZA=="]').isVisible()).toBe(true)
    expect(await page.locator('[data-located-key="bG9jYXRlZA=="]').count()).toBe(1)
    expect(await page.locator('[data-loaded-keys]').textContent()).toBe('3')
    expect(await page.evaluate(() => Reflect.get(window, 'fixture').epoch.snapshot().synchronized)).toBe(false)
    await page.evaluate(() => { const f = Reflect.get(window, 'fixture'); f.push({ kind: 'selectionResult', requestId: f.id, accepted: false }) })
    await page.waitForFunction(() => Reflect.get(window, 'fixture').epoch.snapshot().synchronized, undefined, { timeout: 5000 })
    expect(await page.evaluate(() => Reflect.get(window, 'oldView') === document.querySelector('.redis-key-view:not([hidden])'))).toBe(true)
    expect(await page.locator('.redis-key-view:not([hidden]) [data-row-identity="ZmllbGQ="]').getAttribute('aria-selected')).toBe('true')
    expect(await page.locator('.redis-keys').getAttribute('data-focused')).toBe('true')
    expect(await page.getByRole('tab', { name: 'ui.metadata' }).getAttribute('aria-selected')).toBe('true')
    expect(await page.evaluate(() => Reflect.get(window, 'fixture').publications.at(-1).selection)).toEqual({ keyBase64: 'b2xk', item: { kind: 'hash', fieldBase64: 'ZmllbGQ=' } })
    await page.evaluate(() => {
      const f = Reflect.get(window, 'fixture'); f.id = '12345678-1234-1234-1234-123456789abd'
      f.push({ kind: 'action', request: { requestId: f.id, target: f.target, selectionRevision: f.epoch.snapshot().revision, expiresAt: Date.now() + 10000, action: { kind: 'selectKey', key: f.key } } })
    })
    await page.waitForFunction(() => Reflect.get(window, 'fixture').frames.filter((frame: { kind?: string }) => frame.kind === 'commitSelection').length === 2, undefined, { timeout: 5000 })
    await page.locator('.redis-key-view:visible [data-row-identity="ZmllbGQ="]').waitFor({ timeout: 5000 })
    expect(await page.locator('[data-pending-key-content="true"]').evaluate(element => (element as HTMLElement).inert)).toBe(true)
    expect(await page.locator('[data-locating-key]').textContent()).toBe('keys.locating')
    await page.evaluate(() => { const f = Reflect.get(window, 'fixture'); f.push({ kind: 'selectionResult', requestId: f.id, accepted: true }) })
    await page.waitForFunction(() => Reflect.get(window, 'fixture').epoch.snapshot().synchronized, undefined, { timeout: 5000 })
    await page.locator('.redis-key-view:visible [data-row-identity="ZmllbGQ="]').click({ timeout: 5000 })
    await page.waitForFunction(() => Reflect.get(window, 'fixture').publications.some((value: { selection: { keyBase64: string; item: { fieldBase64?: string } | null } | null }) => value.selection?.keyBase64 === 'bG9jYXRlZA==' && value.selection.item?.fieldBase64 === 'ZmllbGQ='), undefined, { timeout: 5000 })
    expect(await page.locator('.redis-key-view:visible [data-row-identity="ZmllbGQ="]').getAttribute('aria-selected')).toBe('true')
    await page.waitForFunction(() => Reflect.get(window, 'fixture').epoch.snapshot().synchronized, undefined, { timeout: 5000 })
    await page.evaluate(() => {
      const f = Reflect.get(window, 'fixture'); f.id = '12345678-1234-1234-1234-123456789abe'
      f.push({ kind: 'action', request: { requestId: f.id, target: f.target, selectionRevision: f.epoch.snapshot().revision, expiresAt: Date.now() + 10000, action: { kind: 'selectKey', key: f.key } } })
    })
    await page.waitForFunction(() => Reflect.get(window, 'fixture').frames.filter((frame: { kind?: string }) => frame.kind === 'commitSelection').length === 3, undefined, { timeout: 5000 })
    await page.locator('.redis-key-view:visible [data-row-identity="ZmllbGQ="]').waitFor({ timeout: 5000 })
    expect(await page.locator('.redis-key-view:visible [data-row-identity="ZmllbGQ="]').getAttribute('aria-selected')).toBe('false')
    await page.locator('[data-key-base64="b2xk"]').click()
    await page.evaluate(() => { const f = Reflect.get(window, 'fixture'); f.push({ kind: 'selectionResult', requestId: f.id, accepted: true }) })
    await page.waitForFunction(() => Reflect.get(window, 'fixture').publications.some((value: { selection: { keyBase64: string } | null }) => value.selection?.keyBase64 === 'b2xk'), undefined, { timeout: 5000 })
    expect(await page.locator('[data-key-base64="b2xk"]').getAttribute('aria-selected')).toBe('true')
    expect(await page.locator('[data-located-key]').count()).toBe(0)
    await page.locator('.redis-key-view:visible [data-row-identity="ZmllbGQ="]').click({ timeout: 5000 })
    await page.waitForFunction(() => Reflect.get(window, 'fixture').epoch.snapshot().synchronized, undefined, { timeout: 5000 })
    await page.evaluate(() => { Reflect.set(window, 'cancelOldView', document.querySelector('.redis-key-view:not([hidden])')) })
    await page.evaluate(() => {
      const f = Reflect.get(window, 'fixture'); f.id = '12345678-1234-1234-1234-123456789abf'
      f.push({ kind: 'action', request: { requestId: f.id, target: f.target, selectionRevision: f.epoch.snapshot().revision, expiresAt: Date.now() + 10000, action: { kind: 'selectKey', key: f.key } } })
    })
    await page.waitForFunction(() => Reflect.get(window, 'fixture').frames.filter((frame: { kind?: string }) => frame.kind === 'commitSelection').length === 4, undefined, { timeout: 5000 })
    await page.evaluate(() => { const f = Reflect.get(window, 'fixture'); f.push({ kind: 'cancel', requestId: f.id }) })
    await page.waitForFunction(() => Reflect.get(window, 'fixture').epoch.snapshot().synchronized, undefined, { timeout: 5000 })
    expect(await page.evaluate(() => Reflect.get(window, 'cancelOldView') === document.querySelector('.redis-key-view:not([hidden])'))).toBe(true)
    expect(await page.locator('.redis-key-view:visible [data-row-identity="ZmllbGQ="]').getAttribute('aria-selected')).toBe('true')
    await page.evaluate(() => { const f = Reflect.get(window, 'fixture'); f.push({ kind: 'selectionResult', requestId: f.id, accepted: true }) })
    expect(await page.locator('[data-key-base64="b2xk"]').getAttribute('aria-selected')).toBe('true')
    await page.evaluate(() => {
      const f = Reflect.get(window, 'fixture'); f.id = '12345678-1234-1234-1234-123456789ac0'
      f.push({ kind: 'action', request: { requestId: f.id, target: f.target, selectionRevision: f.epoch.snapshot().revision, expiresAt: Date.now() + 10000, action: { kind: 'selectKey', key: f.nested } } })
    })
    await page.waitForFunction(() => Reflect.get(window, 'fixture').frames.filter((frame: { kind?: string }) => frame.kind === 'commitSelection').length === 5, undefined, { timeout: 5000 })
    expect(await page.locator('[data-namespace-id]').getAttribute('aria-expanded')).toBe('true')
    expect(await page.locator('[data-key-base64="Zm9sZGVyOm9uZQ=="]').isVisible()).toBe(true)
    expect(await page.locator('[data-key-base64="Zm9sZGVyOm9uZQ=="]').getAttribute('aria-selected')).toBe('true')
    expect(await page.locator('[data-located-key]').count()).toBe(0)
    await page.evaluate(() => { const f = Reflect.get(window, 'fixture'); f.push({ kind: 'selectionResult', requestId: f.id, accepted: true }) })
    await page.waitForFunction(() => Reflect.get(window, 'fixture').epoch.snapshot().synchronized, undefined, { timeout: 5000 })
    await page.evaluate(() => {
      const f = Reflect.get(window, 'fixture'); f.id = '12345678-1234-1234-1234-123456789ac1'
      f.push({ kind: 'action', request: { requestId: f.id, target: f.target, selectionRevision: f.epoch.snapshot().revision, expiresAt: Date.now() + 10000, action: { kind: 'selectKey', key: f.key } } })
    })
    await page.waitForFunction(() => Reflect.get(window, 'fixture').frames.filter((frame: { kind?: string }) => frame.kind === 'commitSelection').length === 6, undefined, { timeout: 5000 })
    expect(await page.locator('[data-pending-key-content="true"]').evaluate(element => (element as HTMLElement).inert)).toBe(true)
    await page.getByRole('button', { name: 'namespace.list' }).click()
    expect(await page.getByRole('button', { name: 'namespace.list' }).getAttribute('aria-pressed')).toBe('true')
    await page.evaluate(() => { const f = Reflect.get(window, 'fixture'); f.push({ kind: 'selectionResult', requestId: f.id, accepted: true }) })
    expect(await page.locator('[data-key-base64="Zm9sZGVyOm9uZQ=="]').getAttribute('aria-selected')).toBe('true')
    await page.getByRole('button', { name: 'content.focus' }).click()
    expect(await page.locator('.redis-keys').getAttribute('data-focused')).toBe('true')
    await page.evaluate(() => Reflect.get(window, 'fixture').abort.abort())
  } finally { await browser.close() }
}, 30000)
