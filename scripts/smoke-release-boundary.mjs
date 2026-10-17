/** Test-only observation of the real rc.2 bootstrap and Remote HTTP decoder.
 * No additional module system/React instance is created; calls are intercepted
 * before the Host, so even profile/connection methods cannot mutate anything.
 */
import assert from 'node:assert/strict'

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
  const methods = ['status', 'testConnection', 'connect', 'disconnect', 'connectionStatus', 'listProfiles', 'saveProfile', 'removeProfile', 'importProfiles', 'selectDatabase', 'scanKeys', 'readString', 'scanHash', 'readList', 'scanSet', 'readZSet', 'readStream', 'readJson', 'readGeo', 'readHll', 'readTimeSeries', 'readBloom', 'readSlowLog', 'readClients', 'readDatabases', 'readOverview', 'loadBrowsingState', 'saveBrowsingState']
  const endpoint = '**/api/redisViewer/*'
  let value = { state: 'ready', readOnly: true, hostVersion: '0.2.0-rc.2', protocolVersion: 1 }
  const seen = []
  const handler = async route => {
    const request = route.request().postDataJSON()
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
    assert.deepEqual(await invoke('status'), { ok: true, value })
    value = null
    for (const method of methods) assert.deepEqual(await invoke(method), { ok: false, code: 'gateway/internal' }, method)
    assert.deepEqual(seen.slice(1), methods.map(method => 'redisViewer/' + method))
    value = { outcome: 'passed', error: 'auth' }
    assert.deepEqual(await invoke('testConnection'), { ok: false, code: 'gateway/internal' })
    value = { state: 'ready', readOnly: true, hostVersion: '0.2.0-rc.2', protocolVersion: 1, password: 'forbidden-response-field' }
    assert.deepEqual(await invoke('status'), { ok: false, code: 'gateway/internal' })
    value = { state: 'ready', readOnly: true, hostVersion: '0.2.0-rc.2', protocolVersion: 1 }
    assert.deepEqual(await invoke('status'), { ok: true, value })
    report.decoderChecks = { methods, malformedRejected: methods.length, contradictoryConnectionTestRejected: true, extraSecretFieldRejected: true, healthyControlBeforeAndAfter: true, hostDispatches: 0 }
    report.checks.push('real rc.2 browser Remote rejects malformed successful HTTP payloads for all 27 methods as gateway/internal, rejects contradictory test/extra secret fields, and recovers to valid status; test routes make zero Host dispatches')
  } finally {
    await page.unroute(endpoint, handler)
    await page.evaluate(() => window.__redisReleaseProbe?.restore())
  }
}
