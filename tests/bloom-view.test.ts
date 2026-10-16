import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RedisConnections, type RedisLink } from '../src/host/connection-service.ts'
import { RedisBloom } from '../src/host/bloom-reader.ts'
import { RedisFrameError, RedisReplyError, type RedisReply } from '../src/host/resp.ts'
import type { BloomReadRequest } from '../src/domain.ts'
import { bloomReadRequestSchema, bloomReadResultSchema } from '../src/typert.shared.ts'
import { redisHostDescriptors } from '../src/typert.host.ts'
import { bloomItemBase64 } from '../src/client/bloom-query.ts'

const signal = () => new AbortController().signal
const settings = { host: 'localhost', port: 6379, username: '', password: '', tls: null }
const key = Buffer.from([255, 0, 13]), item = Buffer.from([254, 0])
const infoReply: RedisReply[] = ['Capacity', 100n, 'Size', 240n, 'Number of filters', 1n, 'Number of items inserted', 2n, 'Expansion rate', 2n]
const owned: RedisConnections[] = []
beforeEach(() => { vi.spyOn(console, 'info').mockImplementation(() => undefined) })
afterEach(() => { for (const connections of owned.splice(0)) connections.dispose(); vi.useRealTimers(); vi.restoreAllMocks() })
async function setup() {
  const state = { type: 'MBbloom--', ttl: -1n }
  const calls: { command: string; args: readonly (string | Buffer)[]; deadline: number | undefined }[] = []
  const info = vi.fn<RedisLink['execute']>().mockResolvedValue(infoReply), exists = vi.fn<RedisLink['execute']>().mockResolvedValue(1n)
  const execute: RedisLink['execute'] = async (command, args, commandSignal, guard, deadline) => {
    guard(); calls.push({ command, args, deadline }); expect(args[0]).toEqual(key)
    if (command === 'TYPE') return state.type
    if (command === 'PTTL') return state.ttl
    if (command === 'BF.INFO') return info(command, args, commandSignal, guard, deadline)
    if (command === 'BF.EXISTS') return exists(command, args, commandSignal, guard, deadline)
    throw new Error('Unexpected or non-read command')
  }
  const connections = new RedisConnections(async () => ({ close: () => undefined, execute, onFailure: () => () => undefined })); owned.push(connections)
  const view = await connections.connect('a', settings, signal()); if (view.id === null) throw new Error('Missing target')
  const request: BloomReadRequest = { target: { id: view.id, generation: view.generation, db: 0 }, keyBase64: key.toString('base64'), itemBase64: null }
  return { state, calls, info, exists, connections, request, reader: new RedisBloom(connections) }
}
describe('Bounded readonly Bloom information and membership', () => {
  it('reads information only with exact raw key/Int64 fields and one total deadline', async () => {
    const f = await setup(); f.state.ttl = 9007199254740993n
    f.info.mockResolvedValue(['Capacity', 9007199254740993n, 'Size', 9223372036854775807n, 'Number of filters', 1n, 'Number of items inserted', 9007199254740993n, 'Expansion rate', 2n])
    const result = await f.reader.read('a', f.request, signal())
    expect(result).toMatchObject({ state: 'value', infoState: 'available', itemBase64: null, membership: null, metadata: { type: 'MBbloom--', ttlMs: '9007199254740993', length: null }, info: { capacity: '9007199254740993', size: '9223372036854775807', inserted: '9007199254740993' } })
    expect(f.exists).not.toHaveBeenCalled(); expect(f.calls.map(call => call.command)).toEqual(['TYPE', 'PTTL', 'BF.INFO', 'TYPE', 'PTTL'])
    expect(new Set(f.calls.map(call => call.deadline)).size).toBe(1)
  })
  it('uses one fixed EXISTS for exact binary/empty items and returns only probabilistic verdicts', async () => {
    const f = await setup()
    for (const value of [item.toString('base64'), '']) {
      const request = { ...f.request, itemBase64: value }
      f.exists.mockResolvedValueOnce(1n).mockResolvedValueOnce(0n)
      expect(await f.reader.read('a', request, signal())).toMatchObject({ state: 'value', membership: 'maybe-present', itemBase64: value })
      expect(await f.reader.read('a', request, signal())).toMatchObject({ state: 'value', membership: 'absent', itemBase64: value })
      expect(f.exists.mock.calls.at(-1)?.[1]).toEqual([key, Buffer.from(value, 'base64')])
    }
    expect(f.calls.every(call => ['TYPE', 'PTTL', 'BF.INFO', 'BF.EXISTS'].includes(call.command))).toBe(true)
  })
  it('distinguishes non-scaling null expansion, empty reserved filter and information order', async () => {
    const f = await setup()
    f.info.mockResolvedValue(['Expansion rate', null, 'Number of items inserted', 0n, 'Number of filters', 1n, 'Size', 112n, 'Capacity', 10n])
    expect(await f.reader.read('a', f.request, signal())).toMatchObject({ state: 'value', info: { capacity: '10', size: '112', filters: '1', inserted: '0', expansion: null } })
  })
  it('never sends Bloom commands to Cuckoo/other types or missing/expired keys', async () => {
    const f = await setup()
    for (const type of ['MBbloomCF', 'CMSk-TYPE', 'string', 'hash']) {
      f.state.type = type; expect(await f.reader.read('a', f.request, signal())).toMatchObject({ state: 'unsupported', metadata: { type, length: null } })
    }
    f.state.type = 'none'; expect((await f.reader.read('a', f.request, signal())).state).toBe('missing')
    f.state.type = 'MBbloom--'; f.state.ttl = -2n; expect((await f.reader.read('a', f.request, signal())).state).toBe('missing')
    expect(f.info).not.toHaveBeenCalled(); expect(f.exists).not.toHaveBeenCalled()
  })
  it('keeps INFO permission/unavailability independent and clears verdict on denied/unavailable EXISTS', async () => {
    const f = await setup(), request = { ...f.request, itemBase64: item.toString('base64') }
    for (const [error, expected] of [[new RedisReplyError('NOPERM secret'), 'permission'], [new RedisReplyError("ERR unknown command 'BF.INFO' secret"), 'unavailable']] as const) {
      f.info.mockRejectedValue(error)
      expect(await f.reader.read('a', request, signal())).toMatchObject({ state: 'value', info: null, infoState: expected, membership: 'maybe-present' })
    }
    f.exists.mockRejectedValue(new RedisReplyError('NOPERM secret'))
    expect(await f.reader.read('a', request, signal())).toMatchObject({ state: 'failed', error: 'permission', membership: null, info: null })
    f.exists.mockRejectedValue(new RedisReplyError("ERR unknown command 'BF.EXISTS' secret"))
    const result = await f.reader.read('a', request, signal()); expect(result.state).toBe('unavailable'); expect(JSON.stringify(result)).not.toContain('secret')
  })
  it('does not publish an EXISTS zero after deletion, expiry or conversion to Cuckoo', async () => {
    for (const mutation of ['none', 'MBbloomCF', 'expired']) {
      const f = await setup()
      f.exists.mockImplementationOnce(async () => { if (mutation === 'expired') f.state.ttl = -2n; else f.state.type = mutation; return 0n })
      expect(await f.reader.read('a', { ...f.request, itemBase64: '' }, signal())).toMatchObject({ state: mutation === 'MBbloomCF' ? 'changed' : 'missing', membership: null, info: null })
    }
  })
  it('rechecks fixed not-found errors and maps WRONGTYPE without exposing server strings', async () => {
    const f = await setup()
    f.info.mockImplementationOnce(async () => { f.state.type = 'none'; throw new RedisReplyError('ERR not found') })
    expect((await f.reader.read('a', f.request, signal())).state).toBe('missing')
    f.state.type = 'MBbloom--'; f.info.mockRejectedValueOnce(new RedisReplyError('ERR not found'))
    expect((await f.reader.read('a', f.request, signal())).error).toBe('protocol')
    f.info.mockRejectedValueOnce(new RedisReplyError('WRONGTYPE secret'))
    expect(await f.reader.read('a', f.request, signal())).toMatchObject({ state: 'changed', error: null, membership: null })
  })
  it('rejects malformed/duplicate/overflow INFO and invalid existence flags; oversize has no partial data', async () => {
    const f = await setup()
    for (const reply of [null, [], ['Capacity', 1n], ['Capacity', 1n, 'Capacity', 2n, 'Number of filters', 1n, 'Number of items inserted', 1n, 'Expansion rate', 2n], ['Capacity', -1n, ...infoReply.slice(2)], ['Capacity', 9223372036854775808n, ...infoReply.slice(2)], ['Capacity', Buffer.from('1'), ...infoReply.slice(2)]]) {
      f.info.mockResolvedValueOnce(reply); expect((await f.reader.read('a', f.request, signal())).error).toBe('protocol')
    }
    for (const flag of [2n, -1n, '1', Buffer.from('1'), null]) {
      f.exists.mockResolvedValueOnce(flag); expect((await f.reader.read('a', { ...f.request, itemBase64: '' }, signal())).error).toBe('protocol')
    }
    f.info.mockRejectedValueOnce(new RedisFrameError('oversize'))
    expect(await f.reader.read('a', f.request, signal())).toMatchObject({ error: 'oversize', info: null, membership: null })
  })
  it('rejects other sessions, changed DB/generation and pre-cancelled work before dispatch', async () => {
    const f = await setup()
    for (const target of [{ ...f.request.target, db: 1 }, { ...f.request.target, generation: 999 }]) expect((await f.reader.read('a', { ...f.request, target }, signal())).error).toBe('stale')
    expect((await f.reader.read('other', f.request, signal())).error).toBe('stale')
    const controller = new AbortController(); controller.abort()
    expect((await f.reader.read('a', f.request, controller.signal)).error).toBe('cancelled'); expect(f.calls).toHaveLength(0)
  })
  it('applies one ten-second deadline while a query is hanging', async () => {
    vi.useFakeTimers(); const f = await setup()
    f.exists.mockImplementationOnce(async (_c, _a, requestSignal) => new Promise((_resolve, reject) => requestSignal.addEventListener('abort', () => reject(new Error('aborted')), { once: true })))
    const pending = f.reader.read('a', { ...f.request, itemBase64: '' }, signal()); await vi.advanceTimersByTimeAsync(10000)
    expect(await pending).toMatchObject({ error: 'timeout', membership: null, info: null })
  })
  it('discards mid-query cancellation and a late reply from a replaced connection', async () => {
    const f = await setup(), controller = new AbortController()
    f.exists.mockImplementationOnce(async (_c, _a, requestSignal) => new Promise((_resolve, reject) => requestSignal.addEventListener('abort', () => reject(new Error('aborted')), { once: true })))
    const cancelled = f.reader.read('a', { ...f.request, itemBase64: '' }, controller.signal)
    await vi.waitFor(() => expect(f.exists).toHaveBeenCalledTimes(1)); controller.abort()
    expect((await cancelled).error).toBe('cancelled')
    let finish: ((reply: RedisReply) => void) | undefined
    f.exists.mockImplementationOnce(async () => new Promise(resolve => { finish = resolve }))
    const old = f.reader.read('a', { ...f.request, itemBase64: '' }, signal()); await vi.waitFor(() => expect(finish).toBeDefined())
    await f.connections.connect('a', settings, signal()); finish?.(1n)
    expect(await old).toMatchObject({ error: 'stale', membership: null })
  })
})
describe('Bloom query bytes and strict protocol', () => {
  it('keeps UTF-8/binary/empty input exact and enforces 4 KiB with canonical Base64', () => {
    expect(bloomItemBase64('text', '中文😀')).toBe(Buffer.from('中文😀').toString('base64'))
    expect(bloomItemBase64('base64', item.toString('base64'))).toBe(item.toString('base64'))
    expect(bloomItemBase64('text', '')).toBe(''); expect(bloomItemBase64('base64', '')).toBe('')
    expect(bloomItemBase64('text', 'x'.repeat(4096))).toBe(Buffer.alloc(4096, 120).toString('base64'))
    for (const value of ['Zg', ' Zg==', 'Zh==', '*', Buffer.alloc(4097).toString('base64')]) expect(() => bloomItemBase64('base64', value)).toThrow()
    expect(() => bloomItemBase64('text', '中'.repeat(1366))).toThrow()
  })
  it('rejects extra commands/owners and oversized/malformed items on both request faces', async () => {
    const f = await setup(), codec = redisHostDescriptors.find(d => d.method === 'readBloom')?.parameters.find(p => p.name === 'request')?.codec
    if (codec?.mode !== 'strict') throw new Error('Missing codec')
    for (const schema of [codec.create(), bloomReadRequestSchema]) {
      expect(schema.parse(f.request)).toEqual(f.request); expect(schema.parse({ ...f.request, itemBase64: '' })).toMatchObject({ itemBase64: '' })
      expect(schema.parse({ ...f.request, keyBase64: Buffer.alloc(65536).toString('base64'), itemBase64: Buffer.alloc(4096).toString('base64') })).toBeDefined()
      for (const value of [{ ...f.request, command: 'BF.ADD x y' }, { ...f.request, owner: 'other' }, { ...f.request, itemBase64: 'bad' }, { ...f.request, itemBase64: Buffer.alloc(4097).toString('base64') }, { ...f.request, items: [] }, { ...f.request, keyBase64: 'bad' }]) expect(() => schema.parse(value)).toThrow()
    }
  })
  it('enforces probability-only verdicts and consistent info/query/state on both response faces', async () => {
    const f = await setup(), codec = redisHostDescriptors.find(d => d.method === 'readBloom')?.result
    if (codec?.mode !== 'strict') throw new Error('Missing result')
    const result = await f.reader.read('a', { ...f.request, itemBase64: '' }, signal())
    for (const schema of [codec.create(), bloomReadResultSchema]) {
      expect(schema.parse(result)).toEqual(result)
      expect(schema.parse({ ...result, info: { ...result.info, expansion: null } })).toMatchObject({ info: { expansion: null } })
      expect(schema.parse({ ...result, info: null, infoState: 'permission' })).toMatchObject({ membership: 'maybe-present' })
      for (const invalid of [{ ...result, membership: 'present' }, { ...result, membership: 1 }, { ...result, itemBase64: null }, { ...result, info: null }, { ...result, infoState: 'permission' }, { ...result, state: 'missing' }, { ...result, error: 'permission' }, { ...result, metadata: { type: 'MBbloomCF', ttlMs: '-1', length: null } }, { ...result, info: { ...result.info, capacity: '9223372036854775808' } }, { ...result, password: 'secret' }]) expect(() => schema.parse(invalid)).toThrow()
    }
  })
})
