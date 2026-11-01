import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { build } from 'esbuild'
import { mkdir, mkdtemp, readFile, readdir, realpath, rm, writeFile } from 'node:fs/promises'
import { basename, dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { RedisMatchPresets } from '../src/host/match-preset-store.ts'

const runtime = resolve(import.meta.dirname, '../.scratch/runtime')
const signal = () => new AbortController().signal
let directory: string

beforeEach(async () => { await mkdir(runtime, { recursive: true }); directory = await mkdtemp(join(runtime, 'match-presets-test-')) })
afterEach(async () => {
  const actual = await realpath(directory)
  if (dirname(actual) !== await realpath(runtime) || !basename(actual).startsWith('match-presets-test-')) throw new Error('Refusing cleanup outside the owned test directory')
  await rm(actual, { recursive: true })
})

function worker(moduleUrl: string, profile: string, name: string, pattern: string) {
  const code = `
    const { RedisMatchPresets, MatchPresetError } = await import(process.argv[1])
    const store = new RedisMatchPresets(process.argv[2]), name = process.argv[3], pattern = process.argv[4]
    process.stdout.write('READY\\n')
    process.stdin.once('data', async () => {
      try { const result = await store.save({ name, pattern }, new AbortController().signal); process.stdout.write(JSON.stringify({ result: 'saved', name: result.name, pattern: result.pattern }) + '\\n') }
      catch (error) { process.stdout.write(JSON.stringify({ result: error instanceof MatchPresetError ? error.code : 'unexpected' }) + '\\n') }
      process.stdin.pause()
    })
  `
  const child = spawn(process.execPath, ['--input-type=module', '-e', code, moduleUrl, profile, name, pattern], { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true })
  let output = '', readyResolve!: () => void, readyReject!: (error: Error) => void
  const ready = new Promise<void>((resolve, reject) => { readyResolve = resolve; readyReject = reject })
  child.stdout.setEncoding('utf8')
  child.stdout.on('data', (chunk: string) => { output += chunk; if (output.includes('READY\n')) readyResolve() })
  const done = new Promise<{ readonly result: string; readonly name?: string; readonly pattern?: string }>((resolve, reject) => {
    child.once('error', error => { readyReject(error); reject(error) })
    child.once('close', code => {
      if (code !== 0) { const error = new Error(`Synthetic preset worker failed (${code})`); readyReject(error); reject(error); return }
      try { resolve(JSON.parse(output.trim().split('\n').at(-1) ?? '') as { readonly result: string; readonly name?: string; readonly pattern?: string }) } catch (error) { reject(error) }
    })
  })
  void done.catch(() => undefined)
  return { ready, done, start: () => child.stdin.end('go\n'), stop: () => { if (child.exitCode === null) child.kill() } }
}

describe('profile-scoped MATCH preset storage', () => {
  it('stores only the name, identity and exact pattern in its own profile', async () => {
    const store = new RedisMatchPresets(directory)
    expect(await store.list(null, signal())).toEqual({ presets: [], nextCursor: null, snapshot: false })
    expect(await readdir(directory)).toEqual([])
    const saved = await store.save({ name: '测试筛选', pattern: 'order:??[0-9]*' }, signal())
    expect(await store.get(saved.id, signal())).toEqual(saved)
    expect((await store.list(null, signal())).presets).toEqual([saved])
    expect(await new RedisMatchPresets(join(directory, 'other-profile')).get(saved.id, signal())).toBeNull()
    const files = await readdir(join(directory, 'data/dsh-redis/match-preset-slots'))
    expect(files).toHaveLength(1); expect(files[0]).toMatch(/^\d{3}\.json$/u)
    expect(JSON.parse(await readFile(join(directory, 'data/dsh-redis/match-preset-slots', files[0]!), 'utf8'))).toEqual(saved)
  })

  it('never replaces an existing normalized name and keeps the original bytes', async () => {
    const store = new RedisMatchPresets(directory)
    const saved = await store.save({ name: 'Café', pattern: 'first:*' }, signal())
    await expect(store.save({ name: 'Cafe\u0301', pattern: 'second:*' }, signal())).rejects.toMatchObject({ code: 'conflict' })
    expect(await store.get(saved.id, signal())).toEqual(saved)
    expect(await readdir(join(directory, 'data/dsh-redis/match-preset-slots'))).toHaveLength(1)
  })

  it('uses deterministic bounded pages and does not claim a snapshot', async () => {
    const store = new RedisMatchPresets(directory)
    await Promise.all(Array.from({ length: 23 }, (_, index) => store.save({ name: `Preset ${index}`, pattern: `key:${index}:*` }, signal())))
    const first = await store.list(null, signal()), second = await store.list(first.nextCursor, signal()), third = await store.list(second.nextCursor, signal())
    expect(first.presets).toHaveLength(10); expect(second.presets).toHaveLength(10); expect(third.presets).toHaveLength(3)
    expect(first.snapshot).toBe(false); expect(third.nextCursor).toBeNull()
    const ids = [...first.presets, ...second.presets, ...third.presets].map(value => value.id)
    expect(new Set(ids).size).toBe(23)
  })

  it('rejects unsupported fields, invalid names and path-like identifiers without writing', async () => {
    const store = new RedisMatchPresets(directory), withPath = { name: 'Safe', pattern: '*', path: 'outside' }, withSecret = { name: 'Safe', pattern: '*', password: 'synthetic-secret' }
    for (const value of [withPath, withSecret, { name: '../escape', pattern: '*' }, { name: '', pattern: '*' }, { name: ' valid ', pattern: '*' }, { name: 'X', pattern: 'a'.repeat(257) }, { name: '\ud800', pattern: '*' }]) await expect(store.save(value, signal())).rejects.toMatchObject({ code: 'invalid' })
    await expect(store.get('../outside', signal())).rejects.toMatchObject({ code: 'invalid' })
    await expect(store.list('../outside', signal())).rejects.toMatchObject({ code: 'invalid' })
    expect(await readdir(directory)).toEqual([])
  })

  it('fails closed for corrupt and oversized files without modifying them', async () => {
    const store = new RedisMatchPresets(directory), saved = await store.save({ name: 'Broken', pattern: '*' }, signal())
    const slots = join(directory, 'data/dsh-redis/match-preset-slots'), path = join(slots, (await readdir(slots))[0]!)
    for (const content of ['invalid JSON', JSON.stringify({ ...saved, password: 'synthetic-secret' }), 'x'.repeat(8193)]) {
      await writeFile(path, content, 'utf8')
      await expect(store.get(saved.id, signal())).rejects.toMatchObject({ code: 'storage' })
      await expect(store.list(null, signal())).rejects.toMatchObject({ code: 'storage' })
      expect(await readFile(path, 'utf8')).toBe(content)
    }
    const invalidUtf8 = Buffer.concat([Buffer.from(`{"id":"${saved.id}","name":"Broken","pattern":"`), Buffer.from([0xff]), Buffer.from('"}')])
    await writeFile(path, invalidUtf8)
    await expect(store.get(saved.id, signal())).rejects.toMatchObject({ code: 'storage' })
    await expect(store.list(null, signal())).rejects.toMatchObject({ code: 'storage' })
    expect(await readFile(path)).toEqual(invalidUtf8)
  })

  it('rejects duplicate identities across pages for lookup, listing and saving without changing files', async () => {
    const slots = join(directory, 'data/dsh-redis/match-preset-slots')
    await mkdir(slots, { recursive: true })
    const record = (name: string, pattern: string) => ({ id: createHash('sha256').update(name).digest('hex'), name, pattern })
    const duplicate = record('Copied preset', 'original:*')
    const records = Array.from({ length: 11 }, (_, index) => record(`Page fixture ${index}`, `fixture:${index}:*`))
    const files = [...records.map((value, index) => ({ slot: index, value })), { slot: 12, value: duplicate }, { slot: 200, value: { ...duplicate, pattern: 'copied:*' } }]
    await Promise.all(files.map(({ slot, value }) => writeFile(join(slots, `${String(slot).padStart(3, '0')}.json`), JSON.stringify(value), 'utf8')))
    const store = new RedisMatchPresets(directory)
    await expect(store.get(duplicate.id, signal())).rejects.toMatchObject({ code: 'storage' })
    await expect(store.get(records[0]!.id, signal())).rejects.toMatchObject({ code: 'storage' })
    await expect(store.list(null, signal())).rejects.toMatchObject({ code: 'storage' })
    await expect(store.list('100', signal())).rejects.toMatchObject({ code: 'storage' })
    await expect(store.save({ name: 'New preset', pattern: '*' }, signal())).rejects.toMatchObject({ code: 'storage' })
    for (const { slot, value } of files) expect(JSON.parse(await readFile(join(slots, `${String(slot).padStart(3, '0')}.json`), 'utf8'))).toEqual(value)
    expect(await readdir(slots)).toHaveLength(files.length)
  })

  it('does not create anything when already cancelled', async () => {
    const controller = new AbortController(); controller.abort()
    await expect(new RedisMatchPresets(directory).save({ name: 'Cancelled', pattern: '*' }, controller.signal)).rejects.toMatchObject({ code: 'cancelled' })
    expect(await readdir(directory)).toEqual([])
  })

  it('observes cancellation after starting a lookup or an empty directory listing', async () => {
    const store = new RedisMatchPresets(directory), empty = join(directory, 'data/dsh-redis/match-preset-slots')
    await mkdir(empty, { recursive: true })
    const listing = new AbortController(), pendingList = store.list(null, listing.signal)
    listing.abort()
    await expect(pendingList).rejects.toMatchObject({ code: 'cancelled' })
    const lookup = new AbortController(), pendingGet = store.get('a'.repeat(64), lookup.signal)
    lookup.abort()
    await expect(pendingGet).rejects.toMatchObject({ code: 'cancelled' })
    const missing = new RedisMatchPresets(join(directory, 'missing-profile')), missingSignal = new AbortController(), pendingMissing = missing.list(null, missingSignal.signal)
    missingSignal.abort()
    await expect(pendingMissing).rejects.toMatchObject({ code: 'cancelled' })
  })

  it('preserves one complete winner across simultaneous independent Windows processes', async () => {
    const built = await build({ entryPoints: [resolve(import.meta.dirname, '../src/host/match-preset-store.ts')], bundle: true, platform: 'node', format: 'esm', write: false })
    const modulePath = join(directory, 'fixture-store.mjs')
    await writeFile(modulePath, built.outputFiles[0]!.text, 'utf8')
    const workers = Array.from({ length: 8 }, (_, index) => worker(pathToFileURL(modulePath).href, directory, 'Concurrent preset', `synthetic-${index}:*`))
    try {
      await Promise.all(workers.map(value => value.ready))
      for (const value of workers) value.start()
      const results = await Promise.all(workers.map(value => value.done))
      const winners = results.filter(value => value.result === 'saved')
      expect(winners).toHaveLength(1)
      expect(results.filter(value => value.result === 'conflict')).toHaveLength(7)
      const page = await new RedisMatchPresets(directory).list(null, signal())
      expect(page.presets).toHaveLength(1); expect(page.presets[0]?.pattern).toBe(winners[0]?.pattern)
      const files = await readdir(join(directory, 'data/dsh-redis/match-preset-slots'))
      expect(files).toHaveLength(1); expect(files[0]).toMatch(/^\d{3}\.json$/u)
    } finally { for (const value of workers) value.stop() }
  }, 30000)

  it('preserves two differently named presets when their starting slots collide across processes', async () => {
    const seen = new Map<string, string>()
    let first = '', second = ''
    for (let index = 0; index < 1000; index++) {
      const name = `Collision ${index}`, slot = createHash('sha256').update(name).digest('hex').slice(0, 2), prior = seen.get(slot)
      if (prior !== undefined) { first = prior; second = name; break }
      seen.set(slot, name)
    }
    if (first === '' || second === '') throw new Error('Could not generate collision fixture')
    const built = await build({ entryPoints: [resolve(import.meta.dirname, '../src/host/match-preset-store.ts')], bundle: true, platform: 'node', format: 'esm', write: false })
    const modulePath = join(directory, 'fixture-store.mjs'); await writeFile(modulePath, built.outputFiles[0]!.text, 'utf8')
    const workers = Array.from({ length: 8 }, (_, index) => worker(pathToFileURL(modulePath).href, directory, index % 2 === 0 ? first : second, `synthetic-${index}:*`))
    try {
      await Promise.all(workers.map(value => value.ready)); for (const value of workers) value.start()
      const results = await Promise.all(workers.map(value => value.done)), winners = results.filter(value => value.result === 'saved')
      expect(winners).toHaveLength(2); expect(results.filter(value => value.result === 'conflict')).toHaveLength(6)
      expect(new Set(winners.map(value => value.name))).toEqual(new Set([first, second]))
      const saved = (await new RedisMatchPresets(directory).list(null, signal())).presets
      expect(saved).toHaveLength(2)
      for (const winner of winners) expect(saved.find(value => value.name === winner.name)?.pattern).toBe(winner.pattern)
    } finally { for (const value of workers) value.stop() }
  }, 30000)

  it('reports full at 256 occupied slots without changing any existing preset', async () => {
    const slots = join(directory, 'data/dsh-redis/match-preset-slots')
    await mkdir(slots, { recursive: true })
    const records = Array.from({ length: 256 }, (_, index) => { const name = `Existing ${index}`; return { id: createHash('sha256').update(name).digest('hex'), name, pattern: `fixture:${index}:*` } })
    await Promise.all(records.map((value, index) => writeFile(join(slots, `${String(index).padStart(3, '0')}.json`), JSON.stringify(value) + '\n', 'utf8')))
    const store = new RedisMatchPresets(directory)
    await expect(store.save({ name: 'Overflow', pattern: 'extra:*' }, signal())).rejects.toMatchObject({ code: 'full' })
    const found = []
    let cursor: string | null = null
    do { const page = await store.list(cursor, signal()); found.push(...page.presets); cursor = page.nextCursor } while (cursor !== null)
    expect(found).toEqual(records)
    expect(await readdir(slots)).toHaveLength(256)
  }, 30000)
})
