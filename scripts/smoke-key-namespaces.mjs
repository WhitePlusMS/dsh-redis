/** Real native catalog acceptance. Caller owns the DSH, Redis and bounded reply proxy. */
import assert from 'node:assert/strict'
import { resolve } from 'node:path'
import { RESP_TYPES } from 'redis'
import { until } from './redis-fixture.mjs'
import { assertSelectedIdentity, chooseValueFormat, findLoadedKey, openConnectionSettings, resizeSidebar } from './native-view-controls.mjs'

export async function smokeKeyNamespaces({ page, rpc, fixture, pane, keys, artifacts, report }) {
  const proxy = fixture.recoveryProxy; assert(proxy)
  const record = message => { report.checks.push(message); console.log('[smoke check] ' + message) }
  const list = keys.locator('.redis-key-list'), refresh = keys.getByRole('button', { name: 'Scan / refresh', exact: true }), more = keys.getByRole('button', { name: 'Continue scan', exact: true })
  const loaded = async () => Number(await keys.locator('[data-loaded-keys]').innerText())
  const pattern = keys.locator('input[name="pattern"]'), details = keys.locator('.redis-details')
  const flat = keys.getByRole('button', { name: 'Flat key list', exact: true }), tree = keys.getByRole('button', { name: 'Namespace tree', exact: true }), locate = keys.getByRole('button', { name: 'Locate selected key', exact: true })
  const ownResponse = name => response => response.url().endsWith('/api/redisViewer/' + name)
  const [statusResponse] = await Promise.all([page.waitForResponse(ownResponse('connectionStatus')), pane.getByRole('button', { name: 'Refresh status', exact: true }).click()])
  const owner = statusResponse.request().postDataJSON().payload.args.agentId; assert.equal(typeof owner, 'string')
  let connection = (await statusResponse.json()).result.value
  const target = () => ({ id: connection.id, generation: connection.generation, db: connection.db })
  const frame = () => list.evaluate(() => new Promise(resolveFrame => requestAnimationFrame(() => requestAnimationFrame(resolveFrame))))
  async function noRead(action) {
    const before = proxy.commands.length
    await action(); await frame()
    assert.equal(proxy.commands.length, before, 'Catalog presentation dispatched a Redis command')
  }
  async function pageScan(button = refresh) {
    const [response] = await Promise.all([page.waitForResponse(ownResponse('scanKeys')), button.click()])
    const body = await response.json(); assert.equal(body.result?.ok, true)
    const value = body.result.value
    await until(async () => await keys.locator('.redis-key-catalog > small time').getAttribute('datetime') === value.sampledAt, 'actual SCAN sample rendered')
    await until(async () => await refresh.isEnabled(), 'actual scan finished')
    return value
  }
  async function scan(match, limited = false) {
    await pattern.fill(match)
    await pageScan()
    let pages = 1
    while (await more.isEnabled()) { await pageScan(more); assert(++pages < 200, 'Owned SCAN did not terminate') }
    assert((await keys.locator('.redis-key-catalog').innerText()).includes(limited ? 'Local cache limit reached' : 'Scan complete'))
    return { count: await loaded(), pages }
  }
  async function openKey(identity) {
    const row = await findLoadedKey(keys, identity)
    const [response] = await Promise.all([page.waitForResponse(response => ownResponse('readString')(response) && response.request().postDataJSON().payload.args.request.keyBase64 === identity), row.click()])
    const body = await response.json(); assert.equal(body.result?.ok, true)
    await until(async () => await details.locator('time').getAttribute('datetime') === body.result.value.sampledAt, 'selected original bytes rendered')
    return body.result.value
  }
  async function separator(value) {
    const help = keys.locator('.redis-namespace-tools .redis-help')
    await help.locator('summary').click()
    await help.locator('input[name="namespaceSeparator"]').fill(value)
    await help.getByRole('button', { name: 'Apply separator', exact: true }).click()
    return help
  }
  async function connectAs(username, password) {
    if (await pane.locator('.redis-connected').count() > 0) await pane.getByRole('button', { name: 'Disconnect', exact: true }).click()
    await openConnectionSettings(pane)
    await pane.locator('input[name="username"]').fill(username)
    assert.equal(await pane.locator('input[name="password"]').inputValue(), '')
    await pane.locator('input[name="password"]').fill(password)
    const mark = proxy.commands.length
    const [response] = await Promise.all([page.waitForResponse(ownResponse('connect')), pane.getByRole('button', { name: 'Connect', exact: true }).click()])
    const body = await response.json(); assert.equal(body.result?.ok, true); connection = body.result.value
    assert.equal(connection.state, 'connected'); await pane.locator('.redis-connected').waitFor()
    assert.deepEqual(proxy.commands.slice(mark).map(value => value.command), ['AUTH', 'PING'], 'Explicit reconnect must not replay a scan or read')
    assert.equal(await loaded(), 0)
  }
  report.namespaces = { cacheRowLimit: 5000, cacheEncodedBytes: 2 * 1024 * 1024, maxDepth: 16, rowHeight: 30, windows: [], noPresentationRedis: false }
  const buffers = fixture.admin.withTypeMapping({ [RESP_TYPES.BLOB_STRING]: Buffer })
  // All writes below are fixture seeding through its independent admin socket.
  for (let offset = 0; offset < 5105; offset += 100) {
    const pairs = Array.from({ length: Math.min(100, 5105 - offset) }, (_, n) => { const index = offset + n; return [`nav:${String(index % 10).padStart(2, '0')}:${String(index).padStart(4, '0')}`, 'value-' + index] })
    await fixture.admin.sendCommand(['MSET', ...pairs.flat()])
  }
  const specialSuffixes = ['', 'a', 'a:', 'a::x', ':x', Buffer.from([255, 58, 120]), Buffer.from([254, 58, 120]), '�:x', 'é:x', 'é:x', '\uFEFF:x', 'deep:' + 'x:'.repeat(40)]
  const special = specialSuffixes.map(value => Buffer.concat([Buffer.from('nav-special:'), Buffer.from(value)]))
  for (const raw of special) await fixture.admin.set(raw, 'raw-' + raw.toString('base64'))
  await fixture.admin.set('', 'empty-key-value')
  for (let offset = 0; offset < 512; offset += 32) await fixture.admin.sendCommand(['MSET', ...Array.from({ length: 32 }, (_, n) => ['nav-bytes:' + String(offset + n).padStart(3, '0') + ':' + 'x'.repeat(4096), 'one']).flat()])
  const watched = [special[5], Buffer.from('nav:00:0000'), Buffer.alloc(0)]
  const snapshots = await Promise.all(watched.map(async raw => ({ raw, dump: await buffers.sendCommand(['DUMP', raw]), expiry: await fixture.admin.sendCommand(['PEXPIRETIME', raw]) })))
  const pluginMark = proxy.commands.length
  const heldReplies = []
  try {
    await tree.click(); await pattern.fill('nav:*')
    const first = await pageScan(); assert.equal(first.state, 'page'); assert(first.cursor !== null)
    const firstCount = await loaded(); assert(firstCount > 0 && firstCount < 5105)
    assert((await keys.locator('.redis-key-catalog').innerText()).includes('More available'))
    const root = list.locator('[data-namespace-id="namespace:bmF2Og=="]')
    assert.equal(Number(await root.locator('[data-namespace-count]').innerText()), firstCount)
    await noRead(async () => {
      await root.click()
      const folder = list.locator('[data-namespace-id]').nth(1); await folder.click()
      await list.focus(); await list.press('Home'); await list.press('ArrowRight'); await list.press('ArrowDown')
    })
    record('native namespace groups show only the current loaded count and More available; expansion and keyboard navigation issue no Redis commands')

    await flat.click()
    const selectedIdentity = await list.locator('[data-key-base64]').first().getAttribute('data-key-base64'); assert(selectedIdentity !== null)
    const original = await openKey(selectedIdentity); assert.equal(original.state, 'value')
    await assertSelectedIdentity(keys, selectedIdentity)
    await chooseValueFormat(details, 'text')
    const selectedText = await details.locator('[data-value-preview]').innerText()
    assert.match(selectedText, /^value-\d+$/u)
    await tree.click(); await locate.click(); await frame()
    const anchorBefore = await list.evaluate(element => { const index = Math.floor(element.scrollTop / 30); return { id: element.querySelector('[data-row-index="' + index + '"]')?.getAttribute('data-key-base64') ?? element.querySelector('[data-row-index="' + index + '"]')?.getAttribute('data-namespace-id'), offset: element.scrollTop % 30 } })
    const beforeAppend = proxy.commands.length
    await pageScan(more)
    assert.deepEqual(proxy.commands.slice(beforeAppend).map(value => value.command), ['SCAN'])
    const anchorAfter = await list.evaluate(element => { const index = Math.floor(element.scrollTop / 30); return { id: element.querySelector('[data-row-index="' + index + '"]')?.getAttribute('data-key-base64') ?? element.querySelector('[data-row-index="' + index + '"]')?.getAttribute('data-namespace-id'), offset: element.scrollTop % 30 } })
    assert.deepEqual(anchorAfter, anchorBefore, 'Incremental group inserts must preserve the top row and pixel offset')
    assert.equal(await details.locator('[data-value-preview]').innerText(), selectedText)
    record('real SCAN continuation incrementally updates existing groups without rereading the selected value or moving the viewport anchor')

    let pages = 2
    while (await more.isEnabled()) { await pageScan(more); assert(++pages < 200) }
    assert.equal(await loaded(), 5000); assert((await keys.locator('.redis-key-catalog').innerText()).includes('Local cache limit reached'))
    await noRead(async () => {
      await flat.click(); await list.focus(); await list.press('End'); await frame()
      assert(await list.locator('[data-row-index="4999"]').count() === 1)
      const state = await list.evaluate(element => ({ total: Number(element.dataset.rowCount), mounted: element.querySelectorAll('[role="treeitem"]').length, height: element.clientHeight, top: element.scrollTop }))
      assert.equal(state.total, 5000); assert(state.top > 0); assert(state.mounted <= Math.ceil(state.height / 30) + 14)
      report.namespaces.windows.push(state)
      await tree.click(); await locate.click(); await frame()
      const selected = list.locator('[data-key-base64="' + selectedIdentity + '"]'); await selected.waitFor()
      assert.equal(await selected.getAttribute('aria-selected'), 'true')
      assert.equal(await list.getAttribute('aria-activedescendant'), await selected.getAttribute('id'))
      const visible = await selected.evaluate(element => { const row = element.getBoundingClientRect(), viewport = element.closest('.redis-key-list').getBoundingClientRect(); return row.top >= viewport.top - 1 && row.bottom <= viewport.bottom + 1 })
      assert(visible); assert.equal(await details.locator('[data-value-preview]').innerText(), selectedText)
    })
    report.namespaces.rowLimitScanPages = pages
    record('native 5105-key fixture stops at the 5000-key cache limit with an incomplete label; End reaches row 4999 with bounded DOM and Locate expands the exact selected byte path without reading')

    // Show the actual tree overview, rather than only a located leaf deep below its ancestors.
    await noRead(async () => {
      await list.focus(); await list.press('Home'); await frame()
      assert.equal(await root.locator('[data-namespace-count]').innerText(), '5000')
    })
    await resizeSidebar(page, pane, 900)
    await pane.screenshot({ path: resolve(artifacts, 'native-namespaces-wide.png') })
    await resizeSidebar(page, pane, 340)
    const geometry = await pane.evaluate(element => ({ overflow: element.scrollWidth - element.clientWidth, keys: element.querySelector('.redis-key-catalog').getBoundingClientRect().width, detail: element.querySelector('.redis-key-detail').getBoundingClientRect().width, groupCounts: [...element.querySelectorAll('[data-namespace-count]')].every(value => value.getClientRects().length > 0) }))
    assert(geometry.overflow <= 1 && geometry.keys > 0 && geometry.detail > 0 && geometry.groupCounts)
    report.namespaces.narrowGeometry = geometry
    await pane.screenshot({ path: resolve(artifacts, 'native-namespaces-narrow.png') })
    record('actual DSH sidebar handle shows namespace/Key/data workbench at 900px and a bounded persistent Key/detail split with visible loaded group counts at 340px')

    const bytes = await scan('nav-bytes:*', true)
    assert(bytes.count > 0 && bytes.count < 512)
    assert(bytes.count < 5000); assert.equal(await more.isEnabled(), false)
    report.namespaces.encodedByteLimit = bytes
    record('real 512-key fixture with 4KiB names reaches the encoded 2MiB cache boundary before the row cap; no false complete count or reusable cursor is shown')

    assert.equal((await scan('nav-special:*')).count, special.length)
    const binary = special[5].toString('base64')
    assert.equal((await openKey(binary)).base64, Buffer.from('raw-' + binary).toString('base64'))
    await assertSelectedIdentity(keys, binary)
    await noRead(async () => {
      await tree.click(); await locate.click(); await frame()
      const help = await separator('::'); assert.equal(await help.getAttribute('open'), '')
      await help.locator('summary').click(); await locate.click(); await frame()
      assert.equal(await list.locator('[data-key-base64="' + binary + '"]').getAttribute('aria-selected'), 'true')
      const invalid = await separator(''); await invalid.getByRole('alert').waitFor(); await invalid.locator('summary').click()
      const restored = await separator(':'); await restored.locator('summary').click(); await locate.click(); await frame()
      const deepIdentity = special.at(-1).toString('base64')
      await flat.click(); const deep = await findLoadedKey(keys, deepIdentity); await deep.waitFor()
      await tree.click()
      await pattern.fill('nav-special:a*')
      assert.equal(await loaded(), 0); assert.equal(await locate.isEnabled(), false)
    })
    assert.equal((await scan('nav-special:a*')).count, 3)
    assert.equal((await scan('')).count, 1)
    assert.equal((await openKey('')).base64, Buffer.from('empty-key-value').toString('base64'))
    await assertSelectedIdentity(keys, '')
    record('native binary, empty-key, repeated/empty segments, leaf/folder collisions and UTF-8 prefixes retain full identity; separator edits, invalid draft and MATCH edits do not read or reuse old selections')

    // A dedicated mutable fixture demonstrates explicit refresh after external changes.
    await fixture.admin.set('nav-mutable', 'original')
    assert.equal((await scan('nav-mutable')).count, 1)
    await openKey(Buffer.from('nav-mutable').toString('base64'))
    await fixture.admin.del('nav-mutable')
    await details.getByRole('button', { name: 'Read / refresh', exact: true }).click()
    await details.getByRole('status').filter({ hasText: 'The key no longer exists' }).waitFor()
    await fixture.admin.rPush('nav-mutable', ['external-type-change'])
    const [listResponse] = await Promise.all([page.waitForResponse(ownResponse('readList')), details.getByRole('button', { name: 'Read / refresh', exact: true }).click()])
    const listBody = await listResponse.json(); assert.equal(listBody.result?.ok, true); assert.equal(listBody.result.value.state, 'page')
    assert.equal(listBody.result.value.entries[0]?.value.base64, Buffer.from('external-type-change').toString('base64'))
    await details.locator('[data-list-index="0"]').filter({ hasText: '"external-type-change"' }).waitFor()
    assert.equal(await details.locator('[data-value-preview]').count(), 0)
    const staleMark = proxy.commands.length
    const stale = await rpc('redisViewer/scanKeys', { agentId: owner, request: { target: { ...target(), generation: target().generation + 1 }, pattern: '*', cursor: null } })
    assert.equal(stale.error, 'stale'); assert.equal(proxy.commands.length, staleMark)
    record('selected loaded keys are observations: external deletion/type changes clear value bytes on explicit refresh, and a forged target generation is rejected before Redis dispatch')

    const limitedUser = 'nav-' + fixture.metadata.owner
    await fixture.admin.sendCommand(['ACL', 'SETUSER', limitedUser, 'on', '>' + fixture.settings.password, '~*', '+ping', '+auth'])
    await connectAs(limitedUser, fixture.settings.password)
    await pattern.fill('nav:*'); assert.equal((await pageScan()).error, 'permission')
    await keys.getByRole('alert').filter({ hasText: 'not allowed' }).waitFor()
    assert.equal(await loaded(), 0); assert.equal(await more.isEnabled(), false)
    await connectAs('', fixture.settings.password)
    await fixture.admin.sendCommand(['ACL', 'DELUSER', limitedUser])
    record('native explicitly connected restricted ACL user receives a fixed SCAN permission error with no rows/cursor; manual normal reconnect starts empty without replay')

    await pattern.fill('nav:*')
    const hold = proxy.holdNext('SCAN'); heldReplies.push(hold); await refresh.click(); await until(() => hold.received, 'actual SCAN reply held')
    await keys.getByRole('button', { name: 'Cancel read', exact: true }).click()
    await keys.getByRole('alert').filter({ hasText: 'Stopped waiting' }).waitFor()
    const cancelledMark = proxy.commands.length; hold.release(); await frame()
    assert.equal(await loaded(), 0); assert.equal(await more.isEnabled(), false); assert.equal(proxy.commands.length, cancelledMark)
    assert.equal((await pageScan()).state, 'page')
    record('actual native SCAN cancellation drops the old page/cursor and does not replay after the held real reply drains; only explicit refresh starts another scan')

    const timeout = proxy.holdNext('SCAN'), started = Date.now()
    heldReplies.push(timeout)
    await refresh.click(); await until(() => timeout.received, 'production-timeout SCAN reply held')
    await keys.getByRole('alert').filter({ hasText: 'Redis operation timed out' }).waitFor({ timeout: 20000 })
    report.namespaces.productionTimeoutMs = Date.now() - started
    assert(report.namespaces.productionTimeoutMs >= 9500 && report.namespaces.productionTimeoutMs < 20000)
    assert.equal(await loaded(), 0); assert.equal(await more.isEnabled(), false)
    timeout.release()
    const oldGeneration = connection.generation
    await pane.getByRole('button', { name: 'Refresh status', exact: true }).click()
    await until(async () => await pane.locator('.redis-connected').count() === 0, 'timeout connection status refreshed')
    await connectAs('', fixture.settings.password); assert(connection.generation > oldGeneration)
    record('actual production ten-second SCAN timeout clears rows and cursor, closes the uncertain generation and requires password/manual reconnect; reconnect sends AUTH/PING only')

    for (const snapshot of snapshots) {
      assert.deepEqual(await buffers.sendCommand(['DUMP', snapshot.raw]), snapshot.dump)
      assert.equal(await fixture.admin.sendCommand(['PEXPIRETIME', snapshot.raw]), snapshot.expiry)
    }
    const allowed = new Set(['SCAN', 'TYPE', 'PTTL', 'STRLEN', 'GETRANGE', 'LLEN', 'LRANGE', 'AUTH', 'PING'])
    const pluginCommands = proxy.commands.slice(pluginMark).map(value => value.command)
    assert(pluginCommands.every(value => allowed.has(value)), 'Unexpected plugin command in namespace acceptance')
    assert.deepEqual(proxy.errors, [])
    report.namespaces.pluginCommands = Object.fromEntries([...allowed].map(command => [command, pluginCommands.filter(value => value === command).length]))
    report.namespaces.noPresentationRedis = true
    record('proxy-observed plugin commands stay within the fixed readonly SCAN/String/auth set; watched binary/empty/ordinary source DUMPs and absolute expiries remain unchanged; 2MiB means DTO cache, not a JS heap claim')
  } finally {
    // All fixture directories/processes remain owned by the caller and its outer finally.
    for (const hold of heldReplies) hold.release()
  }
}
