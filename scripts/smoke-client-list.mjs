/** Client snapshots: owned real connections plus direct Host receive-cap proof.
 * Large-name preparation belongs only to the fixture admin, never plugin API.
 */
import assert from 'node:assert/strict'
import { resolve } from 'node:path'
import { writeFile } from 'node:fs/promises'
import { RESP_TYPES } from 'redis'
import { until } from './redis-fixture.mjs'
import { openConnectionSettings, resizeSidebar } from './native-view-controls.mjs'
export async function smokeClientList({ page, rpc, fixture, pane, artifacts, report, workspaceId }) {
  const proxy = fixture.recoveryProxy; assert(proxy); assert(fixture.directSettings)
  const record = message => { report.checks.push(message); console.log('[smoke check] ' + message) }
  const dialog = pane.locator('dialog.redis-clients-dialog'), open = pane.getByRole('button', { name: 'Client connection snapshot', exact: true })
  const refresh = dialog.getByRole('button', { name: 'Refresh snapshot', exact: true }), close = dialog.getByRole('button', { name: 'Close', exact: true })
  const refreshStatus = pane.getByRole('button', { name: 'Refresh status', exact: true }), endpoint = '**/api/redisViewer/readClients'
  const [statusResponse] = await Promise.all([page.waitForResponse(r => r.url().endsWith('/api/redisViewer/connectionStatus')), refreshStatus.click()])
  const a = statusResponse.request().postDataJSON().payload.args.agentId
  let view = (await statusResponse.json()).result.value
  const target = value => ({ id: value.id, generation: value.generation, db: value.db })
  const own = response => response.url().endsWith('/api/redisViewer/readClients') && response.request().postDataJSON().payload.args.agentId === a
  const buffers = fixture.admin.withTypeMapping({ [RESP_TYPES.BLOB_STRING]: Buffer }), key = Buffer.from([255, 0, 13, 10, 128])
  const dump = await buffers.sendCommand(['DUMP', key]), expiry = await fixture.admin.sendCommand(['PEXPIRETIME', key])
  const b = await rpc('session/create', { request: { workspaceId } }), c = await rpc('session/create', { request: { workspaceId } })
  let bView, cView
  const extras = []
  report.clients = { realRedisVersion: '8.2.6', ownedExtraConnections: 205, cancellationMs: null, productionTimeoutMs: null, explicitResponseFaultCases: true }
  async function read(button = refresh) {
    const [response] = await Promise.all([page.waitForResponse(own), button.click()]); const body = await response.json(); assert(body.result?.ok)
    await until(async () => await refresh.isEnabled(), 'native client-list read settled'); return body.result.value
  }
  async function checkB() {
    assert.deepEqual(await rpc('redisViewer/connectionStatus', { agentId: b.sessionId, request: {} }), bView)
    const result = await rpc('redisViewer/readString', { agentId: b.sessionId, request: { target: target(bView), keyBase64: Buffer.from('native:9').toString('base64'), offset: '0', count: 256 } }); assert.equal(result.base64, 'OQ==')
  }
  async function reconnect(previous) {
    if (await dialog.isVisible()) await close.click()
    await refreshStatus.click(); await openConnectionSettings(pane)
    const password = pane.locator('input[name="password"]'); assert.equal(await password.inputValue(), '')
    const mark = proxy.commands.length; await password.fill(fixture.settings.password)
    const [response] = await Promise.all([page.waitForResponse(r => r.url().endsWith('/api/redisViewer/connect') && r.request().postDataJSON().payload.args.agentId === a), pane.getByRole('button', { name: 'Connect', exact: true }).click()])
    const current = (await response.json()).result.value
    assert.equal(current.state, 'connected'); assert.equal(current.id, previous.id); assert(current.generation > previous.generation)
    await pane.locator('.redis-connected').waitFor(); assert.deepEqual(proxy.commands.slice(mark).map(r => r.command), ['AUTH', 'PING'])
    return current
  }
  try {
    bView = await rpc('redisViewer/connect', { agentId: b.sessionId, request: proxy.settings }); await checkB()
    for (let start = 0; start < 205; start += 10) {
      const results = await Promise.allSettled(Array.from({ length: Math.min(10, 205 - start) }, async (_, index) => {
        const client = fixture.admin.duplicate(); extras.push(client); client.on('error', () => undefined)
        await client.connect(); await client.clientSetName('FixtureClient_' + String(start + index)); return client
      }))
      for (const result of results) if (result.status === 'rejected') throw result.reason
    }
    await resizeSidebar(page, pane, 900)
    assert.equal(proxy.commands.filter(r => r.command === 'CLIENT').length, 0, 'No automatic CLIENT LIST')
    const snapshot = await read(open)
    assert.equal(snapshot.state, 'page'); assert.equal(snapshot.total, 208); assert.equal(snapshot.entries.length, 200); assert.equal(snapshot.limited, true)
    assert.equal(await fixture.clients(), snapshot.total); assert.equal(await dialog.locator('tbody tr').count(), 200)
    assert(snapshot.entries.every(entry => Object.keys(entry).length === 14))
    report.clients.actualReturned = snapshot.total; report.clients.displayed = snapshot.entries.length
    const index = snapshot.entries.findIndex(entry => entry.name === 'FixtureClient_0'); assert(index >= 0)
    const mark = proxy.commands.length
    await dialog.locator('[data-client-index="' + index + '"]').click()
    await dialog.getByRole('region', { name: 'Selected client details', exact: true }).waitFor()
    assert.equal(await dialog.locator('[data-client-field="qbuf"]').innerText(), snapshot.entries[index].qbuf + ' B')
    assert.equal(await dialog.locator('[data-client-field="user"]').innerText(), 'default')
    assert.equal(proxy.commands.length, mark)
    await writeFile(resolve(artifacts, 'native-clients-real-sample.json'), JSON.stringify(snapshot, null, 2) + '\n')
    await page.screenshot({ path: resolve(artifacts, 'native-clients-table.png'), fullPage: true })
    await close.click(); assert.equal(await dialog.locator('tbody tr').count(), 0)
    record('installed native CLIENT LIST reads real Redis 8.2.6 with 205 owned extra sockets: 208 returned records, exactly 200 displayed and explicit truncation; fourteen selected fields, local row details/units and close clearing work without implicit or inspection reads')
    await page.route(endpoint, async route => { const response = await route.fetch(), body = await response.json(); assert(body.result?.ok); body.result.value.entries[0].ssub = null; body.result.value.entries[0].name = ''; await route.fulfill({ response, json: body }) })
    await read(open); await dialog.locator('[data-client-index="0"]').click()
    assert.equal(await dialog.locator('[data-client-field="ssub"]').innerText(), 'Not reported')
    assert.equal(await dialog.locator('tbody tr').first().locator('[data-column="name"]').innerText(), 'Not set (empty)'); await page.unroute(endpoint)
    await page.route(endpoint, async route => { const response = await route.fetch(), body = await response.json(); body.result.value.entries[0].id = 9007199254740992; await route.fulfill({ response, json: body }) })
    await read(); await dialog.getByRole('alert').filter({ hasText: 'Plugin communication failed' }).waitFor(); assert.equal(await dialog.locator('tbody tr').count(), 0); await page.unroute(endpoint)
    for (const state of ['unavailable', 'page']) {
      await page.route(endpoint, async route => { const response = await route.fetch(), body = await response.json(); Object.assign(body.result.value, { state, error: null, entries: [], total: 0, limited: false }); await route.fulfill({ response, json: body }) })
      await read(); await dialog.getByText(state === 'page' ? 'No client records returned at this snapshot.' : 'The required client list read command is unavailable.', { exact: true }).waitFor(); await page.unroute(endpoint)
    }
    record('explicit HTTP response fault cases distinguish missing fields, empty names, unavailable and empty success; the actual browser decoder refuses an imprecise numeric ID and clears the table before rendering')
    await fixture.admin.sendCommand(['ACL', 'SETUSER', 'default', '-client|list'])
    try { assert.equal((await read()).error, 'permission'); await dialog.getByRole('alert').filter({ hasText: 'not allowed to perform' }).waitFor(); assert.equal(await dialog.locator('tbody tr').count(), 0) }
    finally { await fixture.admin.sendCommand(['ACL', 'SETUSER', 'default', '+client|list']) }
    assert.equal((await read()).state, 'page')
    record('real Redis ACL -client|list refuses only the diagnostic, clears previous rows/details and permits explicit recovery after permission restoration; no management command is exposed')
    const hold = proxy.holdNext('CLIENT'); await refresh.click(); await until(() => hold.received, 'real CLIENT LIST reply held')
    const at = Date.now(); await dialog.getByRole('button', { name: 'Cancel read', exact: true }).click(); report.clients.cancellationMs = Date.now() - at
    const queued = proxy.commands.length
    await Promise.all([page.waitForRequest(r => r.url().endsWith('/api/redisViewer/readClients')), refresh.click()]); await close.click(); await checkB()
    assert.equal(proxy.commands.slice(queued).filter(r => r.connectionId === hold.connectionId).length, 0)
    hold.release(); assert.equal((await read(open)).state, 'page')
    assert.equal(proxy.commands.slice(queued).filter(r => r.connectionId === hold.connectionId && r.command === 'CLIENT').length, 1)
    record('native CLIENT LIST Cancel and Close propagate to the real Host, cancel the queued command, discard late rows and require explicit reopening; same-generation recovery leaves B usable')
    const timeout = proxy.holdNext('CLIENT'), started = Date.now(); await refresh.click(); await until(() => timeout.received, 'real CLIENT LIST deadline reply held'); await checkB()
    await dialog.getByRole('alert').filter({ hasText: 'Redis operation timed out.' }).waitFor({ timeout: 20000 })
    report.clients.productionTimeoutMs = Date.now() - started; assert(report.clients.productionTimeoutMs >= 9500 && report.clients.productionTimeoutMs < 20000)
    assert.equal(await dialog.locator('tbody tr').count(), 0); await until(() => proxy.connections.find(r => r.id === timeout.connectionId)?.closed, 'client-list deadline socket closed'); timeout.release(); await checkB()
    const old = view; view = await reconnect(view)
    const beforeStale = proxy.commands.length; assert.equal((await rpc('redisViewer/readClients', { agentId: a, request: { target: target(old) } })).error, 'stale'); assert.equal(proxy.commands.length, beforeStale)
    await read(open)
    record('native CLIENT LIST production ten-second deadline closes only A and clears old rows; manual new-generation reconnect has no replay, old targets dispatch nothing and B survives')
    const eof = proxy.holdNext('CLIENT'); await refresh.click(); await until(() => eof.received, 'real CLIENT LIST EOF reply held'); proxy.disconnect(eof.connectionId)
    await dialog.getByRole('alert').filter({ hasText: 'Cannot connect to Redis.' }).waitFor(); assert.equal(await dialog.locator('tbody tr').count(), 0); await checkB()
    view = await reconnect(view); await read(open)
    record('actual CLIENT LIST TCP EOF clears rows and requires explicit reconnect/opening; no automatic reconnect or old snapshot survives')

    await extras[0].clientSetName('X'.repeat(300000))
    const semanticBytes = Buffer.byteLength(await fixture.admin.sendCommand(['CLIENT', 'LIST']))
    assert(semanticBytes > 262144 && semanticBytes < 1048576)
    assert.equal((await read()).error, 'oversize'); await dialog.getByRole('alert').waitFor(); assert.equal(await dialog.locator('tbody tr').count(), 0)
    assert.equal((await rpc('redisViewer/connectionStatus', { agentId: a, request: {} })).state, 'connected')
    await extras[0].clientSetName('FixtureClient_0'); await read(); await checkB()
    report.clients.semanticBudgetBytes = semanticBytes
    record('real CLIENT LIST reply exceeds the 256 KiB post-receive interpretation budget but stays below the RESP cap: UI refuses the whole snapshot, retains A socket, and explicit recovery succeeds after fixture-only name restoration')

    // The delay proxy has its own one-MiB decoder, so it must not be used to
    // claim the product receive cap. C connects directly to the owned Redis.
    cView = await rpc('redisViewer/connect', { agentId: c.sessionId, request: fixture.directSettings }); assert.equal(cView.state, 'connected')
    await extras[0].clientSetName('Y'.repeat(1100000))
    const receiveBytes = Buffer.byteLength(await fixture.admin.sendCommand(['CLIENT', 'LIST'])); assert(receiveBytes > 1048576)
    const tooBig = await rpc('redisViewer/readClients', { agentId: c.sessionId, request: { target: target(cView) } })
    assert.equal(tooBig.error, 'oversize'); assert.deepEqual(tooBig.entries, [])
    await until(async () => (await rpc('redisViewer/connectionStatus', { agentId: c.sessionId, request: {} })).state === 'error', 'direct product RESP oversize closes C')
    await checkB(); assert.deepEqual(await rpc('redisViewer/connectionStatus', { agentId: a, request: {} }), view)
    await extras[0].clientSetName('FixtureClient_0'); await read()
    report.clients.receiveBudgetBytes = receiveBytes; report.clients.receiveBudgetDirectHost = true
    record('real direct Host C receives a declared CLIENT LIST bulk above one MiB and returns oversize with no entries while closing only C; A/B survive, proving the product receive boundary without crediting the acceptance proxy cap')
    const latest = await read(), gone = latest.entries.findIndex(entry => entry.name === 'FixtureClient_0'); assert(gone >= 0)
    await dialog.locator('[data-client-index="' + gone + '"]').click(); const goneId = latest.entries[gone].id
    extras[0].destroy(); const after = await read()
    assert.equal(after.total, latest.total - 1); assert(!after.entries.some(entry => entry.id === goneId)); assert.equal(await dialog.locator('.redis-client-details').count(), 0)
    await close.click()
    assert.deepEqual(await buffers.sendCommand(['DUMP', key]), dump); assert.equal(await fixture.admin.sendCommand(['PEXPIRETIME', key]), expiry)
    assert(proxy.commands.filter(r => r.command === 'CLIENT').every(r => r.firstArgumentBase64 === Buffer.from('LIST').toString('base64')))
    assert(!proxy.errors.some(e => e.startsWith('proxy-'))); report.clients.proxyErrors = [...proxy.errors]
    record('a real fixture-client exit changes the observed record count and removes its selected details on refresh; all plugin client commands remain LIST, binary-key bytes/absolute expiry stay unchanged and no address is written by product routine logs')
  } finally {
    await page.unroute(endpoint)
    await fixture.admin.sendCommand(['ACL', 'SETUSER', 'default', '+client|list'])
    for (const client of extras) if (client.isOpen) client.destroy()
    for (const [session, currentView] of [[b, bView], [c, cView]]) if (currentView !== undefined) { const current = await rpc('redisViewer/connectionStatus', { agentId: session.sessionId, request: {} }); if (current.id !== null) await rpc('redisViewer/disconnect', { agentId: session.sessionId, request: { id: current.id, generation: current.generation } }) }
    report.clients.ownedExtraConnectionsStopped = extras.every(client => !client.isOpen)
  }
}
