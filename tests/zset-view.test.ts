import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RedisConnections, type RedisLink } from '../src/host/connection-service.ts'
import { RedisZSets } from '../src/host/zset-reader.ts'
import { RedisReplyError } from '../src/host/resp.ts'
import type { ZSetReadRequest } from '../src/domain.ts'
import { zsetReadRequestSchema, zsetReadResultSchema } from '../src/typert.shared.ts'
import { redisHostDescriptors } from '../src/typert.host.ts'
import { appendZSetRows, emptyZSetCache } from '../src/client/zset-cache.ts'
import { isRedisScore } from '../src/redis-score.ts'

const signal = () => new AbortController().signal
const settings = { host: 'localhost', port: 6379, username: '', password: '', tls: null }
const key = Buffer.from([255, 0, 13]), binary = Buffer.from([254, 0])
const identity = (bytes: Buffer) => ({ base64: bytes.toString('base64'), byteLength: bytes.length, label: 'display' })
beforeEach(() => { vi.spyOn(console, 'info').mockImplementation(() => undefined) })
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })

async function setup(rows: readonly [Buffer, Buffer][] = [[Buffer.alloc(0), Buffer.from('-inf')], [binary, Buffer.from('-0')], [Buffer.from('third'), Buffer.from('1.0000000000000002')], [Buffer.from('last'), Buffer.from('inf')]]) {
  const state = { type: 'zset', ttl: -1n, length: BigInt(rows.length) }
  const calls: { command: string; args: readonly (string | Buffer)[]; deadline: number | undefined }[] = []
  const range = vi.fn<RedisLink['execute']>().mockImplementation(async (_command, args) => {
    const start = BigInt(String(args[1])), end = BigInt(String(args[2])) + 1n
    return rows.slice(Number(start > BigInt(rows.length) ? BigInt(rows.length) : start), Number(end > BigInt(rows.length) ? BigInt(rows.length) : end)).flat()
  })
  const scan = vi.fn<RedisLink['execute']>().mockResolvedValue([Buffer.from('0'), rows.flat()])
  const execute: RedisLink['execute'] = async (command, args, commandSignal, guard, deadline) => {
    guard(); calls.push({ command, args, deadline }); expect(args[0]).toEqual(key)
    if (command === 'TYPE') return state.type
    if (command === 'PTTL') return state.ttl
    if (command === 'ZCARD') return state.length
    if (command === 'ZRANGE') return range(command, args, commandSignal, guard, deadline)
    if (command === 'ZSCAN') return scan(command, args, commandSignal, guard, deadline)
    throw new Error('Unexpected or non-read command')
  }
  const connections = new RedisConnections(async () => ({ close: () => undefined, execute, onFailure: () => () => undefined }))
  const view = await connections.connect('a', settings, signal())
  if (view.id === null) throw new Error('No fixture connection')
  const request: Extract<ZSetReadRequest, { mode: 'range' }> = { target: { id: view.id, generation: view.generation, db: 0 }, keyBase64: key.toString('base64'), mode: 'range', offset: '0', count: 2 }
  const scanRequest: Extract<ZSetReadRequest, { mode: 'scan' }> = { target: request.target, keyBase64: request.keyBase64, mode: 'scan', pattern: '*', cursor: null }
  return { connections, reader: new RedisZSets(connections), request, scanRequest, state, calls, range, scan }
}

