import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RedisConnections, type RedisLink } from '../src/host/connection-service.ts'
import { RedisJson } from '../src/host/json-reader.ts'
import { RedisReplyError, type RedisReply } from '../src/host/resp.ts'
import type { JsonReadRequest } from '../src/domain.ts'
import { jsonReadRequestSchema, jsonReadResultSchema } from '../src/typert.shared.ts'
import { redisHostDescriptors } from '../src/typert.host.ts'
import { isJsonPath, jsonMatchCount } from '../src/redis-json.ts'
import { previewValue } from '../src/client/value-preview.ts'

const signal = () => new AbortController().signal
const key = Buffer.from([255, 0, 13]), settings = { host: 'localhost', port: 6379, username: '', password: '', tls: null }
const raw = Buffer.from('[{"id":9007199254740993,"large":1e400,"zero":-0,"escaped":"\\u4e2d"}]')
beforeEach(() => { vi.spyOn(console, 'info').mockImplementation(() => undefined) })
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })

async function setup() {
  const state = { type: 'ReJSON-RL', ttl: -1n, types: [Buffer.from('object')] as RedisReply }
  const calls: { command: string; args: readonly (string | Buffer)[]; deadline: number | undefined }[] = []
  const get = vi.fn<RedisLink['execute']>().mockResolvedValue(raw)
  const types = vi.fn<RedisLink['execute']>().mockImplementation(async () => state.types)
  const execute: RedisLink['execute'] = async (command, args, commandSignal, guard, deadline) => {
    guard(); calls.push({ command, args, deadline }); expect(args[0]).toEqual(key)
    if (command === 'TYPE') return state.type
    if (command === 'PTTL') return state.ttl
    if (command === 'JSON.TYPE') return types(command, args, commandSignal, guard, deadline)
    if (command === 'JSON.GET') return get(command, args, commandSignal, guard, deadline)
    throw new Error('Unexpected non-read command')
  }
  const connections = new RedisConnections(async () => ({ execute, close: () => undefined, onFailure: () => () => undefined }))
  const view = await connections.connect('a', settings, signal())
  if (view.id === null) throw new Error('Missing fixture target')
  const request: JsonReadRequest = { target: { id: view.id, generation: view.generation, db: 0 }, keyBase64: key.toString('base64'), path: '$' }
  return { connections, request, reader: new RedisJson(connections), state, calls, get, types }
}

