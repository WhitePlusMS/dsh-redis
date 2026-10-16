/** Native file transfer and cold Host restart; caller owns all fixture resources. */
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { RESP_TYPES } from 'redis'
import { until } from './redis-fixture.mjs'
import { openConnectionSettings, findLoadedKey, resizeSidebar } from './native-view-controls.mjs'

export function transferProfileNames(owner) {
  return { original: 'Transfer original ' + owner, renamed: 'Transfer renamed ' + owner, tls: 'Transfer TLS ' + owner, kept: 'Transfer kept ' + owner, imported: 'Transfer imported ' + owner, skipped: 'Transfer skipped ' + owner }
}
function counters(info) {
  return Object.fromEntries(info.split('\r\n').filter(line => line.startsWith('cmdstat_') && !/^cmdstat_(?:info|client[|:])/u.test(line)).map(line => [line.split(':')[0], Number(line.match(/calls=(\d+)/u)?.[1])]))
}

export async function smokeProfileTransfer({ page, context, origin, rpc, fixture, pane, artifacts, home, report, phase, baseline }) {
  assert.equal(fixture.settings.tls, null, 'Transfer fixture is plain; TLS handshake has its separate cold-restart gate')
  let uiOwner
  const names = transferProfileNames(fixture.metadata.owner), group = 'Development ' + fixture.metadata.owner, importedGroup = 'Imported ' + fixture.metadata.owner
  const buffers = fixture.admin.withTypeMapping({ [RESP_TYPES.BLOB_STRING]: Buffer })
  const source = { dump: await buffers.sendCommand(['DUMP', 'native:0']), expiry: await fixture.admin.sendCommand(['PEXPIRETIME', 'native:0']) }
  await fixture.admin.select(1)
  const db1Source = { dump: await buffers.sendCommand(['DUMP', 'db1:only']), expiry: await fixture.admin.sendCommand(['PEXPIRETIME', 'db1:only']) }
  await fixture.admin.select(0)
  const storedFile = resolve(home, 'profiles/web/data/dsh-redis/connections.json')
  const dialog = pane.locator('dialog.redis-connection-dialog'), selector = dialog.locator('select[name="profile"]'), password = dialog.locator('input[name="password"]')
  const tools = dialog.locator('details.redis-profile-tools').filter({ has: page.getByText('Import / export connection profiles', { exact: true }) })
  const uriTools = dialog.locator('details.redis-profile-tools').filter({ has: page.getByText('Fill from Redis URI', { exact: true }) })
  const record = text => { report.checks.push(text); console.log('[smoke check] ' + text) }
  const frame = () => page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))))
  const data = async () => JSON.parse(await readFile(storedFile, 'utf8'))
  async function noRedis(action) {
    const before = counters(await fixture.admin.info('commandstats')), clients = await fixture.clients()
    await action(); await frame()
    assert.deepEqual(counters(await fixture.admin.info('commandstats')), before, 'Profile action sent a Redis command')
    assert.equal(await fixture.clients(), clients, 'Profile action created a Redis connection')
  }
  async function openDetails(details) { if (await details.getAttribute('open') === null) await details.locator('summary').click() }
  async function fillUri(text) {
    await openDetails(uriTools)
    await uriTools.locator('input[name="connectionUri"]').fill(text)
    await uriTools.getByRole('button', { name: 'Fill draft', exact: true }).click()
    assert.equal(await uriTools.locator('input[name="connectionUri"]').inputValue(), '')
  }
  const basicUri = (tls, db) => (tls ? 'rediss' : 'redis') + '://%64efault:' + encodeURIComponent(fixture.settings.password) + '@' + fixture.settings.host + ':' + fixture.settings.port + '/' + db
  async function save(name, savedGroup) {
    await dialog.locator('input[name="profileName"]').fill(name); await dialog.locator('input[name="profileGroup"]').fill(savedGroup)
    const [response] = await Promise.all([page.waitForResponse(value => value.url().endsWith('/api/redisViewer/saveProfile')), dialog.getByRole('button', { name: (await selector.inputValue()) === '' ? 'Save profile' : 'Update profile', exact: true }).click()])
    const body = await response.json(); assert.equal(body.result?.ok, true)
    const id = body.result.value.selectedId; assert(id)
    await until(async () => await selector.isEnabled() && await selector.inputValue() === id, 'saved profile rendered')
    assert.equal(await password.inputValue(), '')
    return id
  }
  async function file(document) {
    await openDetails(tools)
    await tools.locator('input[name="profilesFile"]').setInputFiles({ name: 'owned-profile-import.json', mimeType: 'application/json', buffer: Buffer.isBuffer(document) ? document : Buffer.from(JSON.stringify(document)) })
  }
  const document = profiles => ({ format: 'dsh-redis-connections', version: 1, profiles })
  async function commit(count) {
    const button = tools.getByRole('button', { name: 'Import selected profiles (' + count + ')', exact: true })
    assert(await button.isEnabled())
    const [response] = await Promise.all([page.waitForResponse(value => value.url().endsWith('/api/redisViewer/importProfiles')), button.click()])
    const body = await response.json(); assert.equal(body.result?.ok, true)
    await tools.getByRole('status').filter({ hasText: 'Profiles imported.' }).waitFor()
    assert.equal(await tools.locator('[data-profile-preview-row]').count(), 0)
  }
  async function rejectRpc(request) {
    const response = await context.request.post(origin + '/api/redisViewer/importProfiles', { data: { type: 'client-request', rpcId: 'owned-profile-import', method: 'redisViewer/importProfiles', payload: { args: { agentId: uiOwner, request } } } })
    const body = await response.json(); assert.equal(body.result?.ok, false)
    assert(!JSON.stringify(body).includes(fixture.settings.password))
  }
  report.profileTransfer = { phase, noAutomaticConnection: true, exportIncludesCertificates: false, coldRestart: phase === 'reopen' }
  await until(() => selector.isEnabled(), 'profile list ready')
  await dialog.getByRole('button', { name: 'Close', exact: true }).click()
  const [statusResponse] = await Promise.all([page.waitForResponse(value => value.url().endsWith('/api/redisViewer/connectionStatus')), pane.getByRole('button', { name: 'Refresh status', exact: true }).click()])
  uiOwner = statusResponse.request().postDataJSON().payload.args.agentId; assert.equal(typeof uiOwner, 'string')
  assert.equal((await statusResponse.json()).result?.value?.state, 'disconnected')
  await resizeSidebar(page, pane, 900); await openConnectionSettings(pane)
  await until(() => selector.isEnabled(), 'explicit status refresh completed')
  if (phase === 'save') {
    await noRedis(async () => {
      const beforeHost = await dialog.locator('input[name="host"]').inputValue()
      await fillUri(basicUri(false, 1) + '?db=2')
      await uriTools.getByRole('alert').filter({ hasText: 'Invalid or unsupported URI.' }).waitFor()
      assert.equal(await dialog.locator('input[name="host"]').inputValue(), beforeHost)
      assert(!(await dialog.innerText()).includes(fixture.settings.password))
      await fillUri(basicUri(false, 1))
      assert.equal(await selector.inputValue(), '')
      assert.equal(await password.inputValue(), fixture.settings.password)
      assert.equal(await dialog.locator('input[name="username"]').inputValue(), 'default')
      await uriTools.getByRole('status').filter({ hasText: 'DB draft filled: 1' }).waitFor()
      const id = await save(names.original, group)
      const renamed = await save(names.renamed, group)
      assert.equal(renamed, id)
      assert.equal((await data()).profiles.find(value => value.id === id).group, group)
    })
    record('native URI validation is fixed and secret-free; applying fills only the existing form and DB draft, saving/renaming/grouping retains identity and creates no Redis connection')
    await noRedis(async () => {
      await fillUri(basicUri(true, 0))
      await dialog.locator('textarea[name="caPem"]').fill('PUBLIC_CA_LOCAL_ONLY_' + fixture.metadata.owner)
      await save(names.tls, group)
      await openDetails(tools)
      const [download] = await Promise.all([page.waitForEvent('download'), tools.getByRole('button', { name: 'Export profiles', exact: true }).click()])
      assert.equal(download.suggestedFilename(), 'dsh-redis-connections.json')
      await download.saveAs(resolve(artifacts, 'native-profile-transfer-export.json'))
      const text = await readFile(resolve(artifacts, 'native-profile-transfer-export.json'), 'utf8'), exported = JSON.parse(text)
      assert.equal(exported.format, 'dsh-redis-connections'); assert.equal(exported.version, 1)
      assert(!text.includes(fixture.settings.password)); assert(!text.includes('PUBLIC_CA_LOCAL_ONLY_'))
      for (const value of exported.profiles) {
        assert.deepEqual(Object.keys(value).sort(), value.group === undefined ? ['name', 'settings'] : ['group', 'name', 'settings'])
        assert.deepEqual(Object.keys(value.settings).sort(), ['host', 'port', 'tls', 'username']); assert.equal(typeof value.settings.tls, 'boolean')
      }
      const tls = exported.profiles.find(value => value.name === names.tls); assert(tls?.settings.tls)
      const incoming = { name: names.imported, group: importedGroup, settings: { host: fixture.settings.host, port: fixture.settings.port, username: 'default', tls: false } }
      await file(document([tls, incoming]))
      await tools.locator('[data-profile-preview-row="1"]').waitFor()
      assert.equal(await tools.getByRole('button', { name: 'Import selected profiles (2)', exact: true }).isEnabled(), false)
      await tools.getByRole('alert').filter({ hasText: 'Same group and name conflict.' }).waitFor()
      await tools.locator('[data-profile-preview-row="0"] input[name="importProfileName"]').fill(names.kept)
      const selectedId = await selector.inputValue(), ca = await dialog.locator('textarea[name="caPem"]').inputValue()
      // A deliberately typed password draft must survive an unrelated import.
      await password.fill(fixture.settings.password)
      await tools.scrollIntoViewIfNeeded(); await dialog.screenshot({ path: resolve(artifacts, 'native-profile-transfer-preview.png') })
      await commit(2)
      assert.equal(await selector.inputValue(), selectedId); assert.equal(await password.inputValue(), fixture.settings.password)
      assert.equal(await dialog.locator('textarea[name="caPem"]').inputValue(), ca)
      const saved = await data(), kept = saved.profiles.find(value => value.name === names.kept)
      assert.equal(kept.settings.tls.caPem, '')
      const original = exported.profiles.find(value => value.name === names.renamed); assert(original)
      await file(document([original, { ...incoming, name: names.skipped }]))
      await tools.locator('[data-profile-preview-row="1"]').waitFor()
      await tools.locator('[data-profile-preview-row="0"] input[type="checkbox"]').uncheck()
      await commit(1)
      fixture.profileTransferIds = Object.fromEntries((await data()).profiles.filter(value => Object.values(names).includes(value.name)).map(value => [value.name, value.id]))
      assert.equal(Object.keys(fixture.profileTransferIds).length, 5)
    })
    record('native Blob download contains only whitelisted non-secret fields; import preview blocks same-group names, explicit rename/skip adds a complete batch, TLS imports omit CA, and existing selection/password draft are preserved')
    await noRedis(async () => {
      const before = await readFile(storedFile, 'utf8'), entry = { name: names.imported + ' extra', settings: { host: fixture.settings.host, port: fixture.settings.port, username: '', tls: false } }
      for (const content of [document([{ ...entry, settings: { ...entry.settings, password: fixture.settings.password } }]), { ...document([entry]), version: 2 }, Buffer.alloc(256 * 1024 + 1, 32), Buffer.concat([Buffer.from('{"format":"dsh-redis-connections","version":1,"profiles":[{"name":"x","settings":{"host":"'), Buffer.from([255]), Buffer.from('","port":6379,"username":"","tls":false}}]}')])]) {
        await file(content); await tools.getByRole('alert').filter({ hasText: 'Invalid document or name.' }).waitFor()
        assert.equal(await tools.locator('[data-profile-preview-row]').count(), 0)
        assert.equal(await tools.locator('input[name="profilesFile"]').inputValue(), '')
        assert(!(await dialog.innerText()).includes(fixture.settings.password))
      }
      await rejectRpc({ profiles: [{ ...entry, settings: { ...entry.settings, password: fixture.settings.password } }] })
      const duplicate = { ...entry, name: names.imported, group: importedGroup }
      await rejectRpc({ profiles: [entry, duplicate] })
      assert.equal(await readFile(storedFile, 'utf8'), before)
      // Explicit browser File API delay, not an OS filesystem performance claim.
      await page.evaluate(() => {
        const original = File.prototype.arrayBuffer
        const state = window.__redisProfileFileDelay = { original, held: false, release: null, used: false }
        File.prototype.arrayBuffer = async function () {
          const bytes = await Reflect.apply(original, this, [])
          if (state.used) return bytes
          state.used = true; state.held = true
          await new Promise(done => { state.release = done })
          return bytes
        }
      })
      try {
        await file(document([entry]))
        await until(() => page.evaluate(() => window.__redisProfileFileDelay.held), 'controlled File.arrayBuffer reply held')
        await dialog.getByRole('button', { name: 'Close', exact: true }).click(); await openConnectionSettings(pane)
        await page.evaluate(() => window.__redisProfileFileDelay.release())
        await frame()
        assert.equal(await tools.locator('[data-profile-preview-row]').count(), 0)
        assert.equal(await tools.locator('input[name="profilesFile"]').isEnabled(), true)
      } finally {
        await page.evaluate(() => { const state = window.__redisProfileFileDelay; state.release?.(); File.prototype.arrayBuffer = state.original; delete window.__redisProfileFileDelay })
      }
      await file(document(Array.from({ length: 50 }, (_, i) => ({ ...entry, name: 'Capacity ' + i }))))
      await tools.getByRole('alert').filter({ hasText: 'exceeds 50 saved profiles' }).waitFor()
      assert.equal(await tools.getByRole('button', { name: 'Import selected profiles (50)', exact: true }).isEnabled(), false)
      await openDetails(uriTools); await uriTools.locator('input[name="connectionUri"]').fill(basicUri(false, 1))
      await dialog.getByRole('button', { name: 'Close', exact: true }).click(); await openConnectionSettings(pane)
      assert.equal(await password.inputValue(), ''); assert.equal(await uriTools.locator('input[name="connectionUri"]').inputValue(), '')
      assert.equal(await tools.locator('[data-profile-preview-row]').count(), 0)
      assert.equal(await readFile(storedFile, 'utf8'), before)
    })
    record('native invalid/secret/unknown-version/oversized files and Host secret/conflicting batches leave saved bytes unchanged; capacity disables commit; closing settings clears URI/password and drops preview without Redis work')
  } else {
    assert.equal(phase, 'reopen'); assert(fixture.profileTransferIds)
    await noRedis(async () => {
      assert.equal(await selector.inputValue(), ''); assert.equal(await password.inputValue(), '')
      const current = await data()
      for (const [name, id] of Object.entries(fixture.profileTransferIds)) {
        assert.equal(current.profiles.find(value => value.name === name)?.id, id)
        await selector.selectOption(id)
        assert.equal(await password.inputValue(), '')
      }
      await selector.selectOption(fixture.profileTransferIds[names.kept])
      assert.equal(await dialog.locator('textarea[name="caPem"]').inputValue(), '')
      await selector.selectOption(fixture.profileTransferIds[names.tls])
      assert.equal(await dialog.locator('textarea[name="caPem"]').inputValue(), 'PUBLIC_CA_LOCAL_ONLY_' + fixture.metadata.owner)
      await selector.selectOption(fixture.profileTransferIds[names.imported])
      assert.equal(await dialog.locator('input[name="profileGroup"]').inputValue(), importedGroup)
      assert.equal(await dialog.locator('input[name="host"]').inputValue(), fixture.settings.host)
      assert.equal(await dialog.locator('input[name="port"]').inputValue(), String(fixture.settings.port))
      assert.equal(await dialog.locator('input[name="tls"]').isChecked(), false)
    })
    record('actual cold DSH restart reloads all five grouped/imported identities; selection restores public fields with an empty password, imported TLS has no CA, local CA stays local, and no Redis socket is opened')
    await noRedis(async () => { await fillUri(basicUri(false, 1)) })
    const before = counters(await fixture.admin.info('commandstats'))
    const [response] = await Promise.all([page.waitForResponse(value => value.url().endsWith('/api/redisViewer/connect')), dialog.getByRole('button', { name: 'Connect', exact: true }).click()])
    const body = await response.json(); assert.equal(body.result?.value?.db, 0)
    await pane.locator('.redis-connected').waitFor(); await until(async () => await fixture.clients() === baseline + 1, 'explicit URI connection')
    const keys = pane.locator('.redis-keys')
    assert.equal(await keys.locator('input[name="db"]').inputValue(), '1')
    assert.equal(await keys.locator('[data-loaded-keys]').innerText(), '0')
    const after = counters(await fixture.admin.info('commandstats'))
    assert.equal(after.cmdstat_select ?? 0, before.cmdstat_select ?? 0); assert.equal(after.cmdstat_scan ?? 0, before.cmdstat_scan ?? 0)
    await keys.getByRole('button', { name: 'Select DB', exact: true }).click(); await keys.getByRole('heading').filter({ hasText: 'DB 1' }).waitFor()
    await keys.locator('input[name="pattern"]').fill('db1:*'); await keys.getByRole('button', { name: 'Scan / refresh', exact: true }).click()
    await until(async () => await keys.locator('[data-loaded-keys]').innerText() === '1', 'explicit DB1 scan')
    await (await findLoadedKey(keys, Buffer.from('db1:only').toString('base64'))).click()
    await keys.locator('[data-value-preview]').filter({ hasText: 'one' }).waitFor()
    const beforeSnapshot = await fixture.admin.get('native:0'); assert.equal(beforeSnapshot, '0')
    await page.screenshot({ path: resolve(artifacts, 'native-profile-transfer-groups.png'), fullPage: true })
    await keys.locator('input[name="db"]').fill('0'); await keys.getByRole('button', { name: 'Select DB', exact: true }).click(); await keys.getByRole('heading').filter({ hasText: 'DB 0' }).waitFor()
    await pane.getByRole('button', { name: 'Disconnect', exact: true }).click(); await openConnectionSettings(pane)
    await until(async () => await fixture.clients() === baseline, 'explicit URI disconnect')
    assert.equal(await password.inputValue(), '')
    record('native URI connect starts DB0 with the saved DB1 only as a draft; no automatic SELECT/SCAN, then explicit Select DB/scan reads the real DB1 value and manual disconnect clears credentials')
  }
  await noRedis(async () => { await fillUri(basicUri(false, 0)) })
  await password.fill('')
  assert(!(await readFile(storedFile, 'utf8')).includes(fixture.settings.password))
  const native = await rpc('redisViewer/connectionStatus', { agentId: uiOwner, request: {} }); assert.equal(native.state, 'disconnected')
  assert.deepEqual(await buffers.sendCommand(['DUMP', 'native:0']), source.dump)
  assert.equal(await fixture.admin.sendCommand(['PEXPIRETIME', 'native:0']), source.expiry)
  await fixture.admin.select(1)
  assert.deepEqual(await buffers.sendCommand(['DUMP', 'db1:only']), db1Source.dump)
  assert.equal(await fixture.admin.sendCommand(['PEXPIRETIME', 'db1:only']), db1Source.expiry)
  await fixture.admin.select(0)
  record('profile transfer and explicit verification preserve watched DB0/DB1 source DUMPs and absolute expiries')
  report.profileTransfer.ownedProfiles = Object.keys(fixture.profileTransferIds).length
  report.profileTransfer.completed = true
}
