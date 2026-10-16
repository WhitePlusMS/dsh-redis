/** Native INFO acceptance against the installed package and an owned real Redis.
 * Explicit HTTP fault cases are labeled separately from real server samples.
 */
import assert from 'node:assert/strict'
import { resolve } from 'node:path'
import { writeFile } from 'node:fs/promises'
import { RESP_TYPES } from 'redis'
import { until } from './redis-fixture.mjs'
import { openConnectionSettings, findLoadedKey, assertSelectedIdentity, resizeSidebar } from './native-view-controls.mjs'

export async function smokeServerOverview({ page, rpc, fixture, pane, keys, scanAll, artifacts, report, workspaceId }) {
  const proxy = fixture.recoveryProxy
  assert(proxy, 'Overview acceptance requires its owned real-Redis delay proxy')
  const record = message => { report.checks.push(message); console.log('[smoke check] ' + message) }
  const endpoint = '**/api/redisViewer/readOverview'
  const overview = pane.locator('dialog.redis-overview-dialog'), open = pane.getByRole('button', { name: 'Server overview', exact: true })
  const refresh = overview.getByRole('button', { name: 'Refresh snapshot', exact: true }), close = overview.getByRole('button', { name: 'Close', exact: true })
  const refreshStatus = pane.getByRole('button', { name: 'Refresh status', exact: true })
  const [statusResponse] = await Promise.all([page.waitForResponse(response => response.url().endsWith('/api/redisViewer/connectionStatus')), refreshStatus.click()])
  const a = statusResponse.request().postDataJSON().payload.args.agentId
  let view = (await statusResponse.json()).result.value
  const target = value => ({ id: value.id, generation: value.generation, db: value.db })
  const ownResponse = response => response.url().endsWith('/api/redisViewer/readOverview') && response.request().postDataJSON().payload.args.agentId === a
  const b = await rpc('session/create', { request: { workspaceId } })
  let bView
  report.overview = { realRedisVersion: null, cancellationMs: null, productionTimeoutMs: null, explicitResponseFaultInjection: true }
  const buffers = fixture.admin.withTypeMapping({ [RESP_TYPES.BLOB_STRING]: Buffer })
  const sourceKeys = [Buffer.from('native:9'), Buffer.from([255, 0, 13, 10, 128])]
  const originals = await Promise.all(sourceKeys.map(async key => ({ key, dump: await buffers.sendCommand(['DUMP', key]), expiry: await fixture.admin.sendCommand(['PEXPIRETIME', key]) })))
  async function read(button = refresh) {
    const [response] = await Promise.all([page.waitForResponse(ownResponse), button.click()])
    const body = await response.json(); assert(body.result?.ok)
    await until(async () => await refresh.isEnabled(), 'native INFO operation settled')
    return body.result.value
  }
  async function checkB() {
    assert.deepEqual(await rpc('redisViewer/connectionStatus', { agentId: b.sessionId, request: {} }), bView)
    const result = await rpc('redisViewer/readString', { agentId: b.sessionId, request: { target: target(bView), keyBase64: Buffer.from('native:9').toString('base64'), offset: '0', count: 256 } })
    assert.equal(result.base64, 'OQ==')
  }
  async function reconnect(previous) {
    if (await overview.isVisible()) await close.click()
    await refreshStatus.click(); await openConnectionSettings(pane)
    const password = pane.locator('input[name="password"]'); assert.equal(await password.inputValue(), '')
    const mark = proxy.commands.length
    await password.fill(fixture.settings.password)
    const [response] = await Promise.all([page.waitForResponse(response => response.url().endsWith('/api/redisViewer/connect') && response.request().postDataJSON().payload.args.agentId === a), pane.getByRole('button', { name: 'Connect', exact: true }).click()])
    const current = (await response.json()).result.value
    assert.equal(current.state, 'connected'); assert.equal(current.id, previous.id); assert(current.generation > previous.generation)
    await pane.locator('.redis-connected').waitFor()
    assert.deepEqual(proxy.commands.slice(mark).map(value => value.command), ['AUTH', 'PING'])
    assert.equal(await overview.locator('[data-info-field]').count(), 0)
    return current
  }
  try {
    bView = await rpc('redisViewer/connect', { agentId: b.sessionId, request: proxy.settings }); await checkB()
    await resizeSidebar(page, pane, 900)
    assert.equal(await scanAll('*'), fixture.expectedKeyCount)
    const identity = Buffer.from('native:9').toString('base64')
    await (await findLoadedKey(keys, identity)).click(); await assertSelectedIdentity(keys, identity)
    const position = await keys.locator('.redis-key-list').evaluate(element => element.scrollTop)
    const infoBefore = proxy.commands.filter(value => value.command === 'INFO').length
    assert.equal(infoBefore, 0, 'Opening sidebar, connecting and browsing must not automatically call INFO')
    const snapshot = await read(open)
    assert.equal(snapshot.state, 'value'); assert.equal(snapshot.fields.redis_version, '8.2.6'); assert.equal(snapshot.fields.redis_mode, 'standalone')
    assert.equal(Object.keys(snapshot.fields).length, 16); assert.equal(await overview.locator('[data-info-field]').count(), 16); assert.equal(await overview.locator('.redis-overview-card').count(), 4)
    assert.equal(proxy.commands.filter(value => value.command === 'INFO').length, 1)
    assert.equal(proxy.commands.find(value => value.command === 'INFO').firstArgumentBase64, undefined)
    report.overview.realRedisVersion = snapshot.fields.redis_version
    report.overview.snapshot = snapshot
    await writeFile(resolve(artifacts, 'native-overview-real-sample.json'), JSON.stringify(snapshot, null, 2) + '\n')
    await page.screenshot({ path: resolve(artifacts, 'native-overview-cards.png'), fullPage: true })
    await close.click(); await overview.waitFor({ state: 'hidden' })
    assert.equal(await overview.locator('[data-info-field]').count(), 0)
    assert.equal(await keys.locator('.redis-key-list').evaluate(element => element.scrollTop), position)
    await assertSelectedIdentity(keys, identity)
    const catalog = await keys.locator('.redis-key-catalog').boundingBox(), detail = await keys.locator('.redis-key-detail').boundingBox()
    assert(catalog && detail && catalog.x + catalog.width <= detail.x + 1)
    record('native installed INFO reader selects sixteen exact Redis 8.2.6 fields into four cards; no automatic INFO, one no-argument command per explicit opening, and closing preserves the original Key/detail split, raw selection and scroll')

    await page.route(endpoint, async route => {
      const response = await route.fetch(), body = await response.json(); assert(body.result?.ok)
      body.result.value.fields.used_memory = '9007199254740993'; body.result.value.fields.maxmemory = '0'; body.result.value.fields.keyspace_hits = null
      await route.fulfill({ response, json: body })
    })
    await read(open)
    assert.equal((await overview.locator('[data-info-field="used_memory"]').innerText()).replace(/\s+/g, ' '), '9007199254740993 B')
    assert.equal((await overview.locator('[data-info-field="maxmemory"]').innerText()).replace(/\s+/g, ' '), '0 B')
    assert.equal(await overview.locator('[data-info-field="keyspace_hits"]').innerText(), 'Not reported')
    await page.unroute(endpoint)
    await page.route(endpoint, async route => {
      const response = await route.fetch(), body = await response.json(); assert(body.result?.ok)
      body.result.value.fields.used_memory = 9007199254740992
      await route.fulfill({ response, json: body })
    })
    await read(); await overview.getByRole('alert').filter({ hasText: 'Plugin communication failed' }).waitFor()
    assert.equal(await overview.locator('[data-info-field]').count(), 0)
    await page.unroute(endpoint)
    record('labeled HTTP response fault cases render beyond-53-bit integer text, zero bytes and unreported fields distinctly; actual browser decoder rejects a numeric metric before cards can render')

    await fixture.admin.sendCommand(['ACL', 'SETUSER', 'default', '-info'])
    try { assert.equal((await read()).error, 'permission'); await overview.getByRole('alert').filter({ hasText: 'not allowed to perform' }).waitFor(); assert.equal(await overview.locator('[data-info-field]').count(), 0) }
    finally { await fixture.admin.sendCommand(['ACL', 'SETUSER', 'default', '+info']) }
    assert.equal((await read()).state, 'value')
    record('real isolated Redis ACL -info refuses the fixed diagnostic, clears old cards and exposes only the safe permission message; restoring permission requires explicit refresh')

    const hold = proxy.holdNext('INFO')
    await refresh.click(); await until(() => hold.received, 'actual INFO response held')
    const cancelAt = Date.now(); await overview.getByRole('button', { name: 'Cancel read', exact: true }).click()
    report.overview.cancellationMs = Date.now() - cancelAt
    assert.equal(await overview.locator('[data-info-field]').count(), 0)
    const mark = proxy.commands.length
    await Promise.all([page.waitForRequest(request => request.url().endsWith('/api/redisViewer/readOverview')), refresh.click()])
    await close.click(); await overview.waitFor({ state: 'hidden' }); await checkB()
    assert.equal(proxy.commands.slice(mark).filter(value => value.connectionId === hold.connectionId).length, 0)
    hold.release()
    assert.equal((await read(open)).state, 'value')
    assert.equal(proxy.commands.slice(mark).filter(value => value.connectionId === hold.connectionId && value.command === 'INFO').length, 1)
    record('native cancel and dialog close propagate actual Host cancellation; the queued INFO never dispatches, held real reply drains, late data stays cleared and explicit reopen reads fresh on the same generation while B stays usable')

    const timeout = proxy.holdNext('INFO'), started = Date.now()
    await refresh.click(); await until(() => timeout.received, 'actual INFO deadline response held'); await checkB()
    await overview.getByRole('alert').filter({ hasText: 'Redis operation timed out.' }).waitFor({ timeout: 20000 })
    report.overview.productionTimeoutMs = Date.now() - started
    assert(report.overview.productionTimeoutMs >= 9500 && report.overview.productionTimeoutMs < 20000)
    assert.equal(await overview.locator('[data-info-field]').count(), 0)
    await until(() => proxy.connections.find(value => value.id === timeout.connectionId)?.closed, 'timed-out INFO socket closed')
    timeout.release(); await checkB()
    await page.screenshot({ path: resolve(artifacts, 'native-overview-timeout.png'), fullPage: true })
    const old = view; view = await reconnect(view)
    const beforeStale = proxy.commands.length
    assert.equal((await rpc('redisViewer/readOverview', { agentId: a, request: { target: target(old) } })).error, 'stale')
    assert.equal(proxy.commands.length, beforeStale)
    assert.equal((await read(open)).state, 'value')
    record('native INFO uses the production ten-second timeout, clears all old metrics and closes only A; manual status/password/reconnect advances generation without INFO replay, and the prior target dispatches nothing')

    const eof = proxy.holdNext('INFO')
    await refresh.click(); await until(() => eof.received, 'actual INFO EOF response held'); proxy.disconnect(eof.connectionId)
    await overview.getByRole('alert').filter({ hasText: 'Cannot connect to Redis.' }).waitFor()
    assert.equal(await overview.locator('[data-info-field]').count(), 0); await checkB()
    view = await reconnect(view); assert.equal((await read(open)).state, 'value'); await checkB()
    await close.click()
    record('actual INFO TCP EOF clears cards without reconnecting; B remains readable and only manual reconnect plus explicit opening obtains a fresh generation snapshot')

    for (const original of originals) { assert.deepEqual(await buffers.sendCommand(['DUMP', original.key]), original.dump); assert.equal(await fixture.admin.sendCommand(['PEXPIRETIME', original.key]), original.expiry) }
    assert(!proxy.errors.some(value => value.startsWith('proxy-')))
    report.overview.proxyErrors = [...proxy.errors]
    record('native overview preserves selected and binary-key serialized bytes/absolute expiry; snapshots and diagnostics do not edit Redis data or configuration, and the owned proxy reports no protocol errors')
  } finally {
    await page.unroute(endpoint)
    if (bView !== undefined) {
      const current = await rpc('redisViewer/connectionStatus', { agentId: b.sessionId, request: {} })
      if (current.id !== null) await rpc('redisViewer/disconnect', { agentId: b.sessionId, request: { id: current.id, generation: current.generation } })
    }
  }
}
