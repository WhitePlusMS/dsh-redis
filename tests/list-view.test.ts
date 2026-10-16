import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RedisConnections, type RedisLink } from '../src/host/connection-service.ts'
import { RedisLists } from '../src/host/list-reader.ts'
import { RedisReplyError } from '../src/host/resp.ts'
import type { ListReadRequest } from '../src/domain.ts'
import { listReadRequestSchema, listReadResultSchema } from '../src/typert.shared.ts'
import { redisHostDescriptors } from '../src/typert.host.ts'

const signal = () => new AbortController().signal
const settings = { host: 'localhost', port: 6379, username: '', password: '', tls: null }
const key = Buffer.from([255, 0, 13])
beforeEach(() => { vi.spyOn(console, 'info').mockImplementation(() => undefined) })
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })

async function setup(items = [Buffer.from('same'), Buffer.from('same'), Buffer.from([255, 0]), Buffer.alloc(0)]) {
  const state = { type: 'list', ttl: -1n, length: BigInt(items.length) }
  const calls: { command: string; args: readonly (string | Buffer)[]; deadline: number | undefined }[] = []
  const range = vi.fn<RedisLink['execute']>().mockImplementation(async (_command, args) => {
    const start = BigInt(String(args[1])), end = BigInt(String(args[2]))
    return items.slice(Number(start > BigInt(items.length) ? BigInt(items.length) : start), Number(end + 1n > BigInt(items.length) ? BigInt(items.length) : end + 1n))
  })
  const execute: RedisLink['execute'] = async (command, args, commandSignal, guard, deadline) => {
    guard(); calls.push({ command, args, deadline }); expect(args[0]).toEqual(key)
    if (command === 'TYPE') return state.type
    if (command === 'PTTL') return state.ttl
    if (command === 'LLEN') return state.length
    if (command === 'LRANGE') return range(command, args, commandSignal, guard, deadline)
    throw new Error('Unexpected or non-read command')
  }
  const connections = new RedisConnections(async () => ({ close: () => undefined, execute, onFailure: () => () => undefined }))
  const view = await connections.connect('a', settings, signal())
  if (view.id === null) throw new Error('No fixture target')
  const request: ListReadRequest = { target: { id: view.id, generation: view.generation, db: 0 }, keyBase64: key.toString('base64'), offset: '0', count: 2 }
  return { connections, reader: new RedisLists(connections), request, state, calls, range }
}

