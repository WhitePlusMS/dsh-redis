/** Native UI cancellation/recovery against real Redis through an owned proxy. */
import assert from 'node:assert/strict'
import { resolve } from 'node:path'
import { RESP_TYPES } from 'redis'
import { until } from './redis-fixture.mjs'
import { openConnectionSettings, chooseValueFormat } from './native-view-controls.mjs'

export async function smokeNativeRecovery({ page, rpc, fixture, pane, keys, scanAll, artifacts, report, workspaceId }) {
  const proxy = fixture.recoveryProxy
  assert(proxy, 'Recovery acceptance requires its owned real-Redis delay proxy')
  const record = (...checks) => { report.checks.push(...checks); console.log('[smoke check] ' + checks.join(' | ')) }
  const key = Buffer.from([255, 0, 13, 10, 128]), identity = key.toString('base64')
  const buffers = fixture.admin.withTypeMapping({ [RESP_TYPES.BLOB_STRING]: Buffer })
  const dump = await buffers.sendCommand(['DUMP', key]), expiry = await fixture.admin.sendCommand(['PEXPIRETIME', key])
  const refreshStatus = pane.getByRole('button', { name: 'Refresh status', exact: true })
  const [statusResponse] = await Promise.all([
    page.waitForResponse(response => response.url().endsWith('/api/redisViewer/connectionStatus')),
    refreshStatus.click(),
  ])
  const a = statusResponse.request().postDataJSON().payload.args.agentId
  assert.equal(typeof a, 'string')
  const statusBody = await statusResponse.json(); assert.equal(statusBody.result?.ok, true)
  let view = statusBody.result.value
  const target = value => { assert(value.id !== null); return { id: value.id, generation: value.generation, db: value.db } }
  const aStatus = () => rpc('redisViewer/connectionStatus', { agentId: a, request: {} })
  const b = await rpc('session/create', { request: { workspaceId } })
  assert.notEqual(b.sessionId, a)
  let bView
  report.recovery = { cancellationReachedHost: false, proxyErrors: [] }
  async function checkB() {
    assert.deepEqual(await rpc('redisViewer/connectionStatus', { agentId: b.sessionId, request: {} }), bView)
    const value = await rpc('redisViewer/readString', { agentId: b.sessionId, request: { target: target(bView), keyBase64: Buffer.from('native:9').toString('base64'), offset: '0', count: 256 } })
    assert.equal(value.state, 'value'); assert.equal(value.base64, 'OQ==')
  }
  const details = pane.locator('.redis-details')
  const read = details.getByRole('button', { name: 'Read / refresh', exact: true })
  const cancel = details.getByRole('button', { name: 'Cancel read', exact: true })
  const ownRead = response => response.url().endsWith('/api/redisViewer/readString') && response.request().postDataJSON().payload.args.agentId === a
  async function readSuccessfully(button = read) {
    const [response] = await Promise.all([page.waitForResponse(ownRead), button.click()])
    const body = await response.json(); assert.equal(body.result?.ok, true)
    assert.equal(body.result.value.state, 'value'); assert.equal(body.result.value.base64, Buffer.from('binary-key-value').toString('base64'))
    await details.locator('[data-value-coverage]').waitFor()
    await chooseValueFormat(details, 'text')
    await until(async () => await details.locator('[data-value-preview]').innerText() === 'binary-key-value', 'native fresh bytes rendered')
  }
  async function reconnect(previous) {
    await refreshStatus.click()
    await openConnectionSettings(pane)
    const password = pane.locator('input[name="password"]')
    await password.waitFor(); assert.equal(await password.inputValue(), '')
    assert.equal(await pane.locator('.redis-connected').count(), 0)
    const before = proxy.commands.length
    await password.fill(fixture.settings.password)
    const [response] = await Promise.all([
      page.waitForResponse(response => response.url().endsWith('/api/redisViewer/connect') && response.request().postDataJSON().payload.args.agentId === a),
      pane.getByRole('button', { name: 'Connect', exact: true }).click(),
    ])
    const body = await response.json(); assert.equal(body.result?.ok, true)
    const current = body.result.value
    assert.equal(current.state, 'connected'); assert.equal(current.id, previous.id); assert(current.generation > previous.generation); assert.equal(current.db, 0)
    await pane.locator('.redis-connected').waitFor()
    await keys.getByRole('button', { name: 'Read selected key', exact: true }).waitFor()
    assert.equal(await keys.locator('[data-loaded-keys]').innerText(), '0')
    assert.equal(await pane.locator('[data-value-preview]').count(), 0)
    assert.deepEqual(proxy.commands.slice(before).map(value => value.command), ['AUTH', 'PING'], 'Reconnect must not replay old reads, scan or SELECT')
    await readSuccessfully(keys.getByRole('button', { name: 'Read selected key', exact: true }))
    return current
  }
  try {
    bView = await rpc('redisViewer/connect', { agentId: b.sessionId, request: proxy.settings })
    assert.equal(bView.state, 'connected'); await checkB()
    assert.equal(await scanAll('*'), fixture.expectedKeyCount)
    const hold = proxy.holdNext('GETRANGE', key)
    await keys.locator('[data-key-base64="' + identity + '"]').click()
    await until(() => hold.received, 'native actual GETRANGE reply buffered')
    const cancelAt = Date.now()
    await cancel.click()
    await details.getByRole('status').filter({ hasText: 'Stopped waiting; Redis may still be processing.' }).waitFor()
    report.recovery.cancelObservedMs = Date.now() - cancelAt
    assert.equal(await details.locator('[data-value-preview]').count(), 0)
    const mark = proxy.commands.length
    // A second UI request is cancelled while queued behind the real old reply.
    await Promise.all([
      page.waitForRequest(request => request.url().endsWith('/api/redisViewer/readString') && request.postDataJSON().payload.args.agentId === a),
      read.click(),
    ])
    await cancel.click(); await checkB()
    assert.equal(proxy.commands.slice(mark).filter(value => value.connectionId === hold.connectionId).length, 0)
    hold.release()
    await readSuccessfully()
    assert.deepEqual(proxy.commands.slice(mark).filter(value => value.connectionId === hold.connectionId).map(value => value.command), ['TYPE', 'PTTL', 'STRLEN', 'GETRANGE', 'TYPE', 'STRLEN', 'PTTL'], 'Only the explicit third read may run: cancelled active postchecks and queued request must not dispatch')
    assert.deepEqual(await aStatus(), view)
    report.recovery.cancellationReachedHost = true
    record('native Cancel read reaches the actual Host signal: active postchecks and cancelled queued read are not dispatched; old reply drains, explicit retry uses the same generation and B stays readable')

    const timeout = proxy.holdNext('GETRANGE', key), started = Date.now()
    await read.click(); await until(() => timeout.received, 'native production-timeout reply held'); await checkB()
    await details.getByRole('alert').filter({ hasText: 'Redis operation timed out.' }).waitFor({ timeout: 20_000 })
    report.recovery.productionTimeoutMs = Date.now() - started
    assert(report.recovery.productionTimeoutMs >= 9500 && report.recovery.productionTimeoutMs < 20_000)
    assert.equal(await details.locator('[data-value-preview]').count(), 0)
    await until(async () => (await aStatus()).state === 'error', 'native Host timeout state')
    await until(() => proxy.connections.find(value => value.id === timeout.connectionId)?.closed, 'native timeout owned socket closed')
    timeout.release(); await checkB()
    await page.screenshot({ path: resolve(artifacts, 'native-recovery-timeout.png'), fullPage: true })
    view = await reconnect(view)
    record('native production ten-second timeout clears old bytes, only closes A, and status refresh plus explicit password/reconnect creates a new generation without replay; remembered key requires an explicit read')

    const eof = proxy.holdNext('GETRANGE', key)
    await read.click(); await until(() => eof.received, 'native EOF active reply buffered')
    proxy.disconnect(eof.connectionId)
    await details.getByRole('alert').filter({ hasText: 'Cannot connect to Redis.' }).waitFor()
    assert.equal(await details.locator('[data-value-preview]').count(), 0); await checkB()
    view = await reconnect(view); await checkB()
    record('native actual TCP EOF clears old bytes and leaves the other trusted session usable; manual reconnect advances generation and explicitly rereads fresh original binary-key data')

    assert.deepEqual(await buffers.sendCommand(['DUMP', key]), dump); assert.equal(await fixture.admin.sendCommand(['PEXPIRETIME', key]), expiry)
    assert(!proxy.errors.some(value => value.startsWith('proxy-')))
    report.recovery.proxyErrors = [...proxy.errors]
    await page.screenshot({ path: resolve(artifacts, 'native-recovery-fresh.png'), fullPage: true })
    record('native recovery preserves binary key identity, serialized source bytes and absolute expiry; held packets represent a delayed real reply, without claiming server computation stopped')
  } finally {
    if (bView !== undefined) {
      const current = await rpc('redisViewer/connectionStatus', { agentId: b.sessionId, request: {} })
      if (current.id !== null) await rpc('redisViewer/disconnect', { agentId: b.sessionId, request: { id: current.id, generation: current.generation } })
    }
  }
}
