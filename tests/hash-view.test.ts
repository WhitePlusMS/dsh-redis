import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RedisConnections, type RedisLink } from '../src/host/connection-service.ts'
import { RedisHashes } from '../src/host/hash-reader.ts'
import { RedisReplyError, type RedisReply } from '../src/host/resp.ts'
import type { HashEntry, ScanHashRequest } from '../src/domain.ts'
import { appendHashEntries, emptyHashCache } from '../src/client/hash-cache.ts'
import { scanHashRequestSchema, scanHashResultSchema } from '../src/typert.shared.ts'
import { redisHostDescriptors } from '../src/typert.host.ts'

const signal = () => new AbortController().signal
const settings = { host: 'localhost', port: 6379, username: '', password: '', tls: null }
const binaryKey = Buffer.from([255, 0, 13]), binaryField = Buffer.from([254, 0, 10])
const page = (cursor: string, ...pairs: Buffer[]): RedisReply => [Buffer.from(cursor), pairs]
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done }); return { promise, resolve } }
beforeEach(() => { vi.spyOn(console, 'info').mockImplementation(() => undefined) })
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })

async function setup(scanReply: RedisReply = page('0', binaryField, Buffer.from('hello'))) {
  const state = { type: 'hash', length: 1n, ttl: -1n }
  const commands: { command: string; args: readonly (string | Buffer)[]; deadline: number | undefined }[] = []
  const scan = vi.fn<RedisLink['execute']>().mockResolvedValue(scanReply)
  const execute: RedisLink['execute'] = async (command, args, requestSignal, guard, deadline) => {
    guard(); commands.push({ command, args, deadline })
    if (command === 'SELECT') return 'OK'
    expect(args[0]).toEqual(binaryKey)
    if (command === 'TYPE') return state.type
    if (command === 'PTTL') return state.ttl
    if (command === 'HLEN') return state.length
    if (command === 'HSCAN') return scan(command, args, requestSignal, guard, deadline)
    throw new Error('Unexpected or non-read command')
  }
  const connections = new RedisConnections(async () => ({ close: () => undefined, execute, onFailure: () => () => undefined }))
  const view = await connections.connect('a', settings, signal())
  if (view.id === null) throw new Error('No fixture connection')
  const request: ScanHashRequest = { target: { id: view.id, generation: view.generation, db: 0 }, keyBase64: binaryKey.toString('base64'), pattern: '*', cursor: null }
  const reader = new RedisHashes(connections)
  return { connections, reader, request, commands, state, scan, dispose: () => { reader.dispose(); connections.dispose() } }
}