describe('List original-index range reads', () => {
  it('preserves duplicate values at distinct zero-based indices and shares one total deadline', async () => {
    const fixture = await setup()
    fixture.state.ttl = 9007199254740993n
    try {
      const result = await fixture.reader.read('a', fixture.request, signal())
      expect(result).toMatchObject({ state: 'page', offset: '0', nextOffset: '2', metadata: { type: 'list', length: '4', ttlMs: '9007199254740993' } })
      expect(result.entries.map(row => row.index)).toEqual(['0', '1'])
      expect(result.entries[0]?.value).toEqual(result.entries[1]?.value)
      expect(fixture.range.mock.calls[0]?.[1]).toEqual([key, '0', '1'])
      expect(fixture.calls.map(call => call.command)).toEqual(['TYPE', 'PTTL', 'LLEN', 'LRANGE', 'TYPE', 'LLEN', 'PTTL'])
      expect(new Set(fixture.calls.map(call => call.deadline)).size).toBe(1)
    } finally { fixture.connections.dispose() }
  })
  it('keeps binary/empty elements, final-page indices and EOF distinct', async () => {
    const fixture = await setup()
    try {
      const tail = await fixture.reader.read('a', { ...fixture.request, offset: '2' }, signal())
      expect(tail.entries.map(row => row.index)).toEqual(['2', '3']); expect(tail.nextOffset).toBeNull()
      expect(Buffer.from(tail.entries[0]?.value.base64 ?? '', 'base64')).toEqual(Buffer.from([255, 0]))
      expect(tail.entries[1]?.value.byteLength).toBe(0)
      const eof = await fixture.reader.read('a', { ...fixture.request, offset: '9223372036854775807' }, signal())
      expect(eof).toMatchObject({ state: 'page', entries: [], nextOffset: null })
      expect(fixture.range.mock.calls[1]?.[1]).toEqual([key, '9223372036854775807', '9223372036854775807'])
    } finally { fixture.connections.dispose() }
  })
  it('does not round indices beyond JavaScript safe integers', async () => {
    const fixture = await setup()
    fixture.state.length = 9007199254740995n; fixture.range.mockResolvedValue([Buffer.from('last')])
    try {
      const result = await fixture.reader.read('a', { ...fixture.request, offset: '9007199254740993', count: 1 }, signal())
      expect(result.entries[0]?.index).toBe('9007199254740993'); expect(result.nextOffset).toBe('9007199254740994')
      expect(fixture.range.mock.calls[0]?.[1]).toEqual([key, '9007199254740993', '9007199254740993'])
    } finally { fixture.connections.dispose() }
  })
  it('bounds cell prefixes and refuses a whole amplified page without a false continuation', async () => {
    const original = Buffer.alloc(131073, 97), fixture = await setup([original])
    try {
      const result = await fixture.reader.read('a', fixture.request, signal())
      expect(result.entries[0]?.value).toMatchObject({ byteLength: 65536, fullByteLength: 131073, suffix: Buffer.alloc(3, 97).toString('base64') })
      fixture.state.length = 12n; fixture.range.mockResolvedValue(Array.from({ length: 12 }, () => Buffer.alloc(65536, 97)))
      expect(await fixture.reader.read('a', { ...fixture.request, count: 100 }, signal())).toMatchObject({ error: 'oversize', entries: [], nextOffset: null })
    } finally { fixture.connections.dispose() }
  })
  it('discards a page after concurrent insert/delete or type change and does not claim a snapshot', async () => {
    for (const mutation of ['length', 'missing', 'type']) {
      const fixture = await setup()
      fixture.range.mockImplementation(async () => {
        if (mutation === 'length') fixture.state.length++
        else fixture.state.type = mutation === 'missing' ? 'none' : 'hash'
        return [Buffer.from('old'), Buffer.from('old')]
      })
      try { expect(await fixture.reader.read('a', fixture.request, signal())).toMatchObject({ state: mutation === 'missing' ? 'missing' : 'changed', entries: [], nextOffset: null }) }
      finally { fixture.connections.dispose() }
    }
  })
  it('separates missing/expired/unsupported values before issuing LRANGE', async () => {
    const fixture = await setup()
    try {
      fixture.state.type = 'none'; expect((await fixture.reader.read('a', fixture.request, signal())).state).toBe('missing')
      fixture.state.type = 'list'; fixture.state.ttl = -2n; expect((await fixture.reader.read('a', fixture.request, signal())).state).toBe('missing')
      fixture.state.type = 'string'; fixture.state.ttl = -1n
      expect(await fixture.reader.read('a', fixture.request, signal())).toMatchObject({ state: 'unsupported', metadata: { type: 'string', length: null } })
      expect(fixture.range).not.toHaveBeenCalled()
    } finally { fixture.connections.dispose() }
  })
  it('rejects malformed elements, excess range items and a non-snapshot short read', async () => {
    const fixture = await setup()
    try {
      for (const reply of [[1n], [Buffer.from('1'), Buffer.from('2'), Buffer.from('3')]]) {
        fixture.range.mockResolvedValue(reply)
        expect((await fixture.reader.read('a', fixture.request, signal())).error).toBe('protocol')
      }
      fixture.range.mockResolvedValue([])
      expect((await fixture.reader.read('a', fixture.request, signal())).state).toBe('changed')
    } finally { fixture.connections.dispose() }
  })
  it('maps permission/WRONGTYPE and rejects a different session/DB generation', async () => {
    const fixture = await setup()
    try {
      fixture.range.mockRejectedValueOnce(new RedisReplyError('NOPERM fixture'))
      expect((await fixture.reader.read('a', fixture.request, signal())).error).toBe('permission')
      fixture.range.mockRejectedValueOnce(new RedisReplyError('WRONGTYPE fixture'))
      expect((await fixture.reader.read('a', fixture.request, signal())).state).toBe('changed')
      expect((await fixture.reader.read('b', fixture.request, signal())).error).toBe('stale')
      expect((await fixture.reader.read('a', { ...fixture.request, target: { ...fixture.request.target, db: 1 } }, signal())).error).toBe('stale')
    } finally { fixture.connections.dispose() }
  })
  it('does not dispatch pre-cancelled reads and enforces the operation deadline', async () => {
    const fixture = await setup(), controller = new AbortController()
    try {
      controller.abort(); expect((await fixture.reader.read('a', fixture.request, controller.signal)).error).toBe('cancelled'); expect(fixture.calls).toEqual([])
      vi.useFakeTimers()
      fixture.range.mockImplementation(async (_command, _args, requestSignal) => new Promise((_resolve, reject) => { requestSignal.addEventListener('abort', () => reject(new Error('cancelled')), { once: true }) }))
      const pending = fixture.reader.read('a', fixture.request, signal()); await vi.advanceTimersByTimeAsync(10001)
      expect(await pending).toMatchObject({ error: 'timeout', entries: [], nextOffset: null })
    } finally { fixture.connections.dispose() }
  })
  it('cancels an active interval without returning partial rows and can read again', async () => {
    const fixture = await setup(), controller = new AbortController()
    try {
      fixture.range.mockImplementationOnce(async (_command, _args, requestSignal) => new Promise((_resolve, reject) => { requestSignal.addEventListener('abort', () => reject(new Error('cancelled')), { once: true }) }))
      const pending = fixture.reader.read('a', fixture.request, controller.signal)
      await vi.waitFor(() => expect(fixture.range).toHaveBeenCalledTimes(1)); controller.abort()
      expect(await pending).toMatchObject({ error: 'cancelled', entries: [], nextOffset: null })
      expect((await fixture.reader.read('a', fixture.request, signal())).state).toBe('page')
    } finally { fixture.connections.dispose() }
  })
})

