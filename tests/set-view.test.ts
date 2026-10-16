import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RedisConnections, type RedisLink } from '../src/host/connection-service.ts'
import { RedisSets } from '../src/host/set-reader.ts'
import { RedisReplyError, type RedisReply } from '../src/host/resp.ts'
import type { ScanSetRequest } from '../src/domain.ts'
import { appendKeys, emptyKeyCache } from '../src/client/key-cache.ts'
import { scanSetRequestSchema, scanSetResultSchema } from '../src/typert.shared.ts'
import { redisHostDescriptors } from '../src/typert.host.ts'

const signal = () => new AbortController().signal
const settings = { host: 'localhost', port: 6379, username: '', password: '', tls: null }
const key = Buffer.from([255, 0, 13]), binary = Buffer.from([254, 0, 10])
const page = (cursor: string, ...members: Buffer[]): RedisReply => [Buffer.from(cursor), members]
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done }); return { promise, resolve } }
beforeEach(() => { vi.spyOn(console, 'info').mockImplementation(() => undefined) })
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })

async function setup(reply: RedisReply = page('0', binary)) {
  const state = { type: 'set', ttl: -1n, length: 1n }
  const calls: { command: string; args: readonly (string | Buffer)[]; deadline: number | undefined }[] = []
  const scan = vi.fn<RedisLink['execute']>().mockResolvedValue(reply)
  const execute: RedisLink['execute'] = async (command, args, commandSignal, guard, deadline) => {
    guard(); calls.push({ command, args, deadline }); expect(args[0]).toEqual(key)
    if (command === 'TYPE') return state.type
    if (command === 'PTTL') return state.ttl
    if (command === 'SCARD') return state.length
    if (command === 'SSCAN') return scan(command, args, commandSignal, guard, deadline)
    throw new Error('Unexpected or non-read command')
  }
  const connections = new RedisConnections(async () => ({ close: () => undefined, execute, onFailure: () => () => undefined }))
  const view = await connections.connect('a', settings, signal())
  if (view.id === null) throw new Error('No fixture target')
  const request: ScanSetRequest = { target: { id: view.id, generation: view.generation, db: 0 }, keyBase64: key.toString('base64'), pattern: '*', cursor: null }
  const reader = new RedisSets(connections)
  return { connections, reader, request, state, calls, scan, dispose: () => { reader.dispose(); connections.dispose() } }
}

