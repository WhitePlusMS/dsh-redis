import { existsSync } from 'node:fs'
import { build } from 'esbuild'
import { chromium } from 'playwright-core'
import { expect, it } from 'vitest'

const browserPath = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome',
].find(path => existsSync(path))

it.skipIf(browserPath === undefined)('continues a paused Key scan once after a double click in a real browser', async () => {
  if (browserPath === undefined) throw new Error('Missing browser')
  const source = `
    import React from 'react'
    import { createRoot } from 'react-dom/client'
    import { KeyBrowser } from './src/client/KeyBrowser.tsx'
    window.scanCalls = []
    const props = {
      t: key => key,
      connection: { id: 'fixture', generation: 1, db: 0, state: 'connected', target: { host: 'fixture', port: 6379 } },
      configure: () => {}, acceptConnection: () => {}, registerKeyHandler: () => () => {}, registerRefreshHandler: () => () => {}, registerFormatHandler: () => () => {},
      readDatabases: async () => ({ ok: false }),
      scanKeys: async request => {
        window.scanCalls.push(request)
        if (window.scanCalls.length <= 1000) return { ok: true, value: { state: 'page', error: null, keys: [], cursor: 'token-' + window.scanCalls.length, sampledAt: '1970-01-01T00:00:00.000Z' } }
        return new Promise(resolve => { window.releaseScan = () => resolve({ ok: true, value: { state: 'page', error: null, keys: [{ base64: 'aw==', byteLength: 1, label: 'k' }], cursor: null, sampledAt: '1970-01-01T00:00:00.000Z' } }) })
      },
    }
    createRoot(document.getElementById('root')).render(<KeyBrowser {...props} />)
  `
  const built = await build({ stdin: { contents: source, resolveDir: process.cwd(), loader: 'jsx', sourcefile: 'key-resume-harness.jsx' }, bundle: true, platform: 'browser', format: 'iife', jsx: 'automatic', write: false })
  const browser = await chromium.launch({ executablePath: browserPath, headless: true })
  try {
    const page = await browser.newPage()
    page.on('pageerror', error => { console.error('Key resume fixture:', error.message) })
    await page.setContent('<!doctype html><html><body><div id="root"></div></body></html>')
    await page.addScriptTag({ content: built.outputFiles[0]!.text })
    await page.waitForSelector('[data-key-load-phase="paused"]', { timeout: 5000 })
    expect(await page.evaluate(() => (Reflect.get(window, 'scanCalls') as unknown[]).length)).toBe(1000)
    await page.evaluate(() => {
      const button = document.querySelector('[data-key-load-phase="paused"] button')
      if (!(button instanceof HTMLButtonElement)) throw new Error('Missing continue button')
      button.click(); button.click()
    })
    const calls = await page.evaluate(() => Reflect.get(window, 'scanCalls') as { cursor: string | null; pattern: string }[])
    expect(calls).toHaveLength(1001); expect(calls[1000]).toMatchObject({ cursor: 'token-1000', pattern: '*' })
    await page.evaluate(() => { const release = Reflect.get(window, 'releaseScan'); if (typeof release !== 'function') throw new Error('Missing pending scan'); release() })
    await page.waitForSelector('[data-key-load-phase="complete"]')
    expect(await page.locator('[data-loaded-keys]').textContent()).toBe('1')
  } finally { await browser.close() }
}, 30000)

it.skipIf(browserPath === undefined)('shows the scan-specific stale message and retains loaded keys without rescanning', async () => {
  if (browserPath === undefined) throw new Error('Missing browser')
  const source = `
    import React from 'react'
    import { createRoot } from 'react-dom/client'
    import { KeyBrowser } from './src/client/KeyBrowser.tsx'
    import { zh, en } from './src/client/locales.ts'
    window.scanCalls = []
    const words = window.fixtureLanguage === 'en' ? en : zh
    const props = {
      t: key => words[key] ?? key,
      connection: { id: 'fixture', generation: 1, db: 0, state: 'connected', target: { host: 'fixture', port: 6379 } },
      configure: () => {}, acceptConnection: () => {}, registerKeyHandler: () => () => {}, registerRefreshHandler: () => () => {}, registerFormatHandler: () => () => {},
      readDatabases: async () => ({ ok: false }),
      scanKeys: async request => {
        window.scanCalls.push(request)
        if (window.scanCalls.length <= 1000) return { ok: true, value: { state: 'page', error: null, keys: window.scanCalls.length === 1 ? [{ base64: 'b2xk', byteLength: 3, label: 'old' }] : [], cursor: 'token-' + window.scanCalls.length, sampledAt: '1970-01-01T00:00:00.000Z' } }
        return { ok: true, value: { state: 'failed', error: 'stale', keys: [], cursor: null, sampledAt: '1970-01-01T00:00:00.000Z' } }
      },
    }
    createRoot(document.getElementById('root')).render(<KeyBrowser {...props} />)
  `
  const built = await build({ stdin: { contents: source, resolveDir: process.cwd(), loader: 'jsx', sourcefile: 'key-stale-harness.jsx' }, bundle: true, platform: 'browser', format: 'iife', jsx: 'automatic', write: false })
  const browser = await chromium.launch({ executablePath: browserPath, headless: true })
  try {
    for (const [language, message] of [['zh', '扫描状态已失效，当前列表可能不完整，请手动刷新。'], ['en', 'The scan state has expired. The current list may be incomplete; refresh manually.']] as const) {
      const page = await browser.newPage()
      await page.setContent('<!doctype html><html><body><div id="root"></div></body></html>')
      await page.evaluate(language => { Reflect.set(window, 'fixtureLanguage', language) }, language)
      await page.addScriptTag({ content: built.outputFiles[0]!.text })
      await page.waitForSelector('[data-key-load-phase="paused"]', { timeout: 5000 })
      await page.locator('[data-key-load-phase="paused"] button').click()
      await page.waitForSelector('[data-key-load-phase="failed"]', { timeout: 5000 })
      expect(await page.locator('.redis-key-catalog p[role="alert"]').textContent()).toBe(message)
      expect(await page.locator('[data-loaded-keys]').textContent()).toBe('1')
      expect(await page.locator('[data-key-load-phase="failed"] button').count()).toBe(0)
      const calls = await page.evaluate(() => Reflect.get(window, 'scanCalls') as { cursor: string | null }[])
      expect(calls).toHaveLength(1001); expect(calls[1000]?.cursor).toBe('token-1000')
      await page.close()
    }
  } finally { await browser.close() }
}, 30000)
