import { prepareAutoRefreshFixture, smokeAutoRefresh } from './smoke-auto-refresh.mjs'
import { smokeClientList } from './smoke-client-list.mjs'
import { smokeSlowLog } from './smoke-slowlog.mjs'
import { smokeServerOverview } from './smoke-server-overview.mjs'
/** Bounded, keyless native-profile acceptance. Never targets the user's DSH home. */
import assert from 'node:assert/strict'
import { spawn, execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises'
import { resolve, dirname, relative } from 'node:path'
import { promisify } from 'node:util'
import { chromium } from 'playwright-core'
import { until, withRedisFixture } from './redis-fixture.mjs'
import { RedisProfiles } from '../lib/host/profile-store.js'
import { smokeSessionState } from './smoke-session-state.mjs'
import { createReadDelayProxy } from './read-delay-proxy.mjs'
import { smokeNativeRecovery } from './smoke-native-recovery.mjs'
import { smokeSidebarLayout } from './smoke-sidebar-layout.mjs'
import { smokeKeyNamespaces } from './smoke-key-namespaces.mjs'
import { smokeFocusedValue } from './smoke-focused-value.mjs'
import { smokeProfileTransfer, transferProfileNames } from './smoke-profile-transfer.mjs'
import { observeReleaseRuntime, smokeReleaseBoundary } from './smoke-release-boundary.mjs'
import { RESP_TYPES } from 'redis'
import { openConnectionSettings, chooseValueFormat, assertSelectedIdentity, withOpenHelp, readMetadataText, findLoadedKey } from './native-view-controls.mjs'

async function smoke(fixture, profilePhase, transferPhase) {
  const root = resolve(import.meta.dirname, '..')
  const home = resolve(root, '.scratch/runtime/dsh-home')
  const artifacts = resolve(root, '.scratch/artifacts')
  const artifactPrefix = process.env.REDIS_SMOKE_AUTO_REFRESH === '1' ? 'native-auto-refresh' : process.env.REDIS_SMOKE_CLIENTS === '1' ? 'native-clients' : process.env.REDIS_SMOKE_SLOWLOG === '1' ? 'native-slowlog' : process.env.REDIS_SMOKE_OVERVIEW === '1' ? 'native-overview' : transferPhase !== undefined ? 'native-profile-transfer-' + transferPhase : process.env.REDIS_SMOKE_FOCUSED === '1' ? 'native-focused' : process.env.REDIS_SMOKE_NAMESPACES === '1' ? 'native-namespaces' : process.env.REDIS_SMOKE_RELEASE === '1' ? 'native-ui-release' : profilePhase === undefined ? (process.env.REDIS_SMOKE_LAYOUT === '1' ? 'native-workbench' : process.env.REDIS_SMOKE_RECOVERY === '1' ? 'native-ui-recovery' : process.env.REDIS_SMOKE_SESSIONS === '1' ? 'native-sessions' : process.env.REDIS_SMOKE_BLOOM === '1' ? 'native-bloom' : process.env.REDIS_SMOKE_TIMESERIES === '1' ? 'native-timeseries' : process.env.REDIS_SMOKE_HLL === '1' ? (process.env.REDIS_SMOKE_HLL_DISABLED === '1' ? 'native-hll-unavailable' : 'native-hll') : process.env.REDIS_SMOKE_GEO === '1' ? (process.env.REDIS_SMOKE_GEO_DISABLED === '1' ? 'native-geo-unavailable' : 'native-geo') : process.env.REDIS_SMOKE_BITMAP === '1' ? 'native-bitmap' : process.env.REDIS_SMOKE_JSON === '1' ? 'native-json' : process.env.REDIS_SMOKE_STREAMS === '1' ? 'native-streams' : process.env.REDIS_SMOKE_ZSETS === '1' ? 'native-zsets' : process.env.REDIS_SMOKE_SETS === '1' ? 'native-sets' : process.env.REDIS_SMOKE_LISTS === '1' ? 'native-lists' : process.env.REDIS_SMOKE_HASHES === '1' ? 'native-hashes' : process.env.REDIS_SMOKE_STRINGS === '1' ? 'native-strings' : process.env.REDIS_SMOKE_KEYS === '1' ? 'native-keys' : fixture === undefined ? 'native' : fixture.settings.tls === null ? 'native-connection' : 'native-tls') : 'native-ui-profiles-' + profilePhase
  const cli = process.env.DSH_CLI_ENTRY
  const executablePath = process.env.REDIS_BROWSER_EXECUTABLE
  assert(cli && executablePath, 'Set DSH_CLI_ENTRY and REDIS_BROWSER_EXECUTABLE explicitly')
  assert(!relative(root, home).startsWith('..'), 'Test home must stay inside this project')
  const manifest = JSON.parse(await readFile(resolve(dirname(cli), '../package.json'), 'utf8'))
  assert.equal(manifest.version, '0.2.0-rc.2')
  await mkdir(artifacts, { recursive: true })
  // Refuse to verify an older same-version local package retained by the installer.
  async function verifyInstalled(directory, installed) {
    const names = async path => (await readdir(path, { withFileTypes: true })).map(entry => [entry.name, entry.isDirectory()]).sort((a, b) => a[0].localeCompare(b[0]))
    assert.deepEqual(await names(installed), await names(directory), 'Installed artifact file set differs')
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const source = resolve(directory, entry.name)
      const target = resolve(installed, entry.name)
      if (entry.isDirectory()) await verifyInstalled(source, target)
      else assert.deepEqual(await readFile(target), await readFile(source), 'Installed artifact differs: ' + relative(root, source))
    }
  }
  await verifyInstalled(resolve(root, 'lib'), resolve(home, 'profiles/web/node_modules/dsh-redis/lib'))
  const env = { ...process.env, DSH_HOME: home, DSH_AGENTS_HOME: resolve(root, '.scratch/runtime/agents'), DO_NOT_TRACK: '1', DEEPSEEK_API_KEY: 'keyless-redis-smoke-no-model-calls', DEEPSEEK_BASE_URL: 'http://127.0.0.1:1' }
  delete env.OPENAI_API_KEY
  delete env.ANTHROPIC_API_KEY
  let output = ''
  let browser
  let page
  const pageErrors = [], browserConsoleErrors = [], browserRequestFailures = []
  const report = { artifactPrefix, profilePhase, transferPhase, baseline: manifest.version, startedAt: new Date().toISOString(), packageSha256: createHash('sha256').update(await readFile(resolve(artifacts, 'dsh-redis-0.1.0.tgz'))).digest('hex'), checks: [], passed: false, processStopped: false }
  const record = (...checks) => { report.checks.push(...checks); console.log('[smoke check] ' + checks.join(' | ')) }
  const redact = text => {
    const safe = text.replace(/([?&]token=)[^\s&]+/g, '$1[redacted]')
    return fixture?.settings.password ? safe.replaceAll(fixture.settings.password, '[redacted]') : safe
  }
  const child = spawn(process.execPath, [cli, 'web', '--no-open', '--host', '127.0.0.1', '--port', '0'], { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true })
  try {
    const readyUrl = await new Promise((resolveReady, reject) => {
      const timer = setTimeout(() => reject(new Error('DSH startup timed out')), 60_000)
      const consume = chunk => {
        output = (output + chunk.toString()).slice(-120_000)
        const match = output.match(/dsh web:\s*(http:\/\/127\.0\.0\.1:\d+\/\?token=[^\s\x1b]+)/)
        if (match) { clearTimeout(timer); resolveReady(match[1]) }
      }
      child.stdout.on('data', consume)
      child.stderr.on('data', consume)
      child.once('error', error => { clearTimeout(timer); reject(error) })
      child.once('exit', code => { clearTimeout(timer); reject(new Error('DSH exited before readiness: ' + code)) })
    })
    console.log('[smoke] Native rc.2 profile started on loopback')
    browser = await chromium.launch({ executablePath, headless: true })
    const context = await browser.newContext({ locale: 'en-US', viewport: { width: process.env.REDIS_SMOKE_LAYOUT === '1' || process.env.REDIS_SMOKE_NAMESPACES === '1' || process.env.REDIS_SMOKE_FOCUSED === '1' || process.env.REDIS_SMOKE_PROFILE_TRANSFER === '1' || process.env.REDIS_SMOKE_OVERVIEW === '1' || process.env.REDIS_SMOKE_SLOWLOG === '1' || process.env.REDIS_SMOKE_CLIENTS === '1' || process.env.REDIS_SMOKE_AUTO_REFRESH === '1' ? 1920 : 1440, height: 960 } })
    if (process.env.REDIS_SMOKE_RELEASE === '1') await context.addInitScript(observeReleaseRuntime)
    context.setDefaultTimeout(30_000)
    const origin = new URL(readyUrl).origin
    const exchange = await context.request.get(readyUrl, { maxRedirects: 0 })
    assert.equal(exchange.status(), 303)
    record('launch token exchanged for browser session')
    async function rpc(endpoint, args) {
      const response = await context.request.post(origin + '/api/' + endpoint, { data: { type: 'client-request', rpcId: 'redis-smoke-' + endpoint, method: endpoint, payload: { args } } })
      const body = await response.json()
      if (!body.result?.ok) throw new Error(endpoint + ' failed: ' + JSON.stringify(body.result ?? body))
      return body.result.value
    }
    const adopted = await rpc('workspace/create', { request: { path: root } })
    const created = await rpc('session/create', { request: { workspaceId: adopted.workspace.workspaceId } })
    await rpc('session/rename', { request: { sessionId: created.sessionId, title: 'Redis native smoke' } })
    assert.equal(typeof created.sessionId, 'string')
    const status = await rpc('redisViewer/status', { agentId: created.sessionId, request: {} })
    assert.deepEqual(status, { state: 'ready', readOnly: true, hostVersion: '0.2.0-rc.2', protocolVersion: 1 })
    record('installed package loaded and real Agent-scoped Host RPC returned strict status')
    const invalid = await context.request.post(origin + '/api/redisViewer/status', { data: { type: 'client-request', rpcId: 'redis-smoke-invalid', method: 'redisViewer/status', payload: { args: { agentId: created.sessionId, request: { unsupported: true } } } } })
    assert.equal((await invalid.json()).result?.ok, false)
    record('native gateway rejected an unexpected request field')
    const disconnected = await rpc('redisViewer/connectionStatus', { agentId: created.sessionId, request: {} })
    assert.equal(disconnected.db, 0)
    const unavailable = await rpc('redisViewer/scanKeys', { agentId: created.sessionId, request: { target: { id: 'unconnected', generation: 1, db: 0 }, pattern: '*', cursor: null } })
    assert.equal(unavailable.error, 'stale'); assert.deepEqual(unavailable.keys, [])
    record('installed DB/SCAN contract registers and rejects an unconnected target as a fixed stale result')
    page = await context.newPage()
    report.browserErrors = pageErrors; report.browserConsoleErrors = browserConsoleErrors; report.browserRequestFailures = browserRequestFailures
    const browserStatuses = []
    page.on('pageerror', error => { if (pageErrors.length < 30) pageErrors.push(redact(error.message)) })
    page.on('console', message => { if (message.type() === 'error' && browserConsoleErrors.length < 30) browserConsoleErrors.push(redact(message.text())) })
    page.on('requestfailed', request => { if (browserRequestFailures.length < 30) browserRequestFailures.push({ url: redact(request.url()), error: request.failure()?.errorText }) })
    page.on('response', response => {
      if (response.url().endsWith('/api/redisViewer/status')) browserStatuses.push(response.json().catch(() => null))
    })
    await page.goto(origin, { waitUntil: 'domcontentloaded' })
    await page.getByRole('button', { name: 'New session', exact: true }).first().waitFor({ timeout: 30_000 })
    const notice = page.getByText('Preview Notice', { exact: true })
    await notice.waitFor({ timeout: 5000 }).catch(() => undefined)
    if (await notice.isVisible()) await page.getByRole('button', { name: 'Continue', exact: true }).click()
    const workspaceRow = page.getByText(adopted.workspace.title, { exact: true }).first().locator('xpath=ancestor::*[@role=\"treeitem\"][1]')
    await workspaceRow.waitFor({ timeout: 15_000 })
    if (await workspaceRow.getAttribute('aria-expanded') !== 'true') await workspaceRow.click()
    await workspaceRow.hover()
    await page.getByRole('button', { name: `New session in ${adopted.workspace.title}`, exact: true }).click()
    const expand = page.locator('[data-sidebar-right-expand]').first()
    if (await expand.isVisible()) await expand.click()
    await page.locator('[data-sidebar-right-open]').first().waitFor({ timeout: 20_000 })
    const entry = page.locator('[data-sidebar-right-guide-entry="redis"]')
    if (!(await entry.isVisible())) await page.locator('[data-dockkit-add-tab]').first().click()
    await entry.waitFor({ timeout: 20_000 })
    await entry.click()
    await page.locator('.dsh-redis').waitFor()
    await page.locator('.dsh-redis .redis-status').filter({ hasText: 'Host ready' }).waitFor({ timeout: 15_000 })
    assert.equal(await page.locator('.dsh-redis .redis-badge').innerText(), 'Read only')
    assert((await Promise.all(browserStatuses)).some(body => body?.result?.ok === true))
    assert.deepEqual(pageErrors, [])
    if (process.env.REDIS_SMOKE_RELEASE === '1') await smokeReleaseBoundary({ page, browser, sessionId: created.sessionId, report })
    if (fixture !== undefined) {
      const pane = page.locator('.dsh-redis')
      await openConnectionSettings(pane)
      const password = pane.locator('input[name="password"]')
      const baseline = await fixture.clients()
      assert.equal(baseline, 1, 'Opening the pane must not connect Redis')
      const selector = pane.locator('select[name="profile"]')
      const profileName = pane.locator('input[name="profileName"]')
      const storedFile = resolve(home, 'profiles/web/data/dsh-redis/connections.json')
      const savedName = 'TLS fixture ' + fixture.metadata.owner
      const renamedName = 'Renamed ' + savedName
      if (transferPhase !== undefined) await smokeProfileTransfer({ page, context, origin, rpc, fixture, pane, artifacts, home, report, phase: transferPhase, baseline })
      if (profilePhase === 'reopen') {
        await selector.locator('option').filter({ hasText: renamedName }).waitFor({ state: 'attached' })
        assert.equal(await selector.inputValue(), '', 'Reopening must not auto-select or connect')
        const saved = JSON.parse(await readFile(storedFile, 'utf8')).profiles.find(value => value.name === renamedName)
        assert(saved)
        await selector.selectOption(saved.id)
        assert.equal(await pane.locator('input[name="host"]').inputValue(), fixture.settings.host)
        assert.equal(await pane.locator('input[name="port"]').inputValue(), String(fixture.settings.port))
        assert.equal(await pane.locator('textarea[name="caPem"]').inputValue(), fixture.settings.tls.caPem.trim())
        assert.equal(await password.inputValue(), '')
        assert.equal(await fixture.clients(), baseline)
        record('cold DSH restart reloads saved TLS settings; choosing restores fields without password or network')
      }
      await pane.locator('input[name="host"]').fill(fixture.settings.host)
      await pane.locator('input[name="port"]').fill(String(fixture.settings.port))
      await password.fill(fixture.settings.password)
      if (fixture.settings.tls !== null) {
        await pane.locator('input[name="tls"]').check()
        await pane.locator('textarea[name="caPem"]').fill(fixture.wrongCaPem)
        await pane.getByRole('button', { name: 'Test connection', exact: true }).click()
        await pane.getByRole('alert').filter({ hasText: 'TLS certificate verification failed.' }).waitFor()
        await until(async () => await fixture.clients() === baseline, 'native wrong-CA handshake released')
        await pane.locator('textarea[name="caPem"]').fill(fixture.settings.tls.caPem)
        record('native TLS form rejects wrong CA without a socket and accepts a corrected CA')
      }
      if (profilePhase === 'save') {
        await profileName.fill(savedName)
        await pane.getByRole('button', { name: 'Save profile', exact: true }).click()
        await pane.getByRole('button', { name: 'Update profile', exact: true }).waitFor()
        const savedId = await selector.inputValue()
        assert(savedId)
        let stored = await readFile(storedFile, 'utf8')
        assert(!stored.includes(fixture.settings.password))
        assert.equal(JSON.parse(stored).profiles.find(value => value.id === savedId).settings.tls.caPem, fixture.settings.tls.caPem.trim())
        await selector.selectOption('')
        assert.equal(await password.inputValue(), '')
        await pane.locator('input[name="port"]').fill(String(fixture.settings.port))
        await profileName.fill('Plain fixture ' + fixture.metadata.owner)
        await pane.getByRole('button', { name: 'Save profile', exact: true }).click()
        await pane.getByRole('button', { name: 'Update profile', exact: true }).waitFor()
        const plainId = await selector.inputValue()
        stored = await readFile(storedFile, 'utf8')
        assert.equal(JSON.parse(stored).profiles.find(value => value.id === plainId).settings.tls, null)
        await pane.getByRole('button', { name: 'Delete profile', exact: true }).click()
        await until(async () => (await selector.inputValue()) === '', 'plain saved configuration deleted')
        await selector.selectOption(savedId)
        assert.equal(await pane.locator('textarea[name="caPem"]').inputValue(), fixture.settings.tls.caPem.trim())
        assert.equal(await password.inputValue(), '')
        await profileName.fill(renamedName)
        await pane.getByRole('button', { name: 'Update profile', exact: true }).click()
        await selector.locator('option').filter({ hasText: renamedName }).waitFor({ state: 'attached' })
        assert.equal(await selector.inputValue(), savedId, 'Updating keeps the saved identity')
        assert.equal(await fixture.clients(), baseline)
        record('native save/update/delete ordinary and TLS profiles; no password on disk or automatic Redis connection')
        const invalid = await context.request.post(origin + '/api/redisViewer/saveProfile', { data: {
          type: 'client-request', rpcId: 'redis-smoke-profile-secret', method: 'redisViewer/saveProfile', payload: { args: {
            agentId: created.sessionId, request: { id: null, name: 'Rejected', settings: { ...fixture.settings } },
          } },
        } })
        const rejected = await invalid.json()
        assert.equal(rejected.result?.ok, false)
        assert(!JSON.stringify(rejected).includes(fixture.settings.password))
        record('native gateway rejects a password inside saved settings without echoing it')
      }
      await password.fill(fixture.settings.password)
      await pane.getByRole('button', { name: 'Test connection', exact: true }).click()
      await pane.getByRole('status').filter({ hasText: 'Connection test passed.' }).waitFor()
      await until(async () => await fixture.clients() === baseline, 'native temporary test socket closed')
      record('native form test succeeded without a persistent Redis socket')
      await password.fill('incorrect-fixture-password')
      await pane.getByRole('button', { name: 'Test connection', exact: true }).click()
      await pane.getByRole('alert').filter({ hasText: 'Authentication failed.' }).waitFor()
      await until(async () => await fixture.clients() === baseline, 'native bad-password socket closed')
      record('native form displays fixed authentication error and releases its socket')
      if (process.env.REDIS_SMOKE_SESSIONS === '1') {
        await profileName.fill('Sessions ' + fixture.metadata.owner)
        await pane.getByRole('button', { name: 'Save profile', exact: true }).click()
        await pane.getByRole('button', { name: 'Update profile', exact: true }).waitFor()
      }
      await password.fill(fixture.settings.password)
      await pane.getByRole('button', { name: 'Connect', exact: true }).click()
      await pane.locator('.redis-connected').waitFor()
      await until(async () => await fixture.clients() === baseline + 1, 'native persistent connection created')
      assert(!(await page.evaluate(() => JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage } }))).includes(fixture.settings.password))
      await pane.getByRole('button', { name: 'Refresh status', exact: true }).click()
      await pane.locator('time').waitFor()
      if (process.env.REDIS_SMOKE_KEYS === '1') {
        const keys = pane.locator('.redis-keys')
        const refresh = keys.getByRole('button', { name: 'Scan / refresh', exact: true })
        const more = keys.getByRole('button', { name: 'Continue scan', exact: true })
        assert.equal(await keys.locator('[data-loaded-keys]').innerText(), '0', 'Connect must not automatically scan')
        assert.equal(await more.isEnabled(), false)
        async function scanAll(pattern) {
          await keys.getByRole('button', { name: 'Flat key list', exact: true }).click()
          await keys.locator('input[name="pattern"]').fill(pattern)
          await refresh.click()
          await until(async () => await refresh.isEnabled(), 'native first scan finished')
          let pages = 1
          while (await more.isEnabled()) {
            await more.click(); await until(async () => await refresh.isEnabled(), 'native next scan finished')
            assert(++pages < 50, 'Fixture scan must terminate')
          }
          assert((await keys.innerText()).includes('Scan complete'))
          return Number(await keys.locator('[data-loaded-keys]').innerText())
        }
        assert.equal(await scanAll('native:*'), 230)
        record('native incremental MATCH scan and explicit continuation load 230 distinct keys')
        assert.equal(await scanAll('*'), fixture.expectedKeyCount ?? 232)
        const identity = Buffer.from([255, 0, 13, 10, 128]).toString('base64')
        await (await findLoadedKey(keys, identity)).click()
        await assertSelectedIdentity(keys, identity)
        assert.equal(await scanAll('native:absent-*'), 0)
        assert.equal(await more.isEnabled(), false)
        record('native binary key selection preserves Base64 identity; empty MATCH is complete without stale rows')
        await keys.locator('input[name="db"]').fill('1')
        await keys.getByRole('button', { name: 'Select DB', exact: true }).click()
        await keys.getByRole('heading').filter({ hasText: 'DB 1' }).waitFor()
        assert.equal(await keys.locator('[data-loaded-keys]').innerText(), '0')
        assert.equal(await scanAll('*'), 1)
        await keys.locator('.redis-key-list button').click()
        await page.screenshot({ path: resolve(artifacts, 'native-keys-data.png'), fullPage: true })
        record('native DB switch clears previous keys and selects the independent DB1 key')
        await keys.locator('input[name="db"]').fill('65535')
        await keys.getByRole('button', { name: 'Select DB', exact: true }).click()
        await pane.getByRole('alert').filter({ hasText: 'DB index is outside' }).waitFor()
        assert((await keys.getByRole('heading').innerText()).includes('DB 1'))
        await keys.locator('input[name="db"]').fill('0')
        await keys.getByRole('button', { name: 'Select DB', exact: true }).click()
        await keys.getByRole('heading').filter({ hasText: 'DB 0' }).waitFor()
        assert.equal(await keys.locator('[data-loaded-keys]').innerText(), '0')
        record('native invalid DB shows fixed error and retains DB1, then manual recovery to DB0 succeeds')
        if (process.env.REDIS_SMOKE_STRINGS === '1') {
          async function selectValue(name) {
            assert.equal(await scanAll(name), 1)
            await keys.locator('.redis-key-list button').click()
            const details = keys.locator('.redis-details')
            await details.waitFor()
            return details
          }
          let details = await selectValue('view:json')
          await details.locator('[data-value-coverage]').filter({ hasText: 'Complete value' }).waitFor()
          assert.equal(await details.locator('[data-value-preview]').innerText(), fixture.jsonText)
          await chooseValueFormat(details, 'json')
          let pretty = await details.locator('[data-value-preview]').innerText()
          assert(pretty.includes('9007199254740993') && pretty.includes('1e400') && pretty.includes('\n'))
          await chooseValueFormat(details, 'hex')
          assert((await details.locator('[data-value-preview]').innerText()).startsWith('00000000  7B'))
          await chooseValueFormat(details, 'base64')
          assert.equal(await details.locator('[data-value-preview]').innerText(), Buffer.from(fixture.jsonText).toString('base64'))
          await chooseValueFormat(details, 'json')
          await details.scrollIntoViewIfNeeded()
          await page.screenshot({ path: resolve(artifacts, 'native-string-data.png'), fullPage: true })
          record('native complete String Text/JSON/Hex/Base64 preserve large integer and exponent tokens')
          details = await selectValue('view:base64')
          await details.locator('[data-value-coverage]').waitFor()
          await chooseValueFormat(details, 'decode-json')
          pretty = await details.locator('[data-value-preview]').innerText()
          assert(pretty.includes('9007199254740993') && pretty.includes('中文😀'))
          details = await selectValue('view:invalid')
          await chooseValueFormat(details, 'text')
          await details.getByRole('alert').filter({ hasText: 'not valid UTF-8' }).waitFor()
          await chooseValueFormat(details, 'hex')
          assert((await details.locator('[data-value-preview]').innerText()).includes('FF 00'))
          await chooseValueFormat(details, 'decode-text')
          await details.getByRole('alert').filter({ hasText: 'not decodable standard Base64' }).waitFor()
          record('native explicit Base64 decoding succeeds; invalid raw UTF-8 and Base64 display fixed errors')
          details = await selectValue('view:large')
          await details.locator('[data-value-coverage]').filter({ hasText: 'Partial byte preview' }).waitFor()
          await chooseValueFormat(details, 'json')
          await details.getByRole('alert').filter({ hasText: 'partial value cannot be formatted' }).waitFor()
          await chooseValueFormat(details, 'base64')
          assert.equal((await details.locator('[data-value-preview]').innerText()).length, 87384)
          await details.getByRole('button', { name: 'Next window', exact: true }).click()
          await details.locator('[data-value-coverage]').filter({ hasText: 'Start byte 65536' }).waitFor()
          await details.getByRole('button', { name: 'Next window', exact: true }).click()
          await details.locator('[data-value-coverage]').filter({ hasText: 'Start byte 131072' }).waitFor()
          assert.equal(await details.locator('[data-value-preview]').innerText(), 'YQ==')
          assert.equal(await details.getByRole('button', { name: 'Next window', exact: true }).isEnabled(), false)
          record('native large String remains partial, refuses partial JSON, and reads the last single-byte window')
          details = await selectValue('view:utf8')
          await chooseValueFormat(details, 'text')
          await details.locator('[data-value-coverage]').waitFor()
          await details.locator('input[name="byteOffset"]').fill('2')
          await details.locator('select[name="byteCount"]').selectOption('256')
          await details.getByRole('button', { name: 'Read / refresh', exact: true }).click()
          await details.locator('[data-value-coverage]').filter({ hasText: 'Start byte 2' }).waitFor()
          const boundaryText = await details.locator('[data-value-preview]').innerText()
          assert(boundaryText.includes('😀') && !boundaryText.includes('\ufffd'))
          assert((await details.innerText()).includes('outside-window bytes completing'))
          await chooseValueFormat(details, 'hex')
          assert((await details.locator('[data-value-preview]').innerText()).startsWith('00000002  9F 98 80'))
          await details.locator('input[name="byteOffset"]').fill('9223372036854775808')
          await details.getByRole('button', { name: 'Read / refresh', exact: true }).click()
          await details.getByRole('alert').filter({ hasText: 'Start byte must be an integer' }).waitFor()
          record('native UTF-8 crossing uses explicit context, exact Hex offset and strict integer range feedback')
          details = await selectValue('view:hash')
          await details.getByRole('heading').filter({ hasText: 'Hash fields and values' }).waitFor()
          await details.locator('[data-loaded-fields]').filter({ hasText: '1' }).waitFor()
          details = await selectValue('view:empty')
          await details.locator('[data-value-coverage]').filter({ hasText: 'Complete value' }).waitFor()
          assert.equal(await details.locator('[data-value-preview]').innerText(), '')
          await fixture.admin.del('view:empty')
          await details.getByRole('button', { name: 'Read / refresh', exact: true }).click()
          await details.getByRole('status').filter({ hasText: 'no longer exists or has expired' }).waitFor()
          assert.equal(await details.locator('[data-value-preview]').count(), 0)
          record('native Hash routes to its own viewer; empty String and disappeared key are distinct and discard prior preview')
        }
        if (process.env.REDIS_SMOKE_HASHES === '1') {
          assert.equal(await scanAll('hash:records'), 1)
          await keys.locator('.redis-key-list button').click()
          const details = keys.locator('.redis-details')
          await details.getByRole('heading').filter({ hasText: 'Hash fields and values' }).waitFor()
          const refreshHash = details.getByRole('button', { name: 'Scan / refresh', exact: true })
          const moreHash = details.getByRole('button', { name: 'Continue scan', exact: true })
          async function scanHashAll(pattern) {
            if (pattern !== undefined) { await details.locator('input[name="hashPattern"]').fill(pattern); await refreshHash.click() }
            await until(async () => await refreshHash.isEnabled(), 'native Hash first page finished')
            let pages = 1
            while (await moreHash.isEnabled()) { await moreHash.click(); await until(async () => await refreshHash.isEnabled(), 'native Hash continuation finished'); assert(++pages < 50) }
            assert((await details.innerText()).includes('Scan complete'))
            return Number(await details.locator('[data-loaded-fields]').innerText())
          }
          assert.equal(await scanHashAll(), 235)
          assert.equal(await details.getByRole('table').locator('tbody tr').count(), 235)
          record('native Hash routes automatically on key selection and explicitly continues to 235 unique raw-identity rows')
          const binaryField = Buffer.from([255, 0, 13]).toString('base64')
          await details.locator('[data-hash-field="' + binaryField + '"]').click()
          const cell = details.locator('.redis-cell-preview')
          assert.equal(await cell.locator('textarea[readonly]').inputValue(), binaryField)
          await cell.getByRole('alert').filter({ hasText: 'not valid UTF-8' }).waitFor()
          await chooseValueFormat(cell, 'hex')
          assert((await cell.locator('[data-value-preview]').innerText()).includes('FF 00 0D'))
          await chooseValueFormat(cell, 'base64')
          assert.equal(await cell.locator('[data-value-preview]').innerText(), binaryField)
          await details.locator('[data-hash-value=""]').click()
          assert.equal(await cell.locator('[data-value-preview]').innerText(), '')
          record('native binary field byte preview keeps exact Hex/Base64 identity, and empty field/value remain selectable')
          await details.locator('[data-hash-value="' + Buffer.from('json').toString('base64') + '"]').click()
          await chooseValueFormat(cell, 'json')
          const pretty = await cell.locator('[data-value-preview]').innerText()
          assert(pretty.includes('9007199254740993') && pretty.includes('1e400') && pretty.includes('中文😀'))
          await cell.scrollIntoViewIfNeeded()
          await page.screenshot({ path: resolve(artifacts, 'native-hash-data.png'), fullPage: true })
          await details.locator('[data-hash-value="' + Buffer.from('encoded').toString('base64') + '"]').click()
          await chooseValueFormat(cell, 'decode-json')
          assert((await cell.locator('[data-value-preview]').innerText()).includes('9007199254740993'))
          record('native Hash JSON and explicit Base64 decode reuse the lossless formatter with large integer/exponent tokens')
          await details.locator('[data-hash-value="' + Buffer.from('large').toString('base64') + '"]').click()
          await cell.locator('[data-cell-coverage]').filter({ hasText: '65536/131073' }).waitFor()
          await chooseValueFormat(cell, 'json')
          await cell.getByRole('alert').filter({ hasText: 'partial value cannot be formatted' }).waitFor()
          await chooseValueFormat(cell, 'base64')
          assert.equal((await cell.locator('[data-value-preview]').innerText()).length, 87384)
          record('native long Hash cell reports its full length and 64 KiB partial coverage, refusing complete JSON formatting')
          assert.equal(await scanHashAll('item:1*'), 111)
          assert.equal(await cell.count(), 0)
          assert.equal(await scanHashAll('absent:*'), 0)
          assert.equal(await details.locator('tbody tr').count(), 0)
          record('native server field MATCH has explicit completion and clears previous rows/preview for changed or empty patterns')
          assert.equal(await scanAll('hash:compact'), 1)
          await keys.locator('.redis-key-list button').click()
          await details.locator('[data-loaded-fields]').filter({ hasText: '3' }).waitFor()
          await fixture.admin.del('hash:compact')
          await refreshHash.click()
          await details.getByRole('status').filter({ hasText: 'no longer exists or has expired' }).waitFor()
          assert.equal(await details.locator('tbody tr').count(), 0)
          await fixture.admin.set('hash:compact', 'changed to String')
          await refreshHash.click()
          await details.getByRole('status').filter({ hasText: 'cannot be viewed as a Hash' }).waitFor()
          assert.equal(await details.locator('tbody tr').count(), 0)
          record('native Hash refresh discards all prior cells when the key disappears or becomes another type')
        }
        if (process.env.REDIS_SMOKE_LISTS === '1') {
          assert.equal(await scanAll('list:records'), 1)
          await keys.locator('.redis-key-list button').click()
          const details = keys.locator('.redis-details')
          await details.getByRole('heading').filter({ hasText: 'List elements' }).waitFor()
          await until(async () => await details.locator('[data-list-count]').textContent() === '100', 'native List first range loaded')
          assert.equal(await details.getByRole('table').locator('tbody tr').count(), 100)
          assert.equal(await details.locator('[data-list-index="0"]').innerText(), await details.locator('[data-list-index="1"]').innerText())
          record('native List opens its own viewer with 100 original-index rows; duplicate values occupy separate positions')
          const cell = details.locator('.redis-cell-preview')
          await details.locator('[data-list-index="2"]').click()
          await cell.getByRole('alert').filter({ hasText: 'not valid UTF-8' }).waitFor()
          await chooseValueFormat(cell, 'hex')
          assert((await cell.locator('[data-value-preview]').innerText()).includes('FF 00'))
          await chooseValueFormat(cell, 'base64')
          assert.equal(await cell.locator('[data-value-preview]').innerText(), Buffer.from([255, 0]).toString('base64'))
          await details.locator('[data-list-index="3"]').click()
          assert.equal(await cell.locator('[data-value-preview]').innerText(), '')
          await details.locator('[data-list-index="4"]').click()
          await chooseValueFormat(cell, 'json')
          const pretty = await cell.locator('[data-value-preview]').innerText()
          assert(pretty.includes('9007199254740993') && pretty.includes('1e400') && pretty.includes('中文😀'))
          await cell.scrollIntoViewIfNeeded()
          await page.screenshot({ path: resolve(artifacts, 'native-list-data.png'), fullPage: true })
          await details.locator('[data-list-index="5"]').click()
          await chooseValueFormat(cell, 'decode-json')
          assert((await cell.locator('[data-value-preview]').innerText()).includes('9007199254740993'))
          record('native List binary/empty/JSON/encoded cells reuse exact byte previews and lossless JSON tokens')
          await details.locator('[data-list-index="6"]').click()
          await cell.locator('[data-cell-coverage]').filter({ hasText: '65536/131073' }).waitFor()
          await chooseValueFormat(cell, 'json')
          await cell.getByRole('alert').filter({ hasText: 'partial value cannot be formatted' }).waitFor()
          await chooseValueFormat(cell, 'base64')
          assert.equal((await cell.locator('[data-value-preview]').innerText()).length, 87384)
          const refreshList = details.getByRole('button', { name: 'Read / refresh', exact: true }), nextList = details.getByRole('button', { name: 'Next range', exact: true })
          await nextList.click()
          await until(async () => await details.locator('[data-list-start]').textContent() === '100', 'native List second interval')
          assert.equal(await cell.count(), 0)
          await nextList.click()
          await until(async () => await details.locator('[data-list-start]').textContent() === '200', 'native List final interval')
          assert.equal(await details.locator('[data-list-count]').innerText(), '37')
          assert.equal(await details.locator('[data-list-index="236"]').count(), 1)
          assert.equal(await nextList.isEnabled(), false)
          record('native List caps a long element, rejects partial JSON, and advances 0/100/200 without retaining old cell selection')
          await details.locator('input[name="listOffset"]').fill('9223372036854775807')
          await refreshList.click()
          await until(async () => await details.locator('[data-list-count]').textContent() === '0', 'native List EOF interval')
          assert.equal(await details.locator('tbody tr').count(), 0)
          await details.locator('input[name="listOffset"]').fill('9223372036854775808')
          await refreshList.click()
          await details.getByRole('alert').filter({ hasText: 'Start index must be an integer' }).waitFor()
          await details.locator('input[name="listOffset"]').fill('0')
          await details.locator('select[name="listCount"]').selectOption('10')
          await fixture.admin.lPush('list:records', 'inserted')
          await refreshList.click()
          await until(async () => await details.locator('[data-list-count]').textContent() === '10', 'native List refreshed after insertion')
          assert((await details.locator('[data-list-index="0"]').innerText()).includes('inserted'))
          record('native List distinguishes exact EOF, validates signed-integer input and refreshes shifted positions after an insertion')
          await fixture.admin.del('list:records'); await refreshList.click()
          await details.getByRole('status').filter({ hasText: 'no longer exists or has expired' }).waitFor()
          assert.equal(await details.locator('tbody tr').count(), 0)
          await fixture.admin.hSet('list:records', 'field', 'value'); await refreshList.click()
          await details.getByRole('status').filter({ hasText: 'cannot be viewed as a List' }).waitFor()
          assert.equal(await details.locator('tbody tr').count(), 0)
          record('native List refresh discards rows for disappeared or wrong-type keys')
        }
        if (process.env.REDIS_SMOKE_SETS === '1') {
          // This block follows the other type regressions but starts a fresh Key scan.
          assert.equal(await scanAll('set:records'), 1)
          await keys.locator('.redis-key-list button').click()
          const details = keys.locator('.redis-details')
          await details.getByRole('heading').filter({ hasText: 'Set members' }).waitFor()
          const refreshSet = details.getByRole('button', { name: 'Scan / refresh', exact: true }), moreSet = details.getByRole('button', { name: 'Continue scan', exact: true })
          async function scanSetAll(pattern) {
            if (pattern !== undefined) { await details.locator('input[name="setPattern"]').fill(pattern); await refreshSet.click() }
            await until(async () => await refreshSet.isEnabled(), 'native Set first page finished')
            let pages = 1
            while (await moreSet.isEnabled()) { await moreSet.click(); await until(async () => await refreshSet.isEnabled(), 'native Set continuation finished'); assert(++pages < 50) }
            assert((await details.innerText()).includes('Scan complete'))
            return Number(await details.locator('[data-loaded-members]').innerText())
          }
          assert.equal(await scanSetAll(), 235)
          assert.equal(await details.getByRole('table').locator('tbody tr').count(), 235)
          record('native Set routes on selection and explicitly continues to 235 complete raw-identity members without a global-sort claim')
          const binary = Buffer.from([255, 0]).toString('base64'), cell = details.locator('.redis-cell-preview')
          await details.locator('[data-set-member="' + binary + '"]').click()
          assert.equal(await cell.locator('textarea[readonly]').inputValue(), binary)
          await cell.getByRole('alert').filter({ hasText: 'not valid UTF-8' }).waitFor()
          await chooseValueFormat(cell, 'hex')
          assert((await cell.locator('[data-value-preview]').innerText()).includes('FF 00'))
          await chooseValueFormat(cell, 'base64')
          assert.equal(await cell.locator('[data-value-preview]').innerText(), binary)
          await details.locator('[data-set-member=""]').click()
          assert.equal(await cell.locator('[data-value-preview]').innerText(), '')
          const json = '{"id":9007199254740993,"huge":1e400,"label":"中文😀"}'
          await details.locator('[data-set-member="' + Buffer.from(json).toString('base64') + '"]').click()
          await chooseValueFormat(cell, 'json')
          const pretty = await cell.locator('[data-value-preview]').innerText()
          assert(pretty.includes('9007199254740993') && pretty.includes('1e400') && pretty.includes('中文😀'))
          await cell.scrollIntoViewIfNeeded()
          await page.screenshot({ path: resolve(artifacts, 'native-set-data.png'), fullPage: true })
          await details.locator('[data-set-member="' + Buffer.from(Buffer.from(json).toString('base64')).toString('base64') + '"]').click()
          await chooseValueFormat(cell, 'decode-json')
          assert((await cell.locator('[data-value-preview]').innerText()).includes('9007199254740993'))
          record('native Set binary/empty/JSON/explicit Base64 decode preserve member bytes and large-number tokens')
          // Editing MATCH clears loaded rows/preview but must not issue a scan itself.
          let memberCalls = 0
          const countMemberCalls = request => { if (request.url().endsWith('/api/redisViewer/scanSet')) memberCalls++ }
          page.on('request', countMemberCalls)
          await details.locator('input[name="setPattern"]').fill('item:1*')
          assert.equal(await details.locator('[data-loaded-members]').innerText(), '0'); assert.equal(await cell.count(), 0)
          await details.locator('input[name="setPattern"]').blur()
          assert.equal(memberCalls, 0)
          page.off('request', countMemberCalls)
          assert.equal(await scanSetAll('item:1*'), 111); assert.equal(await scanSetAll('absent:*'), 0)
          record('native Set MATCH changes clear rows without auto-reading; explicit scans show 111 matching members or an empty completed result')
          assert.equal(await scanAll('set:compact'), 1)
          await keys.locator('.redis-key-list button').click()
          await details.locator('[data-loaded-members]').filter({ hasText: '3' }).waitFor()
          await fixture.admin.del('set:compact'); await refreshSet.click()
          await details.getByRole('status').filter({ hasText: 'no longer exists or has expired' }).waitFor()
          assert.equal(await details.locator('tbody tr').count(), 0)
          await fixture.admin.set('set:compact', 'changed'); await refreshSet.click()
          await details.getByRole('status').filter({ hasText: 'cannot be viewed as a Set' }).waitFor()
          assert.equal(await details.locator('tbody tr').count(), 0)
          record('native Set refresh discards members when the key disappears or changes type')
        }
        if (process.env.REDIS_SMOKE_ZSETS === '1') {
          assert.equal(await scanAll('zset:records'), 1)
          await keys.locator('.redis-key-list button').click()
          const details = keys.locator('.redis-details')
          await details.getByRole('heading').filter({ hasText: 'ZSet members and scores' }).waitFor()
          await until(async () => await details.locator('[data-loaded-zset]').textContent() === '100', 'native ZSet first rank interval')
          assert.equal(await details.getByRole('table').locator('tbody tr').count(), 100)
          const binary = Buffer.from([255, 0]).toString('base64'), cell = details.locator('.redis-cell-preview')
          assert.equal(await details.locator('[data-zset-score="' + binary + '"]').innerText(), '-inf')
          await details.locator('[data-zset-member="' + binary + '"]').click()
          await cell.getByRole('alert').filter({ hasText: 'not valid UTF-8' }).waitFor()
          assert.equal(await cell.locator('textarea[readonly]').inputValue(), binary)
          await chooseValueFormat(cell, 'hex')
          assert((await cell.locator('[data-value-preview]').innerText()).includes('FF 00'))
          await details.locator('[data-zset-member=""]').click()
          assert.equal(await cell.locator('[data-value-preview]').innerText(), '')
          const json = '{"id":9007199254740993,"huge":1e400,"label":"中文😀"}', jsonId = Buffer.from(json).toString('base64')
          assert.equal(await details.locator('[data-zset-score="' + jsonId + '"]').innerText(), '1.0000000000000002')
          await details.locator('[data-zset-member="' + jsonId + '"]').click()
          await chooseValueFormat(cell, 'json')
          const pretty = await cell.locator('[data-value-preview]').innerText()
          assert(pretty.includes('9007199254740993') && pretty.includes('1e400') && pretty.includes('中文😀'))
          await cell.scrollIntoViewIfNeeded()
          await page.screenshot({ path: resolve(artifacts, 'native-zset-data.png'), fullPage: true })
          await details.locator('[data-zset-member="' + Buffer.from(Buffer.from(json).toString('base64')).toString('base64') + '"]').click()
          await chooseValueFormat(cell, 'decode-json')
          assert((await cell.locator('[data-value-preview]').innerText()).includes('9007199254740993'))
          record('native ZSet rank table keeps binary/empty members, exact high-precision/infinity score text and lossless JSON/decoded previews')
          const next = details.getByRole('button', { name: 'Next range', exact: true })
          await next.click(); await until(async () => await details.locator('[data-zset-start]').textContent() === '100', 'native ZSet second rank interval')
          assert.equal(await cell.count(), 0)
          await next.click(); await until(async () => await details.locator('[data-zset-start]').textContent() === '200', 'native ZSet final rank interval')
          assert.equal(await details.locator('[data-loaded-zset]').innerText(), '35'); assert.equal(await next.isEnabled(), false)
          record('native ZSet rank intervals advance 0/100/200, replace old rows and clear selected preview, with 35 final members')
          await details.locator('select[name="zsetMode"]').selectOption('scan')
          const refreshScan = details.getByRole('button', { name: 'Scan / refresh', exact: true }), moreScan = details.getByRole('button', { name: 'Continue scan', exact: true })
          async function scanZSetAll(pattern) {
            if (pattern !== undefined) { await details.locator('input[name="zsetPattern"]').fill(pattern); await refreshScan.click() }
            await until(async () => await refreshScan.isEnabled(), 'native ZSet scan first page')
            let pages = 1
            while (await moreScan.isEnabled()) { await moreScan.click(); await until(async () => await refreshScan.isEnabled(), 'native ZSet scan continuation'); assert(++pages < 50) }
            assert((await details.innerText()).includes('Scan complete'))
            return Number(await details.locator('[data-loaded-zset]').innerText())
          }
          assert.equal(await scanZSetAll(), 235)
          assert.equal(await details.getByRole('columnheader', { name: 'Ascending rank', exact: true }).count(), 0)
          await details.scrollIntoViewIfNeeded()
          await page.screenshot({ path: resolve(artifacts, 'native-zset-scan-data.png'), fullPage: true })
          assert.equal(await scanZSetAll('item:1*'), 111); assert.equal(await scanZSetAll('absent:*'), 0)
          record('native ZSet unordered scan has no rank column, continues 235 unique members and completes MATCH111/0 independently from rank pagination')
          await details.locator('select[name="zsetMode"]').selectOption('range')
          await until(async () => await details.locator('[data-zset-start]').textContent() === '200', 'native ZSet rank mode restored')
          const refreshRange = details.getByRole('button', { name: 'Read / refresh', exact: true })
          await details.locator('input[name="zsetOffset"]').fill('9223372036854775807'); await refreshRange.click()
          await until(async () => await details.locator('[data-zset-start]').textContent() === '9223372036854775807', 'native ZSet EOF rank')
          assert.equal(await details.locator('tbody tr').count(), 0)
          await details.locator('input[name="zsetOffset"]').fill('9223372036854775808'); await refreshRange.click()
          await details.getByRole('alert').filter({ hasText: 'Start rank must be an integer' }).waitFor()
          await details.locator('input[name="zsetOffset"]').fill('0'); await details.locator('select[name="zsetCount"]').selectOption('10')
          await fixture.admin.sendCommand(['ZADD', 'zset:records', '-100', 'inserted']); await refreshRange.click()
          await until(async () => await details.locator('[data-zset-start]').textContent() === '0', 'native ZSet fresh rank after insertion')
          assert.equal(await details.locator('[data-loaded-zset]').innerText(), '10')
          assert.equal(await details.locator('[data-zset-score="' + Buffer.from('inserted').toString('base64') + '"]').innerText(), '-100')
          record('native ZSet mode switch restores a rank interval; exact EOF and invalid integer are distinct, and refresh reflects insertion')
          assert.equal(await scanAll('zset:oversize'), 1); await keys.locator('.redis-key-list button').click()
          await details.getByRole('alert').waitFor()
          assert.equal(await details.locator('[data-loaded-zset]').innerText(), '0'); assert.equal(await pane.locator('.redis-connected').count(), 1)
          assert.equal(await scanAll('zset:compact'), 1); await keys.locator('.redis-key-list button').click()
          await until(async () => await details.locator('[data-loaded-zset]').textContent() === '3', 'native compact ZSet after oversized page')
          await fixture.admin.del('zset:compact'); await refreshRange.click()
          await details.getByRole('status').filter({ hasText: 'no longer exists or has expired' }).waitFor()
          assert.equal(await details.locator('tbody tr').count(), 0)
          await fixture.admin.set('zset:compact', 'changed'); await refreshRange.click()
          await details.getByRole('status').filter({ hasText: 'cannot be viewed as a ZSet' }).waitFor()
          assert.equal(await details.locator('tbody tr').count(), 0)
          record('native ZSet oversized member refuses without truncation or disconnect; another key recovers, and missing/wrong-type refresh removes old rows')
        }
        if (process.env.REDIS_SMOKE_STREAMS === '1') {
          assert.equal(await scanAll('stream:records'), 1); await keys.locator('.redis-key-list button').click()
          const details = keys.locator('.redis-details')
          await details.getByRole('heading').filter({ hasText: 'Stream messages' }).waitFor()
          await until(async () => await details.locator('[data-loaded-messages]').textContent() === '100', 'native Stream first page')
          const messageTable = details.getByRole('table', { name: 'Stream messages', exact: true })
          assert.equal(await messageTable.locator('tbody tr').count(), 100)
          await details.locator('[data-stream-id="1000-0"]').click()
          const fields = details.locator('.redis-stream-fields'), cell = details.locator('.redis-cell-preview')
          assert.equal(await fields.locator('tbody tr').count(), 7)
          assert.equal(await fields.locator('[data-stream-field="1"]').innerText(), await fields.locator('[data-stream-field="2"]').innerText())
          await fields.locator('[data-stream-value="1"]').click(); assert.equal(await cell.locator('[data-value-preview]').innerText(), 'one')
          await fields.locator('[data-stream-value="2"]').click(); assert.equal(await cell.locator('[data-value-preview]').innerText(), 'two')
          await fields.locator('[data-stream-field="0"]').click()
          assert.equal(await cell.locator('textarea[readonly]').inputValue(), Buffer.from([255, 0]).toString('base64'))
          await cell.getByRole('alert').filter({ hasText: 'not valid UTF-8' }).waitFor()
          await chooseValueFormat(cell, 'hex'); assert((await cell.locator('[data-value-preview]').innerText()).includes('FF 00'))
          await fields.locator('[data-stream-value="0"]').click()
          await chooseValueFormat(cell, 'base64'); assert.equal(await cell.locator('[data-value-preview]').innerText(), Buffer.from([254, 0]).toString('base64'))
          await fields.locator('[data-stream-field="3"]').click(); assert.equal(await cell.locator('[data-value-preview]').innerText(), '')
          await fields.locator('[data-stream-value="3"]').click(); assert.equal(await cell.locator('[data-value-preview]').innerText(), '')
          record('native Stream selection preserves seven ordered field occurrences, repeated names with different values, binary field/value and empty pairs')
          await fields.locator('[data-stream-value="4"]').click(); await chooseValueFormat(cell, 'json')
          const pretty = await cell.locator('[data-value-preview]').innerText()
          assert(pretty.includes('9007199254740993') && pretty.includes('1e400') && pretty.includes('中文😀'))
          await cell.scrollIntoViewIfNeeded(); await page.screenshot({ path: resolve(artifacts, 'native-stream-data.png'), fullPage: true })
          await fields.locator('[data-stream-value="5"]').click(); await chooseValueFormat(cell, 'decode-json')
          assert((await cell.locator('[data-value-preview]').innerText()).includes('9007199254740993'))
          await fields.locator('[data-stream-value="6"]').click(); await cell.locator('[data-cell-coverage]').filter({ hasText: '65536/131073' }).waitFor()
          await chooseValueFormat(cell, 'json'); await cell.getByRole('alert').filter({ hasText: 'partial value cannot be formatted' }).waitFor()
          await chooseValueFormat(cell, 'base64'); assert.equal((await cell.locator('[data-value-preview]').innerText()).length, 87384)
          record('native Stream JSON/explicit decode preserve original numeric tokens; long message values report 64 KiB partial coverage and refuse complete JSON formatting')
          const moreStream = details.getByRole('button', { name: 'Continue reading', exact: true }), refreshStream = details.getByRole('button', { name: 'Read / refresh', exact: true })
          async function readRemaining() {
            await until(async () => await refreshStream.isEnabled(), 'native Stream page finished')
            let pages = 1
            while (await moreStream.isEnabled()) { await moreStream.click(); await until(async () => await refreshStream.isEnabled(), 'native Stream continuation'); assert(++pages < 50) }
            assert((await details.innerText()).includes('Range read complete'))
            return Number(await details.locator('[data-loaded-messages]').innerText())
          }
          assert.equal(await readRemaining(), 235)
          let ids = await messageTable.locator('[data-stream-id]').evaluateAll(nodes => nodes.map(node => node.textContent))
          assert.equal(new Set(ids).size, 235); assert.equal(ids[0], '1000-0'); assert.equal(ids[234], '1000-234')
          await details.locator('select[name="streamDirection"]').selectOption('reverse')
          await until(async () => await details.locator('[data-loaded-messages]').textContent() === '100', 'native Stream reverse first page')
          assert.equal(await fields.count(), 0); assert.equal(await readRemaining(), 235)
          ids = await messageTable.locator('[data-stream-id]').evaluateAll(nodes => nodes.map(node => node.textContent))
          assert.equal(ids[0], '1000-234'); assert.equal(ids[234], '1000-0'); assert.equal(new Set(ids).size, 235)
          record('native Stream forward and reverse continuation load 235 distinct IDs in opposite order and discard old field selection on direction change')
          let calls = 0
          const countStreamCalls = request => { if (request.url().endsWith('/api/redisViewer/readStream')) calls++ }
          page.on('request', countStreamCalls)
          await details.locator('input[name="streamStart"]').fill('1000-99'); await details.locator('input[name="streamEnd"]').fill('1000-101'); await details.locator('select[name="streamCount"]').selectOption('1')
          assert.equal(calls, 0); page.off('request', countStreamCalls)
          await refreshStream.click()
          await until(async () => await details.locator('[data-loaded-messages]').textContent() === '1' && await messageTable.locator('[data-stream-id]').first().textContent() === '1000-101', 'native submitted Stream range first page')
          assert.equal(await readRemaining(), 3)
          assert.deepEqual(await messageTable.locator('[data-stream-id]').evaluateAll(nodes => nodes.map(node => node.textContent)), ['1000-101', '1000-100', '1000-99'])
          await details.locator('input[name="streamEnd"]').fill('0-0'); await refreshStream.click()
          await details.getByRole('alert').filter({ hasText: 'Use complete IDs' }).waitFor()
          assert.equal(await details.locator('[data-loaded-messages]').innerText(), '3')
          assert.deepEqual(await fixture.admin.sendCommand(['XPENDING', 'stream:records', 'fixture-group']), fixture.streamPending)
          assert.deepEqual(await fixture.admin.sendCommand(['XINFO', 'GROUPS', 'stream:records']), fixture.streamGroups)
          record('native Stream draft bounds/count do not auto-query; inclusive single-message pages have exact boundaries, invalid bounds retain prior data, and Pending/group progress are unchanged')
          assert.equal(await scanAll('stream:ids'), 1); await keys.locator('.redis-key-list button').click()
          await until(async () => await details.locator('[data-loaded-messages]').textContent() === '4', 'native exact uint64 Stream IDs')
          const maxId = '18446744073709551615-18446744073709551615'
          assert.equal(await details.locator('[data-stream-id="' + maxId + '"]').innerText(), maxId)
          assert.equal(await details.locator('[data-stream-id="9007199254740993-0"]').innerText(), '9007199254740993-0')
          await details.locator('select[name="streamDirection"]').selectOption('reverse')
          await until(async () => await details.locator('[data-stream-id]').first().textContent() === maxId, 'native reverse uint64 Stream ID')
          await details.scrollIntoViewIfNeeded(); await page.screenshot({ path: resolve(artifacts, 'native-stream-ids.png'), fullPage: true })
          record('native Stream displays both unsigned-64-bit ID components exactly, including maximum ID and values beyond JavaScript safe integers')
          assert.equal(await scanAll('stream:records'), 1); await keys.locator('.redis-key-list button').click()
          await until(async () => await details.locator('[data-loaded-messages]').textContent() === '100', 'native Stream returns to records')
          await fixture.admin.sendCommand(['XADD', 'stream:records', '1001-0', 'field', 'appended'])
          await details.locator('select[name="streamDirection"]').selectOption('reverse')
          await until(async () => await details.locator('[data-stream-id]').first().textContent() === '1001-0', 'native Stream sees appended ID on explicit new read')
          assert.equal(await scanAll('stream:oversize'), 1); await keys.locator('.redis-key-list button').click()
          await details.getByRole('alert').waitFor(); assert.equal(await details.locator('[data-loaded-messages]').innerText(), '0'); assert.equal(await pane.locator('.redis-connected').count(), 1)
          assert.equal(await scanAll('stream:empty'), 1); await keys.locator('.redis-key-list button').click()
          await details.getByRole('status').filter({ hasText: 'Range read complete' }).waitFor()
          assert.equal(await details.locator('[data-loaded-messages]').innerText(), '0'); assert.equal(await details.getByRole('alert').count(), 0)
          assert.equal(await scanAll('stream:compact'), 1); await keys.locator('.redis-key-list button').click()
          await until(async () => await details.locator('[data-loaded-messages]').textContent() === '2', 'native compact Stream')
          await fixture.admin.del('stream:compact'); await refreshStream.click()
          await details.getByRole('status').filter({ hasText: 'no longer exists or has expired' }).waitFor(); assert.equal(await details.locator('[data-stream-id]').count(), 0)
          await fixture.admin.set('stream:compact', 'changed'); await refreshStream.click()
          await details.getByRole('status').filter({ hasText: 'cannot be viewed as a Stream' }).waitFor(); assert.equal(await details.locator('[data-stream-id]').count(), 0)
          record('native Stream explicit read sees appends; oversized fields refuse without disconnect, empty existing Stream is complete, and deletion/type changes clear messages')
        }
        if (process.env.REDIS_SMOKE_JSON === '1') {
          const buffers = fixture.admin.withTypeMapping({ [RESP_TYPES.BLOB_STRING]: Buffer })
          const dump = await buffers.sendCommand(['DUMP', 'json:records']), expiry = await fixture.admin.sendCommand(['PEXPIRETIME', 'json:records'])
          async function selectJson(name) {
            assert.equal(await scanAll(name), 1); await keys.locator('.redis-key-list button').click()
            const details = keys.locator('section[aria-label="RedisJSON content"]')
            await details.waitFor(); return details
          }
          let details = await selectJson('json:records')
          await details.locator('[data-json-matches]').waitFor()
          assert((await details.innerText()).includes('ReJSON-RL'))
          let pretty = await details.locator('[data-value-preview]').innerText()
          assert(pretty.includes('9007199254740993') && pretty.includes('中文😀'))
          await chooseValueFormat(details, 'text')
          assert.equal(await details.locator('[data-value-preview]').innerText(), fixture.jsonRoot)
          await chooseValueFormat(details, 'base64')
          assert.equal(await details.locator('[data-value-preview]').innerText(), Buffer.from(fixture.jsonRoot).toString('base64'))
          await chooseValueFormat(details, 'hex')
          assert((await details.locator('[data-value-preview]').innerText()).startsWith('00000000  5B'))
          await chooseValueFormat(details, 'json')
          await details.scrollIntoViewIfNeeded(); await page.screenshot({ path: resolve(artifacts, 'native-json-data.png'), fullPage: true })
          record('native RedisJSON routes separately from String, retaining the server root match array, large integer/UTF-8 and exact Text/JSON/Hex/Base64 bytes')
          const readJson = details.getByRole('button', { name: 'Read / refresh', exact: true })
          async function submitPath(path) {
            await details.locator('input[name="jsonPath"]').fill(path); await readJson.click()
            await until(async () => await details.locator('[data-json-path]').textContent() === path, 'native submitted JSONPath result')
          }
          let calls = 0
          const countJsonCalls = request => { if (request.url().endsWith('/api/redisViewer/readJson')) calls++ }
          page.on('request', countJsonCalls)
          await details.locator('input[name="jsonPath"]').fill('$.items[0:3].v')
          assert.equal(calls, 0); assert.equal(await details.locator('[data-json-path]').innerText(), '$'); page.off('request', countJsonCalls)
          await submitPath('$.items[0:3].v')
          assert((await details.locator('[data-json-matches]').innerText()).includes('Matched values: 3'))
          assert.deepEqual(JSON.parse(await details.locator('[data-value-preview]').innerText()), [1, 2, 3])
          await submitPath('$.id'); assert((await details.locator('[data-value-preview]').innerText()).includes('9007199254740993'))
          await details.scrollIntoViewIfNeeded(); await page.screenshot({ path: resolve(artifacts, 'native-json-path.png'), fullPage: true })
          record('native JSONPath drafts do not query; explicit slices return three matches and a narrowed integer path preserves its exact original token')
          await submitPath('$.nil'); assert.equal((await details.locator('[data-value-preview]').innerText()).replace(/\s/gu, ''), '[null]')
          await submitPath('$.empty'); assert.equal((await details.locator('[data-value-preview]').innerText()).replace(/\s/gu, ''), '[[]]')
          await submitPath('$.missing'); await details.getByRole('status').filter({ hasText: 'has no matching value' }).waitFor(); assert.equal(await details.locator('[data-value-preview]').count(), 0)
          await submitPath('$['); await details.getByRole('status').filter({ hasText: 'server rejected this JSONPath' }).waitFor()
          await submitPath('$.id')
          await details.locator('input[name="jsonPath"]').fill('wrong'); await readJson.click()
          await details.getByRole('alert').filter({ hasText: 'Start with $' }).waitFor(); assert.equal(await details.locator('[data-json-path]').innerText(), '$.id')
          assert.deepEqual(await buffers.sendCommand(['DUMP', 'json:records']), dump); assert.equal(await fixture.admin.sendCommand(['PEXPIRETIME', 'json:records']), expiry)
          record('native JSON null/empty/no-match and server/client syntax errors stay distinct, old bytes clear on new results, source bytes and absolute expiry stay unchanged')
          details = await selectJson('json:large')
          await details.getByRole('alert').filter({ hasText: 'No partial JSON' }).waitFor(); assert.equal(await details.locator('[data-value-preview]').count(), 0)
          assert.equal(await pane.locator('.redis-connected').count(), 1)
          await submitPath('$.small'); assert.equal(JSON.parse(await details.locator('[data-value-preview]').innerText())[0], 1)
          assert.equal(await details.getByRole('button', { name: 'Next window', exact: true }).count(), 0)
          record('native oversized JSON root refuses without partial output or fake pagination; a smaller path succeeds on the same connected socket')
          details = await selectJson('json:empty'); await details.locator('[data-json-matches]').waitFor()
          assert.equal((await details.locator('[data-value-preview]').innerText()).replace(/\s/gu, ''), '[[]]')
          details = await selectJson('json:compact'); await details.locator('[data-json-matches]').waitFor()
          await fixture.admin.del('json:compact'); await readJson.click()
          await details.getByRole('status').filter({ hasText: 'no longer exists or has expired' }).waitFor(); assert.equal(await details.locator('[data-value-preview]').count(), 0)
          await fixture.admin.set('json:compact', '{"ordinary":true}'); await readJson.click()
          await details.getByRole('status').filter({ hasText: 'not a supported RedisJSON type' }).waitFor(); assert.equal(await details.locator('[data-value-preview]').count(), 0)
          record('native empty JSON document differs from missing key; deletion and conversion to ordinary String remove old JSON content')
        }
        if (process.env.REDIS_SMOKE_BITMAP === '1') {
          const buffers = fixture.admin.withTypeMapping({ [RESP_TYPES.BLOB_STRING]: Buffer })
          const dump = await buffers.sendCommand(['DUMP', 'bitmap:binary']), expiry = await fixture.admin.sendCommand(['PEXPIRETIME', 'bitmap:binary'])
          async function selectBitmap(name) {
            assert.equal(await scanAll(name), 1); await keys.locator('.redis-key-list button').click()
            await keys.locator('[data-value-coverage]').waitFor()
            assert.equal(await keys.locator('section[aria-label="Bitmap bit window"]').count(), 0)
            await keys.getByRole('button', { name: 'View as Bitmap', exact: true }).click()
            const details = keys.locator('section[aria-label="Bitmap bit window"]'); await details.locator('[data-bitmap-coverage]').waitFor(); return details
          }
          let details = await selectBitmap('bitmap:binary')
          assert.equal(await details.locator('[data-bitmap-count]').innerText(), '256')
          assert.equal(await details.locator('[data-bitmap-bits]').first().innerText(), '10000000000000011010010111111111')
          assert((await details.locator('[data-bitmap-coverage]').innerText()).includes('16777216'))
          await details.scrollIntoViewIfNeeded(); await page.screenshot({ path: resolve(artifacts, 'native-bitmap-data.png'), fullPage: true })
          record('native ordinary binary String stays in String until explicit Bitmap selection; bit-zero is highest-bit-first and the 2 MiB total is exact')
          const readBits = details.getByRole('button', { name: 'Read / refresh', exact: true }), nextBits = details.getByRole('button', { name: 'Next bit window', exact: true })
          await nextBits.click(); await until(async () => await details.locator('[data-bitmap-coverage]').getAttribute('data-bitmap-start') === '256', 'native next bit window')
          let calls = 0
          const countBitCalls = request => { if (request.url().endsWith('/api/redisViewer/readString')) calls++ }
          page.on('request', countBitCalls)
          await details.locator('input[name="bitOffset"]').fill('7'); await details.locator('select[name="bitCount"]').selectOption('4096')
          assert.equal(calls, 0); page.off('request', countBitCalls)
          async function submitBits(offset) {
            await details.locator('input[name="bitOffset"]').fill(offset); await readBits.click()
            await until(async () => await details.locator('[data-bitmap-coverage]').getAttribute('data-bitmap-start') === offset, 'native submitted bit range')
          }
          await submitBits('7'); assert.equal(await details.locator('[data-bitmap-count]').innerText(), '4096')
          assert.equal(await details.locator('[data-bitmap-bits]').count(), 128)
          const actual = (await details.locator('[data-bitmap-bits]').allTextContents()).join('')
          const expected = [...fixture.bitmapBytes.subarray(0, 513)].map(value => value.toString(2).padStart(8, '0')).join('').slice(7, 4103)
          assert.equal(actual, expected)
          await details.scrollIntoViewIfNeeded(); await page.screenshot({ path: resolve(artifacts, 'native-bitmap-range.png'), fullPage: true })
          record('native next interval is exact, draft bit range does not query, and an unaligned 4096-bit window renders 128 bounded rows with correct bits')
          await details.locator('select[name="bitCount"]').selectOption('64'); await submitBits('16777215')
          assert.equal(await details.locator('[data-bitmap-count]').innerText(), '1'); assert.equal(await details.locator('[data-bitmap-bits]').innerText(), '1'); assert.equal(await nextBits.isEnabled(), false)
          await submitBits('16777216'); assert.equal(await details.locator('[data-bitmap-count]').innerText(), '0'); assert.equal(await details.locator('[data-bitmap-bits]').count(), 0)
          await submitBits('9223372036854775807'); assert.equal(await details.locator('[data-bitmap-count]').innerText(), '0')
          await details.locator('input[name="bitOffset"]').fill('-1'); await readBits.click()
          await details.getByRole('alert').filter({ hasText: 'Start bit must be an integer' }).waitFor()
          assert.equal(await details.locator('[data-bitmap-coverage]').getAttribute('data-bitmap-start'), '9223372036854775807')
          assert.deepEqual(await buffers.sendCommand(['DUMP', 'bitmap:binary']), dump); assert.equal(await fixture.admin.sendCommand(['PEXPIRETIME', 'bitmap:binary']), expiry)
          record('native last bit clips, at/past EOF gives no fabricated zero rows, maximum integer offset stays exact, invalid input preserves the prior range and source bytes/expiry remain unchanged')
          await keys.getByRole('button', { name: 'Back to String', exact: true }).click(); await keys.locator('[data-value-coverage]').waitFor()
          assert.equal(await details.count(), 0); await keys.getByRole('button', { name: 'View as Bitmap', exact: true }).click(); await details.locator('[data-bitmap-coverage]').waitFor()
          assert.equal(await details.locator('[data-bitmap-coverage]').getAttribute('data-bitmap-start'), '0')
          details = await selectBitmap('bitmap:empty'); assert.equal(await details.locator('[data-bitmap-count]').innerText(), '0'); assert((await details.innerText()).includes('Total String bits: 0'))
          details = await selectBitmap('bitmap:binary')
          await fixture.admin.del('bitmap:binary'); await readBits.click()
          await details.getByRole('status').filter({ hasText: 'no longer exists or has expired' }).waitFor(); assert.equal(await details.locator('[data-bitmap-bits]').count(), 0)
          await fixture.admin.hSet('bitmap:binary', 'field', 'value'); await readBits.click()
          await details.getByRole('status').filter({ hasText: 'no longer a String' }).waitFor(); assert.equal(await details.locator('[data-bitmap-bits]').count(), 0)
          record('native return to String reads fresh data; empty String, deletion and conversion to Hash do not retain old bitmap rows')
        }
        if (process.env.REDIS_SMOKE_GEO === '1') {
          async function selectGeo(name) {
            assert.equal(await scanAll(name), 1); await keys.locator('.redis-key-list button').click()
            await keys.locator('[data-loaded-zset]').waitFor()
            assert.equal(await keys.locator('section[aria-label="GEO coordinates (ZSet)"]').count(), 0)
            await keys.getByRole('button', { name: 'View coordinates (GEO)', exact: true }).click()
            const details = keys.locator('section[aria-label="GEO coordinates (ZSet)"]'); await details.waitFor(); return details
          }
          let details = await selectGeo('geo:records')
          if (process.env.REDIS_SMOKE_GEO_DISABLED === '1') {
            await details.getByRole('status').filter({ hasText: 'required GEO command is unavailable' }).waitFor()
            assert.equal(await details.locator('[data-geo-member]').count(), 0)
            await keys.getByRole('button', { name: 'Back to ZSet', exact: true }).click()
            await until(async () => await keys.locator('[data-loaded-zset]').textContent() === '100', 'native ZSet works without GEOPOS')
            record('actual fixture disables GEOPOS; native unavailable state contains no old rows and original ZSet remains readable')
          } else {
            await details.locator('[data-geo-start]').waitFor()
            const buffers = fixture.admin.withTypeMapping({ [RESP_TYPES.BLOB_STRING]: Buffer })
            // RESP2 is an independent oracle for exact score/coordinate spelling.
            await fixture.admin.sendCommand(['HELLO', '2'])
            const dump = await buffers.sendCommand(['DUMP', 'geo:records']), expiry = await fixture.admin.sendCommand(['PEXPIRETIME', 'geo:records'])
            const oracle = await buffers.sendCommand(['ZRANGE', 'geo:records', '0', '-1', 'WITHSCORES'])
            const readGeo = details.getByRole('button', { name: 'Read / refresh', exact: true }), nextGeo = details.getByRole('button', { name: 'Next range', exact: true })
            async function submitGeo(offset) {
              await details.locator('input[name="geoOffset"]').fill(offset)
              const response = page.waitForResponse(value => value.url().endsWith('/api/redisViewer/readGeo'))
              await readGeo.click(); await response
              await until(async () => await details.locator('[data-geo-start]').textContent() === offset, 'native submitted GEO range')
            }
            const members = []
            for (const offset of [0, 100, 200]) {
              if (offset !== 0) { await nextGeo.click(); await until(async () => await details.locator('[data-geo-start]').textContent() === String(offset), 'native next GEO range') }
              const actual = await details.locator('[data-geo-member]').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-geo-member')))
              assert.equal(actual.length, offset === 200 ? 35 : 100)
              assert.deepEqual(actual, oracle.filter((_value, index) => index % 2 === 0).slice(offset, offset + 100).map(value => value.toString('base64')))
              members.push(...actual)
              assert.equal(await details.locator('.redis-cell-preview').count(), 0)
            }
            assert.equal(new Set(members).size, 235); assert.equal(await nextGeo.isEnabled(), false)
            const binary = Buffer.from([255, 0]).toString('base64')
            assert.equal(await details.locator('[data-geo-longitude="' + binary + '"]').innerText(), '13.361389338970184')
            assert.equal(await details.locator('[data-geo-latitude="' + binary + '"]').innerText(), '38.1155563954963')
            const binaryIndex = members.indexOf(binary)
            assert.equal(await details.locator('[data-geo-score="' + binary + '"]').innerText(), oracle[binaryIndex * 2 + 1].toString())
            await details.scrollIntoViewIfNeeded(); await page.screenshot({ path: resolve(artifacts, 'native-geo-data.png'), fullPage: true })
            record('native ZSet requires explicit GEO selection; 235 exact member identities retain ascending ranks, score and quantized coordinate text across 100/100/35 intervals')
            await details.locator('[data-geo-member="' + binary + '"]').click()
            assert.equal(await details.locator('textarea[readonly]').inputValue(), binary)
            await chooseValueFormat(details, 'hex'); assert((await details.locator('[data-value-preview]').innerText()).includes('FF 00'))
            const json = '{"id":9007199254740993,"name":"中文😀"}', jsonIdentity = Buffer.from(json).toString('base64')
            await details.locator('[data-geo-member="' + jsonIdentity + '"]').click()
            await chooseValueFormat(details, 'json'); assert((await details.locator('[data-value-preview]').innerText()).includes('9007199254740993'))
            await details.scrollIntoViewIfNeeded(); await page.screenshot({ path: resolve(artifacts, 'native-geo-member.png'), fullPage: true })
            await submitGeo('0'); await details.locator('[data-geo-member=""]').click()
            assert.equal(await details.locator('textarea[readonly]').inputValue(), '')
            const encoded = Buffer.from(json).toString('base64')
            await details.locator('[data-geo-member="' + Buffer.from(encoded).toString('base64') + '"]').click()
            await chooseValueFormat(details, 'decode-json'); assert((await details.locator('[data-value-preview]').innerText()).includes('9007199254740993'))
            record('native binary/empty/JSON/encoded GEO members retain complete byte identity and lossless shared previews')
            let calls = 0
            const countGeo = request => { if (request.url().endsWith('/api/redisViewer/readGeo')) calls++ }
            page.on('request', countGeo)
            await details.locator('input[name="geoOffset"]').fill('235'); await details.locator('select[name="geoCount"]').selectOption('10')
            assert.equal(calls, 0); page.off('request', countGeo)
            await submitGeo('235'); assert.equal(await details.locator('[data-loaded-geo]').innerText(), '0')
            await submitGeo('9223372036854775807'); assert.equal(await details.locator('[data-loaded-geo]').innerText(), '0')
            await details.locator('input[name="geoOffset"]').fill('-1'); await readGeo.click()
            await details.getByRole('alert').filter({ hasText: 'Start rank must be an integer' }).waitFor()
            assert.equal(await details.locator('[data-geo-start]').innerText(), '9223372036854775807')
            await details.locator('select[name="geoCount"]').selectOption('100'); await submitGeo('0')
            record('native GEO range drafts do not query; exact EOF, maximum integer offset and invalid input remain distinct')
            // UI branch fault injection only. Actual equal-cardinality replacement
            // yielding nil GEOPOS was separately proved in the real Redis smoke.
            const geoEndpoint = '**/api/redisViewer/readGeo'
            await page.route(geoEndpoint, async route => {
              const response = await route.fetch(), body = await response.json()
              assert(body.result?.ok && body.result.value.entries.length > 0)
              body.result.value.entries[0].position = null
              await route.fulfill({ response, json: body })
            })
            await submitGeo('0'); await details.getByText('No position returned', { exact: true }).first().waitFor()
            assert.equal(await details.locator('[data-loaded-geo]').innerText(), '100')
            await page.unroute(geoEndpoint); await submitGeo('0')
            record('native nil-position UI branch uses explicit response fault injection; missing position does not classify or discard the entire ZSet')
            await fixture.admin.sendCommand(['ACL', 'SETUSER', 'default', '-geopos'])
            try {
              await readGeo.click(); await details.getByRole('alert').filter({ hasText: 'not allowed to perform' }).waitFor()
              assert.equal(await details.locator('[data-geo-member]').count(), 0)
            } finally { await fixture.admin.sendCommand(['ACL', 'SETUSER', 'default', '+geopos']) }
            await submitGeo('0')
            assert.deepEqual(await buffers.sendCommand(['DUMP', 'geo:records']), dump); assert.equal(await fixture.admin.sendCommand(['PEXPIRETIME', 'geo:records']), expiry)
            await keys.getByRole('button', { name: 'Back to ZSet', exact: true }).click()
            await until(async () => await keys.locator('[data-loaded-zset]').textContent() === '100', 'native return to ZSet refreshes')
            assert.equal(await details.count(), 0)
            record('native GEO permission refusal clears prior rows; manual recovery and return to fresh ZSet succeed without changing source bytes/absolute expiry')
            details = await selectGeo('geo:ordinary'); await details.locator('[data-geo-start]').waitFor()
            assert.equal(await details.locator('[data-loaded-geo]').innerText(), '3'); await withOpenHelp(details, async () => { assert((await details.innerText()).includes('does not prove the business type is GEO')) })
            details = await selectGeo('geo:request-limit')
            await details.getByRole('alert').filter({ hasText: 'Reduce the range count' }).waitFor()
            assert.equal(await details.locator('[data-geo-member]').count(), 0); assert.equal(await pane.locator('.redis-connected').count(), 1)
            await details.locator('select[name="geoCount"]').selectOption('1'); await submitGeo('0')
            assert.equal(await details.locator('[data-loaded-geo]').innerText(), '1')
            assert.equal((await details.locator('[data-geo-member]').getAttribute('data-geo-member')).length, 65536)
            record('native ordinary ZSet scores stay an explicit interpretation; combined request oversize refuses intact identities and reducing count recovers on the same connection')
            details = await selectGeo('geo:compact'); await details.locator('[data-geo-start]').waitFor()
            await fixture.admin.del('geo:compact'); await readGeo.click()
            await details.getByRole('status').filter({ hasText: 'no longer exists or has expired' }).waitFor(); assert.equal(await details.locator('[data-geo-member]').count(), 0)
            await fixture.admin.set('geo:compact', 'ordinary String'); await readGeo.click()
            await details.getByRole('status').filter({ hasText: 'no longer a ZSet' }).waitFor(); assert.equal(await details.locator('[data-geo-member]').count(), 0)
            record('native GEO deletion and conversion to String discard all prior coordinates')
          }
        }
        if (process.env.REDIS_SMOKE_TIMESERIES === '1') {
          const buffers = fixture.admin.withTypeMapping({ [RESP_TYPES.BLOB_STRING]: Buffer })
          const dump = await buffers.sendCommand(['DUMP', 'ts:records']), expiry = await fixture.admin.sendCommand(['PEXPIRETIME', 'ts:records'])
          async function selectSeries(name) {
            assert.equal(await scanAll(name), 1); await keys.locator('.redis-key-list button').click()
            const details = keys.locator('section[aria-label="TimeSeries samples"]'); await details.waitFor()
            await until(async () => await details.getByRole('button', { name: 'Read / refresh', exact: true }).isEnabled(), 'native TimeSeries selection read')
            return details
          }
          let details = await selectSeries('ts:records')
          const refreshSeries = () => details.getByRole('button', { name: 'Read / refresh', exact: true })
          const moreSeries = () => details.getByRole('button', { name: 'Continue reading', exact: true })
          async function readSeries() {
            const response = page.waitForResponse(value => value.url().endsWith('/api/redisViewer/readTimeSeries'))
            await refreshSeries().click(); await response
            await until(async () => await refreshSeries().isEnabled(), 'native TimeSeries refresh completed')
          }
          async function remainingSeries() {
            let pages = 0
            while (await moreSeries().isEnabled()) {
              const response = page.waitForResponse(value => value.url().endsWith('/api/redisViewer/readTimeSeries'))
              await moreSeries().click(); await response
              await until(async () => await refreshSeries().isEnabled(), 'native TimeSeries next completed'); assert(++pages < 250)
            }
            return await details.locator('[data-ts-timestamp]').evaluateAll(nodes => nodes.map(node => node.textContent))
          }
          assert.equal(await details.locator('[data-loaded-samples]').innerText(), '100')
          assert.equal(await readMetadataText(keys, details.locator('[data-ts-total]')), '235')
          const ascending = await remainingSeries()
          assert.deepEqual(ascending, Array.from({ length: 235 }, (_, index) => String(index)))
          await details.locator('select[name="timeseriesDirection"]').selectOption('reverse')
          await until(async () => await details.locator('[data-ts-timestamp]').first().textContent() === '234', 'native reverse TimeSeries first page')
          assert.deepEqual(await remainingSeries(), ascending.toReversed())
          record('native TimeSeries routes from real TSDB-TYPE and loads 235 exact timestamps in both directions across bounded pages; total series count stays separate')
          let calls = 0
          const seriesCalls = request => { if (request.url().endsWith('/api/redisViewer/readTimeSeries')) calls++ }
          page.on('request', seriesCalls)
          await details.locator('input[name="timeseriesStart"]').fill('99'); await details.locator('input[name="timeseriesEnd"]').fill('101'); await details.locator('select[name="timeseriesCount"]').selectOption('1')
          assert.equal(calls, 0); page.off('request', seriesCalls)
          await readSeries(); assert.deepEqual(await remainingSeries(), ['101', '100', '99'])
          await details.locator('input[name="timeseriesStart"]').fill('(99'); await refreshSeries().click()
          await details.getByRole('alert').filter({ hasText: 'Use integer timestamps' }).waitFor(); assert.equal(await details.locator('[data-loaded-samples]').innerText(), '3')
          await details.locator('input[name="timeseriesStart"]').fill('999'); await details.locator('input[name="timeseriesEnd"]').fill('+'); await readSeries()
          await details.getByText('No samples in this range.', { exact: true }).waitFor(); assert.equal(await details.locator('[data-ts-timestamp]').count(), 0)
          record('native TimeSeries drafts do not query; inclusive one-row reverse pages, rejected Stream-exclusive syntax and an empty submitted range remain distinct')
          details = await selectSeries('ts:ids')
          assert.equal(await details.locator('[data-ts-timestamp="9007199254740993"]').innerText(), '9007199254740993')
          assert.equal(await details.locator('[data-ts-timestamp="9223372036854775807"]').innerText(), '9223372036854775807')
          assert.equal(await details.locator('[data-ts-value="9007199254740993"]').innerText(), '1.2345678901234567')
          await details.locator('select[name="timeseriesCount"]').selectOption('1'); await readSeries(); assert.equal((await remainingSeries()).length, 4)
          await details.locator('select[name="timeseriesDirection"]').selectOption('reverse')
          await until(async () => await details.locator('[data-ts-timestamp]').first().textContent() === '9223372036854775807', 'native reverse maximum timestamp')
          assert.deepEqual(await remainingSeries(), ['9223372036854775807', '9007199254740993', '1', '0'])
          await details.scrollIntoViewIfNeeded(); await page.screenshot({ path: resolve(artifacts, 'native-timeseries-data.png'), fullPage: true })
          record('native TimeSeries retains signed-64 maximum and beyond-53-bit timestamp/value text, with exact one-row continuations through zero and no underflow/overflow')
          await fixture.admin.sendCommand(['ACL', 'SETUSER', 'default', '-ts.info'])
          try {
            await readSeries(); await details.locator('[data-ts-info-status="permission"]').waitFor()
            assert.equal(await details.locator('[data-ts-total]').count(), 0); assert.equal(await details.locator('[data-ts-timestamp]').count(), 1)
          } finally { await fixture.admin.sendCommand(['ACL', 'SETUSER', 'default', '+ts.info']) }
          await fixture.admin.sendCommand(['ACL', 'SETUSER', 'default', '-ts.revrange'])
          try {
            await readSeries(); await details.getByRole('alert').filter({ hasText: 'not allowed to perform' }).waitFor(); assert.equal(await details.locator('[data-ts-timestamp]').count(), 0)
          } finally { await fixture.admin.sendCommand(['ACL', 'SETUSER', 'default', '+ts.revrange']) }
          await readSeries(); await readMetadataText(keys, details.locator('[data-ts-total]'))
          record('native actual ACL refusal of TS.INFO keeps samples readable; denied REVRANGE clears old samples and explicit recovery restores metadata')
          // UI-state and codec fault injection, not a claim of an actual missing server module.
          const seriesEndpoint = '**/api/redisViewer/readTimeSeries'
          await page.route(seriesEndpoint, async route => {
            const response = await route.fetch(), body = await response.json(); assert(body.result?.ok)
            Object.assign(body.result.value, { state: 'unavailable', error: null, metadata: null, samples: [], info: null, infoState: null, cursor: null })
            await route.fulfill({ response, json: body })
          })
          await readSeries(); await details.getByRole('status').filter({ hasText: 'required TimeSeries range command is unavailable' }).waitFor(); assert.equal(await details.locator('[data-ts-timestamp]').count(), 0)
          await page.unroute(seriesEndpoint)
          await page.route(seriesEndpoint, async route => {
            const response = await route.fetch(), body = await response.json(); assert(body.result?.ok && body.result.value.samples.length > 0)
            body.result.value.samples[0].timestamp = '9223372036854775808'
            await route.fulfill({ response, json: body })
          })
          await readSeries(); await details.getByRole('alert').filter({ hasText: 'Plugin communication failed' }).waitFor(); assert.equal(await details.locator('[data-ts-timestamp]').count(), 0)
          await page.unroute(seriesEndpoint); await readSeries(); await readMetadataText(keys, details.locator('[data-ts-total]'))
          record('explicit native response fault injection covers unavailable-command UI and strict rejection of overflowing timestamp text; original server remains module-enabled')
          assert.deepEqual(await buffers.sendCommand(['DUMP', 'ts:records']), dump); assert.equal(await fixture.admin.sendCommand(['PEXPIRETIME', 'ts:records']), expiry)
          details = await selectSeries('ts:empty'); await details.getByText('No samples in this range.', { exact: true }).waitFor(); assert.equal(await readMetadataText(keys, details.locator('[data-ts-total]')), '0')
          details = await selectSeries('ts:compact'); await until(async () => await details.locator('[data-loaded-samples]').textContent() === '2', 'native compact TimeSeries')
          await fixture.admin.del('ts:compact'); await readSeries(); await details.getByRole('status').filter({ hasText: 'no longer exists or has expired' }).waitFor(); assert.equal(await details.locator('[data-ts-timestamp]').count(), 0)
          await fixture.admin.set('ts:compact', 'ordinary'); await readSeries(); await details.getByRole('status').filter({ hasText: 'not a TimeSeries for the target version' }).waitFor(); assert.equal(await details.locator('[data-ts-timestamp]').count(), 0)
          record('native TimeSeries preserves source bytes and absolute expiry, distinguishes an empty existing series, and clears rows on deletion/type conversion')
        }
        if (process.env.REDIS_SMOKE_HLL === '1') {
          async function selectHll(name) {
            assert.equal(await scanAll(name), 1); await keys.locator('.redis-key-list button').click()
            await keys.locator('[data-value-coverage]').waitFor()
            assert.equal(await keys.locator('section[aria-label="HyperLogLog estimate"]').count(), 0)
            await keys.getByRole('button', { name: 'View as HyperLogLog', exact: true }).click()
            const details = keys.locator('section[aria-label="HyperLogLog estimate"]'); await details.waitFor(); return details
          }
          let details = await selectHll('hll:records')
          if (process.env.REDIS_SMOKE_HLL_DISABLED === '1') {
            await details.getByRole('status').filter({ hasText: 'required multi-input HLL count is unavailable' }).waitFor()
            assert.equal(await details.locator('[data-hll-estimate]').count(), 0)
            await keys.getByRole('button', { name: 'Back to String', exact: true }).click(); await keys.locator('[data-value-coverage]').waitFor()
            assert.equal(await details.count(), 0)
            record('actual fixture disables PFCOUNT; native HLL unavailable has no estimate and returns to original String without a single-input fallback')
          } else {
            async function refreshHll() {
              const response = page.waitForResponse(value => value.url().endsWith('/api/redisViewer/readHll'))
              await details.getByRole('button', { name: 'Read / refresh', exact: true }).click(); await response
            }
            const buffers = fixture.admin.withTypeMapping({ [RESP_TYPES.BLOB_STRING]: Buffer })
            await details.locator('[data-hll-estimate]').waitFor()
            const raw = await buffers.get('hll:records'), dump = await buffers.sendCommand(['DUMP', 'hll:records']), expiry = await fixture.admin.sendCommand(['PEXPIRETIME', 'hll:records'])
            assert.equal(await details.locator('[data-hll-estimate]').innerText(), String(await fixture.admin.sendCommand(['PFCOUNT', 'hll:records', 'hll:records'])))
            assert.equal(await details.locator('[data-hll-encoding]').innerText(), 'Sparse'); assert.equal(await details.locator('[data-hll-cache]').innerText(), 'Invalid (not written back)')
            await withOpenHelp(details, async () => { assert((await details.innerText()).includes('not an exact count')) })
            await details.locator('[data-hll-estimate]').scrollIntoViewIfNeeded(); await page.screenshot({ path: resolve(artifacts, 'native-hll-data.png'), fullPage: true })
            record('native String remains raw until manual HLL interpretation; sparse count and invalid source cache show explicit approximate/non-enumerable semantics')
            for (const [name, encoding, valid] of [['hll:dense', 'Dense', false], ['hll:cached', 'Sparse', true], ['hll:empty', 'Sparse', false]]) {
              details = await selectHll(name); await details.locator('[data-hll-estimate]').waitFor()
              const original = await buffers.get(name), beforeDump = await buffers.sendCommand(['DUMP', name]), beforeExpiry = await fixture.admin.sendCommand(['PEXPIRETIME', name])
              assert.equal(await details.locator('[data-hll-encoding]').innerText(), encoding); assert.equal(await details.locator('[data-hll-cache]').innerText(), valid ? 'Valid' : 'Invalid (not written back)')
              const expected = String(await fixture.admin.sendCommand(['PFCOUNT', name, name])); assert.equal(await details.locator('[data-hll-estimate]').innerText(), expected)
              await refreshHll(); await details.locator('[data-hll-estimate]').waitFor()
              assert.deepEqual(await buffers.get(name), original); assert.deepEqual(await buffers.sendCommand(['DUMP', name]), beforeDump); assert.equal(await fixture.admin.sendCommand(['PEXPIRETIME', name]), beforeExpiry)
              if (name === 'hll:empty') assert.equal(expected, '0')
            }
            record('native dense/sparse and valid/invalid caches, including zero estimate, refresh without changing source bytes or expiry')
            details = await selectHll('hll:records'); await details.locator('[data-hll-estimate]').waitFor()
            await fixture.admin.sendCommand(['ACL', 'SETUSER', 'default', '-pfcount'])
            try {
              await refreshHll()
              await details.getByRole('alert').filter({ hasText: 'not allowed to perform' }).waitFor(); assert.equal(await details.locator('[data-hll-estimate]').count(), 0)
            } finally { await fixture.admin.sendCommand(['ACL', 'SETUSER', 'default', '+pfcount']) }
            await refreshHll(); await details.locator('[data-hll-estimate]').waitFor()
            assert.deepEqual(await buffers.sendCommand(['DUMP', 'hll:records']), dump); assert.equal(await fixture.admin.sendCommand(['PEXPIRETIME', 'hll:records']), expiry)
            await keys.getByRole('button', { name: 'Back to String', exact: true }).click(); await keys.locator('[data-value-coverage]').waitFor()
            await chooseValueFormat(keys, 'base64'); assert.equal(await keys.locator('[data-value-preview]').innerText(), raw.toString('base64'))
            record('native denied PFCOUNT clears old count, explicit recovery succeeds, and Back to String reads the original complete bytes')
            for (const name of ['hll:plain', 'hll:corrupt']) {
              details = await selectHll(name); await details.getByRole('status').filter({ hasText: 'not a valid HyperLogLog' }).waitFor(); assert.equal(await details.locator('[data-hll-estimate]').count(), 0)
            }
            await details.scrollIntoViewIfNeeded(); await page.screenshot({ path: resolve(artifacts, 'native-hll-invalid.png'), fullPage: true })
            record('native ordinary String and a fake sparse body fail format validation without fabricating a zero count or hiding the raw String entry')
            details = await selectHll('hll:compact'); await details.locator('[data-hll-estimate]').waitFor()
            await fixture.admin.del('hll:compact'); await refreshHll()
            await details.getByRole('status').filter({ hasText: 'no longer exists or has expired' }).waitFor(); assert.equal(await details.locator('[data-hll-estimate]').count(), 0)
            await fixture.admin.hSet('hll:compact', 'field', 'value'); await refreshHll()
            await details.getByRole('status').filter({ hasText: 'no longer a String' }).waitFor(); assert.equal(await details.locator('[data-hll-estimate]').count(), 0)
            record('native HLL deletion and conversion to Hash discard prior count and metadata')
          }
        }
        if (process.env.REDIS_SMOKE_BLOOM === '1') {
          const buffers = fixture.admin.withTypeMapping({ [RESP_TYPES.BLOB_STRING]: Buffer })
          const dump = await buffers.sendCommand(['DUMP', 'bloom:records']), expiry = await fixture.admin.sendCommand(['PEXPIRETIME', 'bloom:records'])
          const existsCount = async () => Number(/cmdstat_bf\.exists:calls=(\d+)/u.exec(await fixture.admin.info('commandstats'))?.[1] ?? 0)
          const before = await existsCount()
          async function selectBloom(name) {
            assert.equal(await scanAll(name), 1); await keys.locator('.redis-key-list button').click()
            const details = keys.locator('section[aria-label="Bloom statistics and membership"]'); await details.waitFor()
            await details.locator('[data-bloom-capacity]').waitFor(); return details
          }
          let details = await selectBloom('bloom:records')
          assert.equal(await existsCount(), before); assert.equal(await details.locator('[data-bloom-membership]').count(), 0)
          let calls = 0
          const bloomCalls = request => { if (request.url().endsWith('/api/redisViewer/readBloom')) calls++ }
          page.on('request', bloomCalls)
          await details.locator('textarea[name="bloomItem"]').fill('present'); await details.locator('select[name="bloomFormat"]').selectOption('base64')
          assert.equal(calls, 0); page.off('request', bloomCalls)
          const queryBloom = async (value, mode = 'text') => {
            await details.locator('select[name="bloomFormat"]').selectOption(mode); await details.locator('textarea[name="bloomItem"]').fill(value)
            const response = page.waitForResponse(item => item.url().endsWith('/api/redisViewer/readBloom'))
            await details.getByRole('button', { name: 'Check possibility', exact: true }).click(); await response
            await until(async () => await details.getByRole('button', { name: 'Check possibility', exact: true }).isEnabled(), 'native Bloom query complete')
          }
          const refreshBloom = async () => {
            const response = page.waitForResponse(item => item.url().endsWith('/api/redisViewer/readBloom'))
            await details.getByRole('button', { name: 'Read / refresh statistics', exact: true }).click(); await response
            await until(async () => await details.getByRole('button', { name: 'Check possibility', exact: true }).isEnabled(), 'native Bloom information complete')
          }
          await queryBloom('present')
          assert.equal(await details.locator('[data-bloom-membership]').getAttribute('data-bloom-membership'), 'maybe-present')
          assert((await details.innerText()).includes('false positives cannot prove'))
          record('native Bloom opens from exact MBbloom-- with information only; input/format drafts cause no RPC or EXISTS, and positive membership uses explicit probability semantics')
          for (const value of ['', '中文😀']) {
            await queryBloom(value); assert.equal(await details.locator('[data-bloom-membership]').getAttribute('data-bloom-membership'), 'maybe-present')
            assert.equal(await details.locator('textarea[readonly]').inputValue(), Buffer.from(value).toString('base64'))
          }
          await queryBloom(Buffer.from([254, 0]).toString('base64'), 'base64')
          assert.equal(await details.locator('textarea[readonly]').inputValue(), Buffer.from([254, 0]).toString('base64'))
          await queryBloom(Buffer.alloc(4096, 255).toString('base64'), 'base64')
          assert.equal(await details.locator('[data-bloom-membership]').getAttribute('data-bloom-membership'), 'maybe-present')
          assert.equal(await details.locator('textarea[readonly]').inputValue(), Buffer.alloc(4096, 255).toString('base64'))
          await details.locator('textarea[name="bloomItem"]').fill(Buffer.alloc(4097).toString('base64'))
          calls = 0; page.on('request', bloomCalls); await details.getByRole('button', { name: 'Check possibility', exact: true }).click()
          await details.getByRole('alert').filter({ hasText: 'Use at most 4 KiB' }).waitFor(); assert.equal(calls, 0); page.off('request', bloomCalls)
          await refreshBloom(); assert.equal(await details.locator('[data-bloom-membership]').count(), 0)
          record('native Bloom checks empty/UTF-8/binary and exact 4 KiB items, echoes canonical raw bytes; oversized input is rejected without network and statistics refresh clears the old verdict')
          details = await selectBloom('bloom:fixed'); assert.equal(await details.locator('[data-bloom-expansion]').innerText(), 'Non-scaling')
          await queryBloom('never-added'); assert.equal(await details.locator('[data-bloom-membership]').getAttribute('data-bloom-membership'), 'absent')
          details = await selectBloom('bloom:probability'); await queryBloom(fixture.bloomFalsePositive)
          assert.equal(await details.locator('[data-bloom-membership]').getAttribute('data-bloom-membership'), 'maybe-present')
          assert.notEqual(fixture.bloomFalsePositive, 'only-added')
          await details.scrollIntoViewIfNeeded(); await page.screenshot({ path: resolve(artifacts, 'native-bloom-probability.png'), fullPage: true })
          assert.equal(await scanAll('bloom:cuckoo'), 1); await keys.locator('.redis-key-list button').click()
          await keys.getByRole('status').filter({ hasText: 'This type cannot be viewed as a String.' }).waitFor()
          assert.equal(await keys.locator('section[aria-label="Bloom statistics and membership"]').count(), 0)
          record('native non-scaling/null expansion and an empty-filter negative differ from a real never-added false positive; Cuckoo remains a distinct unsupported type')
          details = await selectBloom('bloom:records')
          await fixture.admin.sendCommand(['ACL', 'SETUSER', 'default', '-bf.info'])
          try {
            await queryBloom('present'); await details.locator('[data-bloom-info-status="permission"]').waitFor()
            assert.equal(await details.locator('[data-bloom-membership]').getAttribute('data-bloom-membership'), 'maybe-present'); assert.equal(await details.locator('[data-bloom-capacity]').count(), 0)
          } finally { await fixture.admin.sendCommand(['ACL', 'SETUSER', 'default', '+bf.info']) }
          await fixture.admin.sendCommand(['ACL', 'SETUSER', 'default', '-bf.exists'])
          try {
            await queryBloom('present'); await details.getByRole('alert').filter({ hasText: 'not allowed to perform' }).waitFor(); assert.equal(await details.locator('[data-bloom-membership]').count(), 0)
          } finally { await fixture.admin.sendCommand(['ACL', 'SETUSER', 'default', '+bf.exists']) }
          await queryBloom('present'); await details.locator('[data-bloom-capacity]').waitFor()
          record('native actual INFO permission refusal still permits an explicit EXISTS verdict; denied EXISTS clears previous results and explicit recovery succeeds')
          const bloomEndpoint = '**/api/redisViewer/readBloom'
          // Explicit response fault injection, not an actual disabled module.
          await page.route(bloomEndpoint, async route => {
            const response = await route.fetch(), body = await response.json(); assert(body.result?.ok)
            Object.assign(body.result.value, { state: 'unavailable', error: null, metadata: null, info: null, infoState: null, membership: null })
            await route.fulfill({ response, json: body })
          })
          await queryBloom('present'); await details.getByRole('status').filter({ hasText: 'required Bloom query command is unavailable' }).waitFor(); assert.equal(await details.locator('[data-bloom-membership]').count(), 0)
          await page.unroute(bloomEndpoint)
          await page.route(bloomEndpoint, async route => {
            const response = await route.fetch(), body = await response.json(); assert(body.result?.ok)
            body.result.value.membership = 'present'
            await route.fulfill({ response, json: body })
          })
          await queryBloom('present'); await details.getByRole('alert').filter({ hasText: 'Plugin communication failed' }).waitFor(); assert.equal(await details.locator('[data-bloom-membership]').count(), 0)
          await page.unroute(bloomEndpoint); await queryBloom('present'); await details.locator('[data-bloom-membership]').waitFor()
          record('explicit native response fault injection covers unavailable-command UI and rejects a forged certain-present verdict before rendering; the server module remains enabled')
          assert.deepEqual(await buffers.sendCommand(['DUMP', 'bloom:records']), dump); assert.equal(await fixture.admin.sendCommand(['PEXPIRETIME', 'bloom:records']), expiry)
          details = await selectBloom('bloom:compact'); await fixture.admin.del('bloom:compact'); await queryBloom('member')
          await details.getByRole('status').filter({ hasText: 'no longer exists or has expired' }).waitFor(); assert.equal(await details.locator('[data-bloom-membership]').count(), 0)
          await fixture.admin.sendCommand(['CF.RESERVE', 'bloom:compact', '100']); await queryBloom('member')
          await details.getByRole('status').filter({ hasText: 'Cuckoo is outside this first release' }).waitFor(); assert.equal(await details.locator('[data-bloom-membership]').count(), 0)
          record('native Bloom preserves serialized source bytes and absolute expiry; deletion and Cuckoo conversion discard old statistics/verdicts rather than invent a negative')
        }
        if (process.env.REDIS_SMOKE_AUTO_REFRESH === '1') await smokeAutoRefresh({ page, rpc, fixture, pane, keys, scanAll, artifacts, report, workspaceTitle: adopted.workspace.title })
        if (process.env.REDIS_SMOKE_CLIENTS === '1') await smokeClientList({ page, rpc, fixture, pane, artifacts, report, workspaceId: adopted.workspace.workspaceId })
        if (process.env.REDIS_SMOKE_SLOWLOG === '1') await smokeSlowLog({ page, rpc, fixture, pane, artifacts, report, workspaceId: adopted.workspace.workspaceId })
        if (process.env.REDIS_SMOKE_OVERVIEW === '1') await smokeServerOverview({ page, rpc, fixture, pane, keys, scanAll, artifacts, report, workspaceId: adopted.workspace.workspaceId })
        if (process.env.REDIS_SMOKE_FOCUSED === '1') await smokeFocusedValue({ page, fixture, pane, keys, scanAll, artifacts, report })
        if (process.env.REDIS_SMOKE_NAMESPACES === '1') await smokeKeyNamespaces({ page, rpc, fixture, pane, keys, artifacts, report })
        if (process.env.REDIS_SMOKE_SESSIONS === '1') await smokeSessionState({ page, context, origin, rpc, fixture, pane, keys, scanAll, artifacts, report, baseline, workspaceTitle: adopted.workspace.title })
        if (process.env.REDIS_SMOKE_RECOVERY === '1') await smokeNativeRecovery({ page, rpc, fixture, pane, keys, scanAll, artifacts, report, workspaceId: adopted.workspace.workspaceId })
        if (process.env.REDIS_SMOKE_LAYOUT === '1') await smokeSidebarLayout({ page, fixture, pane, keys, scanAll, artifacts, report })
      }
      await pane.getByRole('button', { name: 'Disconnect', exact: true }).click()
      await openConnectionSettings(pane)
      await password.waitFor()
      assert.equal(await password.inputValue(), '')
      await until(async () => await fixture.clients() === baseline, 'native disconnect closed its socket')
      record('native connect, local status refresh, disconnect and password clearing passed')
      await password.fill(fixture.settings.password)
      await pane.getByRole('button', { name: 'Connect', exact: true }).click()
      await pane.locator('.redis-connected').waitFor()
      await until(async () => await fixture.clients() === baseline + 1, 'native reconnect created one socket')
      await fixture.admin.sendCommand(['CLIENT', 'KILL', 'TYPE', 'normal', 'SKIPME', 'yes'])
      await until(async () => await fixture.clients() === baseline, 'server-side close released the viewer socket')
      await pane.getByRole('button', { name: 'Refresh status', exact: true }).click()
      await pane.getByRole('alert').filter({ hasText: 'Cannot connect to Redis.' }).waitFor()
      await openConnectionSettings(pane)
      await password.waitFor()
      assert.equal(await password.inputValue(), '')
      assert.equal(await fixture.clients(), baseline)
      record('native manual refresh exposes server-side disconnect without reconnecting')
      if (profilePhase === 'reopen') {
        await pane.getByRole('button', { name: 'Delete profile', exact: true }).click()
        await until(async () => (await selector.inputValue()) === '', 'owned saved TLS profile deleted')
        const stored = await readFile(storedFile, 'utf8')
        assert(!JSON.parse(stored).profiles.some(value => value.name === renamedName))
        assert(!stored.includes(fixture.settings.password))
        record('owned saved fixture removed after cold-restart verification; no secret on disk')
      }
      assert.deepEqual(pageErrors, [])
    }
    await page.screenshot({ path: resolve(artifacts, fixture === undefined ? 'native-sidebar.png' : artifactPrefix + '.png'), fullPage: true })
    record('real native sidebar guide opened Redis; browser called Host and rendered ready state')
    report.passed = true
    console.log('[smoke] Native sidebar and Host RPC passed')
  } catch (error) {
    report.error = redact(error instanceof Error ? error.message : String(error))
    report.errorStack = redact(error instanceof Error ? (error.stack ?? '').slice(0, 4000) : '')
    if (page) {
      await page.screenshot({ path: resolve(artifacts, artifactPrefix + '-failure.png'), fullPage: true }).catch(() => undefined)
      report.visibleText = (await page.locator('body').innerText().catch(() => '')).slice(0, 6000)
    }
    process.exitCode = 1
    console.error('[smoke] ' + report.error)
  } finally {
    await browser?.close()
    if (child.exitCode === null && child.signalCode === null) {
      const closed = new Promise(resolveClosed => child.once('close', resolveClosed))
      if (process.platform === 'win32') await promisify(execFile)('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true }).catch(() => { child.kill() })
      else child.kill('SIGTERM')
      await closed
    }
    report.processStopped = child.exitCode !== null || child.signalCode !== null
    report.finishedAt = new Date().toISOString()
    await writeFile(resolve(artifacts, artifactPrefix + '-smoke.json'), JSON.stringify(report, null, 2) + '\n')
    await writeFile(resolve(artifacts, artifactPrefix + '-smoke.log'), redact(output))
    console.log('[smoke] Test process stopped: ' + report.processStopped)
  }

  return report
}