describe('ZSet rank and scan semantics', () => {
  it('preserves binary/empty members and exact score text with one operation deadline', async () => {
    const f = await setup(); f.state.ttl = 9007199254740993n
    try {
      const page = await f.reader.read('a', f.request, signal())
      expect(page).toMatchObject({ state: 'page', mode: 'range', offset: '0', nextOffset: '2', cursor: null, metadata: { type: 'zset', length: '4', ttlMs: '9007199254740993' } })
      expect(page.entries.map(row => [row.rank, row.score, row.member.base64])).toEqual([['0', '-inf', ''], ['1', '-0', binary.toString('base64')]])
      expect(f.range.mock.calls[0]?.[1]).toEqual([key, '0', '1', 'WITHSCORES'])
      expect(f.calls.map(call => call.command)).toEqual(['TYPE', 'PTTL', 'ZCARD', 'ZRANGE', 'TYPE', 'ZCARD', 'PTTL'])
      expect(new Set(f.calls.map(call => call.deadline)).size).toBe(1)
      const tail = await f.reader.read('a', { ...f.request, offset: '2' }, signal())
      expect(tail.entries.map(row => row.score)).toEqual(['1.0000000000000002', 'inf']); expect(tail.nextOffset).toBeNull()
    } finally { f.reader.dispose(); f.connections.dispose() }
  })
  it('uses exact signed-64-bit ranks, final intervals and empty EOF', async () => {
    const f = await setup()
    try {
      const eof = await f.reader.read('a', { ...f.request, offset: '9223372036854775807' }, signal())
      expect(eof).toMatchObject({ state: 'page', entries: [], nextOffset: null })
      expect(f.range.mock.calls[0]?.[1]).toEqual([key, '9223372036854775807', '9223372036854775807', 'WITHSCORES'])
      f.state.length = 9007199254740995n; f.range.mockResolvedValue([binary, Buffer.from('1e+100')])
      const page = await f.reader.read('a', { ...f.request, offset: '9007199254740993', count: 1 }, signal())
      expect(page.entries[0]?.rank).toBe('9007199254740993'); expect(page.entries[0]?.score).toBe('1e+100'); expect(page.nextOffset).toBe('9007199254740994')
    } finally { f.reader.dispose(); f.connections.dispose() }
  })
  it('continues nonterminal empty scans with exact uint64 cursors, never ranks or sorted claims', async () => {
    const f = await setup()
    f.scan.mockResolvedValueOnce([Buffer.from('18446744073709551615'), []]).mockResolvedValueOnce([Buffer.from('0'), [binary, Buffer.from('2'), binary, Buffer.from('3')]])
    try {
      const first = await f.reader.read('a', f.scanRequest, signal())
      expect(first).toMatchObject({ state: 'page', mode: 'scan', entries: [], offset: null, nextOffset: null }); expect(first.cursor).not.toBeNull()
      const next = await f.reader.read('a', { ...f.scanRequest, cursor: first.cursor }, signal())
      expect(next.entries).toEqual([{ member: expect.objectContaining({ base64: binary.toString('base64') }), score: '3', rank: null }]); expect(next.cursor).toBeNull()
      expect(f.scan.mock.calls[1]?.[1]).toEqual([key, '18446744073709551615', 'MATCH', '*', 'COUNT', '100'])
      expect((await f.reader.read('a', { ...f.scanRequest, cursor: first.cursor }, signal())).error).toBe('stale')
    } finally { f.reader.dispose(); f.connections.dispose() }
  })
  it('binds scan tokens to raw key, MATCH, DB, session and generation; rank reads invalidate scans', async () => {
    const f = await setup(); f.scan.mockResolvedValue([Buffer.from('7'), []])
    try {
      const first = await f.reader.read('a', f.scanRequest, signal())
      for (const request of [{ ...f.scanRequest, keyBase64: '' }, { ...f.scanRequest, pattern: 'other' }, { ...f.scanRequest, target: { ...f.request.target, db: 1 } }, { ...f.scanRequest, target: { ...f.request.target, generation: 999 } }]) {
        expect((await f.reader.read('a', { ...request, cursor: first.cursor }, signal())).error).toBe('stale')
      }
      expect((await f.reader.read('other', { ...f.scanRequest, cursor: first.cursor }, signal())).error).toBe('stale')
      expect((await f.reader.read('a', { ...f.scanRequest, cursor: first.cursor }, signal())).state).toBe('page')
      const current = await f.reader.read('a', f.scanRequest, signal()); await f.reader.read('a', f.request, signal())
      expect((await f.reader.read('a', { ...f.scanRequest, cursor: current.cursor }, signal())).error).toBe('stale')
    } finally { f.reader.dispose(); f.connections.dispose() }
  })
  it('refuses oversized full identities and JSON amplification, without returning partial rows', async () => {
    const f = await setup([[Buffer.alloc(65536, 97), Buffer.from('0')]])
    try {
      expect((await f.reader.read('a', f.request, signal())).entries[0]?.member.byteLength).toBe(65536)
      f.range.mockResolvedValue([Buffer.alloc(65537, 97), Buffer.from('0')])
      expect(await f.reader.read('a', f.request, signal())).toMatchObject({ error: 'oversize', entries: [], nextOffset: null })
      f.state.length = 12n; const raw = Array.from({ length: 12 }, (_, index) => [Buffer.alloc(65536, index), Buffer.from('0')]).flat()
      f.range.mockResolvedValue(raw); f.scan.mockResolvedValue([Buffer.from('3'), raw])
      for (const request of [{ ...f.request, count: 100 }, f.scanRequest]) expect(await f.reader.read('a', request, signal())).toMatchObject({ error: 'oversize', entries: [], cursor: null, nextOffset: null })
    } finally { f.reader.dispose(); f.connections.dispose() }
  })
  it('rejects malformed pairs/scores/duplicate range members and malformed scan cursors', async () => {
    const f = await setup()
    try {
      for (const reply of [[binary], [binary, 1n], [binary, Buffer.from('nan')], [binary, Buffer.from('1e400')], [binary, Buffer.from([255])], [binary, Buffer.from('0'), binary, Buffer.from('1')]]) {
        f.range.mockResolvedValue(reply)
        expect((await f.reader.read('a', f.request, signal())).error).toBe('protocol')
      }
      f.scan.mockResolvedValue([Buffer.from('01'), []]); expect((await f.reader.read('a', f.scanRequest, signal())).error).toBe('protocol')
      f.scan.mockResolvedValue([Buffer.from('0'), Array.from({ length: 4097 }, () => [binary, Buffer.from('0')]).flat()])
      expect((await f.reader.read('a', f.scanRequest, signal())).error).toBe('oversize')
      f.range.mockResolvedValue([]); expect((await f.reader.read('a', f.request, signal())).state).toBe('changed')
    } finally { f.reader.dispose(); f.connections.dispose() }
  })
  it('separates missing, expired and unsupported types before reading rows', async () => {
    const f = await setup()
    try {
      f.state.type = 'none'; expect((await f.reader.read('a', f.request, signal())).state).toBe('missing')
      f.state.type = 'zset'; f.state.ttl = -2n; expect((await f.reader.read('a', f.scanRequest, signal())).state).toBe('missing')
      f.state.type = 'set'; f.state.ttl = -1n
      expect(await f.reader.read('a', f.request, signal())).toMatchObject({ state: 'unsupported', metadata: { type: 'set', length: null } })
      expect(f.range).not.toHaveBeenCalled(); expect(f.scan).not.toHaveBeenCalled()
    } finally { f.reader.dispose(); f.connections.dispose() }
  })
  it('discards cardinality, deletion and type races in either mode', async () => {
    for (const mode of ['range', 'scan'] as const) for (const mutation of ['length', 'missing', 'type']) {
      const f = await setup(), raw = [binary, Buffer.from('0')]
      const mutate = () => { if (mutation === 'length') f.state.length++; else f.state.type = mutation === 'missing' ? 'none' : 'set' }
      f.range.mockImplementation(async () => { mutate(); return raw }); f.scan.mockImplementation(async () => { mutate(); return [Buffer.from('3'), raw] })
      try { expect(await f.reader.read('a', mode === 'range' ? f.request : f.scanRequest, signal())).toMatchObject({ state: mutation === 'missing' ? 'missing' : 'changed', entries: [], nextOffset: null, cursor: null }) }
      finally { f.reader.dispose(); f.connections.dispose() }
    }
  })
  it('maps permissions and wrong type to fixed data-free results', async () => {
    const f = await setup()
    try {
      f.range.mockRejectedValue(new RedisReplyError('NOPERM secret'))
      expect(await f.reader.read('a', f.request, signal())).toMatchObject({ state: 'failed', error: 'permission', entries: [] })
      f.scan.mockRejectedValue(new RedisReplyError('WRONGTYPE secret'))
      const changed = await f.reader.read('a', f.scanRequest, signal())
      expect(changed).toMatchObject({ state: 'changed', error: null, entries: [] }); expect(JSON.stringify(changed)).not.toContain('secret')
    } finally { f.reader.dispose(); f.connections.dispose() }
  })
  it('does not dispatch pre-cancelled work and enforces the shared total deadline', async () => {
    vi.useFakeTimers(); const f = await setup()
    try {
      const controller = new AbortController(); controller.abort()
      expect((await f.reader.read('a', f.request, controller.signal)).error).toBe('cancelled'); expect(f.calls).toHaveLength(0)
      f.range.mockImplementation(async (_command, _args, commandSignal) => new Promise((_resolve, reject) => commandSignal.addEventListener('abort', () => reject(new Error('aborted')), { once: true })))
      const pending = f.reader.read('a', f.request, signal()); await vi.advanceTimersByTimeAsync(10000)
      expect(await pending).toMatchObject({ error: 'timeout', entries: [], nextOffset: null })
    } finally { f.reader.dispose(); f.connections.dispose() }
  })
  it('invalidates cancelled and disposed scan tokens and ignores a late prior scan', async () => {
    const f = await setup(); f.scan.mockResolvedValue([Buffer.from('7'), []])
    try {
      const first = await f.reader.read('a', f.scanRequest, signal()), controller = new AbortController()
      f.scan.mockImplementationOnce(async (_command, _args, commandSignal) => new Promise((_resolve, reject) => commandSignal.addEventListener('abort', () => reject(new Error('aborted')), { once: true })))
      const pending = f.reader.read('a', { ...f.scanRequest, cursor: first.cursor }, controller.signal)
      await vi.waitFor(() => expect(f.scan).toHaveBeenCalledTimes(2)); controller.abort()
      expect((await pending).error).toBe('cancelled'); expect((await f.reader.read('a', { ...f.scanRequest, cursor: first.cursor }, signal())).error).toBe('stale')
      let finish: ((value: [Buffer, Buffer[]]) => void) | undefined
      f.scan.mockImplementationOnce(async () => new Promise(resolve => { finish = resolve }))
      const old = f.reader.read('a', f.scanRequest, signal()); await vi.waitFor(() => expect(finish).toBeDefined())
      const latest = await f.reader.read('a', f.scanRequest, signal()); finish?.([Buffer.from('9'), []])
      expect((await old).error).toBe('stale')
      f.reader.disposeSession('a'); expect((await f.reader.read('a', { ...f.scanRequest, cursor: latest.cursor }, signal())).error).toBe('stale')
    } finally { f.reader.dispose(); f.connections.dispose() }
  })
})