describe('bounded Hash scans', () => {
  it('uses exact binary key/field/value bytes and one metadata-to-value deadline', async () => {
    const fixture = await setup(page('0', binaryField, Buffer.from([0, 255]), Buffer.alloc(0), Buffer.alloc(0)))
    fixture.state.length = 2n; fixture.state.ttl = 9007199254740993n
    try {
      const result = await fixture.reader.scan('a', fixture.request, signal())
      expect(result).toMatchObject({ state: 'page', metadata: { type: 'hash', ttlMs: '9007199254740993', length: '2' }, cursor: null })
      expect(result.entries.map(row => row.field.base64)).toEqual([binaryField.toString('base64'), ''])
      expect(Buffer.from(result.entries[0]?.value.base64 ?? '', 'base64')).toEqual(Buffer.from([0, 255]))
      expect(result.entries[1]?.value).toEqual({ base64: '', byteLength: 0, fullByteLength: 0, suffix: '' })
      expect(fixture.commands.map(value => value.command)).toEqual(['TYPE', 'PTTL', 'HLEN', 'HSCAN', 'TYPE', 'HLEN', 'PTTL'])
      expect(fixture.scan.mock.calls[0]?.[1]).toEqual([binaryKey, '0', 'MATCH', '*', 'COUNT', '100'])
      expect(new Set(fixture.commands.map(value => value.deadline)).size).toBe(1)
    } finally { fixture.dispose() }
  })
  it('keeps uint64 cursors opaque, accepts empty nonterminal pages and deduplicates pairs', async () => {
    const fixture = await setup()
    fixture.scan.mockResolvedValueOnce(page('18446744073709551615')).mockResolvedValueOnce(page('0', binaryField, Buffer.from('old'), binaryField, Buffer.from('new')))
    try {
      const first = await fixture.reader.scan('a', fixture.request, signal())
      expect(first.entries).toEqual([]); expect(first.cursor).not.toBeNull()
      const next = await fixture.reader.scan('a', { ...fixture.request, cursor: first.cursor }, signal())
      expect(next.entries).toHaveLength(1); expect(next.entries[0]?.value.base64).toBe(Buffer.from('new').toString('base64'))
      expect(fixture.scan.mock.calls[1]?.[1][1]).toBe('18446744073709551615')
      expect((await fixture.reader.scan('a', { ...fixture.request, cursor: first.cursor }, signal())).error).toBe('stale')
    } finally { fixture.dispose() }
  })
  it('refuses moving tokens across pattern/key/session/DB/generation without consuming the valid continuation', async () => {
    const fixture = await setup(page('7'))
    try {
      const first = await fixture.reader.scan('a', fixture.request, signal()), request = { ...fixture.request, cursor: first.cursor }
      for (const invalid of [{ ...request, pattern: 'other:*' }, { ...request, keyBase64: '' }, { ...request, target: { ...request.target, db: 1 } }, { ...request, target: { ...request.target, generation: request.target.generation + 1 } }]) {
        expect((await fixture.reader.scan('a', invalid, signal())).error).toBe('stale')
      }
      expect((await fixture.reader.scan('b', request, signal())).error).toBe('stale')
      expect((await fixture.reader.scan('a', { ...request, cursor: null, target: { ...request.target, db: 1 } }, signal())).error).toBe('stale')
      expect((await fixture.reader.scan('a', request, signal())).state).toBe('page')
      expect(fixture.scan).toHaveBeenCalledTimes(2)
    } finally { fixture.dispose() }
  })
  it('rejects a late page after refresh and prevents replay of an in-flight token', async () => {
    const fixture = await setup(page('7')), delayed = deferred<RedisReply>()
    try {
      const first = await fixture.reader.scan('a', fixture.request, signal())
      fixture.scan.mockReturnValueOnce(delayed.promise)
      const pending = fixture.reader.scan('a', { ...fixture.request, cursor: first.cursor }, signal())
      await vi.waitFor(() => expect(fixture.scan).toHaveBeenCalledTimes(2))
      expect((await fixture.reader.scan('a', { ...fixture.request, cursor: first.cursor }, signal())).error).toBe('stale')
      expect((await fixture.reader.scan('a', fixture.request, signal())).state).toBe('page')
      delayed.resolve(page('0', binaryField, Buffer.from('late')))
      expect((await pending).error).toBe('stale')
    } finally { fixture.dispose() }
  })
  it('sends at most 64 KiB plus boundary context, reports the true value length and refuses huge fields', async () => {
    const value = Buffer.concat([Buffer.alloc(65535, 97), Buffer.from('中😀'), Buffer.alloc(32, 98)])
    const fixture = await setup(page('0', binaryField, value))
    try {
      const result = await fixture.reader.scan('a', fixture.request, signal()), preview = result.entries[0]?.value
      expect(preview).toMatchObject({ byteLength: 65536, fullByteLength: value.length })
      expect(Buffer.from(preview?.base64 ?? '', 'base64')).toEqual(value.subarray(0, 65536))
      expect(Buffer.from(preview?.suffix ?? '', 'base64')).toEqual(value.subarray(65536, 65539))
      fixture.scan.mockResolvedValue(page('0', Buffer.alloc(65537), Buffer.from('value')))
      expect((await fixture.reader.scan('a', fixture.request, signal())).error).toBe('oversize')
    } finally { fixture.dispose() }
  })
  it('rejects an amplified JSON page entirely and invalidates its continuation', async () => {
    const fixture = await setup(page('9')), pairs: Buffer[] = []
    // Six pairs fit below the RESP frame cap but exceed the JSON/Base64 cap.
    for (let index = 0; index < 6; index++) pairs.push(Buffer.alloc(65536, index), Buffer.alloc(65536, 97))
    fixture.state.length = 6n
    try {
      const first = await fixture.reader.scan('a', fixture.request, signal())
      fixture.scan.mockResolvedValue(page('7', ...pairs))
      const failed = await fixture.reader.scan('a', { ...fixture.request, cursor: first.cursor }, signal())
      expect(failed).toMatchObject({ state: 'failed', error: 'oversize', entries: [], cursor: null })
      expect((await fixture.reader.scan('a', { ...fixture.request, cursor: first.cursor }, signal())).error).toBe('stale')
    } finally { fixture.dispose() }
  })
  it('distinguishes missing, expired and unsupported keys without HSCAN', async () => {
    const fixture = await setup()
    try {
      fixture.state.type = 'none'; expect((await fixture.reader.scan('a', fixture.request, signal())).state).toBe('missing')
      fixture.state.type = 'hash'; fixture.state.ttl = -2n; expect((await fixture.reader.scan('a', fixture.request, signal())).state).toBe('missing')
      fixture.state.type = 'string'; fixture.state.ttl = -1n
      expect(await fixture.reader.scan('a', fixture.request, signal())).toMatchObject({ state: 'unsupported', metadata: { type: 'string', length: null }, entries: [] })
      expect(fixture.scan).not.toHaveBeenCalled()
    } finally { fixture.dispose() }
  })
  it('discards values if the key disappears or changes type/count between replies', async () => {
    for (const mutation of ['missing', 'type', 'length']) {
      const fixture = await setup()
      fixture.scan.mockImplementation(async () => {
        if (mutation === 'missing') fixture.state.type = 'none'
        else if (mutation === 'type') fixture.state.type = 'string'
        else fixture.state.length = 2n
        return page('0', binaryField, Buffer.from('old'))
      })
      try { expect(await fixture.reader.scan('a', fixture.request, signal())).toMatchObject({ state: mutation === 'missing' ? 'missing' : 'changed', entries: [], cursor: null }) }
      finally { fixture.dispose() }
    }
  })
  it('does not silently drop odd pairs, accept non-bulk cells, or coerce invalid cursors', async () => {
    const fixture = await setup()
    try {
      for (const reply of [page('0', binaryField), [Buffer.from('0'), [binaryField, 1n]], page('18446744073709551616'), page('01'), [Buffer.from([0xb0]), []]]) {
        fixture.scan.mockResolvedValue(reply)
        expect(await fixture.reader.scan('a', fixture.request, signal())).toMatchObject({ error: 'protocol', entries: [], cursor: null })
      }
    } finally { fixture.dispose() }
  })
  it('reports permission and WRONGTYPE without leaking raw errors or retaining data', async () => {
    const fixture = await setup()
    try {
      fixture.scan.mockRejectedValueOnce(new RedisReplyError('NOPERM private field or credential'))
      const denied = await fixture.reader.scan('a', fixture.request, signal())
      expect(denied).toMatchObject({ error: 'permission', entries: [] }); expect(JSON.stringify(denied)).not.toContain('private')
      fixture.scan.mockRejectedValueOnce(new RedisReplyError('WRONGTYPE fixture'))
      expect(await fixture.reader.scan('a', fixture.request, signal())).toMatchObject({ state: 'changed', error: null, entries: [] })
    } finally { fixture.dispose() }
  })
  it('does not dispatch cancelled requests and uses a single ten-second operation deadline', async () => {
    const fixture = await setup(), controller = new AbortController()
    try {
      controller.abort(); expect((await fixture.reader.scan('a', fixture.request, controller.signal)).error).toBe('cancelled')
      expect(fixture.commands).toEqual([])
      vi.useFakeTimers()
      fixture.scan.mockImplementation(async (_command, _args, requestSignal) => new Promise((_resolve, reject) => { requestSignal.addEventListener('abort', () => reject(new Error('cancelled')), { once: true }) }))
      const pending = fixture.reader.scan('a', fixture.request, signal())
      await vi.advanceTimersByTimeAsync(10001)
      expect(await pending).toMatchObject({ error: 'timeout', entries: [], cursor: null })
    } finally { fixture.dispose() }
  })
  it('discards the active continuation after explicit cancellation and permits a fresh scan', async () => {
    const fixture = await setup(page('7')), controller = new AbortController()
    try {
      const first = await fixture.reader.scan('a', fixture.request, signal())
      fixture.scan.mockImplementationOnce(async (_command, _args, requestSignal) => new Promise((_resolve, reject) => { requestSignal.addEventListener('abort', () => reject(new Error('cancelled')), { once: true }) }))
      const pending = fixture.reader.scan('a', { ...fixture.request, cursor: first.cursor }, controller.signal)
      await vi.waitFor(() => expect(fixture.scan).toHaveBeenCalledTimes(2))
      controller.abort()
      expect(await pending).toMatchObject({ error: 'cancelled', entries: [], cursor: null })
      expect((await fixture.reader.scan('a', { ...fixture.request, cursor: first.cursor }, signal())).error).toBe('stale')
      expect((await fixture.reader.scan('a', fixture.request, signal())).state).toBe('page')
    } finally { fixture.dispose() }
  })
  it('removes disposed session tokens without affecting a new reader scan', async () => {
    const fixture = await setup(page('7'))
    try {
      const first = await fixture.reader.scan('a', fixture.request, signal())
      fixture.reader.disposeSession('a')
      expect((await fixture.reader.scan('a', { ...fixture.request, cursor: first.cursor }, signal())).error).toBe('stale')
      expect((await fixture.reader.scan('a', fixture.request, signal())).state).toBe('page')
    } finally { fixture.dispose() }
  })
})

