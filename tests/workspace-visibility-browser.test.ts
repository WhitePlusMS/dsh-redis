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
    const budget = { stopped: false }, write = { enabled: false, fail: false, loseReply: false, hang: false }
    const connection = { id: 'connection', generation: 1, db: 0, state: 'connected', error: null, target: { host: 'localhost', port: 6379, username: '', tls: false } }
    const budgetStatus = () => ({ callsUsed: budget.stopped ? 32 : 0, maxCalls: 32, bytesUsed: 0, maxBytes: 1048576, inFlight: 0, stopped: budget.stopped })
    const props = {
      t: key => key, sessionKey: 'fixture', selectionEpoch: epoch, retrySelection: () => {},
      registerVisiblePane: () => panes.attach('fixture'), registerKeyHandler: handler => panes.registerKeyHandler('fixture', handler), registerRefreshHandler: handler => panes.registerRefreshHandler('fixture', handler), registerFormatHandler: handler => panes.registerFormatHandler('fixture', handler), registerMatchHandler: handler => panes.registerMatchHandler('fixture', handler),
      useTabInfo: () => ({ tab: { visible: true, signal: controller.signal } }),
      status: async () => ({ ok: true, value: {} }),
      aiBudgetStatus: async () => ({ ok: true, value: budgetStatus() }),
      resumeAiBudget: async () => { budget.stopped = false; return { ok: true, value: { accepted: true, status: budgetStatus() } } },
      writeModeStatus: async () => write.fail ? ({ ok: false }) : ({ ok: true, value: { connection, enabled: write.enabled } }),
      setWriteMode: async request => { write.enabled = request.enabled; if (write.hang) return new Promise(() => {}); return write.loseReply ? ({ ok: false }) : ({ ok: true, value: { connection, enabled: write.enabled } }) },
      connectionStatus: async () => ({ ok: true, value: { id: null, generation: 0, db: 0, state: 'disconnected', error: null, target: null } }),
    }
    installRedisStyles(); window.fixture = { epoch, panes, budget, write, connection }
    createRoot(document.getElementById('root')).render(<RedisWorkspace {...props} />)
  `
  const built = await build({ stdin: { contents: source, resolveDir: process.cwd(), loader: 'jsx', sourcefile: 'workspace-visibility-harness.jsx' }, bundle: true, platform: 'browser', format: 'iife', jsx: 'automatic', write: false })
  const browser = await chromium.launch({ executablePath: browserPath, headless: true })
  try {
    const context = await browser.newContext(), page = await context.newPage()
    await page.setContent('<!doctype html><html><body><div id="root"></div></body></html>')
    await page.addScriptTag({ content: built.outputFiles[0]!.text })
    await page.waitForFunction(() => Reflect.get(window, 'fixture').panes.count('fixture') === 1, undefined, { timeout: 5000 })
    expect(await page.getByText('budget.title').count()).toBe(0)
    expect(await page.getByText('budget.calls').count()).toBe(0)
    await page.getByRole('button', { name: 'ui.pluginInfo' }).click()
    await page.getByRole('button', { name: 'write.enable' }).click()
    await page.getByRole('button', { name: 'write.disable' }).click()
    await expect.poll(() => page.getByRole('button', { name: 'write.enable' }).isEnabled()).toBe(true)
    await page.evaluate(() => { const f = Reflect.get(window, 'fixture'); f.write.loseReply = true; f.write.fail = true })
    await page.getByRole('button', { name: 'write.enable' }).click()
    await expect.poll(() => page.getByText('write.unknown').count()).toBe(1)
    expect(await page.getByRole('button', { name: 'write.enable' }).isDisabled()).toBe(true)
    await page.evaluate(() => { const f = Reflect.get(window, 'fixture'); f.write.fail = false; f.write.loseReply = false; f.connection.db = 2; f.epoch.invalidate() })
    await expect.poll(() => page.getByRole('button', { name: 'write.disable' }).isEnabled()).toBe(true)
    expect(await page.getByText(/DB 2/).count()).toBe(1)
    await page.evaluate(() => { Reflect.get(window, 'fixture').write.hang = true })
    await page.getByRole('button', { name: 'write.disable' }).click()
    await expect.poll(() => page.getByText('write.unknown').count()).toBe(1)
    await expect.poll(() => page.getByRole('button', { name: 'write.enable' }).isEnabled(), { timeout: 10000 }).toBe(true)
    expect(await page.getByRole('button', { name: 'budget.resume' }).count()).toBe(0)
    await page.getByRole('button', { name: 'ui.pluginInfo' }).click()
    await page.evaluate(() => { Reflect.get(window, 'fixture').budget.stopped = true })
    await page.getByRole('button', { name: 'ui.pluginInfo' }).click()
    await page.getByRole('button', { name: 'budget.resume' }).click()
    await expect.poll(() => page.getByRole('button', { name: 'budget.resume' }).count()).toBe(0)
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
