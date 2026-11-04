import { existsSync } from 'node:fs'
import { build } from 'esbuild'
import { chromium } from 'playwright-core'
import { expect, it } from 'vitest'

const browserPath = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome',
].find(path => existsSync(path))

it.skipIf(browserPath === undefined)('keeps a newer row unsynchronized when an older selection response arrives late', async () => {
  if (browserPath === undefined) throw new Error('Missing browser')
  const source = `
    import React, { useState } from 'react'
    import { createRoot } from 'react-dom/client'
    import { SelectionEpoch } from './src/client/selection-epoch.ts'
    import { SelectionEpochContext, useSelectionRevision } from './src/client/SelectionEpochContext.ts'
    import { CurrentSelection, useCurrentItem } from './src/client/CurrentSelection.tsx'
    import { CollectionTable } from './src/client/CollectionTable.tsx'
    const epoch = new SelectionEpoch(), requests = []
    window.fixture = { epoch, requests }
    const publish = request => new Promise(resolve => { requests.push({ request, resolve }) })
    function Rows() {
      const [selected, setSelected] = useState(null)
      useCurrentItem(selected === null ? null : { kind: 'list', index: selected })
      return <CollectionTable rows={['1', '2']} identity={row => row} label="fixture" columns={[{ id: 'id', title: 'id', render: row => row }]} selection={{ id: selected, onSelect: setSelected }} />
    }
    function Owner() {
      const revision = useSelectionRevision()
      return <CurrentSelection target={{ id: 'fixture', generation: 1, db: 0 }} keyBase64="aw==" publish={publish} revision={revision}><Rows /></CurrentSelection>
    }
    createRoot(document.getElementById('root')).render(<SelectionEpochContext.Provider value={epoch}><Owner /></SelectionEpochContext.Provider>)
  `
  const built = await build({ stdin: { contents: source, resolveDir: process.cwd(), loader: 'jsx', sourcefile: 'selection-race-harness.jsx' }, bundle: true, platform: 'browser', format: 'iife', jsx: 'automatic', write: false })
  const browser = await chromium.launch({ executablePath: browserPath, headless: true })
  try {
    const page = await browser.newPage()
    await page.setContent('<!doctype html><html><body><div id="root"></div></body></html>')
    await page.addScriptTag({ content: built.outputFiles[0]!.text })
    await page.waitForFunction(() => Reflect.get(window, 'fixture').requests.length === 1)
    await page.evaluate(() => Reflect.get(window, 'fixture').requests[0].resolve({ ok: true, value: { accepted: true } }))
    await page.waitForFunction(() => Reflect.get(window, 'fixture').epoch.snapshot().synchronized)
    await page.locator('[data-row-identity="1"]').click()
    await page.waitForFunction(() => Reflect.get(window, 'fixture').requests.length === 2)
    await page.locator('[data-row-identity="2"]').click()
    expect(await page.evaluate(() => Reflect.get(window, 'fixture').epoch.snapshot().synchronized)).toBe(false)
    await page.waitForFunction(() => Reflect.get(window, 'fixture').requests.length === 3)
    await page.evaluate(() => Reflect.get(window, 'fixture').requests[1].resolve({ ok: true, value: { accepted: true } }))
    expect(await page.evaluate(() => Reflect.get(window, 'fixture').epoch.snapshot().synchronized)).toBe(false)
    await page.evaluate(() => Reflect.get(window, 'fixture').requests[2].resolve({ ok: true, value: { accepted: true } }))
    await page.waitForFunction(() => Reflect.get(window, 'fixture').epoch.snapshot().synchronized)
    expect(await page.evaluate(() => Reflect.get(window, 'fixture').requests[2].request.selection.item)).toEqual({ kind: 'list', index: '2' })
  } finally { await browser.close() }
}, 30000)

it.skipIf(browserPath === undefined)('does not publish or acknowledge the hidden pane selection', async () => {
  if (browserPath === undefined) throw new Error('Missing browser')
  const source = `
    import React, { useState } from 'react'
    import { createRoot } from 'react-dom/client'
    import { SelectionEpoch } from './src/client/selection-epoch.ts'
    import { SelectionEpochContext, useSelectionRevision } from './src/client/SelectionEpochContext.ts'
    import { CurrentSelection } from './src/client/CurrentSelection.tsx'
    import { RefreshVisibility } from './src/client/AutoRefresh.tsx'
    const epoch = new SelectionEpoch(), requests = [], signal = new AbortController().signal
    window.fixture = { epoch, requests }
    const publish = request => new Promise(resolve => { requests.push({ request, resolve }) })
    function Pane({ visible, keyBase64 }) {
      const revision = useSelectionRevision()
      return <RefreshVisibility.Provider value={{ visible, signal }}><CurrentSelection target={{ id: 'fixture', generation: 1, db: 0 }} keyBase64={keyBase64} publish={publish} revision={revision}><span>{keyBase64}</span></CurrentSelection></RefreshVisibility.Provider>
    }
    function App() {
      const [visible, setVisible] = useState('YQ==')
      return <SelectionEpochContext.Provider value={epoch}><button onClick={() => { epoch.invalidate(); setVisible('Yg==') }}>switch</button><Pane visible={visible === 'YQ=='} keyBase64="YQ==" /><Pane visible={visible === 'Yg=='} keyBase64="Yg==" /></SelectionEpochContext.Provider>
    }
    createRoot(document.getElementById('root')).render(<App />)
  `
  const built = await build({ stdin: { contents: source, resolveDir: process.cwd(), loader: 'jsx', sourcefile: 'hidden-selection-harness.jsx' }, bundle: true, platform: 'browser', format: 'iife', jsx: 'automatic', write: false })
  const browser = await chromium.launch({ executablePath: browserPath, headless: true })
  try {
    const page = await browser.newPage()
    await page.setContent('<!doctype html><html><body><div id="root"></div></body></html>')
    await page.addScriptTag({ content: built.outputFiles[0]!.text })
    await page.waitForFunction(() => Reflect.get(window, 'fixture').requests.length === 1)
    expect(await page.evaluate(() => Reflect.get(window, 'fixture').requests[0].request.selection.keyBase64)).toBe('YQ==')
    await page.getByRole('button', { name: 'switch' }).click()
    await page.waitForFunction(() => Reflect.get(window, 'fixture').requests.length === 2)
    expect(await page.evaluate(() => Reflect.get(window, 'fixture').requests[1].request.selection.keyBase64)).toBe('Yg==')
    await page.evaluate(() => Reflect.get(window, 'fixture').requests[0].resolve({ ok: true, value: { accepted: true } }))
    expect(await page.evaluate(() => Reflect.get(window, 'fixture').epoch.snapshot().synchronized)).toBe(false)
    await page.evaluate(() => Reflect.get(window, 'fixture').requests[1].resolve({ ok: true, value: { accepted: true } }))
    await page.waitForFunction(() => Reflect.get(window, 'fixture').epoch.snapshot().synchronized)
    expect(await page.evaluate(() => Reflect.get(window, 'fixture').requests.length)).toBe(2)
  } finally { await browser.close() }
}, 30000)
