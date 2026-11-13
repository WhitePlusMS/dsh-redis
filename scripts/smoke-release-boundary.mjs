/** Test-only observation of the pinned DSH bootstrap and Remote HTTP decoder.
 * No additional module system/React instance is created; calls are intercepted
 * before the Host, so even profile/connection methods cannot mutate anything.
 */
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { chromium } from 'playwright-core'
import { DSH_BASELINE, PROTOCOL_VERSION } from '../lib/domain.js'
import { redisDescriptors } from '../lib/typert.shared.js'

export function observeReleaseRuntime() {
  const probe = {}
  window.__redisReleaseProbe = probe
  let facade
  const wrapLoad = target => {
    const load = target.load
    const wrapper = function (registration) {
      if (registration.id === 'dsh-redis') {
        const factory = registration.factory
        registration = { ...registration, factory: function (require, ...rest) {
          const observedRequire = Object.assign(function (name) {
            const value = require(name)
            if (name === 'react') probe.pluginReact = value
            return value
          }, require)
          const exported = Reflect.apply(factory, this, [observedRequire, ...rest])
          const apply = exported.apply
          return { ...exported, apply: function (ctx, ...args) {
            probe.ctx = ctx
            return Reflect.apply(apply, this, [ctx, ...args])
          } }
        } }
      }
      return Reflect.apply(load, this, [registration])
    }
    target.load = wrapper
    probe.restoreLoad = () => { if (target.load === wrapper) target.load = load }
  }
  Object.defineProperty(window, '__ModuleLoader__', { configurable: true, enumerable: true,
    get: () => facade,
    set: value => {
      facade = value
      wrapLoad(value)
      const create = value.create
      const wrapper = function (...args) {
        const modules = Reflect.apply(create, this, args)
        probe.modules = modules
        // The constructor replaces queue.load with live.load. Observe later
        // arrivals too, without changing registration order or factory inputs.
        wrapLoad(value)
        return modules
      }
      value.create = wrapper
      probe.restoreCreate = () => { if (value.create === wrapper) value.create = create }
    },
  })
  probe.restore = () => {
    probe.restoreLoad?.(); probe.restoreCreate?.()
    Object.defineProperty(window, '__ModuleLoader__', { value: facade, configurable: true, enumerable: true, writable: true })
    delete window.__redisReleaseProbe
  }
}

export async function smokeReleaseBoundary({ page, browser, sessionId, report }) {
  const runtime = await page.evaluate(async () => {
    const probe = window.__redisReleaseProbe
    if (!probe?.ctx || !probe.modules || !probe.pluginReact) throw new Error('Real plugin/bootstrap was not observed')
    const react = await probe.modules.import('react')
    return { reactVersion: react.version, pluginUsesSameReact: probe.pluginReact === react }
  })
  assert.equal(runtime.reactVersion, '18.3.1')
  assert.equal(runtime.pluginUsesSameReact, true)
  report.runtime = { ...runtime, chromeVersion: browser.version(), nodeVersion: process.versions.node }
  report.checks.push('actual native plugin require(react) is the identical Web seed object returned by the real module system; React.version=18.3.1')
  // The bidirectional stream is exercised by ui-action-gateway.test.ts.
  const methods = redisDescriptors.filter(descriptor => descriptor.mode !== 'stream').map(descriptor => descriptor.method)
  const endpoint = '**/api/redisViewer/*'
  const healthy = { state: 'ready', sidebarReadOnly: true, aiWriteAvailable: true, dshBaseline: DSH_BASELINE, protocolVersion: PROTOCOL_VERSION }
  let value = healthy
  const seen = []
  const handler = async route => {
    const request = route.request().postDataJSON()
    if (request?.payload?.args?.agentId !== sessionId) return route.fallback()
    seen.push(request.method)
    await route.fulfill({ status: 200, json: { type: 'server-response', rpcId: request.rpcId, result: { ok: true, value } } })
  }
  const invoke = method => page.evaluate(async ({ method, sessionId }) => {
    const remote = window.__redisReleaseProbe.ctx.get('remote.redisViewer')
    const result = await remote[method](sessionId, {}, new AbortController().signal)
    return result.ok ? { ok: true, value: result.value } : { ok: false, code: result.error.code }
  }, { method, sessionId })
  await page.route(endpoint, handler)
  try {
    const first = await page.evaluate(async session => {
      const { ctx } = window.__redisReleaseProbe
      const pane = ctx.slots.entries('sidebar.right.pane.tab').find(entry => entry.options.key === 'dsh-redis')
      if (!pane) throw new Error('Redis pane registration is missing')
      return pane.inject(session).status(new AbortController().signal)
    }, sessionId)
    assert.deepEqual(first, { ok: true, value })
    value = null
    for (const method of methods) assert.deepEqual(await invoke(method), { ok: false, code: 'gateway/internal' }, method)
    assert.deepEqual(seen.slice(1), methods.map(method => 'redisViewer/' + method))
    value = { state: 'connected', id: null, generation: 0, db: 0, target: null, error: 'auth' }
    assert.deepEqual(await invoke('connectionStatus'), { ok: false, code: 'gateway/internal' })
    value = { ...healthy, password: 'forbidden-response-field' }
    assert.deepEqual(await invoke('status'), { ok: false, code: 'gateway/internal' })
    value = healthy
    assert.deepEqual(await invoke('status'), { ok: true, value })
    report.decoderChecks = { methods, malformedRejected: methods.length, contradictoryConnectionRejected: true, extraSecretFieldRejected: true, healthyControlBeforeAndAfter: true, hostDispatches: 0 }
    report.checks.push(`native DSH browser Remote rejects malformed successful payloads for ${methods.length} unary methods, contradictory connection and extra secret fields, and recovers`)
  } finally {
    await page.unroute(endpoint, handler)
    await page.evaluate(() => window.__redisReleaseProbe?.restore())
  }
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [privateFile] = process.argv.slice(2)
  const executablePath = process.env.REDIS_BROWSER_EXECUTABLE
  assert(privateFile && executablePath, 'Pass the owned smoke-dsh private file and set REDIS_BROWSER_EXECUTABLE')
  const { readyUrl, control } = JSON.parse(await readFile(privateFile, 'utf8'))
  const url = new URL(readyUrl), stop = new URL('/stop', control)
  assert(url.protocol === 'http:' && url.hostname === '127.0.0.1' && stop.protocol === 'http:' && stop.hostname === '127.0.0.1', 'Use the owned loopback DSH fixture')
  const report = { checks: [] }
  let browser
  try {
    browser = await chromium.launch({ executablePath })
    const page = await browser.newPage()
    await page.addInitScript(observeReleaseRuntime)
    await page.goto(url.href)
    await page.waitForFunction(() => Boolean(window.__redisReleaseProbe?.ctx))
    // Calls are fulfilled by the route below and never use a real session.
    await smokeReleaseBoundary({ page, browser, sessionId: 'release-wire-fixture', report })
    console.log(JSON.stringify(report))
  } finally {
    try { await browser?.close() }
    finally {
      const response = await fetch(stop, { method: 'POST', signal: AbortSignal.timeout(10_000) })
      assert(response.ok, 'Owned DSH fixture verification failed')
    }
  }
}
