import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RedisConnections, type RedisLink } from '../src/host/connection-service.ts'
import { RedisStreams } from '../src/host/stream-reader.ts'
import { RedisReplyError } from '../src/host/resp.ts'
import type { StreamReadRequest } from '../src/domain.ts'
import { streamReadRequestSchema, streamReadResultSchema } from '../src/typert.shared.ts'
import { redisHostDescriptors } from '../src/typert.host.ts'
import { compareStreamIds, isStreamId, isStreamRange, MAX_STREAM_ID } from '../src/stream-id.ts'
import { appendStreamMessages, emptyStreamCache } from '../src/client/stream-cache.ts'

const signal = () => new AbortController().signal
const settings = { host: 'localhost', port: 6379, username: '', password: '', tls: null }
const key = Buffer.from([255, 0, 13]), binary = Buffer.from([254, 0])
const wire = (id: string, fields: Buffer[] = [Buffer.from('field'), Buffer.from('value')]) => [Buffer.from(id), fields]
const samples = [wire('1-0', [binary, Buffer.from([255, 0]), Buffer.from('same'), Buffer.from('one'), Buffer.from('same'), Buffer.from('two'), Buffer.alloc(0), Buffer.alloc(0)]), wire('1-18446744073709551615'), wire('9007199254740993-0'), wire(MAX_STREAM_ID)]
beforeEach(() => { vi.spyOn(console, 'info').mockImplementation(() => undefined) })
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })

async function setup() {
  const state = { type: 'stream', ttl: -1n, length: 4n }
  const calls: { command: string; args: readonly (string | Buffer)[]; deadline: number | undefined }[] = []
  const range = vi.fn<RedisLink['execute']>().mockResolvedValue(samples.slice(0, 2))
  const execute: RedisLink['execute'] = async (command, args, commandSignal, guard, deadline) => {
    guard(); calls.push({ command, args, deadline }); expect(args[0]).toEqual(key)
    if (command === 'TYPE') return state.type
    if (command === 'PTTL') return state.ttl
    if (command === 'XLEN') return state.length
    if (command === 'XRANGE' || command === 'XREVRANGE') return range(command, args, commandSignal, guard, deadline)
    throw new Error('Unexpected or non-read command')
  }
  const connections = new RedisConnections(async () => ({ close: () => undefined, execute, onFailure: () => () => undefined }))
  const view = await connections.connect('a', settings, signal())
  if (view.id === null) throw new Error('Missing fixture target')
  const request: StreamReadRequest = { target: { id: view.id, generation: view.generation, db: 0 }, keyBase64: key.toString('base64'), direction: 'forward', start: '-', end: '+', count: 2, cursor: null }
  return { connections, reader: new RedisStreams(connections), request, state, calls, range }
}

