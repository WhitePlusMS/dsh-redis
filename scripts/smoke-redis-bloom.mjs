/** Actual production Bloom reads on an exclusive owned module fixture. */
import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'
import { RESP_TYPES } from 'redis'
import { RedisConnections, openRedis } from '../lib/host/connection-service.js'
import { RedisBloom } from '../lib/host/bloom-reader.js'
import { until, withRedisFixture } from './redis-fixture.mjs'

const report = { startedAt: new Date().toISOString(), checks: [], fixtures: [], passed: false }
const signal = () => new AbortController().signal
const target = view => { assert(view.id !== null); return { id: view.id, generation: view.generation, db: view.db } }
try {
  await withRedisFixture(async ({ settings, admin, clients, metadata }) => {
    report.fixtures.push(metadata)
    const module = (await admin.sendCommand(['MODULE', 'LIST'])).find(item => item.name === 'bf')
    assert.equal(module?.ver, 80212); metadata.bloomVersion = module.ver
    await admin.sendCommand(['HELLO', '2'])
    const key = Buffer.from([255, 0, 13]), item = Buffer.from([254, 0]), maximumItem = Buffer.alloc(4096, 255), maximumKey = Buffer.alloc(65536, 97)
    await admin.sendCommand(['BF.ADD', key, item]); await admin.sendCommand(['BF.ADD', key, '']); await admin.pExpire(key, 300000)
    await admin.sendCommand(['BF.ADD', '', 'empty-key-item'])
    await admin.sendCommand(['BF.ADD', maximumKey, maximumItem])
    await admin.sendCommand(['BF.RESERVE', 'fixed', '0.01', '10', 'NONSCALING'])
    await admin.sendCommand(['CF.RESERVE', 'cuckoo', '100'])
    await admin.sendCommand(['BF.RESERVE', 'probability', '0.9', '1']); await admin.sendCommand(['BF.ADD', 'probability', 'only-added'])
    const candidates = Array.from({ length: 1000 }, (_, index) => 'never-added-' + index)
    const flags = await admin.sendCommand(['BF.MEXISTS', 'probability', ...candidates]), falsePositive = candidates[flags.indexOf(1)]
    assert(falsePositive); report.falsePositiveFixtureItem = falsePositive
    const buffers = admin.withTypeMapping({ [RESP_TYPES.BLOB_STRING]: Buffer })
    const dump = await buffers.sendCommand(['DUMP', key]), expiry = await admin.sendCommand(['PEXPIRETIME', key])
    const stats = async () => {
      const map = new Map([...(await admin.info('commandstats')).matchAll(/^cmdstat_([^:]+):calls=(\d+)/gmu)].map(match => [match[1], Number(match[2])]))
      return Object.fromEntries(['bf.add', 'bf.madd', 'bf.reserve', 'bf.insert', 'bf.loadchunk', 'cf.add', 'cf.reserve', 'set', 'del', 'pexpire'].map(command => [command, map.get(command) ?? 0]))
    }
    const before = await stats(), baseline = await clients(), calls = []
    const connections = new RedisConnections(async (...args) => {
      const link = await openRedis(...args)
      return { ...link, execute: async (command, argv, ...rest) => { calls.push({ command, args: argv }); return link.execute(command, argv, ...rest) } }
    }), reader = new RedisBloom(connections)
    let view = await connections.connect('a', settings, signal())
    const request = (name, value = null) => ({ target: target(view), keyBase64: (Buffer.isBuffer(name) ? name : Buffer.from(name)).toString('base64'), itemBase64: value === null ? null : (Buffer.isBuffer(value) ? value : Buffer.from(value)).toString('base64') })
    try {
      const information = await reader.read('a', request(key), signal())
      assert.equal(information.state, 'value'); assert.equal(information.infoState, 'available'); assert.equal(information.info.inserted, '2'); assert.equal(information.membership, null)
      assert.equal(calls.filter(call => call.command === 'BF.EXISTS').length, 0)
      for (const value of [item, '']) {
        const result = await reader.read('a', request(key, value), signal())
        assert.equal(result.membership, 'maybe-present'); assert.equal(result.itemBase64, (Buffer.isBuffer(value) ? value : Buffer.from(value)).toString('base64'))
      }
      assert.deepEqual(calls.filter(call => call.command === 'BF.EXISTS').map(call => call.args), [[key, item], [key, Buffer.alloc(0)]])
      const emptyKey = await reader.read('a', request('', 'empty-key-item'), signal()); assert.equal(emptyKey.membership, 'maybe-present')
      const maximum = await reader.read('a', request(maximumKey, maximumItem), signal())
      assert.equal(maximum.membership, 'maybe-present'); assert.equal(maximum.itemBase64, maximumItem.toString('base64'))
      report.checks.push('information-only read never queries membership; actual binary/empty keys and items plus complete 64 KiB key/4 KiB item keep exact identities in fixed single-item EXISTS')
      const fixed = await reader.read('a', request('fixed', 'never-added'), signal())
      assert.equal(fixed.info.expansion, null); assert.equal(fixed.info.inserted, '0'); assert.equal(fixed.membership, 'absent')
      const positive = await reader.read('a', request('probability', falsePositive), signal())
      assert.equal(positive.membership, 'maybe-present'); assert.notEqual(falsePositive, 'only-added')
      assert.equal((await reader.read('a', request('cuckoo', 'x'), signal())).state, 'unsupported')
      assert.equal((await reader.read('a', request('missing', 'x'), signal())).state, 'missing')
      assert.equal(calls.filter(call => call.command.startsWith('BF.') && call.args[0].equals(Buffer.from('cuckoo'))).length, 0)
      report.checks.push('actual non-scaling empty filter is negative with null expansion; a known never-inserted false positive stays only maybe-present; Cuckoo is never queried as Bloom and missing is distinct')
      assert.deepEqual(await stats(), before); assert.deepEqual(await buffers.sendCommand(['DUMP', key]), dump); assert.equal(await admin.sendCommand(['PEXPIRETIME', key]), expiry)
      assert(calls.every(call => ['TYPE', 'PTTL', 'BF.INFO', 'BF.EXISTS'].includes(call.command)))
      report.checks.push('serialized source filter, absolute expiry and monitored data-write counters remain unchanged; production transport issues only the four fixed read commands')
      await admin.sendCommand(['ACL', 'SETUSER', 'bloom-reader', 'reset', 'on', '>' + settings.password, '~*', '+ping', '+type', '+pttl', '+bf.exists'])
      const limitedView = await connections.connect('limited', { ...settings, username: 'bloom-reader' }, signal()), limited = { ...request(key, item), target: target(limitedView) }
      const noInfo = await reader.read('limited', limited, signal()); assert.equal(noInfo.infoState, 'permission'); assert.equal(noInfo.membership, 'maybe-present')
      await admin.sendCommand(['ACL', 'SETUSER', 'bloom-reader', '+bf.info'])
      assert.equal((await reader.read('limited', limited, signal())).infoState, 'available')
      await admin.sendCommand(['ACL', 'SETUSER', 'bloom-reader', '-bf.exists'])
      assert.equal((await reader.read('limited', limited, signal())).error, 'permission')
      assert.equal((await reader.read('limited', { ...limited, itemBase64: null }, signal())).infoState, 'available')
      assert.match(await admin.sendCommand(['ACL', 'DRYRUN', 'bloom-reader', 'BF.ADD', key, 'forbidden']), /permission/iu)
      report.checks.push('minimal read ACL checks items without INFO permission; INFO grant restores statistics, EXISTS refusal gives no verdict while stats stay readable, and BF.ADD remains forbidden')
      const old = request(key, item); view = await connections.selectDatabase('a', { ...target(view), db: 1 }, signal())
      assert.equal((await reader.read('a', old, signal())).error, 'stale'); assert.equal((await reader.read('a', request(key, item), signal())).state, 'missing')
      view = await connections.selectDatabase('a', { ...target(view), db: 0 }, signal())
      report.checks.push('actual DB generation change rejects old Bloom queries and isolates DB1')
      let observedZeroRaces = 0
      for (const stage of ['TYPE', 'BF.INFO', 'BF.EXISTS']) for (const mode of ['missing', 'type']) {
        await admin.del('race'); await admin.sendCommand(['BF.ADD', 'race', 'member'])
        let changed = false
        const race = new RedisConnections(async (...args) => {
          const link = await openRedis(...args)
          return { ...link, execute: async (command, argv, ...rest) => {
            const reply = await link.execute(command, argv, ...rest)
            if (command === 'BF.EXISTS' && stage === 'BF.INFO' && reply === 0n) observedZeroRaces++
            if (!changed && command === stage) { changed = true; await admin.del('race'); if (mode === 'type') await admin.sendCommand(['CF.RESERVE', 'race', '100']) }
            return reply
          } }
        })
        try {
          const connected = await race.connect('race', settings, signal())
          const result = await new RedisBloom(race).read('race', { ...request('race', 'member'), target: target(connected) }, signal())
          assert.equal(result.state, mode === 'missing' ? 'missing' : 'changed'); assert.equal(result.membership, null)
        } finally { race.dispose() }
      }
      assert.equal(observedZeroRaces, 2)
      report.checks.push('actual deletion/Cuckoo conversion after TYPE, INFO or EXISTS discards verdicts; two real raw EXISTS zeros caused by missing/wrong type are never shown as negative membership')
    } finally { connections.dispose(); await until(async () => await clients() === baseline, 'all Bloom sockets released') }
  })
  report.passed = true
} catch (error) { report.error = error.stack; process.exitCode = 1 }
finally {
  report.finishedAt = new Date().toISOString()
  await writeFile(new URL('../.scratch/artifacts/bloom-smoke.json', import.meta.url), JSON.stringify(report, null, 2) + '\n')
  console.log(JSON.stringify({ passed: report.passed, checks: report.checks.length, error: report.error ?? null, fixturesStopped: report.fixtures.every(f => f.stopped && f.fixtureRemoved && f.certificatesRemoved) }))
}
