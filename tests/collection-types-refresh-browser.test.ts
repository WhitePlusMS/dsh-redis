import { existsSync } from 'node:fs'
import { build } from 'esbuild'
import { chromium } from 'playwright-core'
import { expect, it } from 'vitest'

const browserPath = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/chromium'].find(path => existsSync(path))

it.skipIf(browserPath === undefined).each(['hash', 'set', 'zset', 'stream'] as const)('confirms a newly rendered %s refresh instead of the old view', async kind => {
  if (browserPath === undefined) throw new Error('Missing browser')
  const source = `
    import React from 'react'
    import { createRoot } from 'react-dom/client'
    import { HashView } from './src/client/HashView.tsx'
    import { SetView } from './src/client/SetView.tsx'
    import { ZSetView } from './src/client/ZSetView.tsx'
    import { StreamView } from './src/client/StreamView.tsx'
    import { CurrentSelection } from './src/client/CurrentSelection.tsx'
    import { SelectionEpoch } from './src/client/selection-epoch.ts'
    import { SelectionEpochContext, useSelectionRevision } from './src/client/SelectionEpochContext.ts'
    import { RefreshVisibility, KeyAutoRefresh } from './src/client/AutoRefresh.tsx'
    import { UiPanePresence } from './src/client/ui-pane-presence.ts'
    import { PreviewFormats } from './src/client/PreviewFormats.tsx'
    import { KeyPresentation } from './src/client/KeyPresentation.tsx'
    const kind = ${JSON.stringify(kind)}, target = { id: 'fixture', generation: 1, db: 0 }, selected = { base64: 'aw==', byteLength: 1, label: 'key' }
    const epoch = new SelectionEpoch(), panes = new UiPanePresence(), tab = new AbortController()
    let calls = 0, release, result = 'pending'
    const identity = value => ({ base64: btoa(value), byteLength: value.length, label: value })
    const cell = value => ({ base64: btoa(value), byteLength: value.length, fullByteLength: value.length, suffix: '' })
    const read = async () => {
      calls++; if (calls > 1) await new Promise(resolve => { release = resolve })
      const name = calls > 1 ? 'new' : 'old', id = calls > 1 ? '2-0' : '1-0'
      const common = { state: 'page', error: null, metadata: { type: kind, ttlMs: '-1', length: '1' }, cursor: null, sampledAt: '2026-01-01T00:00:00.000Z' }
      const value = kind === 'hash' ? { ...common, entries: [{ field: identity(name), value: cell(name) }] } : kind === 'set' ? { ...common, members: [identity(name)] } : kind === 'zset' ? { ...common, mode: 'range', entries: [{ member: identity(name), score: '1' }], offset: '0', nextOffset: null } : { ...common, direction: 'forward', messages: [{ id, fields: [{ field: identity(name), value: cell(name) }] }] }
      return { ok: true, value }
    }
    const props = { target, selected, t: key => key, scanHash: read, scanSet: read, readZSet: read, readStream: read, readActionPoint: async () => ({ ok: false }), registerHashHandler: () => () => {}, registerSetHandler: () => () => {}, registerZSetHandler: () => () => {}, registerStreamHandler: () => () => {} }
    const Component = { hash: HashView, set: SetView, zset: ZSetView, stream: StreamView }[kind]
    function View() { const revision = useSelectionRevision(); return <CurrentSelection target={target} keyBase64={selected.base64} revision={revision} suspended={false} publish={async () => ({ ok: true, value: { accepted: true } })}><KeyPresentation><KeyAutoRefresh action={{ register: handler => panes.registerRefreshHandler('a', handler), target, keyBase64: selected.base64 }}><Component {...props} /></KeyAutoRefresh></KeyPresentation></CurrentSelection> }
    panes.attach('a')
    createRoot(document.getElementById('root')).render(<section className="dsh-redis"><SelectionEpochContext.Provider value={epoch}><RefreshVisibility.Provider value={{ visible: true, signal: tab.signal }}><PreviewFormats><View /></PreviewFormats></RefreshVisibility.Provider></SelectionEpochContext.Provider></section>)
    window.fixture = { epoch, calls: () => calls, result: () => result, release: () => release(), start() { const request = { requestId: '12345678-1234-1234-1234-123456789abc', target: null, selectionRevision: epoch.snapshot().revision, expiresAt: Date.now() + 5000, action: { kind: 'refresh', target, keyBase64: selected.base64 } }; panes.refresh('a', request, new AbortController().signal).then(value => { result = value }) } }
  `
  const built = await build({ stdin: { contents: source, resolveDir: process.cwd(), loader: 'jsx', sourcefile: 'collection-types-refresh.jsx' }, bundle: true, platform: 'browser', format: 'iife', jsx: 'automatic', write: false })
  const browser = await chromium.launch({ executablePath: browserPath, headless: true })
  try {
    const page = await browser.newPage()
    page.setDefaultTimeout(5000)
    page.on('pageerror', error => { console.error('Collection refresh fixture:', error.message) })
    await page.setContent('<!doctype html><html><body><div id="root"></div></body></html>')
    await page.addScriptTag({ content: built.outputFiles[0]!.text })
    await page.waitForFunction(() => Reflect.get(window, 'fixture').epoch.snapshot().synchronized)
    const old = kind === 'stream' ? '1-0' : 'b2xk', next = kind === 'stream' ? '2-0' : 'bmV3'
    await page.locator(`[data-row-identity="${old}"]`).waitFor()
    await page.evaluate(() => Reflect.get(window, 'fixture').start())
    await page.waitForFunction(() => Reflect.get(window, 'fixture').calls() > 1)
    expect(await page.evaluate(() => Reflect.get(window, 'fixture').result())).toBe('pending')
    expect(await page.locator(`[data-row-identity="${old}"]`).count()).toBe(1)
    await page.evaluate(() => Reflect.get(window, 'fixture').release())
    await page.waitForFunction(() => Reflect.get(window, 'fixture').result() === 'applied')
    expect(await page.locator(`[data-row-identity="${next}"]`).count()).toBe(1)
  } finally { await browser.close() }
}, 15000)
