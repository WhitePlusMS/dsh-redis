import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RedisConnections, type RedisLink } from '../src/host/connection-service.ts'
import { RedisHll } from '../src/host/hll-reader.ts'
import { encodeCommand, RedisFrameError, RedisReplyError } from '../src/host/resp.ts'
import type { HllReadRequest } from '../src/domain.ts'
import { hllReadRequestSchema, hllReadResultSchema } from '../src/typert.shared.ts'
import { redisHostDescriptors } from '../src/typert.host.ts'

const signal = () => new AbortController().signal
const settings = { host: 'localhost', port: 6379, username: '', password: '', tls: null }
const owned: RedisConnections[] = []
beforeEach(() => { vi.spyOn(console, 'info').mockImplementation(() => undefined) })
afterEach(() => { for (const value of owned.splice(0)) value.dispose(); vi.useRealTimers(); vi.restoreAllMocks() })

async function setup(key = Buffer.from([255, 0, 13])) {
  const header = Buffer.alloc(16); header.write('HYLL'); header[4] = 1; header[15] = 128
  const state = { type: 'string', ttl: -1n, length: 18n, header }
  const calls: { command: string; args: readonly (string | Buffer)[]; deadline: number | undefined }[] = []
  const count = vi.fn<RedisLink['execute']>().mockResolvedValue(88n)
  const range = vi.fn<RedisLink['execute']>().mockImplementation(async () => Buffer.from(state.header))
  const execute: RedisLink['execute'] = async (command, args, commandSignal, guard, deadline) => {
    guard(); calls.push({ command, args, deadline }); expect(args[0]).toEqual(key)
    if (command === 'TYPE') return state.type
    if (command === 'PTTL') return state.ttl
    if (command === 'STRLEN') return state.length
    if (command === 'GETRANGE') return range(command, args, commandSignal, guard, deadline)
    if (command === 'PFCOUNT') return count(command, args, commandSignal, guard, deadline)
    throw new Error('Unexpected non-read command')
  }
  const connections = new RedisConnections(async () => ({ execute, close: () => undefined, onFailure: () => () => undefined })); owned.push(connections)
  const view = await connections.connect('a', settings, signal())
  if (view.id === null) throw new Error('Missing test target')
  const request: HllReadRequest = { target: { id: view.id, generation: view.generation, db: 0 }, keyBase64: key.toString('base64') }
  return { key, state, calls, count, range, connections, request, reader: new RedisHll(connections) }
}

