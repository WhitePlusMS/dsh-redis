/** SELECT/SCAN acceptance uses only an ownership-labelled disposable Redis. */
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { RESP_TYPES } from 'redis'
import { RedisConnections } from '../lib/host/connection-service.js'
import { RedisKeys } from '../lib/host/key-reader.js'
import { until, withRedisFixture } from './redis-fixture.mjs'

const report = { startedAt: new Date().toISOString(), checks: [], fixtures: [], passed: false }
const signal = () => new AbortController().signal
const target = view => { assert(view.id !== null); return { id: view.id, generation: view.generation, db: view.db } }
try {
  await withRedisFixture(async ({ settings, admin, clients, metadata }) => {
    report.fixtures.push(metadata)
    const binary = Buffer.from([255, 0, 13, 10, 128])
    await admin.select(0)
    for (let index = 0; index < 350; index++) await admin.set('db0:' + index, String(index))
    await admin.set(binary, Buffer.from([0, 255, 10])); await admin.set('', 'empty-key')
    await admin.pExpire(binary, 120_000)
    const buffers = admin.withTypeMapping({ [RESP_TYPES.BLOB_STRING]: Buffer })
    const dumpBefore = await buffers.sendCommand(['DUMP', binary])
    const expiryBefore = await admin.sendCommand(['PEXPIRETIME', binary])
    await admin.select(1); await admin.set('db1:only', 'one'); await admin.select(0)
    const baseline = await clients(), connections = new RedisConnections(), keys = new RedisKeys(connections)
    try {
      let a = await connections.connect('a', settings, signal())
      const b = await connections.connect('b', settings, signal())
      assert.equal(a.state, 'connected'); assert.equal(b.db, 0)
      const names = new Set(); let cursor = null, pages = 0
      do {
        const page = await keys.scan('a', { target: target(a), pattern: '*', cursor }, signal())
        assert.equal(page.state, 'page'); pages++
        for (const key of page.keys) names.add(key.base64)
        cursor = page.cursor; assert(pages < 100)
      } while (cursor !== null)
      assert.equal(names.size, 352); assert(names.has(binary.toString('base64'))); assert(names.has(''))
      report.pages = pages
      report.checks.push('real incremental SCAN returns all 352 fixture keys, including binary and empty identities')
      a = await connections.selectDatabase('a', { ...target(a), db: 1 }, signal())
      assert.equal(a.db, 1)
      const firstDb = await keys.scan('a', { target: target(a), pattern: '*', cursor: null }, signal())
      assert.deepEqual(firstDb.keys.map(key => Buffer.from(key.base64, 'base64').toString()), ['db1:only'])
      const secondSession = await keys.scan('b', { target: target(b), pattern: 'db0:*', cursor: null }, signal())
      assert.equal(secondSession.state, 'page'); assert(secondSession.keys.length > 0)
      assert(secondSession.keys.every(key => Buffer.from(key.base64, 'base64').toString().startsWith('db0:')))
      const old = await keys.scan('a', { target: target(b), pattern: '*', cursor: null }, signal())
      assert.equal(old.error, 'stale')
      report.checks.push('SELECT affects only its trusted session; other session stays in DB0 and stale targets fail')
      const invalid = await connections.selectDatabase('a', { ...target(a), db: 65535 }, signal())
      assert.equal(invalid.error, 'database'); assert.equal(invalid.db, 1); assert.equal(invalid.state, 'connected'); a = invalid
      const missing = await keys.scan('a', { target: target(a), pattern: 'nothing-matches-*', cursor: null }, signal())
      assert.equal(missing.state, 'page'); assert.deepEqual(missing.keys, [])
      report.checks.push('out-of-range SELECT keeps prior DB; unmatched pattern is an explicit empty result')
      await admin.sendCommand(['ACL', 'SETUSER', 'scan-only', 'reset', 'on', '>' + settings.password, '~*', '+ping', '+select', '+scan'])
      assert.match(await admin.sendCommand(['ACL', 'DRYRUN', 'scan-only', 'CONFIG', 'GET', 'databases']), /no permissions/u)
      assert.match(await admin.sendCommand(['ACL', 'DRYRUN', 'scan-only', 'INFO']), /no permissions/u)
      let restricted = await connections.connect('restricted', { ...settings, username: 'scan-only' }, signal())
      restricted = await connections.selectDatabase('restricted', { ...target(restricted), db: 1 }, signal())
      assert.equal((await keys.scan('restricted', { target: target(restricted), pattern: '*', cursor: null }, signal())).keys.length, 1)
      report.checks.push('manual DB browsing works with SCAN/SELECT but no CONFIG/INFO permission')
      await admin.sendCommand(['ACL', 'SETUSER', 'no-select', 'reset', 'on', '>' + settings.password, '~*', '+ping', '+scan'])
      let noSelect = await connections.connect('no-select', { ...settings, username: 'no-select' }, signal())
      noSelect = await connections.selectDatabase('no-select', { ...target(noSelect), db: 1 }, signal())
      assert.equal(noSelect.error, 'permission'); assert.equal(noSelect.db, 0)
      assert.equal((await keys.scan('no-select', { target: target(noSelect), pattern: 'db0:*', cursor: null }, signal())).state, 'page')
      await admin.sendCommand(['ACL', 'SETUSER', 'no-scan', 'reset', 'on', '>' + settings.password, '~*', '+ping'])
      const noScan = await connections.connect('no-scan', { ...settings, username: 'no-scan' }, signal())
      assert.equal((await keys.scan('no-scan', { target: target(noScan), pattern: '*', cursor: null }, signal())).error, 'permission')
      report.checks.push('SELECT/SCAN ACL refusals are permission errors, never missing keys or silently empty DBs')
      assert.deepEqual(await buffers.sendCommand(['DUMP', binary]), dumpBefore)
      assert.equal(await admin.sendCommand(['PEXPIRETIME', binary]), expiryBefore)
      assert.equal(await admin.dbSize(), 352)
      report.checks.push('fixture raw bytes, absolute expiration and DB size unchanged after viewer reads')
      a = await connections.selectDatabase('a', { ...target(a), db: 0 }, signal())
      await admin.set(Buffer.alloc(65537, 97), 'oversized-name')
      const largeName = await keys.scan('a', { target: target(a), pattern: 'aaa*', cursor: null }, signal())
      // MATCH can initially be empty; continue explicitly until the oversized name appears.
      let largePage = largeName, rounds = 0
      while (largePage.state === 'page' && largePage.cursor !== null) {
        largePage = await keys.scan('a', { target: target(a), pattern: 'aaa*', cursor: largePage.cursor }, signal()); assert(++rounds < 100)
      }
      assert.equal(largePage.error, 'oversize'); assert.equal(connections.status('a').state, 'connected')
      report.checks.push('real oversized key identity is refused without advancing a partial cursor or closing a healthy socket')
      await admin.set(Buffer.alloc(1024 * 1024 + 1, 98), 'wire-oversize')
      let wire = await keys.scan('a', { target: target(a), pattern: 'bbb*', cursor: null }, signal()); rounds = 0
      while (wire.state === 'page' && wire.cursor !== null) {
        wire = await keys.scan('a', { target: target(a), pattern: 'bbb*', cursor: wire.cursor }, signal()); assert(++rounds < 100)
      }
      assert.equal(wire.error, 'oversize'); assert.equal(connections.status('a').state, 'error')
      report.checks.push('real reply beyond receive budget closes only its owned socket before allocating the bulk')
    } finally { keys.dispose(); connections.dispose() }
    await until(async () => await clients() === baseline, 'all key-viewer sockets released')
  })
  assert(report.fixtures.every(value => value.stopped)); report.passed = true
} catch (error) { report.error = (error instanceof Error ? error.message : String(error)).replace(/(--requirepass\s+)\S+/gu, '$1[redacted]'); process.exitCode = 1; console.error(report.error) }
finally {
  report.finishedAt = new Date().toISOString()
  const directory = resolve(import.meta.dirname, '../.scratch/artifacts'); await mkdir(directory, { recursive: true })
  await writeFile(resolve(directory, 'keys-smoke.json'), JSON.stringify(report, null, 2) + '\n')
  console.log(JSON.stringify({ passed: report.passed, checks: report.checks.length, fixturesStopped: report.fixtures.every(value => value.stopped) }))
}