describe('bounded Set member scans', () => {
  it('keeps exact binary/empty members and precise TTL with one shared operation deadline', async () => {
    const fixture = await setup(page('0', binary, Buffer.alloc(0))); fixture.state.length = 2n; fixture.state.ttl = 9007199254740993n
    try {
      const result = await fixture.reader.scan('a', fixture.request, signal())
      expect(result).toMatchObject({ state: 'page', metadata: { type: 'set', ttlMs: '9007199254740993', length: '2' }, cursor: null })
      expect(result.members.map(value => value.base64)).toEqual([binary.toString('base64'), ''])
      expect(result.members[1]?.byteLength).toBe(0)
      expect(fixture.calls.map(value => value.command)).toEqual(['TYPE', 'PTTL', 'SCARD', 'SSCAN', 'TYPE', 'SCARD', 'PTTL'])
      expect(new Set(fixture.calls.map(value => value.deadline)).size).toBe(1)
      expect(fixture.scan.mock.calls[0]?.[1]).toEqual([key, '0', 'MATCH', '*', 'COUNT', '100'])
    } finally { fixture.dispose() }
  })
  it('deduplicates raw members while preserving scan order, not a fabricated global sort', async () => {
    const fixture = await setup(page('0', Buffer.from('z'), Buffer.from('a'), Buffer.from('z'))); fixture.state.length = 3n
    try {
      const result = await fixture.reader.scan('a', fixture.request, signal())
      expect(result.members.map(value => Buffer.from(value.base64, 'base64').toString())).toEqual(['z', 'a'])
      const duplicate = result.members[0]
      if (duplicate === undefined) throw new Error('Expected raw member')
      const cache = appendKeys(appendKeys(emptyKeyCache(), result.members), [duplicate])
      expect(cache.keys).toEqual(result.members)
    } finally { fixture.dispose() }
  })
  it('continues an empty page with an exact uint64 cursor and rejects completed token replay', async () => {
    const fixture = await setup(page('18446744073709551615'))
    fixture.scan.mockResolvedValueOnce(page('18446744073709551615')).mockResolvedValue(page('0', binary))
    try {
      const first = await fixture.reader.scan('a', fixture.request, signal())
      expect(first.members).toEqual([]); expect(first.cursor).not.toBeNull()
      expect((await fixture.reader.scan('a', { ...fixture.request, cursor: first.cursor }, signal())).state).toBe('page')
      expect(fixture.scan.mock.calls[1]?.[1][1]).toBe('18446744073709551615')
      expect((await fixture.reader.scan('a', { ...fixture.request, cursor: first.cursor }, signal())).error).toBe('stale')
    } finally { fixture.dispose() }
  })
  it('binds continuations to key/MATCH/session/DB/generation without discarding a valid token on a bad request', async () => {
    const fixture = await setup(page('7'))
    try {
      const first = await fixture.reader.scan('a', fixture.request, signal()), request = { ...fixture.request, cursor: first.cursor }
      for (const invalid of [{ ...request, keyBase64: '' }, { ...request, pattern: 'other:*' }, { ...request, target: { ...request.target, db: 1 } }, { ...request, target: { ...request.target, generation: request.target.generation + 1 } }]) expect((await fixture.reader.scan('a', invalid, signal())).error).toBe('stale')
      expect((await fixture.reader.scan('b', request, signal())).error).toBe('stale')
      expect((await fixture.reader.scan('a', { ...request, cursor: null, target: { ...request.target, db: 1 } }, signal())).error).toBe('stale')
      expect((await fixture.reader.scan('a', request, signal())).state).toBe('page')
      expect(fixture.scan).toHaveBeenCalledTimes(2)
    } finally { fixture.dispose() }
  })
  it('drops a late continuation after refresh and refuses an already consumed in-flight token', async () => {
    const fixture = await setup(page('7')), delayed = deferred<RedisReply>()
    try {
      const first = await fixture.reader.scan('a', fixture.request, signal()); fixture.scan.mockReturnValueOnce(delayed.promise)
      const pending = fixture.reader.scan('a', { ...fixture.request, cursor: first.cursor }, signal())
      await vi.waitFor(() => expect(fixture.scan).toHaveBeenCalledTimes(2))
      expect((await fixture.reader.scan('a', { ...fixture.request, cursor: first.cursor }, signal())).error).toBe('stale')
      expect((await fixture.reader.scan('a', fixture.request, signal())).state).toBe('page')
      delayed.resolve(page('0', binary)); expect((await pending).error).toBe('stale')
    } finally { fixture.dispose() }
  })
  it('keeps distinct full 64 KiB identities with identical display labels and refuses oversized members', async () => {
    const a = Buffer.alloc(65536, 97), b = Buffer.from(a); b[b.length - 1] = 98
    const fixture = await setup(page('0', a, b)); fixture.state.length = 2n
    try {
      const result = await fixture.reader.scan('a', fixture.request, signal())
      expect(result.members).toHaveLength(2); expect(result.members[0]?.label).toBe(result.members[1]?.label)
      expect(result.members[0]?.base64).not.toBe(result.members[1]?.base64)
      fixture.scan.mockResolvedValue(page('0', Buffer.alloc(65537)))
      expect(await fixture.reader.scan('a', fixture.request, signal())).toMatchObject({ error: 'oversize', members: [], cursor: null })
    } finally { fixture.dispose() }
  })
  it('refuses a sub-frame-sized page amplified above the JSON cap without returning members or a cursor', async () => {
    const fixture = await setup(page('0', ...Array.from({ length: 12 }, (_, index) => Buffer.alloc(65536, index)))); fixture.state.length = 12n
    try { expect(await fixture.reader.scan('a', fixture.request, signal())).toMatchObject({ error: 'oversize', members: [], cursor: null }) }
    finally { fixture.dispose() }
  })
  it('rejects malformed members, oversized pages and invalid bulk cursor encodings', async () => {
    const fixture = await setup()
    try {
      for (const reply of [[Buffer.from('0'), [1n]], page('01'), page('18446744073709551616'), [Buffer.from([0xb0]), []]]) {
        fixture.scan.mockResolvedValue(reply)
        expect((await fixture.reader.scan('a', fixture.request, signal())).error).toBe('protocol')
      }
      fixture.scan.mockResolvedValue(page('0', ...Array.from({ length: 4097 }, () => Buffer.from('a'))))
      expect((await fixture.reader.scan('a', fixture.request, signal())).error).toBe('oversize')
    } finally { fixture.dispose() }
  })
  it('does not scan missing, expired or unsupported keys', async () => {
    const fixture = await setup()
    try {
      fixture.state.type = 'none'; expect((await fixture.reader.scan('a', fixture.request, signal())).state).toBe('missing')
      fixture.state.type = 'set'; fixture.state.ttl = -2n; expect((await fixture.reader.scan('a', fixture.request, signal())).state).toBe('missing')
      fixture.state.type = 'string'; fixture.state.ttl = -1n
      expect(await fixture.reader.scan('a', fixture.request, signal())).toMatchObject({ state: 'unsupported', metadata: { type: 'string', length: null } })
      expect(fixture.scan).not.toHaveBeenCalled()
    } finally { fixture.dispose() }
  })
  it('discards members when type, cardinality or existence changes between commands', async () => {
    for (const mutation of ['length', 'type', 'missing']) {
      const fixture = await setup()
      fixture.scan.mockImplementation(async () => {
        if (mutation === 'length') fixture.state.length++
        else fixture.state.type = mutation === 'missing' ? 'none' : 'hash'
        return page('0', binary)
      })
      try { expect(await fixture.reader.scan('a', fixture.request, signal())).toMatchObject({ state: mutation === 'missing' ? 'missing' : 'changed', members: [], cursor: null }) }
      finally { fixture.dispose() }
    }
  })
  it('returns fixed permission/WRONGTYPE errors without raw text or partial data', async () => {
    const fixture = await setup()
    try {
      fixture.scan.mockRejectedValueOnce(new RedisReplyError('NOPERM private member'))
      const denied = await fixture.reader.scan('a', fixture.request, signal())
      expect(denied).toMatchObject({ error: 'permission', members: [] }); expect(JSON.stringify(denied)).not.toContain('private')
      fixture.scan.mockRejectedValueOnce(new RedisReplyError('WRONGTYPE fixture'))
      expect((await fixture.reader.scan('a', fixture.request, signal())).state).toBe('changed')
    } finally { fixture.dispose() }
  })
  it('does not dispatch pre-cancelled requests and enforces the total deadline', async () => {
    const fixture = await setup(), controller = new AbortController()
    try {
      controller.abort(); expect((await fixture.reader.scan('a', fixture.request, controller.signal)).error).toBe('cancelled'); expect(fixture.calls).toEqual([])
      vi.useFakeTimers()
      fixture.scan.mockImplementation(async (_command, _args, requestSignal) => new Promise((_resolve, reject) => { requestSignal.addEventListener('abort', () => reject(new Error('cancelled')), { once: true }) }))
      const pending = fixture.reader.scan('a', fixture.request, signal()); await vi.advanceTimersByTimeAsync(10001)
      expect(await pending).toMatchObject({ error: 'timeout', members: [], cursor: null })
    } finally { fixture.dispose() }
  })
  it('invalidates an explicitly cancelled or disposed continuation and permits a new scan', async () => {
    const fixture = await setup(page('7')), controller = new AbortController()
    try {
      const first = await fixture.reader.scan('a', fixture.request, signal())
      fixture.scan.mockImplementationOnce(async (_command, _args, requestSignal) => new Promise((_resolve, reject) => { requestSignal.addEventListener('abort', () => reject(new Error('cancelled')), { once: true }) }))
      const pending = fixture.reader.scan('a', { ...fixture.request, cursor: first.cursor }, controller.signal)
      await vi.waitFor(() => expect(fixture.scan).toHaveBeenCalledTimes(2)); controller.abort()
      expect((await pending).error).toBe('cancelled')
      expect((await fixture.reader.scan('a', { ...fixture.request, cursor: first.cursor }, signal())).error).toBe('stale')
      const fresh = await fixture.reader.scan('a', fixture.request, signal()); fixture.reader.disposeSession('a')
      expect((await fixture.reader.scan('a', { ...fixture.request, cursor: fresh.cursor }, signal())).error).toBe('stale')
    } finally { fixture.dispose() }
  })
})

