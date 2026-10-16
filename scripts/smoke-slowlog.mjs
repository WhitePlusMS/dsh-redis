/** Installed native slow-log table. Only this owned fixture's admin seeds and
 * resets logs/configuration; the plugin transport is fixed to bounded GET.
 */
import assert from 'node:assert/strict'
import { resolve } from 'node:path'
import { writeFile } from 'node:fs/promises'
import { RESP_TYPES } from 'redis'
import { until } from './redis-fixture.mjs'
import { openConnectionSettings, resizeSidebar } from './native-view-controls.mjs'
export async function smokeSlowLog({ page, rpc, fixture, pane, artifacts, report, workspaceId }) {
  const proxy = fixture.recoveryProxy; assert(proxy)
  const record = message => { report.checks.push(message); console.log('[smoke check] ' + message) }
  const dialog = pane.locator('dialog.redis-slowlog-dialog'), open = pane.getByRole('button', { name: 'Slow log snapshot', exact: true })
  const refresh = dialog.getByRole('button', { name: 'Refresh snapshot', exact: true }), close = dialog.getByRole('button', { name: 'Close', exact: true })
  const refreshStatus = pane.getByRole('button', { name: 'Refresh status', exact: true }), endpoint = '**/api/redisViewer/readSlowLog'
  const [statusResponse] = await Promise.all([page.waitForResponse(r => r.url().endsWith('/api/redisViewer/connectionStatus')), refreshStatus.click()])
  const a = statusResponse.request().postDataJSON().payload.args.agentId
  let view = (await statusResponse.json()).result.value
  const target = value => ({ id: value.id, generation: value.generation, db: value.db })
  const own = response => response.url().endsWith('/api/redisViewer/readSlowLog') && response.request().postDataJSON().payload.args.agentId === a
  const buffers = fixture.admin.withTypeMapping({ [RESP_TYPES.BLOB_STRING]: Buffer })
  const key = Buffer.from([255, 0, 13, 10, 128]), dump = await buffers.sendCommand(['DUMP', key]), expiry = await fixture.admin.sendCommand(['PEXPIRETIME', key])
  const oldConfig = await fixture.admin.configGet(['slowlog-log-slower-than', 'slowlog-max-len'])
  assert.equal(typeof oldConfig['slowlog-log-slower-than'], 'string'); assert.equal(typeof oldConfig['slowlog-max-len'], 'string')
  const secret = 'private-slowlog-' + fixture.metadata.owner, large = secret + 'x'.repeat(150000)
  const b = await rpc('session/create', { request: { workspaceId } }); let bView
  report.slowlog = { realRedisVersion: '8.2.6', wireShape: 6, displayedMaximum: 100, cancellationMs: null, productionTimeoutMs: null, responseFaultCases: true }
  async function read(button = refresh) {
    const [response] = await Promise.all([page.waitForResponse(own), button.click()]); const body = await response.json(); assert(body.result?.ok)
    await until(async () => await refresh.isEnabled(), 'native slowlog read settled'); return body.result.value
  }
  async function checkB() {
    assert.deepEqual(await rpc('redisViewer/connectionStatus', { agentId: b.sessionId, request: {} }), bView)
    const value = await rpc('redisViewer/readString', { agentId: b.sessionId, request: { target: target(bView), keyBase64: Buffer.from('native:9').toString('base64'), offset: '0', count: 256 } }); assert.equal(value.base64, 'OQ==')
  }
  async function reconnect(previous) {
    if (await dialog.isVisible()) await close.click()
    await refreshStatus.click(); await openConnectionSettings(pane)
    const password = pane.locator('input[name="password"]'); assert.equal(await password.inputValue(), '')
    const mark = proxy.commands.length; await password.fill(fixture.settings.password)
    const [response] = await Promise.all([page.waitForResponse(r => r.url().endsWith('/api/redisViewer/connect') && r.request().postDataJSON().payload.args.agentId === a), pane.getByRole('button', { name: 'Connect', exact: true }).click()])
    const current = (await response.json()).result.value
    assert.equal(current.state, 'connected'); assert.equal(current.id, previous.id); assert(current.generation > previous.generation)
    await pane.locator('.redis-connected').waitFor(); assert.deepEqual(proxy.commands.slice(mark).map(c => c.command), ['AUTH', 'PING'])
    return current
  }
  try {
    bView = await rpc('redisViewer/connect', { agentId: b.sessionId, request: proxy.settings }); await checkB()
    await fixture.admin.sendCommand(['CONFIG', 'SET', 'slowlog-log-slower-than', '0', 'slowlog-max-len', '256'])
    for (let i = 0; i < 120; i++) await fixture.admin.sendCommand(['ECHO', secret + ':' + i])
    await fixture.admin.sendCommand(['MGET', ...Array.from({ length: 60 }, (_, i) => secret + '-key-' + i)])
    await fixture.admin.sendCommand(['ECHO', large])
    await fixture.admin.sendCommand(['CONFIG', 'SET', 'slowlog-log-slower-than', '-1'])
    const originalLog = await buffers.sendCommand(['SLOWLOG', 'GET', '-1'])
    assert(Array.isArray(originalLog) && originalLog.length > 101 && originalLog.every(row => Array.isArray(row) && row.length === 6))
    await resizeSidebar(page, pane, 900)
    assert.equal(proxy.commands.filter(c => c.command === 'SLOWLOG').length, 0)
    const snapshot = await read(open)
    assert.equal(snapshot.state, 'page'); assert.equal(snapshot.entries.length, 10); assert.equal(snapshot.more, true)
    assert.deepEqual(snapshot.entries.map(e => e.id), originalLog.slice(0, 10).map(e => String(e[0])))
    assert.equal(snapshot.entries[0].command, 'ECHO'); assert.equal(snapshot.entries[0].originalArgumentCount, null)
    assert(snapshot.entries[0].argumentBytes[0] < Buffer.byteLength(large), 'Length describes the server-truncated logged fragment, not the original request')
    assert.equal(snapshot.entries[1].loggedArgumentCount, 32); assert.equal(snapshot.entries[1].argumentBytes.length, 8)
    assert.equal(await dialog.locator('tbody tr').count(), 10)
    assert(!(await dialog.innerText()).includes(secret)); assert(!JSON.stringify(snapshot).includes(secret)); assert(!JSON.stringify(snapshot).includes('127.0.0.1'))
    assert.equal(await dialog.locator('[data-slowlog-duration]').first().innerText(), snapshot.entries[0].durationUs + ' μs')
    await writeFile(resolve(artifacts, 'native-slowlog-real-sample.json'), JSON.stringify(snapshot, null, 2) + '\n')
    await page.screenshot({ path: resolve(artifacts, 'native-slowlog-table.png'), fullPage: true })
    record('installed native slowlog renders the real Redis 8.2.6 six-field newest-first sample with exact IDs/Unix seconds/microseconds; secret and large parameter bodies/client addresses never enter DTO/table, and summary bytes explicitly describe server-truncated fragments')
    const mark = proxy.commands.length
    await dialog.locator('select[name="slowlogCount"]').selectOption('100')
    assert.equal(proxy.commands.length, mark, 'Draft count must not read')
    const hundred = await read(); assert.equal(hundred.entries.length, 100); assert.equal(hundred.more, true); assert.equal(await dialog.locator('tbody tr').count(), 100)
    assert.deepEqual(hundred.entries.map(e => e.id), originalLog.slice(0, 100).map(e => String(e[0])))
    await dialog.locator('select[name="slowlogCount"]').selectOption('1'); assert.equal((await read()).entries.length, 1)
    assert(proxy.commands.filter(c => c.command === 'SLOWLOG').every(c => c.firstArgumentBase64 === Buffer.from('GET').toString('base64')))
    assert.deepEqual(await buffers.sendCommand(['SLOWLOG', 'GET', '-1']), originalLog)
    record('native count drafts cause no RPC; explicit GET count+1 bounds real 1/10/100-row slices, reports another entry accurately and leaves the frozen server log unchanged; no RESET/LEN subcommand is dispatched')
    await fixture.admin.sendCommand(['ACL', 'SETUSER', 'default', '-slowlog|get'])
    try { assert.equal((await read()).error, 'permission'); await dialog.getByRole('alert').filter({ hasText: 'not allowed to perform' }).waitFor(); assert.equal(await dialog.locator('tbody tr').count(), 0) }
    finally { await fixture.admin.sendCommand(['ACL', 'SETUSER', 'default', '+slowlog|get']) }
    assert.equal((await read()).state, 'page')
    record('real ACL refusal of SLOWLOG GET clears prior rows and displays the safe permission state; restoring permission requires an explicit refresh')
    await page.route(endpoint, async route => { const response = await route.fetch(), body = await response.json(); assert(body.result?.ok); body.result.value.entries[0].durationUs = 9007199254740992; await route.fulfill({ response, json: body }) })
    await read(); await dialog.getByRole('alert').filter({ hasText: 'Plugin communication failed' }).waitFor(); assert.equal(await dialog.locator('tbody tr').count(), 0); await page.unroute(endpoint)
    await page.route(endpoint, async route => { const response = await route.fetch(), body = await response.json(); Object.assign(body.result.value, { state: 'unavailable', error: null, entries: [], more: false }); await route.fulfill({ response, json: body }) })
    await read(); await dialog.getByRole('status').filter({ hasText: 'slow log read command is unavailable' }).waitFor(); await page.unroute(endpoint)
    record('labeled HTTP fault cases reject a forged numeric duration in the actual browser decoder and distinguish unavailable command from permission/empty without presenting injected values as real Redis data')
    const hold = proxy.holdNext('SLOWLOG'); await refresh.click(); await until(() => hold.received, 'real SLOWLOG reply held')
    const at = Date.now(); await dialog.getByRole('button', { name: 'Cancel read', exact: true }).click(); report.slowlog.cancellationMs = Date.now() - at
    const queued = proxy.commands.length
    await Promise.all([page.waitForRequest(r => r.url().endsWith('/api/redisViewer/readSlowLog')), refresh.click()]); await close.click(); await checkB()
    assert.equal(proxy.commands.slice(queued).filter(c => c.connectionId === hold.connectionId).length, 0)
    hold.release(); assert.equal((await read(open)).state, 'page')
    assert.equal(proxy.commands.slice(queued).filter(c => c.connectionId === hold.connectionId && c.command === 'SLOWLOG').length, 1)
    record('native shared snapshot Cancel/Close reaches actual SLOWLOG Host cancellation, drops the queued read and all late rows, then explicit reopen reads fresh on the same generation with B unaffected')
    const timeout = proxy.holdNext('SLOWLOG'), started = Date.now(); await refresh.click(); await until(() => timeout.received, 'real SLOWLOG deadline reply held'); await checkB()
    await dialog.getByRole('alert').filter({ hasText: 'Redis operation timed out.' }).waitFor({ timeout: 20000 })
    report.slowlog.productionTimeoutMs = Date.now() - started; assert(report.slowlog.productionTimeoutMs >= 9500 && report.slowlog.productionTimeoutMs < 20000)
    assert.equal(await dialog.locator('tbody tr').count(), 0); await until(() => proxy.connections.find(c => c.id === timeout.connectionId)?.closed, 'slowlog deadline socket closed'); timeout.release(); await checkB()
    const old = view; view = await reconnect(view)
    const staleMark = proxy.commands.length; assert.equal((await rpc('redisViewer/readSlowLog', { agentId: a, request: { target: target(old), count: 10 } })).error, 'stale'); assert.equal(proxy.commands.length, staleMark)
    await read(open)
    record('native SLOWLOG production deadline clears rows and closes only A; manual reconnect advances generation without replay, stale targets dispatch nothing and B remains usable')
    const eof = proxy.holdNext('SLOWLOG'); await refresh.click(); await until(() => eof.received, 'real SLOWLOG EOF reply held'); proxy.disconnect(eof.connectionId)
    await dialog.getByRole('alert').filter({ hasText: 'Cannot connect to Redis.' }).waitFor(); assert.equal(await dialog.locator('tbody tr').count(), 0); await checkB()
    view = await reconnect(view); await read(open); await close.click()
    await fixture.admin.sendCommand(['SLOWLOG', 'RESET'])
    const empty = await read(open); assert.equal(empty.state, 'page'); assert.equal(empty.more, false); assert.deepEqual(empty.entries, [])
    await dialog.getByText('No slow log entries at this snapshot.', { exact: true }).waitFor(); await close.click()
    record('actual SLOWLOG TCP EOF clears rows and requires manual recovery; a fixture-admin reset then proves genuine empty success differs from unavailable/permission (the plugin exposes no reset action)')
    assert.deepEqual(await buffers.sendCommand(['DUMP', key]), dump); assert.equal(await fixture.admin.sendCommand(['PEXPIRETIME', key]), expiry)
    assert(!proxy.errors.some(e => e.startsWith('proxy-'))); report.slowlog.proxyErrors = [...proxy.errors]
    record('native slowlog leaves binary-key bytes and absolute expiry unchanged; every plugin diagnostic is bounded GET, while seed/reset/config actions belong only to the owned fixture admin')
  } finally {
    await page.unroute(endpoint)
    await fixture.admin.sendCommand(['ACL', 'SETUSER', 'default', '+slowlog|get'])
    await fixture.admin.sendCommand(['CONFIG', 'SET', 'slowlog-log-slower-than', oldConfig['slowlog-log-slower-than'], 'slowlog-max-len', oldConfig['slowlog-max-len']])
    if (bView !== undefined) { const current = await rpc('redisViewer/connectionStatus', { agentId: b.sessionId, request: {} }); if (current.id !== null) await rpc('redisViewer/disconnect', { agentId: b.sessionId, request: { id: current.id, generation: current.generation } }) }
  }
}
