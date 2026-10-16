import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RedisConnections, type RedisLink } from '../src/host/connection-service.ts'
import { RedisGeo } from '../src/host/geo-reader.ts'
import { RedisReplyError } from '../src/host/resp.ts'
import type { GeoReadRequest } from '../src/domain.ts'
import { geoReadRequestSchema, geoReadResultSchema } from '../src/typert.shared.ts'
import { redisHostDescriptors } from '../src/typert.host.ts'
import { isGeoPosition } from '../src/redis-geo.ts'

const signal = () => new AbortController().signal
const key = Buffer.from([255, 0, 13]), member = Buffer.from([254, 0]), settings = { host: 'localhost', port: 6379, username: '', password: '', tls: null }
const coord = () => [Buffer.from('13.361389338970184'), Buffer.from('38.1155563954963')]
const pairs = () => [member, Buffer.from('3479099956230698'), Buffer.alloc(0), Buffer.from('inf')]
beforeEach(() => { vi.spyOn(console, 'info').mockImplementation(() => undefined) })
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })

async function setup() {
  const state = { type: 'zset', ttl: -1n, length: 4n }
  const calls: { command: string; args: readonly (string | Buffer)[]; deadline: number | undefined }[] = []
  const range = vi.fn<RedisLink['execute']>().mockResolvedValue(pairs()), positions = vi.fn<RedisLink['execute']>().mockResolvedValue([coord(), null])
  const execute: RedisLink['execute'] = async (command, args, commandSignal, guard, deadline) => {
    guard(); calls.push({ command, args, deadline }); expect(args[0]).toEqual(key)
    if (command === 'TYPE') return state.type
    if (command === 'PTTL') return state.ttl
    if (command === 'ZCARD') return state.length
    if (command === 'ZRANGE') return range(command, args, commandSignal, guard, deadline)
    if (command === 'GEOPOS') return positions(command, args, commandSignal, guard, deadline)
    throw new Error('Unexpected non-read command')
  }
  const connections = new RedisConnections(async () => ({ execute, close: () => undefined, onFailure: () => () => undefined }))
  const view = await connections.connect('a', settings, signal())
  if (view.id === null) throw new Error('Missing fixture target')
  const request: GeoReadRequest = { target: { id: view.id, generation: view.generation, db: 0 }, keyBase64: key.toString('base64'), offset: '0', count: 2 }
  return { connections, request, reader: new RedisGeo(connections), state, calls, range, positions }
}

