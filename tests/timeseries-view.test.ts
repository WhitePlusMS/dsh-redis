import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RedisConnections, type RedisLink } from '../src/host/connection-service.ts'
import { RedisTimeSeries } from '../src/host/timeseries-reader.ts'
import { RedisReplyError, type RedisReply } from '../src/host/resp.ts'
import type { TimeSeriesReadRequest } from '../src/domain.ts'
import { timeSeriesReadRequestSchema, timeSeriesReadResultSchema } from '../src/typert.shared.ts'
import { redisHostDescriptors } from '../src/typert.host.ts'
import { isTimeSeriesRange, isTimeSeriesTimestamp, MAX_TIMESERIES_TIMESTAMP } from '../src/redis-timeseries.ts'
import { appendTimeSeriesSamples, emptyTimeSeriesCache } from '../src/client/timeseries-cache.ts'

const signal = () => new AbortController().signal
const key = Buffer.from([255, 0, 13])
const settings = { host: 'localhost', port: 6379, username: '', password: '', tls: null }
const samples: RedisReply[] = [[0n, '1.2345678901234567'], [9007199254740993n, '-0.00000000000000001'], [9223372036854775807n, '1.7976931348623157e+308']]
beforeEach(() => { vi.spyOn(console, 'info').mockImplementation(() => undefined) })
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })
async function setup() {
  const state = { type: 'TSDB-TYPE', ttl: -1n }
  const calls: { command: string; args: readonly (string | Buffer)[]; deadline: number | undefined }[] = []
  const range = vi.fn<RedisLink['execute']>().mockResolvedValue(samples.slice(0, 2))
  const info = vi.fn<RedisLink['execute']>().mockResolvedValue(['totalSamples', 3n, 'firstTimestamp', 0n, 'lastTimestamp', 9223372036854775807n, 'retentionTime', 0n, 'labels', []])
  const execute: RedisLink['execute'] = async (command, args, commandSignal, guard, deadline) => {
    guard(); calls.push({ command, args, deadline }); expect(args[0]).toEqual(key)
    if (command === 'TYPE') return state.type
    if (command === 'PTTL') return state.ttl
    if (command === 'TS.INFO') return info(command, args, commandSignal, guard, deadline)
    if (command === 'TS.RANGE' || command === 'TS.REVRANGE') return range(command, args, commandSignal, guard, deadline)
    throw new Error('Unexpected or non-read command')
  }
  const connections = new RedisConnections(async () => ({ close: () => undefined, execute, onFailure: () => () => undefined }))
  const view = await connections.connect('a', settings, signal())
  if (view.id === null) throw new Error('Missing target')
  const request: TimeSeriesReadRequest = { target: { id: view.id, generation: view.generation, db: 0 }, keyBase64: key.toString('base64'), direction: 'forward', start: '-', end: '+', count: 2, cursor: null }
  const reader = new RedisTimeSeries(connections)
  return { state, calls, range, info, connections, reader, request, dispose: () => { reader.dispose(); connections.dispose() } }
}
describe('TimeSeries precise bounded reads', () => {
  it('preserves raw key bytes, value text and Int64 timestamps/metadata with one total deadline', async () => {
    const f = await setup(); f.state.ttl = 9007199254740993n
    try {
      const page = await f.reader.read('a', f.request, signal())
      expect(page).toMatchObject({ state: 'page', infoState: 'available', metadata: { type: 'TSDB-TYPE', ttlMs: '9007199254740993', length: null }, info: { totalSamples: '3', lastTimestamp: MAX_TIMESERIES_TIMESTAMP } })
      expect(page.samples).toEqual([{ timestamp: '0', value: '1.2345678901234567' }, { timestamp: '9007199254740993', value: '-0.00000000000000001' }])
      expect(f.calls.map(call => call.command)).toEqual(['TYPE', 'PTTL', 'TS.INFO', 'TS.RANGE', 'TYPE', 'PTTL'])
      expect(new Set(f.calls.map(call => call.deadline)).size).toBe(1)
    } finally { f.dispose() }
  })
  it('continues using exact last+1 and stops at max without Stream syntax or overflow', async () => {
    const f = await setup(); f.range.mockResolvedValueOnce(samples.slice(0, 2)).mockResolvedValueOnce(samples.slice(2))
    try {
      const first = await f.reader.read('a', f.request, signal()), last = await f.reader.read('a', { ...f.request, cursor: first.cursor }, signal())
      expect(first.cursor).not.toBeNull(); expect(last.cursor).toBeNull(); expect(last.samples[0]?.timestamp).toBe(MAX_TIMESERIES_TIMESTAMP)
      expect(f.range.mock.calls.map(call => call[1])).toEqual([[key, '-', '+', 'COUNT', '2'], [key, '9007199254740994', '+', 'COUNT', '2']])
      expect((await f.reader.read('a', { ...f.request, cursor: first.cursor }, signal())).error).toBe('stale')
    } finally { f.dispose() }
  })
  it('keeps low/high order in reverse, continues last-1 including timestamp zero and stops before underflow', async () => {
    const f = await setup(); f.range.mockResolvedValueOnce([[1n, '1']]).mockResolvedValueOnce([[0n, '0']])
    try {
      const request = { ...f.request, direction: 'reverse' as const, count: 1 }
      const first = await f.reader.read('a', request, signal()), last = await f.reader.read('a', { ...request, cursor: first.cursor }, signal())
      expect(first.cursor).not.toBeNull(); expect(last).toMatchObject({ state: 'page', cursor: null, samples: [{ timestamp: '0', value: '0' }] })
      expect(f.range.mock.calls.map(call => call[1])).toEqual([[key, '-', '+', 'COUNT', '1'], [key, '-', '0', 'COUNT', '1']])
    } finally { f.dispose() }
  })
  it('includes single timestamp bounds and distinguishes empty existing series/range from missing', async () => {
    const f = await setup(); f.range.mockResolvedValue([[1n, '3']])
    try {
      expect(await f.reader.read('a', { ...f.request, start: '1', end: '1', count: 1 }, signal())).toMatchObject({ state: 'page', cursor: null, samples: [{ timestamp: '1', value: '3' }] })
      f.range.mockResolvedValue([])
      expect(await f.reader.read('a', f.request, signal())).toMatchObject({ state: 'page', samples: [], cursor: null })
      f.state.type = 'none'; expect((await f.reader.read('a', f.request, signal())).state).toBe('missing')
      f.state.type = 'TSDB-TYPE'; f.state.ttl = -2n; expect((await f.reader.read('a', f.request, signal())).state).toBe('missing')
      f.state.type = 'string'; f.state.ttl = -1n; expect((await f.reader.read('a', f.request, signal())).state).toBe('unsupported')
    } finally { f.dispose() }
  })
  it('keeps INFO permission/unavailability separate from sample permission/unavailability', async () => {
    const f = await setup()
    try {
      for (const [error, expected] of [[new RedisReplyError('NOPERM secret'), 'permission'], [new RedisReplyError("ERR unknown command 'TS.INFO'"), 'unavailable']] as const) {
        f.info.mockRejectedValue(error)
        expect(await f.reader.read('a', f.request, signal())).toMatchObject({ state: 'page', info: null, infoState: expected })
      }
      f.range.mockRejectedValue(new RedisReplyError('NOPERM secret'))
      expect(await f.reader.read('a', f.request, signal())).toMatchObject({ state: 'failed', error: 'permission', samples: [], info: null })
      f.range.mockRejectedValue(new RedisReplyError("ERR unknown command 'TS.RANGE' secret"))
      const result = await f.reader.read('a', f.request, signal()); expect(result.state).toBe('unavailable'); expect(JSON.stringify(result)).not.toContain('secret')
      expect(f.calls.every(call => ['TYPE', 'PTTL', 'TS.INFO', 'TS.RANGE'].includes(call.command))).toBe(true)
    } finally { f.dispose() }
  })
  it('discards actual post-type changes and classifies TSDB-specific disappearance/refusal via recheck', async () => {
    for (const type of ['none', 'hash']) {
      const f = await setup()
      try {
        f.range.mockImplementationOnce(async () => { f.state.type = type; return samples.slice(0, 2) })
        expect((await f.reader.read('a', f.request, signal())).state).toBe(type === 'none' ? 'missing' : 'changed')
        f.state.type = 'TSDB-TYPE'
        f.range.mockImplementationOnce(async () => { f.state.type = type; throw new RedisReplyError(type === 'none' ? 'ERR TSDB: the key does not exist' : 'ERR WRONGTYPE Operation against a key holding the wrong kind of value') })
        expect((await f.reader.read('a', f.request, signal())).state).toBe(type === 'none' ? 'missing' : 'changed')
      } finally { f.dispose() }
    }
  })
  it('rejects malformed, nonfinite, duplicate, unsorted, out-of-range and excess replies', async () => {
    const f = await setup()
    try {
      for (const reply of [null, [[1n]], [[1n, Buffer.from('1')]], [[-1n, '1']], [[9223372036854775808n, '1']], [[1n, 'nan']], [[1n, 'inf']], [[1n, '1e9999']], [[1n, '1\n']], [[2n, '2'], [1n, '1']], [[1n, '1'], [1n, '1']], [[1n, '1'], [2n, '2'], [3n, '3']]]) {
        f.range.mockResolvedValue(reply); expect((await f.reader.read('a', f.request, signal())).error).toBe('protocol')
      }
      f.range.mockResolvedValue([[1n, '1']]); expect((await f.reader.read('a', { ...f.request, start: '2' }, signal())).error).toBe('protocol')
      f.info.mockResolvedValue(['totalSamples', 1n]); expect((await f.reader.read('a', f.request, signal())).error).toBe('protocol')
    } finally { f.dispose() }
  })
  it('binds single-use tokens to raw key/range/direction/count/target and trusted session', async () => {
    const f = await setup()
    try {
      const first = await f.reader.read('a', f.request, signal())
      for (const request of [{ ...f.request, keyBase64: '' }, { ...f.request, start: '0' }, { ...f.request, end: '9' }, { ...f.request, direction: 'reverse' as const }, { ...f.request, count: 1 }, { ...f.request, target: { ...f.request.target, db: 1 } }, { ...f.request, target: { ...f.request.target, generation: 99 } }]) expect((await f.reader.read('a', { ...request, cursor: first.cursor }, signal())).error).toBe('stale')
      expect((await f.reader.read('other', { ...f.request, cursor: first.cursor }, signal())).error).toBe('stale')
      f.range.mockResolvedValue(samples.slice(2)); expect((await f.reader.read('a', { ...f.request, cursor: first.cursor }, signal())).state).toBe('page')
    } finally { f.dispose() }
  })
  it('cancels before dispatch, discards late refresh replies and clears session continuations', async () => {
    const f = await setup(); const controller = new AbortController(); controller.abort()
    try {
      expect((await f.reader.read('a', f.request, controller.signal)).error).toBe('cancelled'); expect(f.calls).toHaveLength(0)
      let finish: ((reply: RedisReply) => void) | undefined
      f.range.mockImplementationOnce(async () => new Promise(resolve => { finish = resolve }))
      const old = f.reader.read('a', f.request, signal()); await vi.waitFor(() => expect(finish).toBeDefined())
      const latest = await f.reader.read('a', f.request, signal()); finish?.(samples.slice(0, 2))
      expect((await old).error).toBe('stale'); f.reader.disposeSession('a')
      expect((await f.reader.read('a', { ...f.request, cursor: latest.cursor }, signal())).error).toBe('stale')
    } finally { f.dispose() }
  })
  it('uses a total ten-second deadline and invalidates cancelled continuation before retry', async () => {
    vi.useFakeTimers(); const f = await setup()
    try {
      const first = await f.reader.read('a', f.request, signal())
      f.range.mockImplementationOnce(async (_c, _a, commandSignal) => new Promise((_resolve, reject) => commandSignal.addEventListener('abort', () => reject(new Error('aborted')), { once: true })))
      const pending = f.reader.read('a', { ...f.request, cursor: first.cursor }, signal()); await vi.advanceTimersByTimeAsync(10000)
      expect(await pending).toMatchObject({ error: 'timeout', samples: [], cursor: null })
      expect((await f.reader.read('a', { ...f.request, cursor: first.cursor }, signal())).error).toBe('stale')
      expect((await f.reader.read('a', f.request, signal())).state).toBe('page')
    } finally { f.dispose() }
  })
})
describe('TimeSeries cache and strict protocol', () => {
  it('keeps exact timestamp identity and bounds cached sample count/encoded bytes', () => {
    const incoming = [{ timestamp: '9007199254740993', value: '1.2345678901234567' }], first = appendTimeSeriesSamples(emptyTimeSeriesCache(), incoming)
    expect(appendTimeSeriesSamples(first, incoming)).toEqual(first)
    expect(appendTimeSeriesSamples({ ...first, bytes: 2 * 1024 * 1024 }, [{ timestamp: '9', value: '1' }]).limited).toBe(true)
    expect(appendTimeSeriesSamples({ samples: Array.from({ length: 5000 }, (_, index) => ({ timestamp: String(index), value: '1' })), bytes: 0, limited: false }, incoming).limited).toBe(true)
  })
  it('rejects loose/negative/exclusive/overflow range syntax while accepting zero/max', () => {
    for (const stamp of ['0', '9007199254740993', MAX_TIMESERIES_TIMESTAMP]) expect(isTimeSeriesTimestamp(stamp)).toBe(true)
    for (const stamp of ['-1', '01', '+1', '(1', '1-0', '9223372036854775808', '1\n', '']) expect(isTimeSeriesTimestamp(stamp)).toBe(false)
    expect(isTimeSeriesRange('-', '+')).toBe(true); expect(isTimeSeriesRange('0', '0')).toBe(true)
    expect(isTimeSeriesRange('2', '1')).toBe(false); expect(isTimeSeriesRange('+', '-')).toBe(false)
  })
  it('rejects hidden commands/owners, invalid ranges/bytes/count/tokens on both request faces', async () => {
    const f = await setup()
    try {
      const codec = redisHostDescriptors.find(d => d.method === 'readTimeSeries')?.parameters.find(p => p.name === 'request')?.codec
      if (codec?.mode !== 'strict') throw new Error('Missing codec')
      for (const schema of [codec.create(), timeSeriesReadRequestSchema]) {
        expect(schema.parse(f.request)).toEqual(f.request)
        for (const request of [{ ...f.request, owner: 'other' }, { ...f.request, command: 'TS.ADD x * 1' }, { ...f.request, start: '(1' }, { ...f.request, start: '2', end: '1' }, { ...f.request, end: '9223372036854775808' }, { ...f.request, direction: 'arbitrary' }, { ...f.request, count: 101 }, { ...f.request, count: 0 }, { ...f.request, keyBase64: 'bad' }, { ...f.request, cursor: '9007199254740993' }]) expect(() => schema.parse(request)).toThrow()
      }
    } finally { f.dispose() }
  })
  it('validates strict samples, independent info state and fixed failure metadata on both reply faces', async () => {
    const f = await setup()
    try {
      const codec = redisHostDescriptors.find(d => d.method === 'readTimeSeries')?.result
      if (codec?.mode !== 'strict') throw new Error('Missing result')
      const page = await f.reader.read('a', f.request, signal())
      for (const schema of [codec.create(), timeSeriesReadResultSchema]) {
        expect(schema.parse(page)).toEqual(page)
        expect(schema.parse({ ...page, info: null, infoState: 'permission' })).toMatchObject({ infoState: 'permission' })
        for (const invalid of [{ ...page, password: 'secret' }, { ...page, samples: [page.samples[0], page.samples[0]] }, { ...page, direction: 'reverse' }, { ...page, start: '1' }, { ...page, samples: [{ timestamp: 9007199254740993, value: '1' }] }, { ...page, samples: [{ timestamp: '0', value: 'nan' }] }, { ...page, info: null }, { ...page, infoState: 'permission' }, { ...page, samples: [], cursor: page.cursor }, { ...page, metadata: { type: 'string', ttlMs: '-1', length: null } }, { ...page, state: 'missing' }, { ...page, error: 'permission' }]) expect(() => schema.parse(invalid)).toThrow()
      }
    } finally { f.dispose() }
  })
})