describe('RedisJSON complete path reads', () => {
  it('keeps raw binary key and numeric/escape lexemes, with one total deadline and no legacy path', async () => {
    const f = await setup(); f.state.ttl = 9007199254740993n
    try {
      const value = await f.reader.read('a', f.request, signal())
      expect(value).toMatchObject({ state: 'value', metadata: { type: 'ReJSON-RL', ttlMs: '9007199254740993', length: null }, matchTypes: ['object'], path: '$', byteLength: raw.length })
      expect(Buffer.from(value.base64, 'base64')).toEqual(raw)
      expect(f.get.mock.calls[0]?.[1]).toEqual([key, '$'])
      expect(f.calls.map(call => call.command)).toEqual(['TYPE', 'PTTL', 'JSON.TYPE', 'JSON.GET', 'TYPE', 'JSON.TYPE', 'PTTL'])
      expect(new Set(f.calls.map(call => call.deadline)).size).toBe(1)
      const formatted = previewValue({ base64: value.base64, prefix: '', suffix: '', offset: '0', complete: true }, 'json')
      expect(formatted.error).toBeNull(); expect(formatted.text).toContain('9007199254740993'); expect(formatted.text).toContain('1e400'); expect(formatted.text).toContain('-0'); expect(formatted.text).toContain('\\u4e2d')
    } finally { f.connections.dispose() }
  })
  it('keeps multiple matches and distinguishes null from absent paths and absent keys', async () => {
    const f = await setup()
    try {
      f.state.types = [Buffer.from('null'), Buffer.from('array'), Buffer.from('string')]; f.get.mockResolvedValue(Buffer.from('[null,[],""]'))
      expect(await f.reader.read('a', { ...f.request, path: '$..values' }, signal())).toMatchObject({ state: 'value', matchTypes: ['null', 'array', 'string'] })
      f.state.types = []; f.get.mockClear()
      expect(await f.reader.read('a', f.request, signal())).toMatchObject({ state: 'path-missing', base64: '', matchTypes: [], metadata: { type: 'ReJSON-RL' } }); expect(f.get).not.toHaveBeenCalled()
      f.state.types = null
      expect(await f.reader.read('a', f.request, signal())).toMatchObject({ state: 'missing', metadata: null, base64: '' })
    } finally { f.connections.dispose() }
  })
  it('does not JSON-query missing, expired or ordinary String data', async () => {
    const f = await setup()
    try {
      f.state.type = 'none'; expect((await f.reader.read('a', f.request, signal())).state).toBe('missing')
      f.state.type = 'ReJSON-RL'; f.state.ttl = -2n; expect((await f.reader.read('a', f.request, signal())).state).toBe('missing')
      f.state.type = 'string'; f.state.ttl = -1n
      expect(await f.reader.read('a', f.request, signal())).toMatchObject({ state: 'unsupported', metadata: { type: 'string' } })
      expect(f.types).not.toHaveBeenCalled(); expect(f.get).not.toHaveBeenCalled()
    } finally { f.connections.dispose() }
  })
  it('refuses a 65537-byte complete match without partial JSON and accepts a narrower request', async () => {
    const f = await setup()
    try {
      f.get.mockResolvedValue(Buffer.from('["' + 'x'.repeat(65532) + '"]'))
      expect((await f.reader.read('a', f.request, signal())).byteLength).toBe(65536)
      f.get.mockResolvedValue(Buffer.from('["' + 'x'.repeat(65533) + '"]'))
      expect(await f.reader.read('a', f.request, signal())).toMatchObject({ state: 'failed', error: 'oversize', base64: '', matchTypes: [] })
      f.get.mockResolvedValue(Buffer.from('[1]')); f.state.types = [Buffer.from('integer')]
      expect((await f.reader.read('a', { ...f.request, path: '$.small' }, signal())).state).toBe('value')
    } finally { f.connections.dispose() }
  })
  it('rejects malformed nested type replies, invalid UTF-8/JSON and non-array values', async () => {
    const f = await setup()
    try {
      for (const bad of [[Buffer.from('unknown')], ['object'], [[Buffer.from('object')]], 1n]) {
        f.state.types = bad; expect(await f.reader.read('a', f.request, signal())).toMatchObject({ state: 'failed', error: 'protocol' })
      }
      f.state.types = Array.from({ length: 4097 }, () => Buffer.from('object'))
      expect((await f.reader.read('a', f.request, signal())).error).toBe('oversize')
      f.state.types = [Buffer.from('object')]
      for (const bad of [Buffer.from([255]), Buffer.from('[bad]'), Buffer.from('{}'), '[]', [Buffer.from('[]')]]) {
        f.get.mockResolvedValue(bad); expect((await f.reader.read('a', f.request, signal())).error).toBe('protocol')
      }
    } finally { f.connections.dispose() }
  })
  it('discards disappearance, actual type changes, path/cardinality changes and inconsistent match counts', async () => {
    const f = await setup()
    try {
      for (const type of ['none', 'string']) {
        f.state.type = 'ReJSON-RL'; f.get.mockImplementation(async () => { f.state.type = type; return raw })
        expect((await f.reader.read('a', f.request, signal())).state).toBe(type === 'none' ? 'missing' : 'changed')
      }
      f.state.type = 'ReJSON-RL'; f.get.mockImplementation(async () => { f.state.types = []; return raw })
      expect((await f.reader.read('a', f.request, signal())).state).toBe('changed')
      f.state.types = [Buffer.from('object')]; f.get.mockResolvedValue(Buffer.from('[]'))
      expect((await f.reader.read('a', f.request, signal())).state).toBe('changed')
      f.get.mockResolvedValue(null); expect((await f.reader.read('a', f.request, signal())).state).toBe('missing')
    } finally { f.connections.dispose() }
  })
  it('distinguishes unavailable command, grammar, type races and permission without echoing private text', async () => {
    const f = await setup()
    try {
      for (const [message, expected] of [
        ["ERR unknown command 'JSON.GET', private-key", { state: 'unavailable', error: null }],
        ['Error occurred at position 2, Error at position 2: private-path', { state: 'invalid-path', error: null }],
        ['Existing key has wrong Redis type', { state: 'changed', error: null }],
        ['WRONGTYPE changed', { state: 'changed', error: null }],
        ['NOPERM private-key', { state: 'failed', error: 'permission' }],
      ] as const) {
        f.get.mockRejectedValue(new RedisReplyError(message))
        const result = await f.reader.read('a', f.request, signal()); expect(result).toMatchObject(expected); expect(JSON.stringify(result)).not.toContain('private')
      }
      f.types.mockRejectedValue(new RedisReplyError("ERR unknown command 'JSON.TYPE'"))
      expect((await f.reader.read('a', f.request, signal())).state).toBe('unavailable')
    } finally { f.connections.dispose() }
  })
  it('binds the target to its trusted session, DB and generation', async () => {
    const f = await setup()
    try {
      for (const [session, target] of [['other', f.request.target], ['a', { ...f.request.target, db: 1 }], ['a', { ...f.request.target, generation: f.request.target.generation + 1 }]] as const) {
        expect(await f.reader.read(session, { ...f.request, target }, signal())).toMatchObject({ state: 'failed', error: 'stale' })
      }
      expect(f.calls).toEqual([])
    } finally { f.connections.dispose() }
  })
  it('honors pre-cancellation and one operation-wide timeout without exposing late bytes', async () => {
    const f = await setup()
    try {
      const cancelled = new AbortController(); cancelled.abort()
      expect((await f.reader.read('a', f.request, cancelled.signal)).error).toBe('cancelled'); expect(f.calls).toEqual([])
      vi.useFakeTimers()
      f.get.mockImplementation((_command, _args, commandSignal) => new Promise((_resolve, reject) => commandSignal.addEventListener('abort', () => reject(new Error('abort')), { once: true })))
      const pending = f.reader.read('a', f.request, signal()); await vi.advanceTimersByTimeAsync(10001)
      expect(await pending).toMatchObject({ state: 'failed', error: 'timeout', base64: '' })
    } finally { f.connections.dispose() }
  })
  it('gives stale ownership precedence over a late server refusal', async () => {
    const f = await setup()
    try {
      f.get.mockImplementation(async () => {
        f.connections.disconnect('a', f.request.target)
        throw new RedisReplyError("ERR unknown command 'JSON.GET'")
      })
      expect(await f.reader.read('a', f.request, signal())).toMatchObject({ state: 'failed', error: 'stale', base64: '' })
    } finally { f.connections.dispose() }
  })
  it('cancels an active read and can explicitly recover with the same target', async () => {
    const f = await setup()
    try {
      const controller = new AbortController()
      f.get.mockImplementationOnce((_command, _args, commandSignal) => new Promise((_resolve, reject) => commandSignal.addEventListener('abort', () => reject(new Error('cancel')), { once: true })))
      const pending = f.reader.read('a', f.request, controller.signal)
      await vi.waitFor(() => expect(f.get).toHaveBeenCalledOnce()); controller.abort()
      expect((await pending).error).toBe('cancelled')
      expect((await f.reader.read('a', f.request, signal())).state).toBe('value')
    } finally { f.connections.dispose() }
  })
})