describe('Hash UI cache and strict protocol', () => {
  const entry = (field: string, size = 1): HashEntry => ({ field: { base64: Buffer.from(field).toString('base64'), byteLength: Buffer.byteLength(field), label: field }, value: { base64: Buffer.alloc(size, 97).toString('base64'), byteLength: size, fullByteLength: size, suffix: '' } })
  it('replaces duplicate field values by raw identity and budgets both replacement bytes and rows', () => {
    const first = appendHashEntries(emptyHashCache(), [entry('a')]), second = appendHashEntries(first, [entry('a', 10), entry('b')])
    expect(second.rows).toHaveLength(2); expect(second.rows[0]?.value.byteLength).toBe(10)
    expect(second.bytes).toBe(second.rows.reduce((sum, row) => sum + Buffer.byteLength(JSON.stringify(row)), 0))
    expect(appendHashEntries(emptyHashCache(), Array.from({ length: 5001 }, (_, index) => entry(String(index)))).rows).toHaveLength(5000)
    const limited = appendHashEntries(emptyHashCache(), Array.from({ length: 30 }, (_, index) => entry(String(index), 65536)))
    expect(limited.limited).toBe(true); expect(limited.bytes).toBeLessThanOrEqual(2 * 1024 * 1024)
  })
  it('rejects forged identity/owner/cursor inputs on Host and Client faces', () => {
    const descriptor = redisHostDescriptors.find(value => value.method === 'scanHash'), codec = descriptor?.parameters.find(value => value.name === 'request')?.codec
    if (codec?.mode !== 'strict') throw new Error('Missing Hash request codec')
    const request = { target: { id: 'id', generation: 1, db: 0 }, keyBase64: '', pattern: '*', cursor: null }
    for (const schema of [codec.create(), scanHashRequestSchema]) {
      expect(schema.parse(request)).toEqual(request)
      for (const invalid of [{ ...request, keyBase64: 'AA' }, { ...request, command: 'HSET' }, { ...request, agentId: 'other' }, { ...request, pattern: 'x'.repeat(257) }, { ...request, cursor: '7' }, { ...request, target: { ...request.target, db: 1.5 } }]) expect(() => schema.parse(invalid)).toThrow()
    }
  })
  it('enforces prefix length, total size, metadata, state and whole-page budgets on both response faces', () => {
    const codec = redisHostDescriptors.find(value => value.method === 'scanHash')?.result
    if (codec?.mode !== 'strict') throw new Error('Missing Hash result codec')
    const row = entry('a'), valid = { state: 'page', error: null, metadata: { type: 'hash', ttlMs: '-1', length: '1' }, entries: [row], cursor: null, sampledAt: new Date().toISOString() }
    for (const schema of [codec.create(), scanHashResultSchema]) {
      expect(schema.parse(valid)).toEqual(valid)
      for (const invalid of [{ ...valid, metadata: null }, { ...valid, entries: [row, row] }, { ...valid, state: 'failed' }, { ...valid, entries: [{ ...row, value: { ...row.value, fullByteLength: 2 } }] }, { ...valid, entries: [{ ...row, field: { ...row.field, byteLength: 2 } }] }, { ...valid, entries: [{ ...row, value: { ...row.value, suffix: 'YQ==' } }] }, { ...valid, metadata: { ...valid.metadata, ttlMs: '-2' } }]) expect(() => schema.parse(invalid)).toThrow()
      const huge = Array.from({ length: 20 }, (_, index) => entry(String(index), 65536))
      expect(() => schema.parse({ ...valid, metadata: { ...valid.metadata, length: '20' }, entries: huge })).toThrow()
    }
  })
})