describe('ZSet UI cache and strict wire boundary', () => {
  it('updates repeated scan scores without sorting and caps encoded cache bytes', () => {
    const a = { member: identity(Buffer.from('z')), score: '1.0000000000000002', rank: null }, b = { member: identity(Buffer.from('a')), score: '0', rank: null }
    const cache = appendZSetRows(appendZSetRows(emptyZSetCache(), [a, b]), [{ ...a, score: '1e+100' }])
    expect(cache.rows.map(row => row.member.base64)).toEqual([a.member.base64, b.member.base64]); expect(cache.rows[0]?.score).toBe('1e+100')
    const limited = appendZSetRows({ ...cache, bytes: 2 * 1024 * 1024 }, [{ ...a, score: '10000000000' }])
    expect(limited.limited).toBe(true)
  })
  it('validates Redis doubles without rewriting text or accepting NaN/garbage', () => {
    for (const text of ['-0', '1.0000000000000002', '1e+100', '5e-324', '-inf', 'inf', '+inf']) expect(isRedisScore(text)).toBe(true)
    for (const text of ['', 'NaN', 'nan', 'Infinity', '1e400', ' 1', '1\n', '0xFF', '1'.repeat(129)]) expect(isRedisScore(text)).toBe(false)
  })
  it('strictly separates rank and scan input fields on both faces', async () => {
    const f = await setup()
    try {
      const codec = redisHostDescriptors.find(d => d.method === 'readZSet')?.parameters.find(p => p.name === 'request')?.codec
      if (codec?.mode !== 'strict') throw new Error('Missing ZSet codec')
      for (const schema of [codec.create(), zsetReadRequestSchema]) {
        expect(schema.parse(f.request)).toEqual(f.request); expect(schema.parse(f.scanRequest)).toEqual(f.scanRequest)
        for (const request of [{ ...f.request, command: 'ZADD x 1 y' }, { ...f.request, owner: 'other' }, { ...f.request, pattern: '*' }, { ...f.request, cursor: null }, { ...f.scanRequest, offset: '0' }, { ...f.request, offset: '9223372036854775808' }, { ...f.request, offset: '01' }, { ...f.request, count: 101 }, { ...f.request, keyBase64: 'bad' }, { ...f.scanRequest, cursor: '7' }, { ...f.scanRequest, pattern: 'x'.repeat(257) }]) expect(() => schema.parse(request)).toThrow()
      }
    } finally { f.reader.dispose(); f.connections.dispose() }
  })
  it('rejects mixed paging, invalid scores/identity/metadata/continuation and duplicate rows on both faces', async () => {
    const f = await setup()
    try {
      const descriptor = redisHostDescriptors.find(d => d.method === 'readZSet')
      if (descriptor?.result.mode !== 'strict') throw new Error('Missing result codec')
      const range = await f.reader.read('a', f.request, signal()), scan = await f.reader.read('a', f.scanRequest, signal())
      for (const schema of [descriptor.result.create(), zsetReadResultSchema]) {
        expect(schema.parse(range)).toEqual(range); expect(schema.parse(scan)).toEqual(scan)
        const row = range.entries[0]; if (row === undefined) throw new Error('Missing row')
        for (const page of [{ ...range, cursor: 'a'.repeat(36) }, { ...range, offset: null }, { ...range, nextOffset: '3' }, { ...range, entries: [{ ...row, rank: '1' }] }, { ...scan, offset: '0' }, { ...scan, entries: [{ ...row, rank: '0' }] }, { ...range, entries: [row, row] }, { ...range, entries: [{ ...row, score: 'NaN' }] }, { ...range, entries: [{ ...row, member: { ...row.member, byteLength: 99 } }] }, { ...range, metadata: { type: 'set', ttlMs: '-1', length: '4' } }, { ...range, state: 'missing' }, { ...range, password: 'secret' }]) expect(() => schema.parse(page)).toThrow()
      }
    } finally { f.reader.dispose(); f.connections.dispose() }
  })
})
