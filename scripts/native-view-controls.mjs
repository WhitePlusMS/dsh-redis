/** User-facing workbench controls shared by real DSH acceptance scripts. */
import assert from 'node:assert/strict'

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
