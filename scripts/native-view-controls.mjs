/** User-facing workbench controls shared by real DSH acceptance scripts. */
import assert from 'node:assert/strict'
import { until } from './redis-fixture.mjs'

export async function openConnectionSettings(pane) {
  const dialog = pane.locator('dialog.redis-connection-dialog')
  if (!(await dialog.isVisible())) await pane.getByRole('button', { name: 'Connection settings', exact: true }).first().click()
  await dialog.waitFor()
}

export async function chooseValueFormat(scope, format) {
  if (format.startsWith('decode-')) await scope.locator('select[name="decodeFormat"]').selectOption(format)
  else await scope.locator('[data-value-format="' + format + '"]').click()
}

export async function readValueFormat(scope) {
  const pressed = scope.locator('[data-value-format][aria-pressed="true"]')
  return await pressed.count() === 1 ? await pressed.getAttribute('data-value-format') : await scope.locator('select[name="decodeFormat"]').inputValue()
}

/** Metadata is a display tab: switching must not unmount or reread the viewer. */
export async function assertSelectedIdentity(keys, expected) {
  await keys.getByRole('tab', { name: 'Metadata', exact: true }).click()
  const identity = keys.locator('.redis-key-identity textarea')
  await identity.waitFor()
  assert.equal(await identity.inputValue(), expected)
  await keys.getByRole('tab', { name: 'Data', exact: true }).click()
}

/** Inspect on-demand explanations through the same visible control as a user. */
export async function withOpenHelp(scope, check) {
  const help = scope.locator('.redis-help').first(), wasOpen = await help.getAttribute('open') !== null
  if (!wasOpen) await help.locator('summary').click()
  try { await help.locator('.redis-help-content').waitFor(); await check() }
  finally { if (!wasOpen) await help.locator('summary').click() }
}

export async function readMetadataText(keys, locator) {
  await keys.getByRole('tab', { name: 'Metadata', exact: true }).click()
  try { await locator.waitFor(); return await locator.innerText() }
  finally { await keys.getByRole('tab', { name: 'Data', exact: true }).click() }
}

/** Scroll the actual virtual catalog; never inspect React state or a hidden full list. */
export async function findLoadedKey(keys, identity) {
  await keys.getByRole('button', { name: 'Flat key list', exact: true }).click()
  const list = keys.locator('.redis-key-list'), row = list.locator('[data-key-base64="' + identity + '"]')
  await list.evaluate(element => { element.scrollTop = 0 })
  const frame = () => list.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
  await frame()
  const count = Number(await list.getAttribute('data-row-count'))
  for (let attempt = 0; attempt <= count; ++attempt) {
    if (await row.count() === 1) { await row.scrollIntoViewIfNeeded(); return row }
    const moved = await list.evaluate(element => { const before = element.scrollTop; element.scrollTop += Math.max(30, element.clientHeight - 30); return element.scrollTop > before })
    await frame()
    if (!moved) break
  }
  throw new Error('Raw key identity is not in the loaded virtual catalog: ' + identity.slice(0, 64))
}

export async function resizeSidebar(page, pane, wanted) {
  const panel = page.locator('[data-sidebar-right-panel]').filter({ has: pane })
  const handle = page.locator('[data-side="rightbar"]'), box = await handle.boundingBox(), current = await panel.boundingBox()
  assert(box && current)
  const x = box.x + box.width / 2, y = box.y + box.height / 2
  await page.mouse.move(x, y); await page.mouse.down()
  await page.mouse.move(x + current.width - wanted, y, { steps: 8 }); await page.mouse.up()
  await until(async () => Math.abs((await panel.boundingBox()).width - wanted) < 6, 'actual native sidebar width')
  const actual = (await panel.boundingBox()).width
  assert(Math.abs(actual - wanted) < 6, 'Actual native sidebar handle did not reach requested width')
  return actual
}
