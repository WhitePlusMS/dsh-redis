import { existsSync } from 'node:fs'
import { build } from 'esbuild'
import { chromium } from 'playwright-core'
import { expect, it } from 'vitest'

const browserPath = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome',
].find(path => existsSync(path))

it.skipIf(browserPath === undefined)('releases and restores the pane on simulated browser visibility changes', async () => {
  if (browserPath === undefined) throw new Error('Missing browser')
  const source = `
    import React from 'react'
    import { createRoot } from 'react-dom/client'
    import { RedisWorkspace } from './src/client/RedisWorkspace.tsx'
    import { SelectionEpoch } from './src/client/selection-epoch.ts'
    import { UiPanePresence } from './src/client/ui-pane-presence.ts'
    import { installRedisStyles } from './src/client/styles.ts'
    const epoch = new SelectionEpoch(), panes = new UiPanePresence(), controller = new AbortController()
    const props = {
      t: key => key, sessionKey: 'fixture', selectionEpoch: epoch, retrySelection: () => {},
      registerVisiblePane: () => panes.attach('fixture'), registerKeyHandler: handler => panes.registerKeyHandler('fixture', handler), registerRefreshHandler: handler => panes.registerRefreshHandler('fixture', handler), registerFormatHandler: handler => panes.registerFormatHandler('fixture', handler),
      useTabInfo: () => ({ tab: { visible: true, signal: controller.signal } }),
      status: async () => ({ ok: true, value: {} }),
      connectionStatus: async () => ({ ok: true, value: { id: null, generation: 0, db: 0, state: 'disconnected', error: null, target: null } }),
    }
    installRedisStyles(); window.fixture = { epoch, panes }
    createRoot(document.getElementById('root')).render(<RedisWorkspace {...props} />)
  `
  const built = await build({ stdin: { contents: source, resolveDir: process.cwd(), loader: 'jsx', sourcefile: 'workspace-visibility-harness.jsx' }, bundle: true, platform: 'browser', format: 'iife', jsx: 'automatic', write: false })
  const browser = await chromium.launch({ executablePath: browserPath, headless: true })
  try {
    const context = await browser.newContext(), page = await context.newPage()
    await page.setContent('<!doctype html><html><body><div id="root"></div></body></html>')
    await page.addScriptTag({ content: built.outputFiles[0]!.text })
    await page.waitForFunction(() => Reflect.get(window, 'fixture').panes.count('fixture') === 1, undefined, { timeout: 5000 })
    const revision = await page.evaluate(() => { const epoch = Reflect.get(window, 'fixture').epoch; const current = epoch.snapshot().revision; epoch.synchronize(current); return current })
    // Headless Chromium keeps both tabs visible; exercise the real DOM listener explicitly.
    await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' }); document.dispatchEvent(new Event('visibilitychange')) })
    await page.waitForFunction(() => document.visibilityState === 'hidden' && Reflect.get(window, 'fixture').panes.count('fixture') === 0, undefined, { timeout: 5000 })
    expect(await page.evaluate(() => Reflect.get(window, 'fixture').epoch.snapshot())).toEqual({ revision: revision + 1, synchronized: false })
    await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' }); document.dispatchEvent(new Event('visibilitychange')) })
    await page.waitForFunction(() => document.visibilityState === 'visible' && Reflect.get(window, 'fixture').panes.count('fixture') === 1, undefined, { timeout: 5000 })
    expect(await page.evaluate(() => Reflect.get(window, 'fixture').epoch.snapshot())).toEqual({ revision: revision + 2, synchronized: false })
    await context.close()
  } finally { await browser.close() }
}, 30000)
