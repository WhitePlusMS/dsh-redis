/** Real rc.2 sidebar geometry/theme/navigation; only owned Redis fixture data. */
import assert from 'node:assert/strict'
import { resolve } from 'node:path'
import { RESP_TYPES } from 'redis'
import { until } from './redis-fixture.mjs'

export async function smokeSidebarLayout({ page, fixture, pane, keys, scanAll, artifacts, report }) {
  const record = (...checks) => { report.checks.push(...checks); console.log('[smoke check] ' + checks.join(' | ')) }
  const panel = page.locator('[data-sidebar-right-panel]').filter({ has: pane })
  const details = pane.locator('.redis-details')
  const back = keys.getByRole('button', { name: 'Back to keys', exact: true })
  const buffers = fixture.admin.withTypeMapping({ [RESP_TYPES.BLOB_STRING]: Buffer })
  const watched = fixture.layoutKeys
  const snapshots = await Promise.all(watched.map(async key => ({ key, dump: await buffers.sendCommand(['DUMP', key]), expiry: await fixture.admin.sendCommand(['PEXPIRETIME', key]) })))
  report.layout = { widths: [], themes: [], viewers: [] }
  let reads = 0
  const readerNames = new Set(['readString', 'scanKeys', 'scanHash', 'readList', 'scanSet', 'readZSet', 'readStream', 'readJson', 'readGeo', 'readHll', 'readTimeSeries', 'readBloom'])
  const countRead = request => { if (readerNames.has(request.url().split('/').at(-1))) reads++ }
  page.on('request', countRead)
  async function width(wanted) {
    const handle = page.locator('[data-side="rightbar"]')
    const box = await handle.boundingBox(), current = await panel.boundingBox(); assert(box && current)
    const x = box.x + box.width / 2, y = box.y + box.height / 2
    await page.mouse.move(x, y); await page.mouse.down()
    await page.mouse.move(x + current.width - wanted, y, { steps: 8 }); await page.mouse.up()
    await until(async () => Math.abs((await panel.boundingBox()).width - wanted) < 6, 'actual sidebar drag reached ' + wanted)
    report.layout.widths.push({ requested: wanted, actual: (await panel.boundingBox()).width })
  }
  async function theme(dark) {
    await page.getByRole('button', { name: 'Settings', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'Settings', exact: true })
    await dialog.getByRole('button', { name: 'General', exact: true }).click()
    await dialog.getByRole('button', { name: dark ? 'Dark' : 'Light', exact: true }).click()
    await until(async () => await page.locator('body').evaluate(body => body.hasAttribute('data-ds-dark-theme')) === dark, 'native appearance setting applied')
    await dialog.getByRole('button', { name: 'Close', exact: true }).click()
    report.layout.themes.push(dark ? 'dark' : 'light')
  }
  async function geometry(label) {
    const value = await pane.evaluate(root => {
      const rect = root.getBoundingClientRect()
      const bounded = selector => [...root.querySelectorAll(selector)].filter(element => element.getClientRects().length > 0).every(element => {
        const box = element.getBoundingClientRect(); return box.left >= rect.left - 2 && box.right <= rect.right + 2
      })
      return { width: root.clientWidth, rootHorizontalOverflow: root.scrollWidth - root.clientWidth,
        connectionHorizontalOverflow: root.querySelector('.redis-connection').scrollWidth - root.querySelector('.redis-connection').clientWidth,
        keysHorizontalOverflow: root.querySelector('.redis-keys').scrollWidth - root.querySelector('.redis-keys').clientWidth,
        toolbarBounded: bounded('.redis-actions button, .redis-key-navigation button'),
        documentScrollTop: document.scrollingElement.scrollTop,
        headersSingleLine: [...root.querySelectorAll('.redis-collection-table th')].every(element => {
          const range = document.createRange(); range.selectNodeContents(element); return range.getClientRects().length === 1
        }),
        background: getComputedStyle(root).backgroundColor, color: getComputedStyle(root).color,
      }
    })
    assert(value.rootHorizontalOverflow <= 1 && value.connectionHorizontalOverflow <= 1 && value.keysHorizontalOverflow <= 1, label + ': horizontal overflow escaped a local scroll surface')
    assert(value.toolbarBounded, label + ': toolbar extends beyond the plugin')
    assert(value.headersSingleLine, label + ': a table header became vertical text')
    assert.equal(value.documentScrollTop, 0, label + ': DSH document scrolled')
    report.layout.viewers.push({ label, ...value })
  }
  async function open(key, endpoint = 'readString', trigger) {
    assert.equal(await scanAll(key === fixture.layoutLongKey ? 'layout:long:*' : key), 1)
    const selected = keys.locator('[data-key-base64="' + Buffer.from(key).toString('base64') + '"]')
    const responseFor = response => response.url().endsWith('/api/redisViewer/' + endpoint) && response.request().postDataJSON().payload.args.request.keyBase64 === Buffer.from(key).toString('base64')
    let response
    if (trigger === undefined) [response] = await Promise.all([page.waitForResponse(responseFor), selected.click()])
    else {
      await selected.click()
      const action = details.getByRole('button', { name: trigger, exact: true }); await action.waitFor()
      ;[response] = await Promise.all([page.waitForResponse(responseFor), action.click()])
    }
    const body = await response.json(); assert.equal(body.result?.ok, true); assert.notEqual(body.result.value.state, 'failed')
    await details.locator('time').waitFor()
  }
  try {
    await width(340)
    assert.equal(await scanAll('*'), fixture.expectedKeyCount)
    const identity = Buffer.from('native:140').toString('base64'), selected = keys.locator('[data-key-base64="' + identity + '"]')
    await selected.scrollIntoViewIfNeeded()
    const before = await keys.locator('.redis-key-list').evaluate(element => element.scrollTop)
    await selected.focus(); await selected.press('Enter')
    await details.locator('[data-value-coverage]').waitFor()
    assert.equal(await back.evaluate(element => document.activeElement === element), true)
    await details.locator('select[name="valueFormat"]').selectOption('text')
    assert.equal(await details.locator('[data-value-preview]').innerText(), '140')
    const beforeBackReads = reads
    await back.focus(); await back.press('Enter')
    assert.equal(await selected.getAttribute('aria-pressed'), 'true')
    assert.equal(await selected.evaluate(element => document.activeElement === element), true)
    assert.equal(await keys.locator('.redis-key-list').evaluate(element => element.scrollTop), before)
    await selected.press('Enter'); await back.waitFor()
    assert.equal(reads, beforeBackReads, 'Returning and reopening the same key must not reread')
    report.layout.returnPosition = { before, after: before, reread: false }
    record('native 340px keyboard selection focuses Back to keys; returning preserves exact list scroll, selected identity and focus, and reopening keeps data without a new read')

    await open(fixture.layoutLongKey)
    await details.locator('select[name="valueFormat"]').selectOption('text')
    assert.equal(await keys.locator('textarea[readonly]').inputValue(), Buffer.from(fixture.layoutLongKey).toString('base64'))
    await geometry('340px long key and String')
    assert((await details.locator('h2 span').boundingBox()).height <= 24, 'Long key label must occupy one visual line; full identity remains in the textarea')
    const preview = details.locator('[data-value-preview]')
    assert(await preview.evaluate(element => element.scrollWidth > element.clientWidth))
    await preview.hover(); await page.mouse.wheel(0, 600)
    assert.equal(await page.evaluate(() => document.scrollingElement.scrollTop), 0)
    record('native long key retains full Base64 identity; toolbar stays bounded and a large String scrolls inside the plugin without moving the DSH document')

    // Delaying HTTP after the real Host reply is only a loading-layout probe.
    // Actual Host cancellation/ten-second recovery was separately verified in 19.
    const endpoint = '**/api/redisViewer/readString'
    let resume, received = false, finished = false, routeFailure = null
    const gate = new Promise(resolve => { resume = resolve })
    await page.route(endpoint, async route => {
      try { const response = await route.fetch(); received = true; await gate; await route.fulfill({ response }) }
      catch (error) { routeFailure = error }
      finally { finished = true }
    })
    try {
      await details.getByRole('button', { name: 'Read / refresh', exact: true }).click()
      await until(() => received, 'real Host reply ready at delayed HTTP boundary')
      await details.getByRole('status').filter({ hasText: 'Reading byte window' }).waitFor()
      await details.getByRole('button', { name: 'Cancel read', exact: true }).waitFor()
      await geometry('340px explicit HTTP-delayed loading')
      await page.screenshot({ path: resolve(artifacts, 'native-layout-loading.png'), fullPage: true })
    } finally { resume(); await until(() => finished, 'owned delayed route released'); await page.unroute(endpoint) }
    assert.equal(routeFailure, null); await details.locator('[data-value-coverage]').waitFor()
    record('native loading status and Cancel button remain bounded in 340px; explicit HTTP reply-delay injection is released and the actual value renders again')

    const cases = [
      ['layout:hash', 'scanHash'], ['layout:list', 'readList'], ['layout:set', 'scanSet'], ['layout:zset', 'readZSet'],
      ['layout:stream', 'readStream'], ['layout:json', 'readJson'], ['layout:bitmap', 'readString', 'View as Bitmap'],
      ['layout:geo', 'readGeo', 'View coordinates (GEO)'], ['layout:hll', 'readHll', 'View as HyperLogLog'],
      ['layout:ts', 'readTimeSeries'], ['layout:bloom', 'readBloom'],
    ]
    for (const [key, endpoint, trigger] of cases) {
      await open(key, endpoint, trigger)
      await geometry('340px ' + key)
      if (key === 'layout:ts') {
        const start = await details.locator('input[name="timeseriesStart"]').boundingBox(), end = await details.locator('input[name="timeseriesEnd"]').boundingBox()
        assert(start && end && end.y > start.y && Math.abs(start.width - end.width) < 1)
      }
    }
    record('all twelve native viewers share the same bounded narrow container; long TimeSeries boundaries stack at equal width and collection tables retain their own horizontal scroll')

    await open('layout:geo', 'readGeo', 'View coordinates (GEO)')
    const table = details.locator('.redis-collection-table').first()
    assert(await table.evaluate(element => element.scrollWidth > element.clientWidth))
    assert((await table.locator('td[data-column="longitude"],td[data-column="latitude"]').evaluateAll(elements => elements.every(element => getComputedStyle(element).whiteSpace === 'nowrap' && element.scrollWidth <= element.clientWidth + 2))))
    assert((await table.locator('td[data-column="member"]').evaluateAll(elements => elements.every(element => element.clientWidth >= 118))))
    await table.focus(); await table.press('ArrowRight')
    await until(async () => await table.evaluate(element => element.scrollLeft > 0), 'focused table scrolls with keyboard')
    await width(900)
    assert.equal(await keys.locator('.redis-key-catalog').isVisible(), true); assert.equal(await details.isVisible(), true); assert.equal(await back.isVisible(), false)
    await geometry('900px GEO split')
    const catalog = await keys.locator('.redis-key-catalog').boundingBox(), detail = await keys.locator('.redis-key-detail').boundingBox()
    assert(catalog && detail && detail.x >= catalog.x + catalog.width - 1)
    await table.evaluate(element => { element.scrollLeft = 0 })
    await table.scrollIntoViewIfNeeded()
    await page.screenshot({ path: resolve(artifacts, 'native-layout-wide-light.png'), fullPage: true })
    record('real sidebar handle reaches 900px and shows list/details side by side; GEO scores/coordinates stay on single lines with a local horizontal scrollbar')

    const beforeThemeReads = reads
    await theme(true); await geometry('900px dark theme'); assert.equal(reads, beforeThemeReads)
    await width(300); await open('layout:ts', 'readTimeSeries'); await geometry('300px dark TimeSeries')
    const timestampLines = await details.locator('.redis-metadata dd').evaluateAll(elements => elements.filter(element => /^\d{16,}$/u.test(element.textContent)).map(element => {
      const range = document.createRange(); range.selectNodeContents(element); return range.getClientRects().length
    }))
    assert.deepEqual(timestampLines, [1, 1], 'Metadata timestamps must remain one line at 300px, not vertical digits')
    report.layout.metadataTimestampLines = timestampLines
    await page.screenshot({ path: resolve(artifacts, 'native-layout-narrow-dark.png'), fullPage: true })
    await details.locator('.redis-collection-table').scrollIntoViewIfNeeded()
    await page.screenshot({ path: resolve(artifacts, 'native-layout-narrow-dark-data.png'), fullPage: true })
    await details.locator('input[name="timeseriesStart"]').fill('10'); await details.locator('input[name="timeseriesEnd"]').fill('1')
    await details.getByRole('button', { name: 'Read / refresh', exact: true }).click()
    await details.getByRole('alert').waitFor(); await geometry('300px dark validation error')
    report.layout.darkErrorColor = await details.getByRole('alert').evaluate(element => getComputedStyle(element).color)
    await theme(false); await geometry('300px light validation error')
    report.layout.lightErrorColor = await details.getByRole('alert').evaluate(element => getComputedStyle(element).color)
    record('actual native Settings / General switches Dark and Light, updates colors without rereading, and retains readable 300px validation errors')

    assert.equal(await scanAll('layout:no-such-key-*'), 0); await geometry('300px empty list')
    await width(900); await geometry('900px empty detail')
    await keys.locator('.redis-key-detail').getByText('Select a key from the list to inspect its content.', { exact: true }).waitFor()
    record('actual empty MATCH and empty detail remain usable in narrow and wide modes without stale values or escaping document scroll')

    for (const snapshot of snapshots) {
      assert.deepEqual(await buffers.sendCommand(['DUMP', snapshot.key]), snapshot.dump)
      assert.equal(await fixture.admin.sendCommand(['PEXPIRETIME', snapshot.key]), snapshot.expiry)
    }
    record('all twelve viewer fixture values and absolute expiries remain unchanged after layout, navigation and native theme changes')
  } finally { page.off('request', countRead) }
}