describe('strict List range protocol', () => {
  it('limits count and exact nonnegative offsets and rejects hidden commands on both faces', () => {
    const codec = redisHostDescriptors.find(value => value.method === 'readList')?.parameters.find(value => value.name === 'request')?.codec
    if (codec?.mode !== 'strict') throw new Error('Missing List request codec')
    const valid = { target: { id: 'id', generation: 1, db: 0 }, keyBase64: '', offset: '0', count: 100 }
    for (const schema of [codec.create(), listReadRequestSchema]) {
      expect(schema.parse(valid)).toEqual(valid)
      for (const invalid of [{ ...valid, count: 101 }, { ...valid, count: 0 }, { ...valid, offset: '-1' }, { ...valid, offset: '01' }, { ...valid, offset: '9223372036854775808' }, { ...valid, keyBase64: 'AA' }, { ...valid, command: 'LPOP' }]) expect(() => schema.parse(invalid)).toThrow()
    }
  })
  it('validates original contiguous positions, duplicate values, EOF and continuation on both faces', () => {
    const codec = redisHostDescriptors.find(value => value.method === 'readList')?.result
    if (codec?.mode !== 'strict') throw new Error('Missing List result codec')
    const value = { base64: 'YQ==', byteLength: 1, fullByteLength: 1, suffix: '' }
    const valid = { state: 'page', error: null, metadata: { type: 'list', ttlMs: '-1', length: '4' }, entries: [{ index: '0', value }, { index: '1', value }], offset: '0', nextOffset: '2', sampledAt: new Date().toISOString() }
    for (const schema of [codec.create(), listReadResultSchema]) {
      expect(schema.parse(valid)).toEqual(valid)
      expect(schema.parse({ ...valid, offset: '5', entries: [], nextOffset: null })).toMatchObject({ entries: [] })
      for (const invalid of [{ ...valid, entries: [{ index: '0', value }, { index: '0', value }] }, { ...valid, offset: '1' }, { ...valid, nextOffset: '3' }, { ...valid, entries: [] }, { ...valid, state: 'failed' }, { ...valid, metadata: { ...valid.metadata, type: 'hash' } }]) expect(() => schema.parse(invalid)).toThrow()
    }
  })
  it('rejects forged byte prefixes and amplified whole-page output on both faces', () => {
    const codec = redisHostDescriptors.find(value => value.method === 'readList')?.result
    if (codec?.mode !== 'strict') throw new Error('Missing List result codec')
    const value = { base64: 'YQ==', byteLength: 1, fullByteLength: 2, suffix: '' }
    const valid = { state: 'page', error: null, metadata: { type: 'list', ttlMs: '-1', length: '1' }, entries: [{ index: '0', value }], offset: '0', nextOffset: null, sampledAt: new Date().toISOString() }
    for (const schema of [codec.create(), listReadResultSchema]) {
      expect(() => schema.parse(valid)).toThrow()
      const entries = Array.from({ length: 12 }, (_, index) => ({ index: String(index), value: { base64: Buffer.alloc(65536, 97).toString('base64'), byteLength: 65536, fullByteLength: 65536, suffix: '' } }))
      expect(() => schema.parse({ ...valid, metadata: { ...valid.metadata, length: '12' }, entries })).toThrow()
    }
  })
})
