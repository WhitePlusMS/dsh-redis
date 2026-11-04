import { existsSync } from 'node:fs'
import { build } from 'esbuild'
import { chromium } from 'playwright-core'
import { expect, it } from 'vitest'

const browserPath = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome',
].find(path => existsSync(path))

it.skipIf(browserPath === undefined)('acknowledges a rendered preset without claiming scan completion and respects newer input', async () => {
  if (browserPath === undefined) throw new Error('Missing browser')
  const source = `
    import React from 'react'
    import { createRoot } from 'react-dom/client'
    import { KeyBrowser } from './src/client/KeyBrowser.tsx'
    import { SelectionEpoch } from './src/client/selection-epoch.ts'
    import { SelectionEpochContext } from './src/client/SelectionEpochContext.ts'
    import { RefreshVisibility } from './src/client/AutoRefresh.tsx'
    import { UiPanePresence } from './src/client/ui-pane-presence.ts'
    const epoch = new SelectionEpoch(), panes = new UiPanePresence(), tab = new AbortController()
    const target = { id: 'fixture', generation: 1, db: 0 }
    let calls = 0, releaseSelection, holdSelection = false
    const props = {
      t: key => key, connection: { ...target, state: 'connected', target: { host: 'fixture', port: 6379 } },
      configure: () => {}, acceptConnection: () => {},
      registerKeyHandler: handler => panes.registerKeyHandler('a', handler),
      registerRefreshHandler: handler => panes.registerRefreshHandler('a', handler),
      registerFormatHandler: handler => panes.registerFormatHandler('a', handler),
      registerMatchHandler: handler => panes.registerMatchHandler('a', handler),
      setSelection: async () => { if (holdSelection) await new Promise(resolve => { releaseSelection = resolve }); return { ok: true, value: { accepted: true } } },
      readDatabases: async () => { calls++; if (calls > 1) await new Promise(() => {}); return { ok: false } },
      scanKeys: async () => ({ ok: true, value: { state: 'page', error: null, keys: [], cursor: null, sampledAt: '1970-01-01T00:00:00.000Z' } }),
    }
    panes.attach('a')
    createRoot(document.getElementById('root')).render(<SelectionEpochContext.Provider value={epoch}><RefreshVisibility.Provider value={{ visible: true, signal: tab.signal }}><KeyBrowser {...props} /></RefreshVisibility.Provider></SelectionEpochContext.Provider>)
    window.fixture = {
      epoch, get calls() { return calls }, get outcome() { return this.result }, result: 'pending',
      hold: () => { holdSelection = true }, release: () => { holdSelection = false; releaseSelection?.() },
      apply(pattern) { this.result = 'pending'; const request = { requestId: '12345678-1234-1234-1234-123456789abc', target: null, selectionRevision: epoch.snapshot().revision, expiresAt: Date.now() + 5000, action: { kind: 'applyMatch', target, pattern } }; panes.applyMatch('a', request, new AbortController().signal).then(result => { this.result = result }) },
    }
  `
  const built = await build({ stdin: { contents: source, resolveDir: process.cwd(), loader: 'jsx', sourcefile: 'match-action-harness.jsx' }, bundle: true, platform: 'browser', format: 'iife', jsx: 'automatic', write: false })
  const browser = await chromium.launch({ executablePath: browserPath, headless: true })
  try {
    const page = await browser.newPage()
    page.setDefaultTimeout(5000)
    await page.setContent('<!doctype html><html><body><div id="root"></div></body></html>')
    await page.addScriptTag({ content: built.outputFiles[0]!.text })
    await page.waitForFunction(() => Reflect.get(window, 'fixture').epoch.snapshot().synchronized)
    await page.waitForSelector('[data-key-load-phase="complete"]')
    await page.evaluate(() => { const f = Reflect.get(window, 'fixture'); f.hold(); f.apply('fixture:order:*') })
    await page.getByText('fixture:order:*').waitFor()
    expect(await page.evaluate(() => Reflect.get(window, 'fixture').outcome)).toBe('pending')
    expect(await page.evaluate(() => Reflect.get(window, 'fixture').calls)).toBe(2)
    await page.evaluate(() => Reflect.get(window, 'fixture').release())
    await page.waitForFunction(() => Reflect.get(window, 'fixture').outcome === 'applied')
    expect(await page.locator('[data-key-load-phase]').getAttribute('data-key-load-phase')).not.toBe('complete')
    await page.evaluate(() => { const f = Reflect.get(window, 'fixture'); f.hold(); f.apply('fixture:second:*') })
    await page.getByText('fixture:second:*').waitFor()
    await page.getByRole('button', { name: 'workbench.filter' }).click()
    await page.locator('input[name="pattern"]').fill('user:*')
    await page.waitForFunction(() => Reflect.get(window, 'fixture').outcome === 'stale')
    await page.evaluate(() => Reflect.get(window, 'fixture').release())
    expect(await page.locator('input[name="pattern"]').inputValue()).toBe('user:*')
  } finally { await browser.close() }
}, 30000)
