/** Native loaded-content operations; no database is searched by the display controls. */
import assert from 'node:assert/strict'
import { resolve } from 'node:path'
import { RESP_TYPES } from 'redis'
import { until } from './redis-fixture.mjs'
import { assertSelectedIdentity, chooseValueFormat, findLoadedKey, resizeSidebar } from './native-view-controls.mjs'

export async function smokeFocusedValue({ page, fixture, pane, keys, scanAll, artifacts, report }) {
  const proxy = fixture.recoveryProxy; assert(proxy)
  const record = message => { report.checks.push(message); console.log('[smoke check] ' + message) }
  const jsonText = '{"id":9007199254740993,"n":1e400,"n":-0,"nested":{"city":"北京","tags":["redis","redis"],"quoted":"} ["}}'
  JSON.parse(jsonText)
  const binary = Buffer.concat([Buffer.from('focus:binary:'), Buffer.from([255, 0, 128])])
  const longText = 'event\n'.repeat(12000) + 'UNLOADED_ONLY_TOKEN'
  const many = '[' + Array.from({ length: 1200 }, (_, index) => '{"id":' + index + '}').join(',') + ']'
  await fixture.admin.set('focus:json', jsonText); await fixture.admin.set(binary, jsonText)
  await fixture.admin.set('focus:partial', longText); await fixture.admin.set('focus:many', many)
  fixture.expectedKeyCount += 4
  const buffers = fixture.admin.withTypeMapping({ [RESP_TYPES.BLOB_STRING]: Buffer })
  const snapshots = await Promise.all(['focus:json', binary, 'focus:partial', 'focus:many'].map(async key => ({ key, dump: await buffers.sendCommand(['DUMP', key]), expiry: await fixture.admin.sendCommand(['PEXPIRETIME', key]) })))
  const details = keys.locator('.redis-details'), preview = details.locator('[data-value-preview]'), scope = details.locator('.redis-byte-preview')
  const list = keys.locator('.redis-key-list'), query = scope.locator('input[name="loadedQuery"]')
  const focus = keys.getByRole('button', { name: 'Focus details', exact: true }), restore = keys.getByRole('button', { name: 'Restore key navigation', exact: true })
  const frame = () => page.evaluate(() => new Promise(resolveFrame => requestAnimationFrame(() => requestAnimationFrame(resolveFrame))))
  async function noRead(action) { const before = proxy.commands.length; await action(); await frame(); assert.equal(proxy.commands.length, before, 'Display controls dispatched a Redis command') }
  async function openKey(match, identity) {
    await scanAll(match)
    const row = await findLoadedKey(keys, identity)
    const [response] = await Promise.all([page.waitForResponse(value => value.url().endsWith('/api/redisViewer/readString') && value.request().postDataJSON().payload.args.request.keyBase64 === identity), row.click()])
    const body = await response.json(); assert.equal(body.result?.ok, true); assert.equal(body.result.value.state, 'value')
    await until(async () => await details.locator('time').getAttribute('datetime') === body.result.value.sampledAt, 'actual focused-view read rendered')
    return body.result.value
  }
  async function geometry(label) {
    const value = await pane.evaluate(root => ({ overflow: root.scrollWidth - root.clientWidth, documentTop: document.scrollingElement.scrollTop, focused: root.querySelector('.redis-keys').dataset.focused, catalog: root.querySelector('.redis-key-catalog').getClientRects().length > 0, detailWidth: root.querySelector('.redis-key-detail').getBoundingClientRect().width, previewWidth: root.querySelector('[data-value-preview]').getBoundingClientRect().width }))
    assert(value.overflow <= 1 && value.documentTop === 0 && value.previewWidth > 0)
    assert.equal(value.catalog, value.focused !== 'true')
    report.focused.geometry.push({ label, ...value })
  }
  report.focused = { geometry: [], clipboard: 'Controlled API substitute records exact writeText arguments; OS clipboard permissions are not asserted', passed: false }
  await page.evaluate(() => {
    window.__redisFocusClipboard = { previous: Object.getOwnPropertyDescriptor(navigator, 'clipboard'), mode: 'ok', writes: [], release: null }
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText(text) {
      const state = window.__redisFocusClipboard; state.writes.push(text)
      if (state.mode === 'fail') return Promise.reject(new Error('controlled clipboard refusal'))
      if (state.mode === 'hold') return new Promise(resolveCopy => { state.release = resolveCopy })
      return Promise.resolve()
    } } })
  })
  try {
    await resizeSidebar(page, pane, 900)
    await openKey('*', binary.toString('base64'))
    await chooseValueFormat(details, 'json'); await frame()
    const full = await preview.textContent()
    assert(full.includes('9007199254740993') && full.includes('1e400') && full.includes('-0'))
    assert.equal((full.match(/"n"/g) ?? []).length, 2)
    await assertSelectedIdentity(keys, binary.toString('base64'))
    const listPosition = await list.evaluate(element => element.scrollTop)
    await noRead(async () => {
      await preview.focus(); await preview.press('Control+f'); await query.waitFor()
      assert.equal(await query.evaluate(element => document.activeElement === element), true)
      await query.fill('redis'); assert.equal(await scope.locator('[data-content-matches]').innerText(), '1/2')
      await focus.click(); await geometry('900px focused JSON')
      assert.equal(await keys.getAttribute('data-focused'), 'true')
      assert.equal(await query.inputValue(), 'redis')
      assert.equal(await preview.textContent(), full)
      await query.press('Enter'); assert.equal(await scope.locator('[data-content-matches]').innerText(), '2/2')
      await query.press('Shift+Enter'); assert.equal(await scope.locator('[data-content-matches]').innerText(), '1/2')
      await restore.click()
      assert.equal(await list.evaluate(element => element.scrollTop), listPosition)
      assert.equal(await query.inputValue(), 'redis')
      assert.equal(await keys.getAttribute('data-focused'), 'false')
      await query.focus(); await query.press('Escape')
      assert.equal(await query.count(), 0); assert.equal(await preview.evaluate(element => document.activeElement === element), true)
    })
    report.focused.listPosition = listPosition
    record('native binary-key JSON focus/restore preserves exact identity, formatted number tokens, loaded find state, match navigation and virtual-list scroll position without Redis commands; Ctrl+F and Escape stay local')

    await noRead(async () => {
      await scope.getByRole('button', { name: 'Collapse all JSON', exact: true }).click()
      assert((await preview.textContent()).includes('lines')); assert(!(await preview.textContent()).includes('9007199254740993'))
      await scope.getByRole('button', { name: 'Copy read content', exact: true }).click()
      await scope.getByRole('status').filter({ hasText: 'Copied' }).waitFor()
      assert.equal(await page.evaluate(() => window.__redisFocusClipboard.writes.at(-1)), full)
      await scope.getByRole('button', { name: 'Expand all JSON', exact: true }).click(); assert.equal(await preview.textContent(), full)
      const block = preview.locator('[data-json-fold]').nth(1); await block.click()
      assert.equal(await block.getAttribute('aria-expanded'), 'false'); await block.click()
      assert.equal(await preview.textContent(), full)
      await page.evaluate(() => { window.__redisFocusClipboard.mode = 'fail' })
      await scope.getByRole('button', { name: 'Copy read content', exact: true }).click()
      await scope.getByRole('status').filter({ hasText: 'Copy failed' }).waitFor()
      await page.evaluate(() => { window.__redisFocusClipboard.mode = 'hold' })
      await scope.getByRole('button', { name: 'Copy read content', exact: true }).click()
      await chooseValueFormat(details, 'text'); await frame()
      await page.evaluate(() => { window.__redisFocusClipboard.release(); window.__redisFocusClipboard.mode = 'ok' }); await frame()
      assert.equal(await scope.getByRole('status').filter({ hasText: 'Copied' }).count(), 0)
      await chooseValueFormat(details, 'json')
    })
    record('native JSON folds restore exact source text and copy passes the complete unfolded preview to a controlled Clipboard API; refusal and late completion are visible/isolated without claiming OS clipboard access')

    await resizeSidebar(page, pane, 340)
    await noRead(async () => {
      await focus.click(); await preview.focus(); await preview.press('Control+f'); await query.fill('9007199254740993')
      assert.equal(await scope.locator('[data-content-matches]').innerText(), '1/1')
      await geometry('340px focused search')
      await pane.screenshot({ path: resolve(artifacts, 'native-focused-narrow.png') })
      await query.press('Escape'); assert.equal(await keys.getAttribute('data-focused'), 'true')
      await preview.press('Escape'); assert.equal(await keys.getAttribute('data-focused'), 'false')
      await geometry('340px restored split')
    })
    await resizeSidebar(page, pane, 900)
    await focus.click(); await pane.screenshot({ path: resolve(artifacts, 'native-focused-wide.png') }); await restore.click()
    record('actual native 340px focused preview/search stays bounded and two-stage Escape closes find then restores the split; 900px focus and return use the same reader DOM')

    await openKey('focus:partial', Buffer.from('focus:partial').toString('base64'))
    await chooseValueFormat(details, 'text')
    await details.locator('[data-value-coverage]').filter({ hasText: 'Partial byte preview' }).waitFor()
    await noRead(async () => {
      await scope.getByRole('button', { name: 'Find in loaded content', exact: true }).click()
      await query.fill('UNLOADED_ONLY_TOKEN'); assert.equal(await scope.locator('[data-content-matches]').innerText(), '0/0')
      await query.fill('event'); assert((await scope.innerText()).includes('1000 /'))
      assert.equal(await preview.locator('mark').count(), 1000)
      await focus.click(); await query.focus(); await query.press('Escape'); await preview.press('Escape')
    })
    record('native partial String search excludes the unread tail and explicitly reports loaded-only scope; repeated loaded matches retain exactly 1000 highlights with the full loaded count, without whole-Redis search')

    await openKey('focus:many', Buffer.from('focus:many').toString('base64')); await chooseValueFormat(details, 'json')
    await noRead(async () => {
      assert.equal(await preview.locator('[data-json-fold]').count(), 512)
      await scope.getByText('Only the first 512 fold controls are available; all other content remains.', { exact: true }).waitFor()
      await scope.getByRole('button', { name: 'Collapse all JSON', exact: true }).click()
      assert.equal(await preview.locator('[data-json-fold]').count(), 1)
      await scope.getByRole('button', { name: 'Expand all JSON', exact: true }).click()
      assert((await preview.textContent()).includes('1199'))
    })
    record('native 1200-object JSON retains all original text while bounding fold controls at 512; root collapse mounts one control and full expansion restores the final object')

    // Same shared preview on a collection cell: no focus-owned duplicate reader.
    await fixture.admin.hSet('focus:hash', { first: jsonText }); ++fixture.expectedKeyCount
    await scanAll('focus:hash')
    const [hashResponse] = await Promise.all([page.waitForResponse(response => response.url().endsWith('/api/redisViewer/scanHash')), keys.locator('.redis-key-list [data-key-base64]').click()])
    assert.equal((await hashResponse.json()).result?.ok, true)
    await details.locator('[data-hash-value]').first().click()
    await details.locator('.redis-cell-preview').waitFor(); await chooseValueFormat(details.locator('.redis-cell-preview'), 'json')
    await noRead(async () => {
      await focus.click(); await details.locator('.redis-cell-preview [data-value-preview]').focus()
      await details.locator('.redis-cell-preview [data-value-preview]').press('Control+f')
      await details.locator('input[name="loadedQuery"]').fill('9007199254740993')
      assert.equal(await details.locator('[data-content-matches]').innerText(), '1/1')
      await restore.click(); await details.locator('.redis-cell-preview').waitFor()
    })
    record('native selected Hash cell uses the same focused/searchable lossless JSON preview and retains its selected field on restore without another HSCAN')
    for (const snapshot of snapshots) { assert.deepEqual(await buffers.sendCommand(['DUMP', snapshot.key]), snapshot.dump); assert.equal(await fixture.admin.sendCommand(['PEXPIRETIME', snapshot.key]), snapshot.expiry) }
    report.focused.passed = true
    record('all focus fixtures preserve source DUMP bytes and absolute expiry; display-only operations are measured against real proxy command counts')
  } finally {
    await page.evaluate(() => { const state = window.__redisFocusClipboard; if (state.previous === undefined) delete navigator.clipboard; else Object.defineProperty(navigator, 'clipboard', state.previous); delete window.__redisFocusClipboard }).catch(() => undefined)
  }
}
