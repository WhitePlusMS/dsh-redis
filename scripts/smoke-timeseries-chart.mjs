/** Local chart acceptance through the actual rc.2 browser and owned TimeSeries module. */
import assert from 'node:assert/strict'
import { resolve } from 'node:path'
import { writeFile } from 'node:fs/promises'
import { RESP_TYPES } from 'redis'
import { until } from './redis-fixture.mjs'
import { openConnectionSettings, findLoadedKey, resizeSidebar } from './native-view-controls.mjs'
const preciseKey = Buffer.concat([Buffer.from('chart:'), Buffer.from([0, 255, 128])])
export async function prepareChartFixture(fixture) {
  const admin = fixture.admin
  const module = (await admin.sendCommand(['MODULE', 'LIST'])).find(item => item.name === 'timeseries')
  assert.equal(module?.ver, 80210); fixture.metadata.timeSeriesVersion = module.ver
  const precise = [['0', '0'], ['1', '1'], ['9007199254740993', '1.2345678901234567'], ['9007199254740994', '-0.00000000000000001'], ['9223372036854775806', '-1.7976931348623157e308'], ['9223372036854775807', '1.7976931348623157e308']]
  for (const [timestamp, value] of precise) await admin.sendCommand(['TS.ADD', preciseKey, timestamp, value])
  for (let i = 0; i < 700; i++) await admin.sendCommand(['TS.ADD', 'chart:metrics', String(i), String(20 + Math.sin(i / 18) * 5 + Math.cos(i / 7))])
  await admin.sendCommand(['TS.CREATE', 'chart:empty'])
  await admin.sendCommand(['TS.ADD', 'chart:constant', '0', '0']); await admin.sendCommand(['TS.ADD', 'chart:constant', '1', '0'])
  await admin.sendCommand(['TS.ADD', 'chart:change', '0', '1']); await admin.sendCommand(['TS.ADD', 'chart:change', '1', '2'])
  fixture.chartKeys = [preciseKey, 'chart:metrics', 'chart:empty', 'chart:constant', 'chart:change']
  fixture.chartImmutable = fixture.chartKeys.slice(0, 4)
  for (const key of fixture.chartKeys) await admin.pExpire(key, 900000)
  return fixture.chartKeys.length
}
export async function smokeTimeSeriesChart({ page, rpc, fixture, pane, keys, scanAll, artifacts, report, workspaceId }) {
  const proxy = fixture.recoveryProxy; assert(proxy)
  const record = message => { report.checks.push(message); console.log('[smoke check] ' + message) }
  const details = pane.locator('.redis-details'), svg = details.locator('[data-ts-chart-svg]'), dots = details.locator('[data-ts-chart-timestamp]')
  const table = details.getByRole('button', { name: 'Table', exact: true }), chart = details.getByRole('button', { name: 'Chart', exact: true })
  const refresh = details.getByRole('button', { name: 'Read / refresh', exact: true }), more = details.getByRole('button', { name: 'Continue reading', exact: true })
  const endpoint = '**/api/redisViewer/readTimeSeries', requests = []
  const observe = request => { if (request.url().endsWith('/api/redisViewer/readTimeSeries')) requests.push(request.postDataJSON().payload.args) }
  page.on('request', observe)
  const [statusReply] = await Promise.all([page.waitForResponse(r => r.url().endsWith('/api/redisViewer/connectionStatus')), pane.getByRole('button', { name: 'Refresh status', exact: true }).click()])
  const a = statusReply.request().postDataJSON().payload.args.agentId
  let view = (await statusReply.json()).result.value, currentIdentity = '', b, bView
  const target = value => ({ id: value.id, generation: value.generation, db: value.db })
  const own = response => response.url().endsWith('/api/redisViewer/readTimeSeries') && response.request().postDataJSON().payload.args.agentId === a && response.request().postDataJSON().payload.args.request.keyBase64 === currentIdentity
  async function read(action = () => refresh.click()) {
    const [response] = await Promise.all([page.waitForResponse(own), action()]); const body = await response.json(); assert(body.result?.ok)
    const result = body.result.value
    await until(async () => await details.locator('time').getAttribute('datetime') === result.sampledAt, 'TimeSeries result committed')
    return result
  }
  async function open(key) {
    currentIdentity = Buffer.from(key).toString('base64')
    const result = await read(async () => (await findLoadedKey(keys, currentIdentity)).click()); assert.equal(result.state, 'page')
    await chart.waitFor(); assert.equal(await table.getAttribute('aria-pressed'), 'true'); return result
  }
  async function switchToChart() { const before = requests.length; await chart.click(); assert.equal(await chart.getAttribute('aria-pressed'), 'true'); assert.equal(requests.length, before) }
  async function range(start, end, count = '100') {
    const before = requests.length; await details.locator('input[name="timeseriesStart"]').fill(start); await details.locator('input[name="timeseriesEnd"]').fill(end); await details.locator('select[name="timeseriesCount"]').selectOption(count)
    assert.equal(requests.length, before); return read()
  }
  async function checkB() {
    assert.deepEqual(await rpc('redisViewer/connectionStatus', { agentId: b, request: {} }), bView)
    const result = await rpc('redisViewer/readString', { agentId: b, request: { target: target(bView), keyBase64: Buffer.from('native:9').toString('base64'), offset: '0', count: 256 } }); assert.equal(result.base64, 'OQ==')
  }
  async function theme(dark) {
    await page.getByRole('button', { name: 'Settings', exact: true }).click(); const dialog = page.getByRole('dialog', { name: 'Settings', exact: true })
    await dialog.getByRole('button', { name: 'General', exact: true }).click(); await dialog.getByRole('button', { name: dark ? 'Dark' : 'Light', exact: true }).click()
    await until(async () => await page.locator('body').evaluate(body => body.hasAttribute('data-ds-dark-theme')) === dark, 'chart appearance applied')
    await dialog.getByRole('button', { name: 'Close', exact: true }).click()
  }
  async function geometry(label) {
    const value = await pane.evaluate(root => {
      const box = root.getBoundingClientRect(), viewport = root.querySelector('.redis-chart-viewport'), rect = viewport.getBoundingClientRect()
      return { width: root.clientWidth, rootOverflow: root.scrollWidth - root.clientWidth, keysOverflow: root.querySelector('.redis-keys').scrollWidth - root.querySelector('.redis-keys').clientWidth,
        viewportInside: rect.left >= box.left - 2 && rect.right <= box.right + 2, chartOwnOverflow: viewport.scrollWidth - viewport.clientWidth, documentOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth }
    })
    assert(value.rootOverflow <= 2 && value.keysOverflow <= 2 && value.documentOverflow <= 2 && value.viewportInside); report.chart.geometry.push({ label, ...value })
    return value
  }
  const buffers = fixture.admin.withTypeMapping({ [RESP_TYPES.BLOB_STRING]: Buffer }), originals = []
  for (const key of fixture.chartImmutable) originals.push({ key, dump: await buffers.sendCommand(['DUMP', key]), expiry: await fixture.admin.sendCommand(['PEXPIRETIME', key]) })
  report.chart = { redisVersion: '8.2.6', timeSeriesVersion: fixture.metadata.timeSeriesVersion, drawingBudget: 512, geometry: [], explicitHttpFault: true }
  try {
    b = (await rpc('session/create', { request: { workspaceId } })).sessionId; assert.notEqual(b, a)
    bView = await rpc('redisViewer/connect', { agentId: b, request: proxy.settings }); await checkB()
    await resizeSidebar(page, pane, 900); await scanAll('*')
    const first = await open(preciseKey); assert.equal(first.samples.length, 6); await switchToChart()
    await until(async () => await dots.count() === 6, 'six precise native chart points')
    const mark = requests.length
    await svg.focus(); await svg.press('Home'); assert.equal(await details.locator('[data-ts-chart-utc]').innerText(), '1970-01-01T00:00:00.000Z')
    await svg.press('End'); assert.equal(await details.locator('[data-ts-chart-time]').innerText(), '9223372036854775807')
    assert.equal(await details.locator('[data-ts-chart-value-text]').innerText(), first.samples.at(-1).value)
    assert((await details.locator('[data-ts-chart-utc]').innerText()).includes('Outside date display range'))
    await table.click(); assert.equal(await details.locator('tbody tr').count(), 6); await switchToChart(); assert.equal(requests.length, mark)
    await range('9007199254740993', '9007199254740994'); await until(async () => await dots.count() === 2, 'adjacent large timestamps charted')
    const positions = await dots.evaluateAll(rows => rows.map(row => Number(row.getAttribute('cx')))); assert.deepEqual(positions, [24, 576])
    await svg.focus(); await svg.press('Home'); assert.equal(await details.locator('[data-ts-chart-time]').innerText(), '9007199254740993'); await svg.press('ArrowRight'); assert.equal(await details.locator('[data-ts-chart-time]').innerText(), '9007199254740994')
    await range('9223372036854775806', '9223372036854775807'); assert.deepEqual(await dots.evaluateAll(rows => rows.map(row => Number(row.getAttribute('cx')))), [24, 576])
    assert(await dots.evaluateAll(rows => rows.every(row => Number.isFinite(Number(row.getAttribute('cy'))))))
    await read(); assert.equal(await chart.getAttribute('aria-pressed'), 'true'); assert.equal(await dots.count(), 2)
    record('real TimeSeries 80210 chart preserves raw binary Key identity and exact 53-bit/Int64-adjacent timestamps; local table/chart/keyboard inspection makes zero extra reads, UTC is explicit and finite double extremes do not overflow')
    let pageValue = await open('chart:metrics'); for (let i = 0; i < 5; i++) pageValue = await read(() => more.click())
    assert.equal(await details.locator('[data-loaded-samples]').innerText(), '600'); assert.equal(await details.locator('tbody tr').count(), 600)
    await switchToChart(); assert.equal(await dots.count(), 512); assert.equal(await details.locator('[data-ts-chart-from]').innerText(), '0'); assert.equal(await details.locator('[data-ts-chart-to]').innerText(), '511'); assert((await details.locator('[data-ts-chart-omitted]').innerText()).includes('88'))
    assert.equal(await dots.last().getAttribute('data-ts-chart-value'), pageValue.samples.find(sample => sample.timestamp === '511').value)
    await read(() => details.locator('select[name="timeseriesDirection"]').selectOption('reverse')); for (let i = 0; i < 5; i++) await read(() => more.click())
    assert.equal(await details.locator('[data-loaded-samples]').innerText(), '600'); assert.equal(await dots.count(), 512); assert.equal(await details.locator('[data-ts-chart-from]').innerText(), '188'); assert.equal(await details.locator('[data-ts-chart-to]').innerText(), '699')
    await table.click(); assert.equal(await details.locator('tbody tr').count(), 600); await switchToChart()
    await range('701', '702'); await details.locator('[data-ts-chart-empty]').waitFor(); assert.equal(await dots.count(), 0)
    await open('chart:empty'); await switchToChart(); await details.locator('[data-ts-chart-empty]').waitFor()
    await open('chart:constant'); await switchToChart(); assert.deepEqual(await dots.evaluateAll(rows => rows.map(row => Number(row.getAttribute('cy')))), [150, 150])
    record('600 real loaded samples remain in the table while only 512 read-prefix points are drawn, with 88 explicitly not drawn; reverse reads choose the latest prefix then plot ascending, empty ranges/series invent no zero curve and constant zero series stays finite')
    await open('chart:metrics'); await read(() => more.click()); await switchToChart(); await svg.focus(); await svg.press('End')
    assert.equal(await details.locator('[data-ts-chart-time]').innerText(), '199')
    const auto = pane.locator('.redis-auto-refresh'); await auto.locator('select[name="autoRefreshInterval"]').selectOption('1000')
    const autoToggle = auto.getByRole('button', { name: 'Auto refresh', exact: true })
    const autoResult = page.waitForResponse(own); await autoToggle.click(); await autoResult
    await until(async () => await auto.locator('[data-auto-status]').innerText() === 'On · waiting', 'automatic TimeSeries chart settled'); await autoToggle.click()
    assert.equal(await chart.getAttribute('aria-pressed'), 'true'); assert.equal(await dots.count(), 100); assert.equal(await details.locator('[data-ts-chart-time]').innerText(), '0')
    record('one real automatic TimeSeries refresh keeps chart mode, replaces 200 loaded points with the bounded first 100 and removes a selected point absent from the fresh data')
    await open(preciseKey); await switchToChart()
    const hold = proxy.holdNext('TS.RANGE', preciseKey); await refresh.click(); await until(() => hold.received, 'actual TimeSeries reply held for chart cancel')
    assert.equal(await dots.count(), 0)
    const aborted = page.waitForEvent('requestfailed', { predicate: request => request.url().endsWith('/api/redisViewer/readTimeSeries') })
    const at = Date.now(), cancelMark = proxy.commands.length; await Promise.all([aborted, details.getByRole('button', { name: 'Cancel read', exact: true }).click()]); report.chart.cancelMs = Date.now() - at
    await checkB(); hold.release(); assert.equal(await dots.count(), 0); await read(); assert.equal(await dots.count(), 6)
    assert.equal(proxy.commands.slice(cancelMark).filter(command => command.connectionId === hold.connectionId && command.command === 'TYPE').length, 2)
    // The two TYPE commands above belong only to the explicit fresh retry, not
    // the cancelled operation's postchecks; its first precheck follows drainage.
    record('actual chart refresh clears old points while loading; Cancel reaches the real Host using the HTTP delivery barrier, late drainage cannot restore a graph, explicit retry is fresh and B remains readable')
    await fixture.admin.sendCommand(['ACL', 'SETUSER', 'default', '-ts.info'])
    try { assert.equal((await read()).infoState, 'permission'); assert.equal(await dots.count(), 6) }
    finally { await fixture.admin.sendCommand(['ACL', 'SETUSER', 'default', '+ts.info']) }
    await fixture.admin.sendCommand(['ACL', 'SETUSER', 'default', '-ts.range'])
    try { assert.equal((await read()).error, 'permission'); assert.equal(await dots.count(), 0) }
    finally { await fixture.admin.sendCommand(['ACL', 'SETUSER', 'default', '+ts.range']) }
    await read(); assert.equal(await dots.count(), 6)
    await page.route(endpoint, async route => { const response = await route.fetch(), body = await response.json(); body.result.value.samples[0].timestamp = 9007199254740992; await route.fulfill({ response, json: body }) })
    await Promise.all([page.waitForResponse(own), refresh.click()]); await details.getByRole('alert').filter({ hasText: 'Plugin communication failed' }).waitFor(); assert.equal(await dots.count(), 0); await page.unroute(endpoint); await read()
    await open('chart:change'); await switchToChart(); await fixture.admin.del('chart:change'); assert.equal((await read()).state, 'missing'); assert.equal(await dots.count(), 0)
    await fixture.admin.set('chart:change', 'ordinary String'); assert.equal((await read()).state, 'unsupported'); assert.equal(await dots.count(), 0)
    record('actual TS.INFO permission refusal preserves readable samples; TS.RANGE denial, deletion and type change clear graphs, while an explicitly forged numeric timestamp is refused by the actual strict browser decoder before plotting')
    await open(preciseKey); await switchToChart(); const timeout = proxy.holdNext('TS.RANGE', preciseKey); await refresh.click(); await until(() => timeout.received, 'actual TimeSeries chart deadline reply held'); const started = Date.now()
    await details.getByRole('alert').filter({ hasText: 'Redis operation timed out.' }).waitFor({ timeout: 20000 }); report.chart.timeoutAfterHeldMs = Date.now() - started; assert(report.chart.timeoutAfterHeldMs >= 9000); assert.equal(await dots.count(), 0); timeout.release(); await checkB()
    const old = view; await pane.getByRole('button', { name: 'Refresh status', exact: true }).click(); await openConnectionSettings(pane); const password = pane.locator('input[name="password"]'); assert.equal(await password.inputValue(), '')
    const beforeConnect = proxy.commands.length; await password.fill(fixture.settings.password)
    const [connected] = await Promise.all([page.waitForResponse(r => r.url().endsWith('/api/redisViewer/connect')), pane.getByRole('button', { name: 'Connect', exact: true }).click()])
    view = (await connected.json()).result.value; assert(view.generation > old.generation); assert.deepEqual(proxy.commands.slice(beforeConnect).map(command => command.command), ['AUTH', 'PING']); await pane.locator('.redis-connected').waitFor()
    const staleMark = proxy.commands.length; assert.equal((await rpc('redisViewer/readTimeSeries', { agentId: a, request: { target: target(old), keyBase64: preciseKey.toString('base64'), direction: 'forward', start: '-', end: '+', count: 100, cursor: null } })).error, 'stale'); assert.equal(proxy.commands.length, staleMark)
    record('production ten-second TimeSeries deadline clears the graph and closes only A; explicit reconnect advances generation with AUTH/PING only, old targets dispatch nothing and B survives')
    await scanAll('*'); await open('chart:metrics'); await range('0', '234'); await read(() => more.click()); await read(() => more.click()); await switchToChart(); assert.equal(await dots.count(), 235)
    const layoutMark = requests.length; await resizeSidebar(page, pane, 900); await geometry('900px light English chart'); await pane.screenshot({ path: resolve(artifacts, 'native-chart-panel-wide-light.png') })
    await theme(true); await resizeSidebar(page, pane, 340); const narrow = await geometry('340px dark English chart'); assert(narrow.chartOwnOverflow > 0); await pane.screenshot({ path: resolve(artifacts, 'native-chart-panel-narrow-dark.png') })
    await resizeSidebar(page, pane, 900); await page.getByRole('button', { name: 'Settings', exact: true }).click(); let dialog = page.getByRole('dialog', { name: 'Settings', exact: true }); await dialog.getByRole('button', { name: 'General', exact: true }).click(); await dialog.getByRole('button', { name: 'English', exact: true }).click(); await page.getByRole('menuitem', { name: '中文', exact: true }).click()
    await until(async () => await page.locator('html').getAttribute('lang') === 'zh-CN', 'chart real Chinese locale'); await page.getByRole('dialog', { name: '设置', exact: true }).getByRole('button', { name: '关闭', exact: true }).click()
    await details.getByRole('button', { name: '曲线', exact: true }).waitFor(); await geometry('900px dark Chinese chart'); assert.equal(await dots.count(), 235)
    await pane.screenshot({ path: resolve(artifacts, 'native-chart-panel-wide-zh-dark.png') }); await page.screenshot({ path: resolve(artifacts, 'native-chart-wide-zh-dark.png'), fullPage: true })
    await page.getByRole('button', { name: '设置', exact: true }).click(); dialog = page.getByRole('dialog', { name: '设置', exact: true }); await dialog.getByRole('button', { name: '中文', exact: true }).click(); await page.getByRole('menuitem', { name: 'English', exact: true }).click(); await until(async () => await page.locator('html').getAttribute('lang') === 'en', 'chart English restored'); await page.getByRole('dialog', { name: 'Settings', exact: true }).getByRole('button', { name: 'Close', exact: true }).click(); await theme(false)
    assert.equal(requests.length, layoutMark)
    for (const original of originals) { assert.deepEqual(await buffers.sendCommand(['DUMP', original.key]), original.dump); assert.equal(await fixture.admin.sendCommand(['PEXPIRETIME', original.key]), original.expiry) }
    assert(proxy.commands.filter(command => command.command.startsWith('TS.')).every(command => ['TS.INFO', 'TS.RANGE', 'TS.REVRANGE'].includes(command.command)))
    assert(!proxy.errors.some(error => error.startsWith('proxy-'))); report.chart.proxyErrors = [...proxy.errors]
    await writeFile(resolve(artifacts, 'native-chart-details.json'), JSON.stringify(report.chart, null, 2) + String.fromCharCode(10))
    record('real narrow/wide, Light/Dark and English/Chinese chart controls preserve the Database/RESP workbench without extra data reads or document overflow; immutable source values/absolute expiries stay unchanged and only readonly TS commands traverse the plugin proxy')
  } finally {
    page.off('request', observe); await page.unroute(endpoint)
    await fixture.admin.sendCommand(['ACL', 'SETUSER', 'default', '+ts.info', '+ts.range'])
    if (b !== undefined && bView !== undefined) { const current = await rpc('redisViewer/connectionStatus', { agentId: b, request: {} }); if (current.id !== null) await rpc('redisViewer/disconnect', { agentId: b, request: { id: current.id, generation: current.generation } }) }
  }
}