describe('Explicit bounded GEO interpretation', () => {
  it('keeps raw binary/empty members, original score/rank/coordinate text and one total deadline', async () => {
    const f = await setup(); f.state.ttl = 9007199254740993n
    try {
      const result = await f.reader.read('a', f.request, signal())
      expect(result).toMatchObject({ state: 'page', metadata: { type: 'zset', ttlMs: '9007199254740993', length: '4' }, offset: '0', nextOffset: '2' })
      expect(result.entries.map(entry => [entry.member.base64, entry.rank, entry.score])).toEqual([[member.toString('base64'), '0', '3479099956230698'], ['', '1', 'inf']])
      expect(result.entries[0]?.position).toEqual({ longitude: '13.361389338970184', latitude: '38.1155563954963' }); expect(result.entries[1]?.position).toBeNull()
      expect(f.positions.mock.calls[0]?.[1]).toEqual([key, member, Buffer.alloc(0)])
      expect(f.range.mock.calls[0]?.[1]).toEqual([key, '0', '1', 'WITHSCORES'])
      expect(f.calls.map(call => call.command)).toEqual(['TYPE', 'PTTL', 'ZCARD', 'ZRANGE', 'GEOPOS', 'TYPE', 'ZCARD', 'PTTL']); expect(new Set(f.calls.map(call => call.deadline)).size).toBe(1)
    } finally { f.connections.dispose() }
  })
  it('continues exact rank intervals, ends at EOF and does not query positions for empty intervals', async () => {
    const f = await setup()
    try {
      const second = await f.reader.read('a', { ...f.request, offset: '2' }, signal())
      expect(second.entries.map(entry => entry.rank)).toEqual(['2', '3']); expect(second.nextOffset).toBeNull()
      f.range.mockResolvedValue([]); f.positions.mockClear()
      for (const offset of ['4', '9223372036854775807']) expect(await f.reader.read('a', { ...f.request, offset, count: 100 }, signal())).toMatchObject({ state: 'page', offset, entries: [], nextOffset: null })
      expect(f.positions).not.toHaveBeenCalled(); expect(f.range.mock.lastCall?.[1]).toEqual([key, '9223372036854775807', '9223372036854775807', 'WITHSCORES'])
    } finally { f.connections.dispose() }
  })
  it('does not classify ordinary scores as a new Redis type and preserves all-null positions', async () => {
    const f = await setup()
    try {
      f.range.mockResolvedValue([member, Buffer.from('-1'), Buffer.alloc(0), Buffer.from('0.5')]); f.positions.mockResolvedValue([null, null])
      const page = await f.reader.read('a', f.request, signal())
      expect(page.state).toBe('page'); expect(page.metadata?.type).toBe('zset'); expect(page.entries.map(entry => entry.position)).toEqual([null, null])
      expect(page.entries.map(entry => entry.score)).toEqual(['-1', '0.5'])
    } finally { f.connections.dispose() }
  })
  it('separates missing/expired/unsupported keys without issuing GEOPOS', async () => {
    const f = await setup()
    try {
      f.state.type = 'none'; expect((await f.reader.read('a', f.request, signal())).state).toBe('missing')
      f.state.type = 'zset'; f.state.ttl = -2n; expect((await f.reader.read('a', f.request, signal())).state).toBe('missing')
      f.state.type = 'string'; f.state.ttl = -1n
      expect(await f.reader.read('a', f.request, signal())).toMatchObject({ state: 'unsupported', metadata: { type: 'string', length: null } }); expect(f.positions).not.toHaveBeenCalled()
    } finally { f.connections.dispose() }
  })
  it('checks the combined 96 KiB request budget before constructing member arguments', async () => {
    const f = await setup(); f.state.length = 2n
    try {
      const first = Buffer.alloc(49150, 97), second = Buffer.alloc(49151, 98)
      f.range.mockResolvedValue([first, Buffer.from('0'), second, Buffer.from('1')])
      expect((await f.reader.read('a', f.request, signal())).state).toBe('page')
      f.positions.mockClear(); f.range.mockResolvedValue([first, Buffer.from('0'), Buffer.alloc(49152, 98), Buffer.from('1')])
      expect(await f.reader.read('a', f.request, signal())).toMatchObject({ state: 'failed', error: 'oversize', entries: [] }); expect(f.positions).not.toHaveBeenCalled()
      f.range.mockResolvedValue([Buffer.alloc(65537), Buffer.from('0')])
      expect((await f.reader.read('a', f.request, signal())).error).toBe('oversize')
    } finally { f.connections.dispose() }
  })
  it('refuses malformed member/score pages and duplicate rank identities', async () => {
    const f = await setup()
    try {
      for (const bad of [null, 'array', [member], [member, '0'], [member, Buffer.from('nan')], [member, Buffer.from('0'), member, Buffer.from('1')], [...pairs(), Buffer.from('extra'), Buffer.from('1')]]) {
        f.range.mockResolvedValue(bad); expect((await f.reader.read('a', f.request, signal())).error).toBe('protocol')
      }
      expect(f.positions).not.toHaveBeenCalled()
    } finally { f.connections.dispose() }
  })
  it('refuses malformed position counts, shapes, numeric types and coordinate ranges', async () => {
    const f = await setup()
    try {
      for (const bad of [null, [], [coord()], [coord(), null, null], ['position', null], [[1n, 2n], null], [[Buffer.from('181'), Buffer.from('0')], null], [[Buffer.from('0'), Buffer.from('86')], null], [[Buffer.from('inf'), Buffer.from('0')], null], [[Buffer.from('0')], null]]) {
        f.positions.mockResolvedValue(bad); expect(await f.reader.read('a', f.request, signal())).toMatchObject({ state: 'failed', error: 'protocol', entries: [] })
      }
    } finally { f.connections.dispose() }
  })
  it('discards page data when metadata detects length/type/expiry/deletion changes', async () => {
    const f = await setup()
    try {
      for (const mode of ['length', 'type', 'expire', 'delete']) {
        Object.assign(f.state, { type: 'zset', ttl: -1n, length: 4n })
        f.positions.mockImplementation(async () => { if (mode === 'length') f.state.length = 5n; if (mode === 'type') f.state.type = 'string'; if (mode === 'expire') f.state.ttl = -2n; if (mode === 'delete') f.state.type = 'none'; return [coord(), null] })
        expect(await f.reader.read('a', f.request, signal())).toMatchObject({ state: mode === 'expire' || mode === 'delete' ? 'missing' : 'changed', entries: [] })
      }
      Object.assign(f.state, { type: 'zset', ttl: -1n, length: 4n }); f.range.mockResolvedValue(pairs().slice(0, 2)); f.positions.mockResolvedValue([coord()])
      expect((await f.reader.read('a', f.request, signal())).state).toBe('changed')
    } finally { f.connections.dispose() }
  })
  it('maps unavailable/permission/type errors to fixed states without raw private text', async () => {
    const f = await setup()
    try {
      for (const [message, expected] of [["ERR unknown command 'GEOPOS' private", { state: 'unavailable', error: null }], ['NOPERM private', { state: 'failed', error: 'permission' }], ['WRONGTYPE private', { state: 'changed', error: null }]] as const) {
        f.positions.mockRejectedValue(new RedisReplyError(message)); const page = await f.reader.read('a', f.request, signal())
        expect(page).toMatchObject(expected); expect(JSON.stringify(page)).not.toContain('private')
      }
    } finally { f.connections.dispose() }
  })
  it('rejects wrong session/DB/generation and prefers stale over a late server refusal', async () => {
    const f = await setup()
    try {
      for (const [session, target] of [['other', f.request.target], ['a', { ...f.request.target, db: 1 }], ['a', { ...f.request.target, generation: f.request.target.generation + 1 }]] as const) expect((await f.reader.read(session, { ...f.request, target }, signal())).error).toBe('stale')
      expect(f.calls).toEqual([])
      f.positions.mockImplementation(async () => { f.connections.disconnect('a', f.request.target); throw new RedisReplyError("ERR unknown command 'GEOPOS'") })
      expect((await f.reader.read('a', f.request, signal())).error).toBe('stale')
    } finally { f.connections.dispose() }
  })
  it('honors pre-cancel and an operation-wide ten-second deadline', async () => {
    const f = await setup()
    try {
      const controller = new AbortController(); controller.abort()
      expect((await f.reader.read('a', f.request, controller.signal)).error).toBe('cancelled'); expect(f.calls).toEqual([])
      vi.useFakeTimers(); f.positions.mockImplementation((_cmd, _args, commandSignal) => new Promise((_resolve, reject) => commandSignal.addEventListener('abort', () => reject(new Error('abort')), { once: true })))
      const pending = f.reader.read('a', f.request, signal()); await vi.advanceTimersByTimeAsync(10001)
      expect(await pending).toMatchObject({ state: 'failed', error: 'timeout', entries: [] })
    } finally { f.connections.dispose() }
  })
  it('cancels an active query, discards late coordinates and allows an explicit retry', async () => {
    const f = await setup()
    try {
      const controller = new AbortController()
      f.positions.mockImplementationOnce((_cmd, _args, commandSignal) => new Promise((_resolve, reject) => commandSignal.addEventListener('abort', () => reject(new Error('cancel')), { once: true })))
      const pending = f.reader.read('a', f.request, controller.signal); await vi.waitFor(() => expect(f.positions).toHaveBeenCalledOnce()); controller.abort()
      expect((await pending).error).toBe('cancelled'); expect((await f.reader.read('a', f.request, signal())).state).toBe('page')
    } finally { f.connections.dispose() }
  })
})