describe('RedisJSON strict wire contract', () => {
  it('only accepts bounded explicit JSONPath requests on both faces', async () => {
    const f = await setup()
    try {
      const codec = redisHostDescriptors.find(d => d.method === 'readJson')?.parameters.find(p => p.name === 'request')?.codec
      if (codec?.mode !== 'strict') throw new Error('Missing JSON request codec')
      for (const schema of [codec.create(), jsonReadRequestSchema]) {
        expect(schema.parse({ ...f.request, path: '$.items[0:10]' })).toMatchObject({ path: '$.items[0:10]' })
        for (const change of [{ path: '.' }, { path: '' }, { path: '$\0' }, { path: '$' + 'x'.repeat(1024) }, { target: { ...f.request.target, db: -1 } }, { keyBase64: '!' }, { command: 'JSON.SET' }, { sessionId: 'other' }]) expect(() => schema.parse({ ...f.request, ...change })).toThrow()
      }
      expect(isJsonPath('$[')).toBe(true); expect(jsonMatchCount(raw)).toBe(1)
    } finally { f.connections.dispose() }
  })
  it('rejects inconsistent states, budgets, match arrays and metadata on both response faces', async () => {
    const f = await setup()
    try {
      const descriptor = redisHostDescriptors.find(d => d.method === 'readJson')
      if (descriptor?.result.mode !== 'strict') throw new Error('Missing JSON result codec')
      const value = await f.reader.read('a', f.request, signal())
      for (const schema of [descriptor.result.create(), jsonReadResultSchema]) {
        expect(schema.parse(value)).toEqual(value)
        for (const change of [{ matchTypes: [] }, { matchTypes: ['bad'] }, { matchTypes: ['object', 'object'] }, { base64: 'e30=', byteLength: 2 }, { byteLength: 0 }, { byteLength: 65537 }, { state: 'path-missing' }, { state: 'unavailable' }, { error: 'network' }, { path: '.' }, { metadata: { type: 'string', ttlMs: '-1', length: null } }, { password: 'secret' }]) expect(() => schema.parse({ ...value, ...change })).toThrow()
        const missing = { ...value, state: 'path-missing', base64: '', byteLength: 0, matchTypes: [] }
        expect(schema.parse(missing)).toEqual(missing)
        for (const state of ['missing', 'changed', 'unavailable', 'invalid-path', 'failed']) expect(schema.parse({ ...missing, state, metadata: null, error: state === 'failed' ? 'permission' : null })).toMatchObject({ state })
      }
    } finally { f.connections.dispose() }
  })
})
