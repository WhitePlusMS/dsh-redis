import { existsSync } from 'node:fs'
import { build } from 'esbuild'
import { chromium } from 'playwright-core'
import { expect, it } from 'vitest'

const browserPath = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/chromium'].find(path => existsSync(path))

it.skipIf(browserPath === undefined)('keeps one refresh in flight while cancelling an old target and ignoring its late result', async () => {
  if (browserPath === undefined) throw new Error('Missing browser')
  const source = `
    import React, { useState } from 'react'
    import { createRoot } from 'react-dom/client'
    import { useCollectionScan } from './src/client/use-collection-scan.ts'
    import { KeyAutoRefresh, RefreshVisibility } from './src/client/AutoRefresh.tsx'
    const records = [], visibility = new AbortController()
    function Harness() {
      const [key, setKey] = useState('one')
      const state = useCollectionScan({ target: { id: 'fixture', generation: 1, db: 0 }, keyBase64: key,
        empty: () => ({ limited: false, rows: [] }), append: (cache, page) => ({ ...cache, rows: [...cache.rows, page.label] }),
        load: (cursor, signal) => new Promise(resolve => { records.push({ key, cursor, signal, release: label => resolve({ ok: true, value: { state: 'page', error: null, cursor: null, sampledAt: '1970-01-01T00:00:00Z', label } }) }) }) })
      window.fixture = { records, scan: state.scan, select: setKey }
      return <div data-result={state.cache.rows.join(',')} data-busy={state.busy} />
    }
    createRoot(document.getElementById('root')).render(<RefreshVisibility.Provider value={{ visible: true, signal: visibility.signal }}><KeyAutoRefresh><Harness /></KeyAutoRefresh></RefreshVisibility.Provider>)
  `
  const built = await build({ stdin: { contents: source, resolveDir: process.cwd(), loader: 'jsx', sourcefile: 'collection-refresh-harness.jsx' }, bundle: true, platform: 'browser', format: 'iife', jsx: 'automatic', write: false })
  const browser = await chromium.launch({ executablePath: browserPath, headless: true })
  try {
    const page = await browser.newPage()
    await page.setContent('<!doctype html><html><body><div id="root"></div></body></html>')
    await page.addScriptTag({ content: built.outputFiles[0]!.text })
    await page.waitForFunction(() => Reflect.get(window, 'fixture').records.length === 1)
    await page.evaluate(() => { const fixture = Reflect.get(window, 'fixture'); void fixture.scan(false); void fixture.scan(false) })
    expect(await page.evaluate(() => Reflect.get(window, 'fixture').records.map((entry: { key: string; signal: AbortSignal }) => ({ key: entry.key, aborted: entry.signal.aborted })))).toEqual([{ key: 'one', aborted: false }])
    await page.evaluate(() => Reflect.get(window, 'fixture').select('two'))
    await page.waitForFunction(() => Reflect.get(window, 'fixture').records.length === 2)
    expect(await page.evaluate(() => Reflect.get(window, 'fixture').records[0].signal.aborted)).toBe(true)
    await page.evaluate(() => { const records = Reflect.get(window, 'fixture').records; records[0].release('old'); records[1].release('new') })
    await page.waitForFunction(() => document.querySelector('[data-result]')?.getAttribute('data-result') === 'new')
    await page.evaluate(() => { const fixture = Reflect.get(window, 'fixture'); void fixture.scan(false); void fixture.scan(false) })
    expect(await page.evaluate(() => Reflect.get(window, 'fixture').records.length)).toBe(3)
    expect(await page.evaluate(() => Reflect.get(window, 'fixture').records[2].signal.aborted)).toBe(false)
    await page.evaluate(() => Reflect.get(window, 'fixture').records[2].release('refreshed'))
    await page.waitForFunction(() => document.querySelector('[data-result]')?.getAttribute('data-result') === 'refreshed')
  } finally { await browser.close() }
}, 30000)
