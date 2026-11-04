import { existsSync } from 'node:fs'
import { build } from 'esbuild'
import { chromium } from 'playwright-core'
import { expect, it } from 'vitest'

const browserPath = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/chromium', '/usr/bin/chromium-browser'].find(path => existsSync(path))

it.skipIf(browserPath === undefined)('confirms the requested collection read only after its result renders', async () => {
  if (browserPath === undefined) throw new Error('Missing browser')
  const source = `
    import React from 'react'
    import { createRoot } from 'react-dom/client'
    import { useCollectionScan } from './src/client/use-collection-scan.ts'
    const target = { id: 'fixture', generation: 1, db: 0 }
    let calls = 0, release, controller, outcome = null
    const page = value => ({ state: 'page', error: null, cursor: null, sampledAt: '2026-01-01T00:00:00Z', value })
    function View() {
      const read = useCollectionScan({ target, keyBase64: 'aw==', empty: () => ({ limited: false }), append: previous => previous,
        load: async () => { calls++; return calls === 1 ? { ok: true, value: page('old') } : await new Promise(resolve => { release = value => resolve({ ok: true, value: page(value) }) }) } })
      window.fixture = { start: () => { controller = new AbortController(); outcome = null; void read.refreshOnce(controller.signal).then(value => { outcome = value }) }, cancel: () => controller.abort(), release: value => release(value), outcome: () => outcome, calls: () => calls }
      return <div data-value={read.result?.value ?? ''} data-busy={read.busy}>content</div>
    }
    createRoot(document.getElementById('root')).render(<View />)
  `
  const built = await build({ stdin: { contents: source, resolveDir: process.cwd(), loader: 'jsx', sourcefile: 'collection-confirmation-harness.jsx' }, bundle: true, platform: 'browser', format: 'iife', jsx: 'automatic', write: false })
  const browser = await chromium.launch({ executablePath: browserPath, headless: true })
  try {
    const page = await browser.newPage()
    page.setDefaultTimeout(5000)
    await page.setContent('<!doctype html><html><body><div id="root"></div></body></html>')
    await page.addScriptTag({ content: built.outputFiles[0]!.text })
    await page.waitForSelector('[data-value="old"][data-busy="false"]')
    await page.evaluate(() => Reflect.get(window, 'fixture').start())
    await page.waitForSelector('[data-value="old"][data-busy="true"]')
    expect(await page.evaluate(() => Reflect.get(window, 'fixture').outcome())).toBeNull()
    await page.evaluate(() => Reflect.get(window, 'fixture').release('new'))
    await page.waitForFunction(() => Reflect.get(window, 'fixture').outcome() === 'applied')
    expect(await page.locator('[data-value]').getAttribute('data-value')).toBe('new')
    await page.evaluate(() => Reflect.get(window, 'fixture').start())
    await page.waitForSelector('[data-value="new"][data-busy="true"]')
    await page.evaluate(() => Reflect.get(window, 'fixture').cancel())
    await page.waitForFunction(() => Reflect.get(window, 'fixture').outcome() === 'stale')
    await page.evaluate(() => Reflect.get(window, 'fixture').release('late'))
    expect(await page.locator('[data-value]').getAttribute('data-value')).toBe('new')
  } finally { await browser.close() }
}, 15000)