describe('Stream raw message and ID pagination', () => {
  it('keeps binary/empty data and repeated field occurrences in order with one total deadline', async () => {
    const f = await setup(); f.state.ttl = 9007199254740993n
    try {
      const page = await f.reader.read('a', f.request, signal())
      expect(page).toMatchObject({ state: 'page', metadata: { type: 'stream', length: '4', ttlMs: '9007199254740993' } })
      const fields = page.messages[0]?.fields
      expect(fields?.map(pair => pair.field.base64)).toEqual([binary.toString('base64'), Buffer.from('same').toString('base64'), Buffer.from('same').toString('base64'), ''])
      expect(fields?.map(pair => Buffer.from(pair.value.base64, 'base64'))).toEqual([Buffer.from([255, 0]), Buffer.from('one'), Buffer.from('two'), Buffer.alloc(0)])
      expect(f.range.mock.calls[0]?.[1]).toEqual([key, '-', '+', 'COUNT', '2'])
      expect(f.calls.map(call => call.command)).toEqual(['TYPE', 'PTTL', 'XLEN', 'XRANGE', 'TYPE', 'XLEN', 'PTTL'])
      expect(new Set(f.calls.map(call => call.deadline)).size).toBe(1)
    } finally { f.reader.dispose(); f.connections.dispose() }
  })
  it('continues forward with an exclusive full ID including maximum sequence, without increment/rounding', async () => {
    const f = await setup(); f.range.mockResolvedValueOnce(samples.slice(0, 2)).mockResolvedValueOnce(samples.slice(2))
    try {
      const first = await f.reader.read('a', f.request, signal()), next = await f.reader.read('a', { ...f.request, cursor: first.cursor }, signal())
      expect(first.cursor).not.toBeNull(); expect(next.cursor).toBeNull()
      expect(next.messages.map(message => message.id)).toEqual(['9007199254740993-0', MAX_STREAM_ID])
      expect(f.range.mock.calls[1]?.[1]).toEqual([key, '(1-18446744073709551615', '+', 'COUNT', '2'])
      expect((await f.reader.read('a', { ...f.request, cursor: first.cursor }, signal())).error).toBe('stale')
    } finally { f.reader.dispose(); f.connections.dispose() }
  })
  it('reverses command bounds and continues exclusively, with an empty terminal probe when needed', async () => {
    const f = await setup(); f.range.mockResolvedValueOnce([...samples.slice(2)].reverse()).mockResolvedValueOnce([...samples.slice(0, 2)].reverse()).mockResolvedValueOnce([])
    try {
      const request = { ...f.request, direction: 'reverse' as const }
      const first = await f.reader.read('a', request, signal()), second = await f.reader.read('a', { ...request, cursor: first.cursor }, signal()), end = await f.reader.read('a', { ...request, cursor: second.cursor }, signal())
      expect(first.messages.map(item => item.id)).toEqual([MAX_STREAM_ID, '9007199254740993-0'])
      expect(second.messages.map(item => item.id)).toEqual(['1-18446744073709551615', '1-0'])
      expect(end).toMatchObject({ state: 'page', messages: [], cursor: null })
      expect(f.calls.filter(call => call.command === 'XREVRANGE').map(call => call.args)).toEqual([[key, '+', '-', 'COUNT', '2'], [key, '(9007199254740993-0', '-', 'COUNT', '2'], [key, '(1-0', '-', 'COUNT', '2']])
    } finally { f.reader.dispose(); f.connections.dispose() }
  })
  it('keeps inclusive single-ID ranges, end bounds and an empty existing Stream distinct', async () => {
    const f = await setup(); f.range.mockResolvedValue([wire('1-18446744073709551615')])
    try {
      const page = await f.reader.read('a', { ...f.request, start: '1-18446744073709551615', end: '1-18446744073709551615', count: 1 }, signal())
      expect(page).toMatchObject({ state: 'page', cursor: null }); expect(page.messages[0]?.id).toBe('1-18446744073709551615')
      f.state.length = 0n; f.range.mockResolvedValue([])
      expect(await f.reader.read('a', f.request, signal())).toMatchObject({ state: 'page', messages: [], cursor: null, metadata: { length: '0' } })
    } finally { f.reader.dispose(); f.connections.dispose() }
  })
  it('allows appends but discards detected trimming, type changes and disappearance', async () => {
    for (const mutation of ['append', 'trim', 'type', 'missing']) {
      const f = await setup()
      f.range.mockImplementation(async () => { if (mutation === 'append') f.state.length++; else if (mutation === 'trim') f.state.length--; else f.state.type = mutation === 'missing' ? 'none' : 'string'; return samples.slice(0, 2) })
      try {
        const page = await f.reader.read('a', f.request, signal())
        expect(page.state).toBe(mutation === 'append' ? 'page' : mutation === 'missing' ? 'missing' : 'changed')
        if (mutation === 'append') expect(page.metadata?.length).toBe('5')
        else expect(page).toMatchObject({ messages: [], cursor: null })
      } finally { f.reader.dispose(); f.connections.dispose() }
    }
  })
  it('does not read rows for missing, expired or other types', async () => {
    const f = await setup()
    try {
      f.state.type = 'none'; expect((await f.reader.read('a', f.request, signal())).state).toBe('missing')
      f.state.type = 'stream'; f.state.ttl = -2n; expect((await f.reader.read('a', f.request, signal())).state).toBe('missing')
      f.state.type = 'hash'; f.state.ttl = -1n
      expect(await f.reader.read('a', f.request, signal())).toMatchObject({ state: 'unsupported', metadata: { type: 'hash', length: null } }); expect(f.range).not.toHaveBeenCalled()
    } finally { f.reader.dispose(); f.connections.dispose() }
  })
  it('bounds value prefixes and refuses oversized field identity or amplified whole-message output', async () => {
    const f = await setup(); const value = Buffer.concat([Buffer.alloc(65535, 97), Buffer.from('中😀'), Buffer.alloc(65536, 98)])
    f.range.mockResolvedValue([wire('1-0', [binary, value])])
    try {
      const prefix = (await f.reader.read('a', f.request, signal())).messages[0]?.fields[0]?.value
      expect(prefix).toMatchObject({ byteLength: 65536, fullByteLength: value.length }); expect(Buffer.from(prefix?.suffix ?? '', 'base64')).toEqual(value.subarray(65536, 65539))
      f.range.mockResolvedValue([wire('1-0', [Buffer.alloc(65537, 97), Buffer.from('v')])])
      expect(await f.reader.read('a', f.request, signal())).toMatchObject({ error: 'oversize', messages: [], cursor: null })
      const fields = Array.from({ length: 6 }, (_, index) => [Buffer.alloc(65536, index), Buffer.alloc(65536, 97)]).flat()
      f.range.mockResolvedValue([wire('1-0', fields)])
      expect(await f.reader.read('a', f.request, signal())).toMatchObject({ error: 'oversize', messages: [], cursor: null })
    } finally { f.reader.dispose(); f.connections.dispose() }
  })
  it('rejects malformed nested messages, field pairs, excessive COUNT and bad/out-of-order IDs', async () => {
    const f = await setup()
    try {
      for (const reply of [[Buffer.from('id')], [[Buffer.from('1-0'), null]], [wire('1-0', [])], [wire('1-0', [Buffer.from('odd')])], [[Buffer.from('1-0'), [Buffer.from('x'), 1n]]], [wire('0-0')], [wire('1-18446744073709551616')], [wire('1-0\n')], [wire('2-0'), wire('1-0')], [wire('1-0'), wire('1-0')], [wire('1-0'), wire('2-0'), wire('3-0')]]) {
        f.range.mockResolvedValue(reply); expect((await f.reader.read('a', f.request, signal())).error).toBe('protocol')
      }
      f.range.mockResolvedValue([wire('1-0')]); expect((await f.reader.read('a', { ...f.request, start: '2-0' }, signal())).error).toBe('protocol')
      f.range.mockResolvedValue([wire('1-0', Array.from({ length: 4097 }, () => [Buffer.from('f'), Buffer.from('v')]).flat())])
      expect((await f.reader.read('a', f.request, signal())).error).toBe('oversize')
    } finally { f.reader.dispose(); f.connections.dispose() }
  })
  it('binds tokens to key, range, direction, DB, session and generation without consuming valid tokens', async () => {
    const f = await setup()
    try {
      const first = await f.reader.read('a', f.request, signal())
      for (const request of [{ ...f.request, keyBase64: '' }, { ...f.request, direction: 'reverse' as const }, { ...f.request, start: '0-0' }, { ...f.request, end: MAX_STREAM_ID }, { ...f.request, target: { ...f.request.target, db: 1 } }, { ...f.request, target: { ...f.request.target, generation: 999 } }]) expect((await f.reader.read('a', { ...request, cursor: first.cursor }, signal())).error).toBe('stale')
      expect((await f.reader.read('other', { ...f.request, cursor: first.cursor }, signal())).error).toBe('stale')
      f.range.mockResolvedValue(samples.slice(2)); expect((await f.reader.read('a', { ...f.request, cursor: first.cursor }, signal())).state).toBe('page')
    } finally { f.reader.dispose(); f.connections.dispose() }
  })
  it('maps permissions and wrong type without returning server secrets or messages', async () => {
    const f = await setup()
    try {
      f.range.mockRejectedValue(new RedisReplyError('NOPERM secret'))
      expect(await f.reader.read('a', f.request, signal())).toMatchObject({ state: 'failed', error: 'permission', messages: [] })
      f.range.mockRejectedValue(new RedisReplyError('WRONGTYPE secret'))
      const page = await f.reader.read('a', f.request, signal()); expect(page).toMatchObject({ state: 'changed', error: null, messages: [] }); expect(JSON.stringify(page)).not.toContain('secret')
    } finally { f.reader.dispose(); f.connections.dispose() }
  })
  it('does not dispatch pre-cancelled work and applies a single ten-second total deadline', async () => {
    vi.useFakeTimers(); const f = await setup()
    try {
      const controller = new AbortController(); controller.abort()
      expect((await f.reader.read('a', f.request, controller.signal)).error).toBe('cancelled'); expect(f.calls).toHaveLength(0)
      f.range.mockImplementation(async (_command, _args, commandSignal) => new Promise((_resolve, reject) => commandSignal.addEventListener('abort', () => reject(new Error('aborted')), { once: true })))
      const pending = f.reader.read('a', f.request, signal()); await vi.advanceTimersByTimeAsync(10000)
      expect(await pending).toMatchObject({ error: 'timeout', messages: [], cursor: null })
    } finally { f.reader.dispose(); f.connections.dispose() }
  })
  it('invalidates mid-read cancellation and restores a fresh page without old continuation', async () => {
    const f = await setup()
    try {
      const first = await f.reader.read('a', f.request, signal()), controller = new AbortController()
      f.range.mockImplementationOnce(async (_command, _args, commandSignal) => new Promise((_resolve, reject) => commandSignal.addEventListener('abort', () => reject(new Error('aborted')), { once: true })))
      const pending = f.reader.read('a', { ...f.request, cursor: first.cursor }, controller.signal)
      await vi.waitFor(() => expect(f.range).toHaveBeenCalledTimes(2)); controller.abort()
      expect((await pending).error).toBe('cancelled'); expect((await f.reader.read('a', { ...f.request, cursor: first.cursor }, signal())).error).toBe('stale')
      expect((await f.reader.read('a', f.request, signal())).state).toBe('page')
    } finally { f.reader.dispose(); f.connections.dispose() }
  })
  it('discards a late old page after refresh and clears tokens on session disposal', async () => {
    const f = await setup(); let finish: ((value: ReturnType<typeof wire>[]) => void) | undefined
    f.range.mockImplementationOnce(async () => new Promise(resolve => { finish = resolve }))
    try {
      const old = f.reader.read('a', f.request, signal()); await vi.waitFor(() => expect(finish).toBeDefined())
      const latest = await f.reader.read('a', f.request, signal()); finish?.(samples.slice(0, 2))
      expect((await old).error).toBe('stale'); f.reader.disposeSession('a')
      expect((await f.reader.read('a', { ...f.request, cursor: latest.cursor }, signal())).error).toBe('stale')
    } finally { f.reader.dispose(); f.connections.dispose() }
  })
})