if (process.env.REDIS_SMOKE_CONNECTIONS === '1') {
  const reports = []
  const owners = []
  assert(process.env.REDIS_SMOKE_PROFILES !== '1' || process.env.REDIS_SMOKE_TLS === '1', 'Profile smoke requires the TLS fixture')
  try {
    await withRedisFixture(async fixture => {
      owners.push(fixture.metadata.owner)
      if (process.env.REDIS_SMOKE_KEYS === '1') {
        await fixture.admin.select(0)
        for (let index = 0; index < 230; index++) await fixture.admin.set('native:' + index, String(index))
        await fixture.admin.set(Buffer.from([255, 0, 13, 10, 128]), 'binary-key-value')
        await fixture.admin.set('测试:key', 'unicode-key-value')
        await fixture.admin.select(1); await fixture.admin.set('db1:only', 'one'); await fixture.admin.select(0)
        fixture.expectedKeyCount = 232
        if (process.env.REDIS_SMOKE_AUTO_REFRESH === '1') fixture.expectedKeyCount += await prepareAutoRefreshFixture(fixture)
        if (process.env.REDIS_SMOKE_LAYOUT === '1') {
          fixture.layoutLongKey = 'layout:long:' + 'x'.repeat(2048)
          fixture.layoutKeys = [fixture.layoutLongKey, ...['hash', 'list', 'set', 'zset', 'stream', 'json', 'bitmap', 'geo', 'hll', 'ts', 'bloom'].map(name => 'layout:' + name)]
          await fixture.admin.set(fixture.layoutLongKey, Buffer.alloc(131073, 97))
          await fixture.admin.hSet('layout:hash', { first: 'one', second: 'two' })
          await fixture.admin.rPush('layout:list', ['one', 'two']); await fixture.admin.sAdd('layout:set', ['one', 'two'])
          await fixture.admin.sendCommand(['ZADD', 'layout:zset', '1', 'one', '2', 'two'])
          await fixture.admin.sendCommand(['XADD', 'layout:stream', '1-0', 'field', 'value'])
          await fixture.admin.sendCommand(['JSON.SET', 'layout:json', '$', '{"id":9007199254740993,"label":"中文"}'])
          await fixture.admin.set('layout:bitmap', Buffer.from([0x80, 0x01]))
          await fixture.admin.sendCommand(['GEOADD', 'layout:geo', '13.361389', '38.115556', 'one', '14.361389', '39.115556', 'two'])
          await fixture.admin.sendCommand(['PFADD', 'layout:hll', 'one', 'two'])
          await fixture.admin.sendCommand(['TS.ADD', 'layout:ts', '9007199254740993', '1.2345678901234567'])
          await fixture.admin.sendCommand(['TS.ADD', 'layout:ts', '9223372036854775807', '1.7976931348623157e308'])
          await fixture.admin.sendCommand(['BF.ADD', 'layout:bloom', 'one'])
          fixture.expectedKeyCount += fixture.layoutKeys.length
        }
        if (process.env.REDIS_SMOKE_STRINGS === '1') {
          fixture.jsonText = '{"id":9007199254740993,"huge":1e400,"nested":{"label":"中文😀"}}'
          await fixture.admin.set('view:json', fixture.jsonText)
          await fixture.admin.set('view:base64', Buffer.from(fixture.jsonText).toString('base64'))
          await fixture.admin.set('view:invalid', Buffer.from([255, 0]))
          await fixture.admin.set('view:large', Buffer.alloc(131073, 97))
          await fixture.admin.set('view:utf8', 'A' + '😀'.repeat(130) + 'Z')
          await fixture.admin.set('view:empty', '')
          await fixture.admin.hSet('view:hash', 'field', 'value')
          fixture.expectedKeyCount += 7
        }
        if (process.env.REDIS_SMOKE_HASHES === '1') {
          for (let index = 0; index < 230; index++) await fixture.admin.hSet('hash:records', 'item:' + index, 'value:' + index)
          await fixture.admin.hSet('hash:records', Buffer.from([255, 0, 13]), Buffer.from([254, 0]))
          await fixture.admin.hSet('hash:records', '', '')
          const json = '{"id":9007199254740993,"huge":1e400,"label":"中文😀"}'
          await fixture.admin.hSet('hash:records', 'json', json)
          await fixture.admin.hSet('hash:records', 'encoded', Buffer.from(json).toString('base64'))
          await fixture.admin.hSet('hash:records', 'large', Buffer.alloc(131073, 97))
          await fixture.admin.hSet('hash:compact', { one: '1', two: '2', three: '3' })
          fixture.expectedKeyCount += 2
        }
        if (process.env.REDIS_SMOKE_LISTS === '1') {
          const json = '{"id":9007199254740993,"huge":1e400,"label":"中文😀"}'
          await fixture.admin.rPush('list:records', ['same', 'same', Buffer.from([255, 0]), '', json, Buffer.from(json).toString('base64'), Buffer.alloc(131073, 97), ...Array.from({ length: 230 }, (_, index) => 'item:' + index)])
          fixture.expectedKeyCount++
        }
        if (process.env.REDIS_SMOKE_SETS === '1') {
          const json = '{"id":9007199254740993,"huge":1e400,"label":"中文😀"}'
          await fixture.admin.sAdd('set:records', [...Array.from({ length: 230 }, (_, index) => 'item:' + index), Buffer.from([255, 0]), '', json, Buffer.from(json).toString('base64'), 'x'.repeat(1024)])
          await fixture.admin.sAdd('set:compact', ['1', '2', '3'])
          fixture.expectedKeyCount += 2
        }
        if (process.env.REDIS_SMOKE_ZSETS === '1') {
          const json = '{"id":9007199254740993,"huge":1e400,"label":"中文😀"}'
          for (let index = 0; index < 230; index++) await fixture.admin.sendCommand(['ZADD', 'zset:records', String(index), 'item:' + index])
          await fixture.admin.sendCommand(['ZADD', 'zset:records', '-inf', Buffer.from([255, 0]), '0', '', '1.0000000000000002', json, '2.5', Buffer.from(json).toString('base64'), 'inf', 'x'.repeat(1024)])
          await fixture.admin.sendCommand(['ZADD', 'zset:compact', '1', 'one', '2', 'two', '3', 'three'])
          await fixture.admin.sendCommand(['ZADD', 'zset:oversize', '0', Buffer.alloc(65537, 97)])
          fixture.expectedKeyCount += 3
        }
        if (process.env.REDIS_SMOKE_STREAMS === '1') {
          const json = '{"id":9007199254740993,"huge":1e400,"label":"中文😀"}'
          await fixture.admin.sendCommand(['XADD', 'stream:records', '1000-0', Buffer.from([255, 0]), Buffer.from([254, 0]), 'same', 'one', 'same', 'two', '', '', 'json', json, 'encoded', Buffer.from(json).toString('base64'), 'large', Buffer.alloc(131073, 97)])
          for (let index = 1; index < 235; index++) await fixture.admin.sendCommand(['XADD', 'stream:records', '1000-' + index, 'index', String(index)])
          await fixture.admin.sendCommand(['XGROUP', 'CREATE', 'stream:records', 'fixture-group', '0-0'])
          await fixture.admin.sendCommand(['XREADGROUP', 'GROUP', 'fixture-group', 'fixture-consumer', 'COUNT', '1', 'STREAMS', 'stream:records', '>'])
          fixture.streamPending = await fixture.admin.sendCommand(['XPENDING', 'stream:records', 'fixture-group'])
          fixture.streamGroups = await fixture.admin.sendCommand(['XINFO', 'GROUPS', 'stream:records'])
          for (const id of ['1-0', '1-18446744073709551615', '9007199254740993-0', '18446744073709551615-18446744073709551615']) await fixture.admin.sendCommand(['XADD', 'stream:ids', id, 'field', 'value'])
          await fixture.admin.sendCommand(['XADD', 'stream:compact', '1-0', 'field', 'one']); await fixture.admin.sendCommand(['XADD', 'stream:compact', '2-0', 'field', 'two'])
          await fixture.admin.sendCommand(['XADD', 'stream:empty', '1-0', 'field', 'discard']); await fixture.admin.sendCommand(['XTRIM', 'stream:empty', 'MAXLEN', '0'])
          await fixture.admin.sendCommand(['XADD', 'stream:oversize', '1-0', Buffer.alloc(65537, 97), 'value'])
          fixture.expectedKeyCount += 5
        }
        if (process.env.REDIS_SMOKE_JSON === '1') {
          const document = '{"id":9007199254740993,"huge":1e100,"name":"中文😀","nil":null,"empty":[],"items":[{"v":1},{"v":2},{"v":3},{"v":4}]}'
          await fixture.admin.sendCommand(['JSON.SET', 'json:records', '$', document]); await fixture.admin.pExpire('json:records', 300000)
          fixture.jsonRoot = await fixture.admin.sendCommand(['JSON.GET', 'json:records', '$'])
          await fixture.admin.sendCommand(['JSON.SET', 'json:large', '$', JSON.stringify({ small: 1, large: 'x'.repeat(70000) })])
          await fixture.admin.sendCommand(['JSON.SET', 'json:empty', '$', '[]'])
          await fixture.admin.sendCommand(['JSON.SET', 'json:compact', '$', '{"value":1}'])
          const json = (await fixture.admin.sendCommand(['MODULE', 'LIST'])).find(item => item.name === 'ReJSON')
          assert.equal(json?.ver, 80209); fixture.metadata.redisJsonVersion = json.ver
          fixture.expectedKeyCount += 4
        }
        if (process.env.REDIS_SMOKE_BITMAP === '1') {
          fixture.bitmapBytes = Buffer.alloc(2 * 1024 * 1024, 0xa5); fixture.bitmapBytes.set([0x80, 0x01, 0xa5, 0xff])
          await fixture.admin.set('bitmap:binary', fixture.bitmapBytes); await fixture.admin.pExpire('bitmap:binary', 300000)
          await fixture.admin.set('bitmap:empty', '')
          fixture.expectedKeyCount += 2
        }
        if (process.env.REDIS_SMOKE_GEO === '1') {
          const json = '{"id":9007199254740993,"name":"中文😀"}'
          const members = ['', Buffer.from(json).toString('base64'), ...Array.from({ length: 231 }, (_, index) => 'place-' + String(index).padStart(3, '0')), json, Buffer.from([255, 0])]
          for (const member of members) await fixture.admin.sendCommand(['GEOADD', 'geo:records', '13.361389', '38.115556', member])
          await fixture.admin.pExpire('geo:records', 300000)
          await fixture.admin.sendCommand(['GEOADD', 'geo:compact', '13', '38', 'one', '14', '39', 'two'])
          await fixture.admin.sendCommand(['GEOADD', 'geo:request-limit', '13', '38', Buffer.alloc(49152, 97), '14', '39', Buffer.alloc(49152, 98)])
          await fixture.admin.sendCommand(['ZADD', 'geo:ordinary', '-1', 'negative', '0', 'zero', '1.5', 'fraction'])
          fixture.expectedKeyCount += 4
          if (process.env.REDIS_SMOKE_GEO_DISABLED === '1') {
            await assert.rejects(fixture.admin.sendCommand(['GEOPOS', 'geo:records', 'place-000']), /ERR unknown command/iu)
            fixture.metadata.geoposDisabled = true
          }
        }
        if (process.env.REDIS_SMOKE_HLL === '1') {
          for (const [name, count] of [['hll:records', 100], ['hll:dense', 10000]]) {
            for (let index = 0; index < count; index += 500) await fixture.admin.sendCommand(['PFADD', name, ...Array.from({ length: Math.min(500, count - index) }, (_, offset) => 'member-' + (index + offset))])
            await fixture.admin.pExpire(name, 300000)
          }
          const buffers = fixture.admin.withTypeMapping({ [RESP_TYPES.BLOB_STRING]: Buffer }), raw = await buffers.get('hll:records')
          await fixture.admin.set('hll:cached', raw); await fixture.admin.pExpire('hll:cached', 300000)
          await fixture.admin.set('hll:compact', raw); await fixture.admin.sendCommand(['PFADD', 'hll:empty'])
          const corrupt = Buffer.alloc(17); corrupt.write('HYLL'); corrupt[4] = 1; corrupt[15] = 128
          await fixture.admin.set('hll:corrupt', corrupt); await fixture.admin.set('hll:plain', 'ordinary String')
          if (process.env.REDIS_SMOKE_HLL_DISABLED === '1') {
            await assert.rejects(fixture.admin.sendCommand(['PFCOUNT', 'hll:records', 'hll:records']), /ERR unknown command/iu)
            fixture.metadata.pfcountDisabled = true
          } else await fixture.admin.sendCommand(['PFCOUNT', 'hll:cached'])
          fixture.expectedKeyCount += 7
        }
        if (process.env.REDIS_SMOKE_TIMESERIES === '1') {
          for (let index = 0; index < 235; index++) await fixture.admin.sendCommand(['TS.ADD', 'ts:records', String(index), String(index / 10)])
          await fixture.admin.pExpire('ts:records', 300000)
          for (const stamp of ['0', '1', '9007199254740993', '9223372036854775807']) await fixture.admin.sendCommand(['TS.ADD', 'ts:ids', stamp, '1.2345678901234567'])
          await fixture.admin.sendCommand(['TS.CREATE', 'ts:empty'])
          await fixture.admin.sendCommand(['TS.ADD', 'ts:compact', '1', '2']); await fixture.admin.sendCommand(['TS.ADD', 'ts:compact', '2', '3'])
          const module = (await fixture.admin.sendCommand(['MODULE', 'LIST'])).find(item => item.name === 'timeseries')
          assert.equal(module?.ver, 80210); fixture.metadata.timeSeriesVersion = module.ver
          fixture.expectedKeyCount += 4
        }
        if (process.env.REDIS_SMOKE_BLOOM === '1') {
          for (const value of ['present', '', '中文😀', Buffer.from([254, 0]), Buffer.alloc(4096, 255)]) await fixture.admin.sendCommand(['BF.ADD', 'bloom:records', value])
          await fixture.admin.pExpire('bloom:records', 300000)
          await fixture.admin.sendCommand(['BF.RESERVE', 'bloom:fixed', '0.01', '10', 'NONSCALING'])
          await fixture.admin.sendCommand(['BF.RESERVE', 'bloom:probability', '0.9', '1']); await fixture.admin.sendCommand(['BF.ADD', 'bloom:probability', 'only-added'])
          const candidates = Array.from({ length: 1000 }, (_, index) => 'never-added-' + index), flags = await fixture.admin.sendCommand(['BF.MEXISTS', 'bloom:probability', ...candidates])
          fixture.bloomFalsePositive = candidates[flags.indexOf(true)]; assert(fixture.bloomFalsePositive)
          await fixture.admin.sendCommand(['CF.RESERVE', 'bloom:cuckoo', '100'])
          await fixture.admin.sendCommand(['BF.ADD', 'bloom:compact', 'member'])
          const module = (await fixture.admin.sendCommand(['MODULE', 'LIST'])).find(item => item.name === 'bf')
          assert.equal(module?.ver, 80212); fixture.metadata.bloomVersion = module.ver
          fixture.expectedKeyCount += 5
        }
      }
      const transfer = process.env.REDIS_SMOKE_PROFILE_TRANSFER === '1'
      assert(!transfer || process.env.REDIS_SMOKE_PROFILES !== '1', 'Run the separate profile transfer and TLS profile gates independently')
      const phases = transfer || process.env.REDIS_SMOKE_PROFILES === '1' ? ['save', 'reopen'] : [undefined]
      for (const phase of phases) {
        // Only this acceptance mode owns a bounded TCP delay proxy. The real
        // fixture/admin and outer shutdown assertions stay unchanged.
        const proxy = process.env.REDIS_SMOKE_RECOVERY === '1' || process.env.REDIS_SMOKE_NAMESPACES === '1' || process.env.REDIS_SMOKE_FOCUSED === '1' || process.env.REDIS_SMOKE_OVERVIEW === '1' || process.env.REDIS_SMOKE_SLOWLOG === '1' || process.env.REDIS_SMOKE_CLIENTS === '1' || process.env.REDIS_SMOKE_AUTO_REFRESH === '1' ? await createReadDelayProxy(fixture.settings) : undefined
        let report
        try { report = await smoke(proxy === undefined ? fixture : { ...fixture, settings: proxy.settings, directSettings: fixture.settings, recoveryProxy: proxy }, transfer ? undefined : phase, transfer ? phase : undefined) }
        finally { await proxy?.close() }
        if (proxy !== undefined) report.recoveryProxyStopped = proxy.connections.every(value => value.closed)
        report.fixtures = [fixture.metadata]
        reports.push(report)
        assert(report.processStopped, 'Own DSH process must be stopped')
        await until(async () => await fixture.clients() === 1, 'all native Host sockets released')
        report.checks.push('native Host shutdown released all viewer sockets')
        if (!report.passed) break
      }
    }, { tls: process.env.REDIS_SMOKE_TLS === '1', disableGeoPos: process.env.REDIS_SMOKE_GEO_DISABLED === '1', disableHllCount: process.env.REDIS_SMOKE_HLL_DISABLED === '1' })
  } finally {
    if ((process.env.REDIS_SMOKE_PROFILES === '1' || process.env.REDIS_SMOKE_SESSIONS === '1' || process.env.REDIS_SMOKE_PROFILE_TRANSFER === '1') && reports.every(report => report.processStopped)) {
      const store = new RedisProfiles(resolve(import.meta.dirname, '../.scratch/runtime/dsh-home/profiles/web'))
      const stored = await store.list(new AbortController().signal)
      const ownedNames = new Set(owners.flatMap(owner => ['TLS fixture ' + owner, 'Renamed TLS fixture ' + owner, 'Plain fixture ' + owner, 'Sessions ' + owner, ...(process.env.REDIS_SMOKE_PROFILE_TRANSFER === '1' ? Object.values(transferProfileNames(owner)) : [])]))
      for (const profile of stored.profiles) if (ownedNames.has(profile.name)) await store.remove({ id: profile.id }, new AbortController().signal)
    }
    for (const report of reports) {
      report.fixturesStopped = report.fixtures.every(value => value.stopped && value.certificatesRemoved)
      if (!report.fixturesStopped) { report.passed = false; process.exitCode = 1 }
      report.finishedAt = new Date().toISOString()
      await writeFile(resolve(import.meta.dirname, '../.scratch/artifacts/' + report.artifactPrefix + '-smoke.json'), JSON.stringify(report, null, 2) + '\n')
      console.log(JSON.stringify({ phase: report.profilePhase, passed: report.passed, checks: report.checks.length, fixturesStopped: report.fixturesStopped }))
    }
  }
} else await smoke()
