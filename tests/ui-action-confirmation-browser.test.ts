import RemoteAccess from '@deepseek-ai/dsh-api-remote-access'
import { ownerPeer } from './gateway-fixture.ts'
import { existsSync } from 'node:fs'
import { build } from 'esbuild'
import { chromium } from 'playwright-core'
import { expect, it } from 'vitest'
import { Context, symbols } from '@deepseek-ai/cordis'
import Gateway from '@deepseek-ai/dsh-api-gateway'
import Registry from '@deepseek-ai/dsh-typert-registry'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime from '@deepseek-ai/dsh-tools'
import type { Agent } from '@deepseek-ai/dsh-agent'
import type { ActionPointReadRequest, UiAction, UiChannelInput, UiChannelMessage } from '../src/domain.ts'
import { RedisConnections, type RedisLink } from '../src/host/connection-service.ts'
import { RedisAiReader } from '../src/host/ai-reader.ts'
import { registerRedisRefreshTool } from '../src/host/ai-ui-tools.ts'
import { openUiActionChannel } from '../src/host/ui-action-channel.ts'
import { RedisRemoteService } from '../src/remote-service.ts'
import { TYPERT } from '../src/typert.host.ts'

const browserPath = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/chromium'].find(path => existsSync(path))

it.skipIf(browserPath === undefined).each(['delivered', 'lost', 'lost-publish-ack', 'manual-aba', 'hidden', 'multiple', 'refresh', 'refresh-delayed', 'refresh-user-change', 'refresh-hidden'] as const)('confirms the rendered List selection through the real Host stream when acknowledgement is %s', async mode => {
  if (browserPath === undefined) throw new Error('Missing browser')
  const commands: string[] = []
  const link: RedisLink = { close: () => undefined, onFailure: () => () => undefined, async execute(command, _args, signal, guard) {
    signal.throwIfAborted(); guard(); commands.push(command)
    if (command === 'TYPE') return 'list'
    if (command === 'PTTL') return -1n
    if (command === 'LLEN') return 3n
    if (command === 'LRANGE') return [Buffer.from('v')]
    throw new Error('Unexpected synthetic command')
  } }
  const ctx = new Context(), connections = new RedisConnections(async () => link), hostAbort = new AbortController()
  ctx.provide('profileContext', { name: 'fixture', dir: '.', patchPath: '', installAnchor: '', cwd: '.', home: '.', startedBundles: [], overlays: [], telemetryDisabledEnv: undefined })
  await ctx.plugin(Registry); await ctx.plugin(RemoteAccess); await ctx.plugin(Gateway, {}); await ctx.plugin(RedisRemoteService)
  ctx.typert.register({ ...TYPERT, face: 'host' })
  const agent = { id: 'fixture-agent', ctx, session: { id: 'a' } } as unknown as Agent
  ctx.typert.lookups.register('agent', { parameter: 'agent', wire: 'agentId', hostTypeSymbol: '@deepseek-ai/dsh-agent#Agent', wireTypeSymbol: '@deepseek-ai/dsh-session/types#SessionId', resolve: id => id === 'a' ? agent : undefined })
  const proxy = ctx.get('redisViewer') as unknown as RedisRemoteService & { [symbols.original]?: RedisRemoteService }, service = proxy[symbols.original] ?? proxy
  Reflect.set(service, 'connections', connections)
  const coordinator = service.uiActions
  const reader = new RedisAiReader(connections, session => coordinator.invalidateSession(session), async (session, selectionTarget, expected, signal) => {
    const revision = coordinator.selectionRevision(session)
    if (revision === null || (expected !== null && expected !== revision)) throw new Error('Selection unavailable')
    const current = () => coordinator.selectionRevision(session) === revision
    const outcome = await coordinator.dispatch(session, { kind: 'confirmSelection' }, selectionTarget, revision, current, signal, 3000)
    if (outcome !== 'applied' || !current()) throw new Error('Selection changed')
    return revision
  }, (session, revision) => { const current = coordinator.selectionRevision(session); return current !== null && (revision === null || current === revision) })
  await ctx.plugin(SystemPrompt); await ctx.plugin(ToolRuntime)
  await ctx.plugin({ name: 'refresh-gateway-tool', inject: ['tools'], apply: (scope: Context) => registerRedisRefreshTool(scope, reader, coordinator) })
  const connection = await connections.connect('a', { host: 'fixture', port: 6379, username: '', password: '', tls: null }, hostAbort.signal)
  if (connection.id === null) throw new Error('Missing synthetic connection')
  const target = { id: connection.id, generation: connection.generation, db: 0 }
  const source = `
    import React from 'react'
    import { createRoot } from 'react-dom/client'
    import { ListView } from './src/client/ListView.tsx'
    import { CurrentSelection } from './src/client/CurrentSelection.tsx'
    import { SelectionEpochContext, useSelectionRevision } from './src/client/SelectionEpochContext.ts'
    import { SelectionEpoch } from './src/client/selection-epoch.ts'
    import { PreviewFormats } from './src/client/PreviewFormats.tsx'
    import { RefreshVisibility, KeyAutoRefresh } from './src/client/AutoRefresh.tsx'
    import { UiPanePresence } from './src/client/ui-pane-presence.ts'
    import { consumeUiActions } from './src/client/ui-actions.ts'
    import { installRedisStyles } from './src/client/styles.ts'
    import { KeyPresentation } from './src/client/KeyPresentation.tsx'
    const epoch = new SelectionEpoch(), panes = new UiPanePresence(), queue = []
    const abort = new AbortController(), tab = new AbortController(), target = ${JSON.stringify(target)}
    let wake, ended = false, reads = 0, releaseRefresh
    const mode = ${JSON.stringify(mode)}
    const notify = () => { const next = wake; wake = undefined; next?.() }
    const stream = { send: frame => { void window.hostSend(frame) }, end: () => {}, dispose: () => { ended = true; notify() }, async *[Symbol.asyncIterator]() { while (!ended) { const value = queue.shift(); if (value) { yield value; continue } await new Promise(resolve => { wake = resolve; if (ended || queue.length) notify() }) } } }
    const key = { base64: 'bGlzdA==', byteLength: 4, label: 'list' }, value = { base64: 'dg==', byteLength: 1, fullByteLength: 1, suffix: '' }
    const props = { target, selected: key, t: key => key, registerListHandler: handler => panes.registerListHandler('a', handler), readActionPoint: async request => ({ ok: true, value: await window.hostPoint(request) }),
      readList: async request => { reads++; if (mode.startsWith('refresh-') && reads > 1) await new Promise(resolve => { releaseRefresh = resolve }); return { ok: true, value: { state: 'page', error: null, metadata: { type: 'list', ttlMs: '-1', length: '3' }, entries: request.count === 1 ? [{ index: request.offset, value }] : [{ index: '0', value }, { index: '1', value }, { index: '2', value }], offset: request.offset, nextOffset: null, sampledAt: '1970-01-01T00:00:00.000Z' } } } }
    const publish = (request, signal) => epoch.publish(request, epoch.snapshot().revision, signal)
    function Holder() { const revision = useSelectionRevision(); return <CurrentSelection target={target} keyBase64={key.base64} revision={revision} suspended={false} publish={publish}><KeyPresentation><KeyAutoRefresh action={{ register: handler => panes.registerRefreshHandler('a', handler), target, keyBase64: key.base64 }}><div className="redis-key-view"><div className="redis-inspector" data-view="data"><ListView {...props} /></div></div></KeyAutoRefresh></KeyPresentation></CurrentSelection> }
    installRedisStyles(); const detach = panes.attach('a')
    createRoot(document.getElementById('root')).render(<section className="dsh-redis" style={{ height: 600 }}><div className="redis-connection"><SelectionEpochContext.Provider value={epoch}><RefreshVisibility.Provider value={{ visible: true, signal: tab.signal }}><PreviewFormats><Holder /></PreviewFormats></RefreshVisibility.Provider></SelectionEpochContext.Provider></div></section>)
    void consumeUiActions(async () => stream, abort.signal, (request, signal) => request.action.kind === 'selectListIndex' ? panes.selectListIndex('a', request, signal) : request.action.kind === 'refresh' ? panes.refresh('a', request, signal) : request.action.kind === 'confirmSelection' && !signal.aborted && epoch.current(request.selectionRevision) && panes.count('a') === 1 ? Promise.resolve('applied') : Promise.resolve('stale'), epoch)
    window.fixture = { epoch, abort, reads: () => reads, releaseRefresh: () => releaseRefresh?.(), hide: () => { epoch.invalidate(); detach(); tab.abort() }, push: frame => { queue.push(frame); notify() } }
  `
  const built = await build({ stdin: { contents: source, resolveDir: process.cwd(), loader: 'jsx', sourcefile: 'ui-action-confirmation-browser.jsx' }, bundle: true, platform: 'browser', format: 'iife', jsx: 'automatic', write: false })
  const values: UiChannelInput[] = [], observed: UiChannelInput[] = []
  let wake: (() => void) | undefined, ended = false, actionId: string | undefined, publicationId: string | undefined, held: UiChannelInput | undefined, actionWrites = 0
  const notify = () => { const next = wake; wake = undefined; next?.() }
  const uplink: AsyncIterable<UiChannelInput> = { async *[Symbol.asyncIterator]() { while (!ended) { const value = values.shift(); if (value !== undefined) { yield value; continue } await new Promise<void>(resolve => { wake = resolve; if (ended || values.length > 0) notify() }) } } }
  const browser = await chromium.launch({ executablePath: browserPath, headless: true })
  let pump: Promise<void> | undefined
  try {
    const page = await browser.newPage()
    page.on('pageerror', error => { console.error('Confirmation fixture:', error.message) })
    await page.exposeFunction('hostPoint', (request: ActionPointReadRequest) => ctx.typertGateway.invoke({ peer: ownerPeer(ctx), namespace: 'redisViewer', method: 'readActionPoint', args: { agentId: 'a', request }, signal: hostAbort.signal }))
    await page.exposeFunction('hostSend', (frame: UiChannelInput) => {
      observed.push(frame)
      if ('kind' in frame && frame.kind === 'publishSelection' && frame.actionRequestId !== undefined) publicationId = frame.requestId
      if ((mode === 'manual-aba' || mode === 'hidden' || mode === 'multiple') && 'kind' in frame && frame.kind === 'publishSelection' && frame.actionRequestId !== undefined) { held = frame; return }
      values.push(frame); notify()
    })
    await page.setContent('<!doctype html><html><body><div id="root"></div></body></html>')
    // about:blank is not a secure context; DSH localhost supplies randomUUID natively.
    await page.evaluate(() => { let sequence = 0; Object.defineProperty(crypto, 'randomUUID', { value: () => `12345678-1234-1234-1234-${String(++sequence).padStart(12, '0')}` }) })
    const host = openUiActionChannel(coordinator, 'a', hostAbort.signal, uplink, (request, source) => {
      if (source === 'action') actionWrites++
      return mode.startsWith('refresh') ? (source === 'action' ? reader.commitSelection('a', request) : reader.setSelection('a', request)) : { accepted: true }
    })
    pump = (async () => {
      for await (const frame of host) {
        if (frame.kind === 'action') actionId = frame.request.requestId
        if (mode === 'lost' && frame.kind === 'selectionResult' && frame.requestId === actionId && frame.accepted) { hostAbort.abort(); ended = true; notify(); return }
        if (mode === 'lost-publish-ack' && frame.kind === 'selectionResult' && frame.requestId === publicationId && frame.accepted) { hostAbort.abort(); ended = true; notify(); return }
        await page.evaluate((message: UiChannelMessage) => Reflect.get(window, 'fixture').push(message), frame)
      }
    })()
    await page.addScriptTag({ content: built.outputFiles[0]!.text })
    await page.locator('[data-row-identity="0"]').click({ timeout: 5000 })
    try { await expect.poll(() => coordinator.selectionRevision('a'), { timeout: 5000 }).not.toBeNull() }
    catch (error) { console.info('Confirmation fixture state:', observed, await page.evaluate(() => Reflect.get(window, 'fixture').epoch.snapshot())); throw error }
    const revision = coordinator.selectionRevision('a')
    if (revision === null) throw new Error('Missing synchronized revision')
    const readsBefore = await page.evaluate(() => Reflect.get(window, 'fixture').reads())
    const refreshing = mode.startsWith('refresh')
    const action: UiAction = refreshing ? { kind: 'refresh', target, keyBase64: 'bGlzdA==' } : { kind: 'selectListIndex', keyBase64: 'bGlzdA==', index: '2' }
    const result = refreshing ? ctx.tools.execute({ callId: 'refresh-tool-fixture' as Parameters<typeof ctx.tools.execute>[0]['callId'], name: 'redis_viewer_refresh', arguments: {}, agent, signal: new AbortController().signal }).then(response => {
      const text = response.content.filter(block => block.type === 'text').map(block => block.text).join('')
      if (response.isError) throw new Error(text)
      return (JSON.parse(text) as { outcome: string }).outcome
    }) : coordinator.dispatch('a', action, target, revision, () => true, new AbortController().signal)
    if (mode === 'refresh') {
      expect(await result).toBe('applied')
      expect(await page.evaluate(() => Reflect.get(window, 'fixture').reads())).toBeGreaterThan(readsBefore)
      expect(await page.locator('[data-row-identity="0"]').getAttribute('aria-selected')).toBe('true')
    } else if (mode === 'refresh-delayed' || mode === 'refresh-user-change' || mode === 'refresh-hidden') {
      let finished = false
      void result.then(() => { finished = true })
      await expect.poll(() => page.evaluate(() => Reflect.get(window, 'fixture').reads()), { timeout: 5000 }).toBeGreaterThan(readsBefore)
      expect(finished).toBe(false)
      if (mode === 'refresh-user-change') {
        await page.evaluate(() => { const events: string[] = []; Reflect.set(window, 'refreshEvents', events); for (const kind of ['pointerdown', 'pointerup', 'click']) document.addEventListener(kind, event => { const node = event.target instanceof Element ? event.target.closest('[data-row-identity]') : null; events.push(`${kind}:${node?.getAttribute('data-row-identity') ?? '-'}`) }, true) })
        await page.locator('[data-row-identity="1"]').click()
      }
      else if (mode === 'refresh-hidden') await page.evaluate(() => Reflect.get(window, 'fixture').hide())
      if (mode !== 'refresh-delayed') expect(await result).toBe('stale')
      if (mode === 'refresh-user-change') expect(await page.evaluate(() => Reflect.get(window, 'refreshEvents'))).toContain('click:1')
      await page.evaluate(() => Reflect.get(window, 'fixture').releaseRefresh())
      if (mode === 'refresh-delayed') expect(await result).toBe('applied')
      if (mode === 'refresh-user-change') expect(await page.locator('[data-row-identity="1"]').getAttribute('aria-selected')).toBe('true')
    } else if (mode === 'delivered') {
      expect(await result).toBe('applied')
      expect(await page.locator('[data-row-identity="2"]').getAttribute('aria-selected')).toBe('true')
      expect(await page.locator('[data-row-identity="2"]').getAttribute('aria-disabled')).toBeNull()
      await expect.poll(() => coordinator.selectionRevision('a'), { timeout: 5000 }).not.toBeNull()
    } else if (mode === 'lost' || mode === 'lost-publish-ack') {
      expect(await result).toBe('unknown')
      expect(actionWrites).toBe(mode === 'lost' ? 0 : 1)
    }
    else if (mode === 'manual-aba') {
      await expect.poll(() => held, { timeout: 5000 }).toBeDefined()
      await page.locator('[data-row-identity="1"]').click()
      await page.locator('[data-row-identity="2"]').click()
      expect(await result).toBe('unknown')
      if (held !== undefined) { values.push(held); notify() }
      expect(await page.locator('[data-row-identity="2"]').getAttribute('aria-selected')).toBe('true')
    } else if (mode === 'hidden') {
      await expect.poll(() => held, { timeout: 5000 }).toBeDefined()
      await page.evaluate(() => Reflect.get(window, 'fixture').hide())
      await expect.poll(() => observed.some(frame => 'kind' in frame && frame.kind === 'selection' && !frame.synchronized && held !== undefined && 'revision' in held && frame.revision > held.revision), { timeout: 5000 }).toBe(true)
      if (held !== undefined) { values.push(held); notify() }
      expect(await result).toBe('unknown')
      expect(coordinator.selectionRevision('a')).toBeNull()
    } else {
      await expect.poll(() => held, { timeout: 5000 }).toBeDefined()
      const secondAbort = new AbortController()
      const second = openUiActionChannel(coordinator, 'a', secondAbort.signal, { async *[Symbol.asyncIterator]() { await new Promise<void>(() => undefined) } }, () => ({ accepted: true }))
      const waiting = second.next()
      expect(await result).toBe('unknown')
      secondAbort.abort(); expect((await waiting).done).toBe(true)
      if (held !== undefined) { values.push(held); notify() }
    }
    if (!refreshing) expect(commands).toContain('LRANGE')
    await page.evaluate(() => Reflect.get(window, 'fixture').abort.abort())
  } finally {
    hostAbort.abort(); ended = true; notify(); await pump; await browser.close(); reader.dispose(); connections.dispose(); await ctx.fiber.dispose()
  }
}, 30000)