describe('Stream cache and strict contract', () => {
  it('preserves message order and repeated field occurrences while bounding encoded cache', async () => {
    const f = await setup()
    try {
      const page = await f.reader.read('a', f.request, signal()), cache = appendStreamMessages(emptyStreamCache(), page.messages)
      expect(appendStreamMessages(cache, page.messages).messages).toEqual(cache.messages)
      expect(cache.messages[0]?.fields).toHaveLength(4)
      const other = page.messages[0]; if (other === undefined) throw new Error('Missing message')
      expect(appendStreamMessages({ ...cache, bytes: 2 * 1024 * 1024 }, [{ ...other, id: '2-0' }]).limited).toBe(true)
      expect(appendStreamMessages({ messages: Array.from({ length: 5000 }, (_, index) => ({ ...other, id: String(index + 10) + '-0' })), bytes: 0, limited: false }, [other]).limited).toBe(true)
    } finally { f.reader.dispose(); f.connections.dispose() }
  })
  it('validates and compares both uint64 components without rounding or loose range syntax', () => {
    for (const id of ['0-0', '0-1', '1-18446744073709551615', '9007199254740993-0', MAX_STREAM_ID]) expect(isStreamId(id)).toBe(true)
    for (const id of ['', '01-0', '1', '(1-0', '1-*', '-1-0', '1-18446744073709551616', '18446744073709551616-0', '1-0\n']) expect(isStreamId(id)).toBe(false)
    expect(compareStreamIds('9007199254740992-0', '9007199254740993-0')).toBe(-1); expect(compareStreamIds('1-18446744073709551615', '2-0')).toBe(-1)
    expect(isStreamRange('-', '+')).toBe(true); expect(isStreamRange('1-0', '1-0')).toBe(true)
    for (const [start, end] of [['+', '-'], ['2-0', '1-0'], ['1', '+']]) expect(isStreamRange(start ?? '', end ?? '')).toBe(false)
  })
  it('rejects arbitrary commands/owners and invalid bounds/count/bytes/token on both request faces', async () => {
    const f = await setup()
    try {
      const codec = redisHostDescriptors.find(d => d.method === 'readStream')?.parameters.find(p => p.name === 'request')?.codec
      if (codec?.mode !== 'strict') throw new Error('Missing Stream codec')
      for (const schema of [codec.create(), streamReadRequestSchema]) {
        expect(schema.parse(f.request)).toEqual(f.request)
        for (const request of [{ ...f.request, command: 'XACK key group 1-0' }, { ...f.request, owner: 'other' }, { ...f.request, direction: 'arbitrary' }, { ...f.request, start: '(1-0' }, { ...f.request, start: '1' }, { ...f.request, start: MAX_STREAM_ID, end: '1-0' }, { ...f.request, end: '1-18446744073709551616' }, { ...f.request, count: 101 }, { ...f.request, count: 0 }, { ...f.request, keyBase64: 'bad' }, { ...f.request, cursor: '1-0' }]) expect(() => schema.parse(request)).toThrow()
      }
    } finally { f.reader.dispose(); f.connections.dispose() }
  })
  it('keeps duplicate names but rejects invalid IDs/order/pairs/bytes/state/budget on both response faces', async () => {
    const f = await setup()
    try {
      const descriptor = redisHostDescriptors.find(d => d.method === 'readStream')
      if (descriptor?.result.mode !== 'strict') throw new Error('Missing Stream result')
      const page = await f.reader.read('a', f.request, signal()), message = page.messages[0], pair = message?.fields[0]
      if (message === undefined || pair === undefined) throw new Error('Missing field sample')
      for (const schema of [descriptor.result.create(), streamReadResultSchema]) {
        expect(schema.parse(page)).toEqual(page)
        for (const invalid of [{ ...page, messages: [message, message] }, { ...page, direction: 'reverse' }, { ...page, start: '2-0' }, { ...page, messages: [{ ...message, id: '0-0' }] }, { ...page, messages: [{ ...message, fields: [] }] }, { ...page, messages: [{ ...message, fields: { field: pair.value } }] }, { ...page, messages: [{ ...message, fields: [{ ...pair, field: { ...pair.field, byteLength: 99 } }] }] }, { ...page, messages: [], cursor: page.cursor }, { ...page, state: 'missing' }, { ...page, metadata: { type: 'hash', ttlMs: '-1', length: '4' } }, { ...page, password: 'secret' }]) expect(() => schema.parse(invalid)).toThrow()
        const big = Buffer.alloc(65536, 97).toString('base64')
        const fields = Array.from({ length: 6 }, (_, index) => ({ field: { base64: Buffer.alloc(65536, index).toString('base64'), byteLength: 65536, label: 'large' }, value: { base64: big, byteLength: 65536, fullByteLength: 65536, suffix: '' } }))
        expect(() => schema.parse({ ...page, messages: [{ id: '1-0', fields }] })).toThrow()
      }
    } finally { f.reader.dispose(); f.connections.dispose() }
  })
})
