/** Bounded native auto-refresh acceptance. Only the caller's isolated fixture is used. */
import assert from 'node:assert/strict'
import { resolve } from 'node:path'
import { mkdir, writeFile } from 'node:fs/promises'
import { RESP_TYPES } from 'redis'
import { until } from './redis-fixture.mjs'
import { openConnectionSettings, chooseValueFormat, readValueFormat, findLoadedKey, resizeSidebar } from './native-view-controls.mjs'
const pause = milliseconds => new Promise(done => setTimeout(done, milliseconds))
const binaryKey = Buffer.from([255, 0, 13, 10, 128])
export async function prepareAutoRefreshFixture(fixture) {
  const admin = fixture.admin
  const names = ['hash', 'list', 'set', 'zset', 'stream', 'json', 'bitmap', 'geo', 'hll', 'ts', 'bloom', 'gone', 'change', 'oversize', 'large'].map(name => 'auto:' + name)
  for (let i = 0; i < 235; ++i) {
    await admin.hSet('auto:hash', 'item:' + i, i === 0 ? 'x'.repeat(5000) : 'value:' + i)
    await admin.sendCommand(['ZADD', 'auto:zset', String(i), 'member:' + i])
    await admin.sendCommand(['XADD', 'auto:stream', String(i + 1) + '-0', 'field', String(i)])
    await admin.sendCommand(['TS.ADD', 'auto:ts', String(i), String(i / 10)])
  }
  await admin.rPush('auto:list', Array.from({ length: 235 }, (_, i) => 'item:' + i))
  await admin.sAdd('auto:set', Array.from({ length: 235 }, (_, i) => 'member:' + i))
  await admin.sendCommand(['JSON.SET', 'auto:json', '$', '{"id":9007199254740993,"label":"中文"}'])
  await admin.set('auto:bitmap', Buffer.from([128, 1])); await admin.sendCommand(['GEOADD', 'auto:geo', '13', '38', 'one'])
  await admin.sendCommand(['PFADD', 'auto:hll', 'one', 'two']); await admin.sendCommand(['BF.ADD', 'auto:bloom', 'present'])
  await admin.set('auto:gone', 'old'); await admin.set('auto:change', 'old')
  await admin.sendCommand(['JSON.SET', 'auto:oversize', '$', '{"small":1}']); await admin.set('auto:large', Buffer.alloc(131073, 97))
  for (const name of names) await admin.pExpire(name, 900000)
  fixture.autoImmutable = [binaryKey, ...names.filter(name => !['auto:gone', 'auto:change', 'auto:oversize'].includes(name))]
  return names.length
}
export async function smokeAutoRefresh({ page, rpc, fixture, pane, keys, scanAll, artifacts, report, workspaceTitle }) {
  const proxy = fixture.recoveryProxy; assert(proxy)
  const record = message => { report.checks.push(message); console.log('[smoke check] ' + message) }
  const methods = new Set(['readString', 'scanHash', 'readList', 'scanSet', 'readZSet', 'readStream', 'readJson', 'readGeo', 'readBloom', 'readTimeSeries', 'readHll'])
  const requests = []
  const observe = request => { const method = request.url().split('/').at(-1); if (methods.has(method)) requests.push({ method, at: Date.now(), ...request.postDataJSON().payload.args }) }
  page.on('request', observe)
  const [statusReply] = await Promise.all([page.waitForResponse(r => r.url().endsWith('/api/redisViewer/connectionStatus')), pane.getByRole('button', { name: 'Refresh status', exact: true }).click()])
  const a = statusReply.request().postDataJSON().payload.args.agentId
  let view = (await statusReply.json()).result.value, b, bView
  const target = value => ({ id: value.id, generation: value.generation, db: value.db })
  const status = owner => rpc('redisViewer/connectionStatus', { agentId: owner, request: {} })
  const details = pane.locator('.redis-details'), toolbar = pane.locator('.redis-auto-refresh')
  const toggle = toolbar.getByRole('button', { name: 'Auto refresh', exact: true })
  const manual = details.getByRole('button', { name: 'Read / refresh', exact: true })
  const ownResponse = (method, identity) => response => response.url().endsWith('/api/redisViewer/' + method) && response.request().postDataJSON().payload.args.agentId === a && (identity === undefined || response.request().postDataJSON().payload.args.request.keyBase64 === identity)
  const autoRequests = () => requests.filter(item => item.agentId === a)
  async function settled() { await until(async () => await toolbar.getAttribute('data-auto-refresh') === 'on' ? await toolbar.locator('[data-auto-status]').innerText() === 'On · waiting' : await toggle.isEnabled(), 'current reader settled') }
  async function select(key, method = 'readString', interpretation) {
    const identity = Buffer.from(key).toString('base64')
    const [reply] = await Promise.all([page.waitForResponse(ownResponse(method, identity)), (await findLoadedKey(keys, identity)).click()])
    assert((await reply.json()).result?.ok)
    if (interpretation !== undefined) {
      const [result] = await Promise.all([page.waitForResponse(ownResponse(interpretation === 'Bitmap' ? 'readString' : interpretation === 'GEO' ? 'readGeo' : 'readHll', identity)), details.getByRole('button', { name: interpretation === 'GEO' ? 'View coordinates (GEO)' : 'View as ' + interpretation, exact: true }).click()])
      assert((await result.json()).result?.ok)
    }
    await settled(); assert.equal(await toolbar.getAttribute('data-auto-refresh'), 'off')
    return identity
  }
  async function enable() { await toolbar.locator('select[name="autoRefreshInterval"]').selectOption('1000'); await toggle.click(); await until(async () => await toolbar.getAttribute('data-auto-refresh') === 'on', 'explicit auto enabled') }
  async function off() { if (await toolbar.count() && await toolbar.getAttribute('data-auto-refresh') === 'on') await toggle.click() }
  async function successful(button = manual) {
    const [reply] = await Promise.all([page.waitForResponse(ownResponse('readString')), button.click()])
    assert.equal((await reply.json()).result.value.state, 'value'); await settled()
  }
  async function checkB() {
    assert.deepEqual(await status(b), bView)
    const result = await rpc('redisViewer/readString', { agentId: b, request: { target: target(bView), keyBase64: Buffer.from('native:9').toString('base64'), offset: '0', count: 256 } })
    assert.equal(result.base64, 'OQ==')
  }
  async function reconnect(previous) {
    await pane.getByRole('button', { name: 'Refresh status', exact: true }).click(); await openConnectionSettings(pane)
    const password = pane.locator('input[name="password"]'); assert.equal(await password.inputValue(), '')
    const mark = proxy.commands.length; await password.fill(fixture.settings.password)
    const [response] = await Promise.all([page.waitForResponse(r => r.url().endsWith('/api/redisViewer/connect')), pane.getByRole('button', { name: 'Connect', exact: true }).click()])
    const next = (await response.json()).result.value; assert.equal(next.state, 'connected'); assert(next.generation > previous.generation)
    assert.deepEqual(proxy.commands.slice(mark).map(row => row.command), ['AUTH', 'PING'])
    await pane.locator('.redis-connected').waitFor(); await scanAll('*'); await select(binaryKey); return next
  }
  const buffers = fixture.admin.withTypeMapping({ [RESP_TYPES.BLOB_STRING]: Buffer })
  const originals = []
  for (const key of fixture.autoImmutable) originals.push({ key, dump: await buffers.sendCommand(['DUMP', key]), expiry: await fixture.admin.sendCommand(['PEXPIRETIME', key]) })
  report.autoRefresh = { version: '8.2.6', readers: [], minimumIntervalMs: 1000, realPanelAndSessionVisibility: false, documentBackgroundEvent: 'model and registered handler only; no OS minimize claim' }
  const titles = new Map([[a, workspaceTitle]])
  async function openSession(owner) {
    const title = titles.get(owner), row = page.getByText(title, { exact: true }).first().locator('xpath=ancestor::*[@role="treeitem"][1]')
    await row.waitFor(); await row.hover()
    const [reply] = await Promise.all([page.waitForResponse(r => r.url().endsWith('/api/session/create')), page.getByRole('button', { name: 'New session in ' + title, exact: true }).click()])
    assert.equal((await reply.json()).result.value.sessionId, owner)
    await page.locator('[data-row-key="session:' + owner + '"][aria-selected="true"]').waitFor()
    const expand = page.locator('[data-sidebar-right-expand]').first(); if (await expand.isVisible()) await expand.click()
    if (await pane.count() === 0) { const guide = page.locator('[data-sidebar-right-guide-entry="redis"]'); if (!await guide.isVisible()) await page.locator('[data-dockkit-add-tab]').first().click(); await guide.click() }
    await pane.locator('.redis-connected').waitFor()
  }
  try {
    const bDirectory = resolve(artifacts, '../runtime/wsl-fixture-' + fixture.metadata.owner, 'auto-session-' + fixture.metadata.owner)
    await mkdir(bDirectory, { recursive: false }); const workspace = await rpc('workspace/create', { request: { path: bDirectory } })
    b = (await rpc('session/create', { request: { workspaceId: workspace.workspace.workspaceId } })).sessionId; titles.set(b, workspace.workspace.title)
    bView = await rpc('redisViewer/connect', { agentId: b, request: proxy.settings }); await checkB()
    await resizeSidebar(page, pane, 900); await scanAll('*'); await select(binaryKey)
    const noAuto = autoRequests().length; await pause(1200); assert.equal(autoRequests().length, noAuto)
    assert.deepEqual(await toolbar.locator('option').evaluateAll(rows => rows.map(row => row.value)), ['1000', '5000', '10000', '30000'])
    record('native current-Key auto control is off by default; one-second minimum and fixed 1/5/10/30-second choices cause no read until explicitly enabled')
    const cases = [[binaryKey, 'readString'], ['auto:hash', 'scanHash'], ['auto:list', 'readList'], ['auto:set', 'scanSet'], ['auto:zset', 'readZSet'], ['auto:stream', 'readStream'], ['auto:json', 'readJson'], ['auto:bitmap', 'readString', 'Bitmap'], ['auto:geo', 'readZSet', 'GEO'], ['auto:hll', 'readString', 'HyperLogLog'], ['auto:ts', 'readTimeSeries'], ['auto:bloom', 'readBloom']]
    for (const [key, method, interpretation] of cases) {
      const identity = report.autoRefresh.readers.length === 0 ? binaryKey.toString('base64') : await select(key, method, interpretation)
      if (method === 'readString' && interpretation === undefined) { await chooseValueFormat(details, 'hex'); await details.locator('input[name="byteOffset"]').fill('1') }
      if (method === 'readList') { const [reply] = await Promise.all([page.waitForResponse(ownResponse('readList')), details.getByRole('button', { name: 'Next range', exact: true }).click()]); assert.equal((await reply.json()).result.value.offset, '100'); await settled(); await details.locator('input[name="listOffset"]').fill('200') }
      if (method === 'readJson') await details.locator('input[name="jsonPath"]').fill('$.unsubmitted')
      const start = autoRequests().length, enabledAt = Date.now(); await enable()
      await until(() => autoRequests().length >= start + 2, 'two native automatic reads for ' + interpretation + ':' + method)
      await settled(); await off()
      const calls = autoRequests().slice(start); assert.equal(calls.length, 2); assert(calls[0].at - enabledAt >= 950); assert(calls[1].at - calls[0].at >= 950)
      assert(calls.every(call => call.method === (interpretation === 'GEO' ? 'readGeo' : interpretation === 'HyperLogLog' ? 'readHll' : method) && call.request.keyBase64 === identity && call.request.target.id === view.id && call.request.target.generation === view.generation && call.request.target.db === 0))
      if (method === 'readString' && interpretation === undefined) { assert(calls.every(call => call.request.offset === '0')); assert.equal(await readValueFormat(details), 'hex'); assert.equal(await details.locator('input[name="byteOffset"]').inputValue(), '1') }
      if (method === 'readList') { assert(calls.every(call => call.request.offset === '100')); assert.equal(await details.locator('[data-list-start]').innerText(), '100'); assert.equal(await details.locator('input[name="listOffset"]').inputValue(), '200') }
      if (method === 'readJson') { assert(calls.every(call => call.request.path === '$')); assert.equal(await details.locator('input[name="jsonPath"]').inputValue(), '$.unsubmitted') }
      if (method === 'readBloom') assert(calls.every(call => call.request.itemBase64 === null))
      if (['scanHash', 'scanSet', 'readStream', 'readTimeSeries'].includes(method)) assert(calls.every(call => call.request.cursor === null))
      report.autoRefresh.readers.push({ method: calls[0].method, interpretation: interpretation ?? null, startsAfterEnableMs: calls[0].at - enabledAt, betweenRequestsMs: calls[1].at - calls[0].at })
    }
    record('all twelve native viewers refresh through existing strict RPCs with raw Key/target identity; one-second waiting follows settlement, committed String/List/JSON queries and formats survive drafts, collection cursors restart bounded first pages and Bloom sends item=null only')
    await select('auto:hash', 'scanHash'); await enable(); const draftMark = autoRequests().length
    await details.locator('input[name="hashPattern"]').fill('item:1*'); assert.equal(await toolbar.getAttribute('data-auto-refresh'), 'off'); await pause(1200); assert.equal(autoRequests().length, draftMark)
    record('Hash MATCH draft clearing stops auto immediately without submitting the draft')
    await select('auto:large'); await enable(); const large = await page.waitForResponse(ownResponse('readString')); const largeBody = (await large.json()).result.value
    await settled(); await off(); assert.equal(largeBody.complete, false); assert.equal(largeBody.byteLength, 65536)
    record('automatic large String remains a 64 KiB partial window; refreshing does not drain the value or relax Host budgets')
    await select(binaryKey); const slow = proxy.holdNext('GETRANGE', binaryKey); const slowMark = autoRequests().length; await enable(); await until(() => slow.received, 'automatic real reply held')
    await pause(2400); assert.equal(autoRequests().length, slowMark + 1); const releasedAt = Date.now(); slow.release(); await settled()
    await until(() => autoRequests().length === slowMark + 2, 'one next request after slow settlement'); assert(autoRequests().at(-1).at - releasedAt >= 950); await settled(); await off()
    record('a real Redis reply held longer than two intervals produces one in-flight RPC, no overlapping timer or catch-up burst; the next read starts at least one minimum interval after release')
    const cancelHold = proxy.holdNext('GETRANGE', binaryKey); await enable(); await until(() => cancelHold.received, 'automatic cancellation reply held')
    const cancelledAt = Date.now(), cancelledMark = proxy.commands.length
    const aborted = page.waitForEvent('requestfailed', { predicate: request => request.url().endsWith('/api/redisViewer/readString') && request.postDataJSON().payload.args.agentId === a })
    await Promise.all([aborted, toggle.click()]); report.autoRefresh.cancellationMs = Date.now() - cancelledAt
    // rc.2 aborts the HTTP fetch; there is no remote cancellation ACK. Keep the
    // real reply withheld while another Host request completes, as gate 19 does.
    await checkB()
    assert.equal(await details.locator('[data-value-preview]').count(), 0); cancelHold.release(); await pause(1200)
    assert.equal(proxy.commands.slice(cancelledMark).filter(row => row.connectionId === cancelHold.connectionId).length, 0); await successful(); await checkB()
    record('turning auto Off aborts the actual Host read, clears prior bytes and suppresses pending postchecks; late reply drainage never rearms it and B remains readable')
    const hidden = proxy.holdNext('GETRANGE', binaryKey); await enable(); await until(() => hidden.received, 'automatic panel-hide reply held')
    const hiddenMark = autoRequests().length; await page.locator('[data-sidebar-right-toggle]').click(); hidden.release(); await pause(1200)
    assert.equal(autoRequests().length, hiddenMark); await page.locator('[data-sidebar-right-expand]').click(); await pane.waitFor(); await pause(1200); assert.equal(autoRequests().length, hiddenMark)
    await scanAll('*'); await select(binaryKey)
    record('real native panel collapse cancels/stops automatic reading; expanding again performs no replay or reconnect')
    const sessionHold = proxy.holdNext('GETRANGE', binaryKey); await enable(); await until(() => sessionHold.received, 'automatic session-switch reply held'); const sessionMark = autoRequests().length
    await openSession(b); sessionHold.release(); await pause(1200); assert.equal(autoRequests().length, sessionMark); await checkB()
    await openSession(a); await pause(1200); assert.equal(autoRequests().length, sessionMark); await scanAll('*'); await select(binaryKey)
    report.autoRefresh.realPanelAndSessionVisibility = true
    record('real A/B session selection stops old A timer/read; B socket stays usable and switching back does not resume, reconnect or overwrite with late A data')
    await enable(); const beforeDb = view; await keys.locator('input[name="db"]').fill('1'); await keys.getByRole('button', { name: 'Select DB', exact: true }).click()
    await keys.getByRole('heading').filter({ hasText: 'DB 1' }).waitFor(); const dbMark = autoRequests().length; await pause(1200); assert.equal(autoRequests().length, dbMark)
    const beforeStale = proxy.commands.length; assert.equal((await rpc('redisViewer/readString', { agentId: a, request: { target: target(beforeDb), keyBase64: binaryKey.toString('base64'), offset: '0', count: 256 } })).error, 'stale'); assert.equal(proxy.commands.length, beforeStale)
    await keys.locator('input[name="db"]').fill('0'); await keys.getByRole('button', { name: 'Select DB', exact: true }).click(); await keys.getByRole('heading').filter({ hasText: 'DB 0' }).waitFor(); view = await status(a); await scanAll('*'); await select(binaryKey)
    record('explicit DB selection removes the old Key timer; old database-generation targets dispatch no Redis command and returning requires a fresh explicit selection')
    const lastBeforeDenied = await details.locator('time').getAttribute('datetime')
    await fixture.admin.sendCommand(['ACL', 'SETUSER', 'default', '-getrange'])
    try { await enable(); await toolbar.locator('[data-auto-status]').filter({ hasText: 'read did not succeed' }).waitFor(); assert(await toolbar.locator('.redis-auto-time').isVisible()); assert.equal(await toolbar.locator('.redis-auto-time time').getAttribute('datetime'), lastBeforeDenied); assert.equal(await details.locator('[data-value-preview]').count(), 0); const failedMark = autoRequests().length; await pause(1200); assert.equal(autoRequests().length, failedMark) }
    finally { await fixture.admin.sendCommand(['ACL', 'SETUSER', 'default', '+getrange']) }
    await successful(); assert.equal(await toolbar.getAttribute('data-auto-refresh'), 'off')
    await select('auto:gone'); await fixture.admin.del('auto:gone'); await enable(); await until(async () => await toolbar.getAttribute('data-auto-refresh') === 'off', 'missing key stops auto'); await details.getByRole('status').filter({ hasText: 'no longer exists' }).waitFor(); assert.equal(await details.locator('[data-value-preview]').count(), 0)
    await select('auto:change'); await fixture.admin.del('auto:change'); await fixture.admin.hSet('auto:change', 'new', 'value'); await enable(); await details.locator('[data-loaded-fields]').waitFor(); await settled(); assert.equal(await toolbar.getAttribute('data-auto-refresh'), 'off')
    await select('auto:oversize', 'readJson'); await fixture.admin.sendCommand(['JSON.SET', 'auto:oversize', '$', JSON.stringify({ large: 'x'.repeat(70000) })]); await enable(); await details.getByRole('alert').waitFor(); assert.equal(await toolbar.getAttribute('data-auto-refresh'), 'off'); assert.equal(await details.locator('[data-value-preview]').count(), 0)
    record('actual Redis ACL refusal, disappeared Key, String-to-Hash change and oversized RedisJSON stop automatic reads and discard old output; manual recovery stays off and original strict/bounded Host results remain intact')
    await select(binaryKey); const timeout = proxy.holdNext('GETRANGE', binaryKey); await enable(); await until(() => timeout.received, 'automatic production timeout reply held'); const timeoutAt = Date.now()
    await details.getByRole('alert').filter({ hasText: 'Redis operation timed out.' }).waitFor({ timeout: 20000 }); report.autoRefresh.productionTimeoutAfterHeldMs = Date.now() - timeoutAt
    assert(report.autoRefresh.productionTimeoutAfterHeldMs >= 9000); assert.equal(await toolbar.getAttribute('data-auto-refresh'), 'off'); timeout.release(); await checkB()
    const old = view; view = await reconnect(view); const staleMark = proxy.commands.length
    assert.equal((await rpc('redisViewer/readString', { agentId: a, request: { target: target(old), keyBase64: binaryKey.toString('base64'), offset: '0', count: 256 } })).error, 'stale'); assert.equal(proxy.commands.length, staleMark)
    const eof = proxy.holdNext('GETRANGE', binaryKey); await enable(); await until(() => eof.received, 'automatic EOF reply held'); proxy.disconnect(eof.connectionId)
    await details.getByRole('alert').filter({ hasText: 'Cannot connect to Redis.' }).waitFor(); assert.equal(await toolbar.getAttribute('data-auto-refresh'), 'off'); await checkB(); view = await reconnect(view)
    record('automatic ten-second deadline and real TCP EOF clear values and stop the timer; only explicit password/reconnect creates a new generation with AUTH/PING and no replay, old targets are rejected and B survives')
    await resizeSidebar(page, pane, 340); await enable(); await toolbar.locator('[data-auto-status]').waitFor(); await page.screenshot({ path: resolve(artifacts, 'native-auto-refresh-narrow.png'), fullPage: true }); await off()
    await resizeSidebar(page, pane, 900); await page.screenshot({ path: resolve(artifacts, 'native-auto-refresh-wide.png'), fullPage: true })
    await enable(); const closeMark = autoRequests().length; const close = page.locator('[data-dockkit-tab-close]:visible'); assert.equal(await close.count(), 1); await close.click(); await pause(1200); assert.equal(autoRequests().length, closeMark)
    const expandAfterClose = page.locator('[data-sidebar-right-expand]:visible')
    if (await expandAfterClose.count()) await expandAfterClose.first().click()
    await page.locator('[data-sidebar-right-open]:visible').waitFor()
    const guide = page.locator('[data-sidebar-right-guide-entry="redis"]:visible')
    if (!await guide.isVisible()) await page.locator('[data-dockkit-add-tab]:visible').first().click()
    await guide.click(); await pane.locator('.redis-connected').waitFor(); await pause(1200); assert.equal(autoRequests().length, closeMark)
    for (const original of originals) { assert.deepEqual(await buffers.sendCommand(['DUMP', original.key]), original.dump); assert.equal(await fixture.admin.sendCommand(['PEXPIRETIME', original.key]), original.expiry) }
    assert(!proxy.errors.some(error => error.startsWith('proxy-'))); report.autoRefresh.proxyErrors = [...proxy.errors]
    await writeFile(resolve(artifacts, 'native-auto-refresh-timings.json'), JSON.stringify(report.autoRefresh, null, 2) + String.fromCharCode(10))
    record('real native tab close/reopen releases its timer without automatic Redis work; narrow/wide toolbar remains in the workbench, all immutable fixture values/absolute expiries remain unchanged and proxy has no protocol errors')
  } finally {
    page.off('request', observe); await fixture.admin.sendCommand(['ACL', 'SETUSER', 'default', '+getrange'])
    if (b !== undefined && bView !== undefined) { const current = await status(b); if (current.id !== null) await rpc('redisViewer/disconnect', { agentId: b, request: { id: current.id, generation: current.generation } }) }
  }
}