describe('GEO strict contract and coordinate text', () => {
  it('validates finite coordinate ranges without reformatting text', () => {
    for (const longitude of ['-180', '180', '-0', '+0.0', '1e-10']) expect(isGeoPosition({ longitude, latitude: '85.05112878' })).toBe(true)
    for (const longitude of ['181', 'NaN', 'inf', '1e400', ' 1', '', '1'.repeat(129)]) expect(isGeoPosition({ longitude, latitude: '0' })).toBe(false)
    expect(isGeoPosition({ longitude: '0', latitude: '-85.05112878' })).toBe(true); expect(isGeoPosition({ longitude: '0', latitude: '85.05112879' })).toBe(false)
  })
  it('keeps both request/result faces strict and rejects mixed paging, bad coordinates and oversize output', async () => {
    const f = await setup()
    try {
      const descriptor = redisHostDescriptors.find(d => d.method === 'readGeo'), codec = descriptor?.parameters.find(p => p.name === 'request')?.codec
      if (codec?.mode !== 'strict' || descriptor?.result.mode !== 'strict') throw new Error('Missing GEO codec')
      for (const schema of [codec.create(), geoReadRequestSchema]) {
        expect(schema.parse(f.request)).toEqual(f.request)
        for (const change of [{ offset: '-1' }, { offset: '01' }, { offset: '9223372036854775808' }, { count: 0 }, { count: 101 }, { keyBase64: '!' }, { mode: 'scan' }, { command: 'GEOADD' }, { sessionId: 'other' }]) expect(() => schema.parse({ ...f.request, ...change })).toThrow()
      }
      const page = await f.reader.read('a', f.request, signal()), row = page.entries[0]
      if (row === undefined) throw new Error('Missing sample')
      for (const schema of [descriptor.result.create(), geoReadResultSchema]) {
        expect(schema.parse(page)).toEqual(page)
        for (const change of [{ entries: [{ ...row, position: { longitude: '181', latitude: '0' } }] }, { entries: [{ ...row, position: { longitude: '0', latitude: '0', extra: true } }] }, { entries: [{ ...row, rank: null }] }, { entries: [row, row] }, { entries: [{ ...row, score: 'nan' }] }, { offset: '1' }, { nextOffset: null }, { state: 'unavailable' }, { metadata: { type: 'geo', ttlMs: '-1', length: '4' } }, { cursor: 'token' }, { password: 'secret' }]) expect(() => schema.parse({ ...page, ...change })).toThrow()
        expect(schema.parse({ ...page, state: 'unavailable', metadata: null, entries: [], nextOffset: null })).toMatchObject({ state: 'unavailable' })
        const entries = Array.from({ length: 20 }, (_, index) => ({ ...row, member: { base64: Buffer.alloc(65536, index).toString('base64'), byteLength: 65536, label: 'large' }, rank: String(index) }))
        expect(() => schema.parse({ ...page, entries, metadata: { type: 'zset', ttlMs: '-1', length: '20' }, nextOffset: null })).toThrow()
      }
    } finally { f.connections.dispose() }
  })
})