describe('Readonly HLL estimates', () => {
  it('uses exactly two identical raw keys, two 16-byte headers and one total deadline', async () => {
    const f = await setup(); f.state.ttl = 9007199254740993n; f.count.mockResolvedValue(9007199254740993n)
    const result = await f.reader.read('a', f.request, signal())
    expect(result).toMatchObject({ state: 'value', estimate: '9007199254740993', encoding: 'sparse', cacheValid: false, metadata: { type: 'string', length: '18', ttlMs: '9007199254740993' } })
    expect(f.count.mock.calls[0]?.[1]).toEqual([f.key, f.key])
    expect(f.range.mock.calls.map(call => call[1])).toEqual([[f.key, '0', '15'], [f.key, '0', '15']])
    expect(f.calls.map(call => call.command)).toEqual(['TYPE', 'PTTL', 'STRLEN', 'GETRANGE', 'PFCOUNT', 'TYPE', 'STRLEN', 'PTTL', 'GETRANGE'])
    expect(new Set(f.calls.map(call => call.deadline)).size).toBe(1)
  })
  it('distinguishes dense/sparse and valid/invalid source caches without changing headers', async () => {
    const f = await setup()
    for (const dense of [false, true]) for (const valid of [false, true]) {
      f.state.header[4] = dense ? 0 : 1; f.state.length = dense ? 12304n : 18n; f.state.header[15] = valid ? 0 : 128
      const original = Buffer.from(f.state.header)
      expect(await f.reader.read('a', f.request, signal())).toMatchObject({ state: 'value', encoding: dense ? 'dense' : 'sparse', cacheValid: valid })
      expect(f.state.header).toEqual(original)
    }
  })
  it('treats zero as a successful estimate and supports an empty raw key', async () => {
    const f = await setup(Buffer.alloc(0)); f.count.mockResolvedValue(0n)
    expect(await f.reader.read('a', f.request, signal())).toMatchObject({ state: 'value', estimate: '0' })
    expect(f.count.mock.calls[0]?.[1]).toEqual([Buffer.alloc(0), Buffer.alloc(0)])
  })
  it('does not count plain/empty Strings, fake magic, unknown encodings or wrong dense sizes', async () => {
    const f = await setup()
    for (const header of [Buffer.alloc(0), Buffer.from('ordinary'), Buffer.alloc(16), Buffer.from([200, 217, 204, 204, 1, ...Array<number>(11).fill(0)])]) {
      f.state.header = header; f.state.length = BigInt(header.length); f.count.mockClear()
      expect(await f.reader.read('a', f.request, signal())).toMatchObject({ state: 'invalid', estimate: null, metadata: { type: 'string', length: String(header.length) } })
      expect(f.count).not.toHaveBeenCalled()
    }
    f.state.header = Buffer.alloc(16); f.state.header.write('HYLL'); f.state.length = 18n
    for (const encoding of [0, 2, 255]) {
      f.state.header[4] = encoding
      expect(await f.reader.read('a', f.request, signal())).toMatchObject({ state: 'invalid', estimate: null })
    }
  })
  it('keeps rejected sparse/HLL formats distinct without leaking raw server errors', async () => {
    const f = await setup()
    for (const message of ['INVALIDOBJ Corrupted HLL object detected private-data', 'WRONGTYPE Key is not a valid HyperLogLog string value.']) {
      f.count.mockRejectedValue(new RedisReplyError(message))
      const result = await f.reader.read('a', f.request, signal())
      expect(result).toMatchObject({ state: 'invalid', metadata: { type: 'string' }, estimate: null, encoding: null, cacheValid: null })
      expect(JSON.stringify(result)).not.toContain('private-data')
    }
  })
  it('has no single-input fallback on unavailable commands or unsupported argument shape', async () => {
    const f = await setup()
    for (const message of ['ERR unknown command PFCOUNT private-data', 'ERR wrong number of arguments for PFCOUNT']) {
      f.count.mockClear(); f.count.mockRejectedValue(new RedisReplyError(message))
      expect(await f.reader.read('a', f.request, signal())).toMatchObject({ state: 'unavailable', estimate: null, metadata: null })
      expect(f.count).toHaveBeenCalledTimes(1); expect(f.count.mock.calls[0]?.[1]).toEqual([f.key, f.key])
    }
  })
  it('separates missing, expired, non-String, permission and concurrent wrong-type states', async () => {
    const f = await setup(); f.state.type = 'none'
    expect((await f.reader.read('a', f.request, signal())).state).toBe('missing')
    f.state.type = 'string'; f.state.ttl = -2n
    expect((await f.reader.read('a', f.request, signal())).state).toBe('missing')
    f.state.ttl = -1n; f.state.type = 'hash'
    expect(await f.reader.read('a', f.request, signal())).toMatchObject({ state: 'unsupported', metadata: { type: 'hash', length: null } })
    expect(f.count).not.toHaveBeenCalled(); f.state.type = 'string'
    f.count.mockRejectedValue(new RedisReplyError('NOPERM private-key-and-password'))
    const denied = await f.reader.read('a', f.request, signal()); expect(denied).toMatchObject({ state: 'failed', error: 'permission' }); expect(JSON.stringify(denied)).not.toContain('private-key')
    f.count.mockRejectedValue(new RedisReplyError('WRONGTYPE Operation against a key holding the wrong kind of value'))
    expect((await f.reader.read('a', f.request, signal())).state).toBe('changed')
  })
  it('discards results when type, length, header/cache or expiry changes while counting', async () => {
    for (const mutate of [async (f: Awaited<ReturnType<typeof setup>>) => { f.state.type = 'hash' }, async (f: Awaited<ReturnType<typeof setup>>) => { f.state.type = 'none' }, async (f: Awaited<ReturnType<typeof setup>>) => { f.state.length++ }, async (f: Awaited<ReturnType<typeof setup>>) => { f.state.header[15] = 0 }, async (f: Awaited<ReturnType<typeof setup>>) => { f.state.ttl = -2n }]) {
      const f = await setup(); f.count.mockImplementationOnce(async () => { await mutate(f); return 88n })
      const result = await f.reader.read('a', f.request, signal()); expect(['changed', 'missing']).toContain(result.state); expect(result.estimate).toBeNull()
    }
  })
  it('refuses malformed header/count replies and enforces the actual request encoder budget', async () => {
    const f = await setup()
    for (const reply of [null, '1', Buffer.from('1'), -1n, [1n]]) {
      f.count.mockResolvedValue(reply); expect(await f.reader.read('a', f.request, signal())).toMatchObject({ state: 'failed', error: 'protocol' })
    }
    f.range.mockResolvedValue(Buffer.alloc(17)); expect(await f.reader.read('a', f.request, signal())).toMatchObject({ state: 'failed', error: 'protocol' })
    const giant = await setup(Buffer.alloc(65536, 97))
    giant.count.mockImplementation(async (command, args) => { encodeCommand([command, ...args]); return 88n })
    expect(await giant.reader.read('a', giant.request, signal())).toMatchObject({ state: 'failed', error: 'oversize' })
    expect(giant.connections.status('a').state).toBe('connected')
  })
  it('rejects foreign/stale DB targets and a late count after reconnect', async () => {
    const f = await setup()
    expect(await f.reader.read('other', f.request, signal())).toMatchObject({ state: 'failed', error: 'stale' })
    expect(await f.reader.read('a', { ...f.request, target: { ...f.request.target, db: 1 } }, signal())).toMatchObject({ state: 'failed', error: 'stale' })
    expect(f.count).not.toHaveBeenCalled()
    f.count.mockImplementationOnce(async () => { await f.connections.connect('a', settings, signal()); return 88n })
    expect(await f.reader.read('a', f.request, signal())).toMatchObject({ state: 'failed', error: 'stale' })
  })
  it('does not dispatch a pre-cancelled request and uses one ten-second operation deadline', async () => {
    const f = await setup(), caller = new AbortController(); caller.abort()
    expect(await f.reader.read('a', f.request, caller.signal)).toMatchObject({ state: 'failed', error: 'cancelled' }); expect(f.calls).toHaveLength(0)
    vi.useFakeTimers(); f.count.mockImplementation(async (_command, _args, commandSignal) => new Promise<never>((_resolve, reject) => commandSignal.addEventListener('abort', () => reject(new Error('aborted')), { once: true })))
    const pending = f.reader.read('a', f.request, signal()); await vi.advanceTimersByTimeAsync(10001)
    expect(await pending).toMatchObject({ state: 'failed', error: 'timeout' })
  })
  it('keeps both RPC faces strict, exact and free of hidden command/secret fields', async () => {
    const f = await setup(), descriptor = redisHostDescriptors.find(d => d.method === 'readHll'), codec = descriptor?.parameters.find(p => p.name === 'request')?.codec
    if (codec?.mode !== 'strict' || descriptor?.result.mode !== 'strict') throw new Error('Missing HLL codec')
    for (const schema of [codec.create(), hllReadRequestSchema]) {
      expect(schema.parse(f.request)).toEqual(f.request)
      for (const extra of [{ keyBase64: '!' }, { command: 'PFADD' }, { keys: [] }, { sessionId: 'other' }, { offset: '0' }, { target: { ...f.request.target, db: -1 } }]) expect(() => schema.parse({ ...f.request, ...extra })).toThrow()
    }
    const value = await f.reader.read('a', f.request, signal())
    for (const schema of [descriptor.result.create(), hllReadResultSchema]) {
      expect(schema.parse(value)).toEqual(value)
      for (const extra of [{ estimate: 88 }, { estimate: '-1' }, { estimate: '01' }, { estimate: '9223372036854775808' }, { encoding: 'dense' }, { cacheValid: 'yes' }, { estimate: null }, { error: 'permission' }, { metadata: null }, { password: 'secret' }, { state: 'invalid' }]) expect(() => schema.parse({ ...value, ...extra })).toThrow()
    }
    expect(() => encodeCommand(['PFCOUNT', Buffer.alloc(65536), Buffer.alloc(65536)])).toThrow(RedisFrameError)
  })
})
