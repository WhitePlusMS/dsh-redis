import * as NativeToolExecutor from '@deepseek-ai/dsh-tool-executor-native'
import { executeTool } from './tool-test-utils.ts'
import { existsSync } from 'node:fs'
import { Context, symbols } from '@deepseek-ai/cordis'
import type { Agent } from '@deepseek-ai/dsh-agent'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime from '@deepseek-ai/dsh-tools'
import { build } from 'esbuild'
import { chromium } from 'playwright-core'
import { expect, it } from 'vitest'
import type { ActionPointReadRequest, ActionPointReadResult, UiChannelInput, UiChannelMessage } from '../src/domain.ts'
import { RedisAiReader } from '../src/host/ai-reader.ts'
import { registerRedisLocateTool } from '../src/host/ai-locate-tool.ts'
import { ConnectionFailure, RedisConnections, type RedisLink } from '../src/host/connection-service.ts'
import { openUiActionChannel } from '../src/host/ui-action-channel.ts'
import { RedisRemoteService } from '../src/remote-service.ts'

const browserPath = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/chromium'].find(path => existsSync(path))

it.skipIf(browserPath === undefined)('keeps the tool and visible ZSet score attached to their own samples', async () => {
  if (browserPath === undefined) throw new Error('Missing browser')
  let scoreReads = 0
  const commands: string[] = []
  const link: RedisLink = { close: () => undefined, onFailure: () => () => undefined, async execute(command, args, signal, guard) {
    signal.throwIfAborted(); guard(); commands.push(command)
    if (command === 'TYPE') return 'zset'
    if (command === 'PTTL') return -1n
    if (command === 'ZSCORE') {
      expect(args).toEqual([Buffer.from('zset'), Buffer.from([0, 255])])
      scoreReads++
      if (scoreReads === 1) return Buffer.from('1.2345678901234567e+20')
      if (scoreReads === 2) { await new Promise<void>(resolve => setTimeout(resolve, 30)); signal.throwIfAborted(); guard(); return Buffer.from('-inf') }
    }
    throw new Error('Unexpected synthetic command')
  } }
  const connections = new RedisConnections(async () => link), ctx = new Context(), abort = new AbortController()
  ctx.provide('profileContext', { name: 'fixture', dir: '.', patchPath: '', installAnchor: '', cwd: '.', home: '.', startedBundles: [], overlays: [], telemetryDisabledEnv: undefined })
  await ctx.plugin(SystemPrompt); await ctx.plugin(ToolRuntime); await ctx.plugin(NativeToolExecutor); await ctx.plugin(RedisRemoteService)
  const proxy = ctx.get('redisViewer') as unknown as RedisRemoteService & { [symbols.original]?: RedisRemoteService }, service = proxy[symbols.original] ?? proxy
  Reflect.set(service, 'connections', connections)
  const actions = service.uiActions
  const reader = new RedisAiReader(connections, session => actions.invalidateSession(session), async (session, target, expected, signal) => {
    const revision = actions.selectionRevision(session)
    if (revision === null || (expected !== null && revision !== expected)) throw new ConnectionFailure('stale')
    const current = () => actions.selectionRevision(session) === revision
    if (await actions.dispatch(session, { kind: 'confirmSelection' }, target, revision, current, signal) !== 'applied' || !current()) throw new ConnectionFailure('stale')
    return revision
  }, (session, revision) => { const current = actions.selectionRevision(session); return current !== null && (revision === null || current === revision) })
  await ctx.plugin({ name: 'zset-two-samples', inject: ['tools'], apply: (scope: Context) => registerRedisLocateTool(scope, reader, actions) })
  const agent = { id: 'a', ctx, session: { id: 'a' } } as unknown as Agent
  const connection = await connections.connect('a', { host: 'fixture', port: 6379, username: '', password: '', tls: null }, abort.signal)
  if (connection.id === null) throw new Error('Missing connection')
  const target = { id: connection.id, generation: connection.generation, db: 0 }
  const source = `
    import React from 'react'
    import { createRoot } from 'react-dom/client'
    import { ZSetView } from './src/client/ZSetView.tsx'
    import { CurrentSelection } from './src/client/CurrentSelection.tsx'
    import { SelectionEpochContext, useSelectionRevision } from './src/client/SelectionEpochContext.ts'
    import { SelectionEpoch } from './src/client/selection-epoch.ts'
    import { PreviewFormats } from './src/client/PreviewFormats.tsx'
    import { RefreshVisibility, KeyAutoRefresh } from './src/client/AutoRefresh.tsx'
    import { UiPanePresence } from './src/client/ui-pane-presence.ts'
    import { consumeUiActions } from './src/client/ui-actions.ts'
    import { installRedisStyles } from './src/client/styles.ts'
    import { KeyPresentation } from './src/client/KeyPresentation.tsx'
    const epoch = new SelectionEpoch(), panes = new UiPanePresence(), queue = [], target = ${JSON.stringify(target)}
    const abort = new AbortController(), tab = new AbortController()
    let wake, ended = false
    const notify = () => { const next = wake; wake = undefined; next?.() }
    const stream = { send: frame => { void window.hostSend(frame) }, end: () => {}, dispose: () => { ended = true; notify() }, async *[Symbol.asyncIterator]() { while (!ended) { const value = queue.shift(); if (value) { yield value; continue } await new Promise(resolve => { wake = resolve; if (ended || queue.length) notify() }) } } }
    const key = { base64: 'enNldA==', byteLength: 4, label: 'zset' }, old = { base64: 'b2xk', byteLength: 3, label: 'old' }
    const props = { target, selected: key, t: key => key, registerZSetHandler: handler => panes.registerZSetHandler('a', handler),
      readZSet: async request => ({ ok: true, value: { state: 'page', error: null, metadata: { type: 'zset', ttlMs: '-1', length: '1' }, mode: request.mode, entries: [{ member: old, score: '0', rank: request.mode === 'range' ? request.offset : null }], offset: request.mode === 'range' ? request.offset : null, nextOffset: null, cursor: null, sampledAt: '1970-01-01T00:00:00.000Z' } }),
      readActionPoint: async request => ({ ok: true, value: await window.hostPoint(request) }) }
    const publish = (request, signal) => epoch.publish(request, epoch.snapshot().revision, signal)
    function Holder() { const revision = useSelectionRevision(); return <CurrentSelection target={target} keyBase64={key.base64} revision={revision} suspended={false} publish={publish}><KeyPresentation><KeyAutoRefresh><div className="redis-key-view"><div className="redis-inspector" data-view="data"><ZSetView {...props} /></div></div></KeyAutoRefresh></KeyPresentation></CurrentSelection> }
    installRedisStyles(); panes.attach('a')
    createRoot(document.getElementById('root')).render(<section className="dsh-redis" style={{ height: 600 }}><div className="redis-connection"><SelectionEpochContext.Provider value={epoch}><RefreshVisibility.Provider value={{ visible: true, signal: tab.signal }}><PreviewFormats><Holder /></PreviewFormats></RefreshVisibility.Provider></SelectionEpochContext.Provider></div></section>)
    void consumeUiActions(async () => stream, abort.signal, (request, signal) => request.action.kind === 'confirmSelection' ? Promise.resolve(signal.aborted ? 'stale' : 'applied') : request.action.kind === 'selectZSetMember' ? panes.selectZSetMember('a', request, signal) : Promise.resolve('stale'), epoch)
    window.fixture = { abort, push: frame => { queue.push(frame); notify() } }
  `
  const built = await build({ stdin: { contents: source, resolveDir: process.cwd(), loader: 'jsx', sourcefile: 'zset-two-samples-browser.jsx' }, bundle: true, platform: 'browser', format: 'iife', jsx: 'automatic', write: false })
  const values: UiChannelInput[] = []
  let wake: (() => void) | undefined, ended = false, point: ActionPointReadResult | undefined
  const notify = () => { const next = wake; wake = undefined; next?.() }
  const uplink: AsyncIterable<UiChannelInput> = { async *[Symbol.asyncIterator]() { while (!ended) { const value = values.shift(); if (value !== undefined) { yield value; continue } await new Promise<void>(resolve => { wake = resolve; if (ended || values.length > 0) notify() }) } } }
  const browser = await chromium.launch({ executablePath: browserPath, headless: true })
  let pump: Promise<void> | undefined
  try {
    const page = await browser.newPage()
    await page.exposeFunction('hostSend', (frame: UiChannelInput) => { values.push(frame); notify() })
    await page.exposeFunction('hostPoint', async (request: ActionPointReadRequest) => { point = await service.readActionPoint(agent, request, abort.signal); return point })
    await page.setContent('<!doctype html><html><body><div id="root"></div></body></html>')
    await page.evaluate(() => { let sequence = 0; Object.defineProperty(crypto, 'randomUUID', { value: () => `12345678-1234-1234-1234-${String(++sequence).padStart(12, '0')}` }) })
    const stream = openUiActionChannel(actions, 'a', abort.signal, uplink, (request, source) => source === 'action' ? reader.commitSelection('a', request) : reader.setSelection('a', request))
    pump = (async () => { for await (const frame of stream) await page.evaluate((message: UiChannelMessage) => Reflect.get(window, 'fixture').push(message), frame) })()
    await page.addScriptTag({ content: built.outputFiles[0]!.text })
    await page.locator('[data-row-identity="b2xk"]').click({ timeout: 5000 })
    await expect.poll(() => actions.selectionRevision('a'), { timeout: 5000 }).not.toBeNull()
    expect(reader.status('a')).toMatchObject({ currentSelection: { selection: { keyBase64: 'enNldA==' } } })
    const result = await executeTool(ctx.tools, { callId: 'zset-two-samples' as string, name: 'redis_viewer_locate_zset_member', arguments: { memberBase64: 'AP8=' }, agent, signal: abort.signal })
    expect(result.isError).toBeFalsy()
    const value = JSON.parse(result.content.filter(item => item.type === 'text').map(item => item.text).join('')) as { outcome: string; score: string; sampledAt: string }
    expect(value).toMatchObject({ outcome: 'applied', score: '1.2345678901234567e+20', sampleNote: expect.stringContaining('面板单独再次采样') })
    expect(point).toMatchObject({ state: 'value', score: '-inf' })
    if (point === undefined) throw new Error('Missing UI point sample')
    expect(Date.parse(point.sampledAt)).toBeGreaterThan(Date.parse(value.sampledAt))
    const row = page.locator('[data-row-identity="AP8="]')
    expect(await row.getAttribute('aria-selected')).toBe('true')
    expect(await row.locator('[data-zset-score]').textContent()).toBe('-inf')
    expect(await row.locator('[data-located-zset-member] time').getAttribute('datetime')).toBe(point.sampledAt)
    expect(scoreReads).toBe(2)
    expect(commands.every(command => ['TYPE', 'ZSCORE', 'PTTL'].includes(command))).toBe(true)
    await page.evaluate(() => Reflect.get(window, 'fixture').abort.abort())
  } finally {
    abort.abort(); ended = true; notify(); await pump; await browser.close(); reader.dispose(); connections.dispose(); await ctx.fiber.dispose()
  }
}, 30000)
