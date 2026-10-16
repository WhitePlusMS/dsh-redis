/** Native two-session acceptance; caller owns the isolated DSH/Redis lifecycle. */
import assert from 'node:assert/strict'
import { resolve } from 'node:path'
import { mkdir } from 'node:fs/promises'
import { until } from './redis-fixture.mjs'

export async function smokeSessionState({ page, context, origin, rpc, fixture, pane, keys, scanAll, artifacts, report, baseline, workspaceTitle }) {
  const profileId = await pane.locator('select[name="profile"]').inputValue()
  assert(profileId, 'Session acceptance requires its owned shared profile')
  const identity = Buffer.concat([Buffer.from('session:a:'), Buffer.from([0, 255, 128])]).toString('base64')
  await fixture.admin.select(1); await fixture.admin.set(Buffer.from(identity, 'base64'), 'session-a-value'); await fixture.admin.select(0)
  async function activeOwner() {
    const request = page.waitForRequest(value => value.url().endsWith('/api/redisViewer/connectionStatus'))
    await pane.getByRole('button', { name: 'Refresh status', exact: true }).click()
    return (await request).postDataJSON().payload.args.agentId
  }
  const a = await activeOwner()
  const readState = owner => rpc('redisViewer/loadBrowsingState', { agentId: owner, request: {} })
  const status = owner => rpc('redisViewer/connectionStatus', { agentId: owner, request: {} })
  const workspaceTitles = new Map([[a, workspaceTitle]])
  async function openSession(owner) {
    const title = workspaceTitles.get(owner); assert(title)
    const row = page.getByText(title, { exact: true }).first().locator('xpath=ancestor::*[@role="treeitem"][1]')
    await row.waitFor(); await row.hover()
    // rc.2 deliberately hides non-current blank sessions. Its ordinary workspace
    // entry adopts the existing blank session before selecting it as main view.
    const [response] = await Promise.all([
      page.waitForResponse(value => value.url().endsWith('/api/session/create')),
      page.getByRole('button', { name: 'New session in ' + title, exact: true }).click(),
    ])
    const body = await response.json(); assert(body.result?.ok); assert.equal(body.result.value.sessionId, owner)
    await page.locator('[data-row-key="session:' + owner + '"][aria-selected="true"]').waitFor()
    const expand = page.locator('[data-sidebar-right-expand]').first()
    if (await expand.isVisible()) await expand.click()
    await page.locator('[data-sidebar-right-open]').first().waitFor()
    if (await pane.count() === 0) {
      const guide = page.locator('[data-sidebar-right-guide-entry="redis"]')
      if (!(await guide.isVisible())) await page.locator('[data-dockkit-add-tab]').first().click()
      await guide.waitFor(); await guide.click()
    }
    await pane.locator('select[name="profile"]').waitFor()
    await until(async () => await pane.locator('select[name="profile"]').isEnabled() || await pane.locator('.redis-connected').isVisible(), 'restored session form ready')
    assert.equal(await activeOwner(), owner)
  }

  function counters(info) {
    return Object.fromEntries(info.split('\r\n').filter(line => line.startsWith('cmdstat_') && !/^cmdstat_(?:info|client[|:])/u.test(line)).map(line => [line.split(':')[0], line.match(/calls=(\d+)/u)?.[1]]))
  }
  async function noRedisRestore(owner, check) {
    const before = counters(await fixture.admin.info('commandstats')), clients = await fixture.clients(), target = await status(owner)
    await openSession(owner); await check()
    assert.equal(await fixture.clients(), clients)
    assert.deepEqual(await status(owner), target)
    assert.deepEqual(counters(await fixture.admin.info('commandstats')), before, 'Switching/restoring must issue no Redis command')
  }
  await keys.locator('input[name="db"]').fill('1'); await keys.getByRole('button', { name: 'Select DB', exact: true }).click()
  await keys.getByRole('heading').filter({ hasText: 'DB 1' }).waitFor()
  assert.equal(await scanAll('session:a:*'), 1)
  await keys.locator('[data-key-base64="' + identity + '"]').click()
  let details = keys.locator('.redis-details').filter({ has: page.locator('input[name="byteOffset"]') })
  await details.locator('[data-value-coverage]').waitFor()
  await details.locator('select[name="valueFormat"]').selectOption('hex')
  await details.locator('input[name="byteOffset"]').fill('1'); await details.locator('select[name="byteCount"]').selectOption('256')
  await details.getByRole('button', { name: 'Read / refresh', exact: true }).click()
  await details.locator('[data-value-coverage]').filter({ hasText: 'Start byte 1' }).waitFor()
  await until(async () => { const value = await readState(a); return value.profileId === profileId && value.db === 1 && value.pattern === 'session:a:*' && value.keyBase64 === identity && value.formats.string === 'hex' && value.stringOffset === '1' && value.stringCount === 256 }, 'session A selections saved')
  const aState = await readState(a), aTarget = await status(a)
  assert(!JSON.stringify(aState).includes('session-a-value')); assert(!JSON.stringify(aState).includes(fixture.settings.password))
  report.checks.push('native session A saves only shared profile identity, DB1, MATCH, binary key bytes, Hex format and submitted String window; no Redis value or secret in state')

  const endpoint = '**/api/redisViewer/readString'
  let holding = true, responseHeld = false, released = false, release
  const wait = new Promise(resolveWait => { release = resolveWait })
  await page.route(endpoint, async route => {
    if (!holding || route.request().postDataJSON().payload.args.agentId !== a) { await route.continue(); return }
    holding = false
    const response = await route.fetch(); responseHeld = true
    await wait
    await route.fulfill({ response }).catch(() => undefined)
    released = true
  })
  try {
    await details.getByRole('button', { name: 'Read / refresh', exact: true }).click()
    await until(() => responseHeld, 'real A reader response held at HTTP boundary')
    const bDirectory = resolve(artifacts, '../runtime/wsl-fixture-' + fixture.metadata.owner, 'session-state-' + fixture.metadata.owner)
    await mkdir(bDirectory, { recursive: false })
    const bWorkspace = await rpc('workspace/create', { request: { path: bDirectory } })
    const bCreated = await rpc('session/create', { request: { workspaceId: bWorkspace.workspace.workspaceId } }), b = bCreated.sessionId
    workspaceTitles.set(b, bWorkspace.workspace.title)
    assert.notEqual(b, a)
    await rpc('session/rename', { request: { sessionId: b, title: 'Redis state B ' + fixture.metadata.owner } })
    const before = counters(await fixture.admin.info('commandstats'))
    await openSession(b)
    assert.equal(await activeOwner(), b)
    assert.equal(await pane.locator('select[name="profile"]').inputValue(), '')
    assert.equal(await pane.locator('input[name="password"]').inputValue(), '')
    assert.equal(await fixture.clients(), baseline + 1, 'New session does not borrow or create A socket')
    await pane.locator('select[name="profile"]').selectOption(profileId)
    assert.equal(await pane.locator('input[name="port"]').inputValue(), String(fixture.settings.port))
    assert.equal(await pane.locator('input[name="password"]').inputValue(), '')
    assert.equal(await fixture.clients(), baseline + 1)
    assert.deepEqual(counters(await fixture.admin.info('commandstats')), before)
    report.checks.push('native distinct session B starts with independent defaults, sees the same saved profile, and choosing it creates no socket or Redis request')
    await pane.locator('input[name="password"]').fill(fixture.settings.password)
    await pane.getByRole('button', { name: 'Connect', exact: true }).click(); await pane.locator('.redis-connected').waitFor()
    await until(async () => await fixture.clients() === baseline + 2, 'two explicitly connected session sockets')
    assert.equal(await scanAll('native:9'), 1); await keys.locator('.redis-key-list button').click()
    details = keys.locator('.redis-details'); await details.locator('[data-value-coverage]').waitFor()
    await details.locator('select[name="valueFormat"]').selectOption('base64')
    await until(async () => (await readState(b)).formats.string === 'base64', 'B format saved')
    const bState = await readState(b), bTarget = await status(b)
    assert.equal(bState.db, 0); assert.equal(bState.pattern, 'native:9'); assert.equal(bState.keyBase64, Buffer.from('native:9').toString('base64'))
    release(); await until(() => released, 'held old A response released'); await page.unroute(endpoint)
    assert.equal(await details.locator('[data-value-preview]').innerText(), 'OQ==')
    assert.equal(await details.locator('select[name="valueFormat"]').inputValue(), 'base64')
    assert(!(await pane.innerText()).includes('session-a-value'))
    assert.deepEqual(await readState(a), aState)
    report.checks.push('explicit HTTP delay of a real A read completes across the switch; its stale UI result cannot overwrite B value, format or A saved selection (not a slow Redis transport claim)')

    await noRedisRestore(a, async () => {
      assert.equal(await pane.locator('select[name="profile"]').inputValue(), profileId)
      assert.equal(await keys.locator('input[name="db"]').inputValue(), '1')
      assert.equal(await keys.locator('input[name="pattern"]').inputValue(), 'session:a:*')
      assert.equal(await keys.locator('textarea[readonly]').inputValue(), identity)
      assert.equal(await keys.locator('[data-loaded-keys]').innerText(), '0')
      assert.equal(await keys.locator('[data-value-preview]').count(), 0)
      await keys.getByRole('button', { name: 'Read selected key', exact: true }).waitFor()
    })
    await keys.getByRole('button', { name: 'Read selected key', exact: true }).click()
    details = keys.locator('.redis-details'); await details.locator('[data-value-coverage]').filter({ hasText: 'Start byte 1' }).waitFor()
    assert.equal(await details.locator('select[name="valueFormat"]').inputValue(), 'hex')
    assert((await details.locator('[data-value-preview]').innerText()).startsWith('00000001  65 73'))
    assert.equal((await status(a)).id, aTarget.id)
    report.checks.push('native switch back to A restores profile, DB, MATCH and exact binary key without Redis work, values, cache or cursor; explicit read restores Hex and byte window on its original socket')
    await noRedisRestore(b, async () => {
      assert.equal(await keys.locator('input[name="db"]').inputValue(), '0')
      assert.equal(await keys.locator('input[name="pattern"]').inputValue(), 'native:9')
      assert.equal(await keys.locator('textarea[readonly]').inputValue(), bState.keyBase64)
      assert.equal(await keys.locator('[data-value-preview]').count(), 0)
    })
    await keys.getByRole('button', { name: 'Read selected key', exact: true }).click()
    details = keys.locator('.redis-details'); await details.locator('[data-value-coverage]').waitFor()
    assert.equal(await details.locator('select[name="valueFormat"]').inputValue(), 'base64')
    assert.equal(await details.locator('[data-value-preview]').innerText(), 'OQ==')
    await page.screenshot({ path: resolve(artifacts, 'native-sessions-b.png'), fullPage: true })
    report.checks.push('native B restores its own DB0, MATCH, key and Base64 independently, without displaying A result')

    const invalid = await context.request.post(origin + '/api/redisViewer/saveBrowsingState', { data: { type: 'client-request', rpcId: 'invalid-session-owner', method: 'redisViewer/saveBrowsingState', payload: { args: { agentId: b, request: { ...bState, sessionId: a, password: 'forbidden-state-secret' } } } } })
    const rejected = await invalid.json(); assert.equal(rejected.result?.ok, false); assert(!JSON.stringify(rejected).includes('forbidden-state-secret'))
    assert.deepEqual(await readState(a), aState); assert.deepEqual(await readState(b), bState)
    await rpc('redisViewer/disconnect', { agentId: a, request: { id: aTarget.id, generation: aTarget.generation } })
    await until(async () => await fixture.clients() === baseline + 1, 'only A disconnected')
    assert.deepEqual(await status(b), bTarget)
    await details.getByRole('button', { name: 'Read / refresh', exact: true }).click(); await details.locator('[data-value-coverage]').waitFor()
    assert.equal(await details.locator('[data-value-preview]').innerText(), 'OQ==')
    report.checks.push('native gateway refuses forged state ownership/secrets; releasing A socket leaves B connected and readable, with both choices unchanged')

    // Restore A while disconnected: no Redis socket; reconnect explicitly starts DB0,
    // keeps the remembered DB1 identity hidden behind a manual SELECT/read boundary.
    await noRedisRestore(a, async () => {
      assert.equal(await pane.locator('input[name="password"]').inputValue(), '')
      assert.equal(await pane.locator('.redis-connected').count(), 0)
    })
    await pane.locator('input[name="password"]').fill(fixture.settings.password)
    await pane.getByRole('button', { name: 'Connect', exact: true }).click(); await pane.locator('.redis-connected').waitFor()
    await keys.getByRole('button', { name: 'Read selected key', exact: true }).waitFor()
    assert.equal(await keys.locator('input[name="db"]').inputValue(), '1')
    assert.equal(await keys.getByRole('button', { name: 'Read selected key', exact: true }).isEnabled(), false)
    assert.equal(await keys.locator('[data-value-preview]').count(), 0)
    await keys.getByRole('button', { name: 'Select DB', exact: true }).click(); await keys.getByRole('heading').filter({ hasText: 'DB 1' }).waitFor()
    await keys.getByRole('button', { name: 'Read selected key', exact: true }).click(); await keys.locator('[data-value-coverage]').waitFor()
    const aAgain = await status(a)
    await rpc('redisViewer/disconnect', { agentId: a, request: { id: aAgain.id, generation: aAgain.generation } })
    await openSession(b); await until(async () => await fixture.clients() === baseline + 1, 'B socket remains after A manual recovery')
    await rpc('redisViewer/removeProfile', { agentId: b, request: { id: profileId } })
    report.checks.push('native disconnected A restore never reconnects; explicit reconnect starts DB0 and requires manual DB1 selection before the remembered key can be read; B remains unaffected')
  } finally {
    release?.(); await page.unroute(endpoint).catch(() => undefined)
  }
}
