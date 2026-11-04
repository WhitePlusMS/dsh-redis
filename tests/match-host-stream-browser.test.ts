import { existsSync } from 'node:fs'
import { mkdtemp, realpath, rm } from 'node:fs/promises'
import { basename, dirname, join, resolve } from 'node:path'
import { build } from 'esbuild'
import { chromium } from 'playwright-core'
import { expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime from '@deepseek-ai/dsh-tools'
import type { Agent } from '@deepseek-ai/dsh-agent'
import type { UiAction, UiChannelInput, UiChannelMessage } from '../src/domain.ts'
import { RedisConnections, type RedisLink } from '../src/host/connection-service.ts'
import { RedisAiReader } from '../src/host/ai-reader.ts'
import { RedisMatchPresets } from '../src/host/match-preset-store.ts'
import { registerRedisMatchTools } from '../src/host/ai-match-tools.ts'
import { UiActionCoordinator } from '../src/host/ui-action-coordinator.ts'
import { openUiActionChannel } from '../src/host/ui-action-channel.ts'

const browserPath = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/chromium'].find(path => existsSync(path))

it.skipIf(browserPath === undefined).each(['applied', 'user-first'] as const)('connects the real preset tool and Host stream to the browser: %s', async mode => {
  if (browserPath === undefined) throw new Error('Missing browser')
  const runtime = resolve(import.meta.dirname, '../.scratch/runtime'), directory = await mkdtemp(join(runtime, 'match-stream-test-'))
  const ctx = new Context(), coordinator = new UiActionCoordinator<UiAction>(), hostAbort = new AbortController()
  const link: RedisLink = { close: () => undefined, onFailure: () => () => undefined, async execute() { throw new Error('Unexpected Redis command') } }
  const connections = new RedisConnections(async () => link)
  const reader = new RedisAiReader(connections, session => coordinator.invalidateSession(session), async () => 0, () => true)
  const presets = new RedisMatchPresets(directory), preset = await presets.save({ name: 'fixture', pattern: 'fixture:order:*' }, hostAbort.signal)
  await ctx.plugin(SystemPrompt); await ctx.plugin(ToolRuntime)
  await ctx.plugin({ name: 'match-stream-test', inject: ['tools'], apply: (scope: Context) => registerRedisMatchTools(scope, reader, presets, coordinator) })
  const connection = await connections.connect('a', { host: 'fixture', port: 6379, username: '', password: '', tls: null }, hostAbort.signal)
  if (connection.id === null) throw new Error('Missing synthetic connection')
  const target = { id: connection.id, generation: connection.generation, db: connection.db }
  const source = `
    import React from 'react'
    import { createRoot } from 'react-dom/client'
    import { KeyBrowser } from './src/client/KeyBrowser.tsx'
    import { SelectionEpoch } from './src/client/selection-epoch.ts'
    import { SelectionEpochContext } from './src/client/SelectionEpochContext.ts'
    import { RefreshVisibility } from './src/client/AutoRefresh.tsx'
    import { UiPanePresence } from './src/client/ui-pane-presence.ts'
    import { consumeUiActions } from './src/client/ui-actions.ts'
    const epoch = new SelectionEpoch(), panes = new UiPanePresence(), queue = [], abort = new AbortController(), tab = new AbortController()
    const target = ${JSON.stringify(target)}
    let wake, ended = false, reads = 0
    const notify = () => { const next = wake; wake = undefined; next?.() }
    const stream = { send: frame => { void window.hostSend(frame) }, end: () => {}, dispose: () => { ended = true; notify() }, async *[Symbol.asyncIterator]() { while (!ended) { const frame = queue.shift(); if (frame) { yield frame; continue } await new Promise(resolve => { wake = resolve; if (ended || queue.length) notify() }) } } }
    const props = {
      t: key => key, connection: { ...target, state: 'connected', target: { host: 'fixture', port: 6379 } }, configure: () => {}, acceptConnection: () => {},
      registerKeyHandler: handler => panes.registerKeyHandler('a', handler), registerRefreshHandler: handler => panes.registerRefreshHandler('a', handler), registerFormatHandler: handler => panes.registerFormatHandler('a', handler), registerMatchHandler: handler => panes.registerMatchHandler('a', handler),
      setSelection: (request, signal) => epoch.publish(request, epoch.snapshot().revision, signal),
      readDatabases: async () => { reads++; if (reads > 1) await new Promise(() => {}); return { ok: false } },
      scanKeys: async () => ({ ok: true, value: { state: 'page', error: null, keys: [], cursor: null, sampledAt: '1970-01-01T00:00:00.000Z' } }),
    }
    panes.attach('a')
    createRoot(document.getElementById('root')).render(<SelectionEpochContext.Provider value={epoch}><RefreshVisibility.Provider value={{ visible: true, signal: tab.signal }}><KeyBrowser {...props} /></RefreshVisibility.Provider></SelectionEpochContext.Provider>)
    void consumeUiActions(async () => stream, abort.signal, (request, signal) => request.action.kind === 'applyMatch' ? panes.applyMatch('a', request, signal) : Promise.resolve('stale'), epoch)
    window.fixture = { epoch, abort, push: frame => { queue.push(frame); notify() } }
  `
  const built = await build({ stdin: { contents: source, resolveDir: process.cwd(), loader: 'jsx', sourcefile: 'match-host-stream.jsx' }, bundle: true, platform: 'browser', format: 'iife', jsx: 'automatic', write: false })
  const frames: UiChannelInput[] = []
  let wake: (() => void) | undefined, ended = false, held: UiChannelMessage | undefined
  const notify = () => { const next = wake; wake = undefined; next?.() }
  const uplink: AsyncIterable<UiChannelInput> = { async *[Symbol.asyncIterator]() { while (!ended) { const frame = frames.shift(); if (frame !== undefined) { yield frame; continue } await new Promise<void>(resolve => { wake = resolve; if (ended || frames.length) notify() }) } } }
  const browser = await chromium.launch({ executablePath: browserPath, headless: true })
  let pump: Promise<void> | undefined
  try {
    const page = await browser.newPage()
    await page.exposeFunction('hostSend', (frame: UiChannelInput) => { frames.push(frame); notify() })
    await page.setContent('<!doctype html><html><body><div id="root"></div></body></html>')
    await page.evaluate(() => { let sequence = 0; Object.defineProperty(crypto, 'randomUUID', { value: () => `12345678-1234-1234-1234-${String(++sequence).padStart(12, '0')}` }) })
    const channel = openUiActionChannel(coordinator, 'a', hostAbort.signal, uplink, request => reader.setSelection('a', request))
    pump = (async () => { for await (const frame of channel) { if (mode === 'user-first' && frame.kind === 'action' && frame.request.action.kind === 'applyMatch') { held = frame; continue } await page.evaluate((message: UiChannelMessage) => Reflect.get(window, 'fixture').push(message), frame) } })()
    await page.addScriptTag({ content: built.outputFiles[0]!.text })
    await expect.poll(() => coordinator.selectionRevision('a'), { timeout: 5000 }).not.toBeNull()
    await page.waitForSelector('[data-key-load-phase="complete"]')
    const agent = { id: 'fixture-agent', ctx, session: { id: 'a' } } as unknown as Agent
    const result = ctx.tools.execute({ callId: 'match-stream' as Parameters<typeof ctx.tools.execute>[0]['callId'], name: 'redis_viewer_apply_match_preset', arguments: { id: preset.id }, agent, signal: new AbortController().signal }).then(response => {
      const body = response.content.filter(block => block.type === 'text').map(block => block.text).join('')
      if (response.isError) throw new Error(body)
      return JSON.parse(body) as { outcome: string }
    })
    if (mode === 'user-first') {
      await expect.poll(() => held, { timeout: 5000 }).toBeDefined()
      await page.getByRole('button', { name: 'workbench.filter' }).click()
      await page.locator('input[name="pattern"]').fill('user:*')
      if (held === undefined) throw new Error('Missing held action')
      await page.evaluate((frame: UiChannelMessage) => Reflect.get(window, 'fixture').push(frame), held)
      expect((await result).outcome).toBe('stale')
      expect(await page.locator('input[name="pattern"]').inputValue()).toBe('user:*')
    } else {
      expect((await result).outcome).toBe('applied')
      expect(await page.getByText('fixture:order:*').isVisible()).toBe(true)
      expect(await page.locator('[data-key-load-phase]').getAttribute('data-key-load-phase')).not.toBe('complete')
    }
    await page.evaluate(() => Reflect.get(window, 'fixture').abort.abort())
  } finally {
    hostAbort.abort(); ended = true; notify(); await pump; await browser.close(); coordinator.dispose(); reader.dispose(); connections.dispose(); await ctx.fiber.dispose()
    const actual = await realpath(directory)
    if (dirname(actual) !== await realpath(runtime) || !basename(actual).startsWith('match-stream-test-')) throw new Error('Refusing cleanup outside the owned test directory')
    await rm(actual, { recursive: true })
  }
}, 30000)