describe('strict Set byte protocol', () => {
  it('rejects hidden commands, noncanonical identities and forged cursors on both faces', () => {
    const codec = redisHostDescriptors.find(value => value.method === 'scanSet')?.parameters.find(value => value.name === 'request')?.codec
    if (codec?.mode !== 'strict') throw new Error('Missing Set request codec')
    const valid = { target: { id: 'id', generation: 1, db: 0 }, keyBase64: '', pattern: '*', cursor: null }
    for (const schema of [codec.create(), scanSetRequestSchema]) {
      expect(schema.parse(valid)).toEqual(valid)
      for (const invalid of [{ ...valid, command: 'SADD' }, { ...valid, agentId: 'other' }, { ...valid, keyBase64: 'AA' }, { ...valid, keyBase64: Buffer.alloc(65537).toString('base64') }, { ...valid, pattern: 'a'.repeat(257) }, { ...valid, cursor: '7' }]) expect(() => schema.parse(invalid)).toThrow()
    }
  })
  it('checks full member bytes, uniqueness, cardinality and non-page states on both faces', () => {
    const codec = redisHostDescriptors.find(value => value.method === 'scanSet')?.result
    if (codec?.mode !== 'strict') throw new Error('Missing Set response codec')
    const member = { base64: '', byteLength: 0, label: '""' }
    const valid = { state: 'page', error: null, metadata: { type: 'set', ttlMs: '-1', length: '1' }, members: [member], cursor: null, sampledAt: new Date().toISOString() }
    for (const schema of [codec.create(), scanSetResultSchema]) {
      expect(schema.parse(valid)).toEqual(valid)
      for (const invalid of [{ ...valid, members: [member, member] }, { ...valid, members: [{ ...member, byteLength: 1 }] }, { ...valid, metadata: { ...valid.metadata, length: '0' } }, { ...valid, metadata: { ...valid.metadata, type: 'hash' } }, { ...valid, state: 'failed' }, { ...valid, cursor: '7' }]) expect(() => schema.parse(invalid)).toThrow()
      const members = Array.from({ length: 12 }, (_, index) => ({ base64: Buffer.alloc(65536, index).toString('base64'), byteLength: 65536, label: 'member' }))
      expect(() => schema.parse({ ...valid, metadata: { ...valid.metadata, length: '12' }, members })).toThrow()
    }
  })
})
