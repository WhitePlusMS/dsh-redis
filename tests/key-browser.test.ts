import { describe, expect, it, vi } from 'vitest'
import { RedisConnections, type RedisLink } from '../src/host/connection-service.ts'
import { RedisKeys } from '../src/host/key-reader.ts'
import { RedisReplyError, type RedisReply } from '../src/host/resp.ts'
import type { ConnectionView, DatabaseTarget, RedisKey } from '../src/domain.ts'
import { MAX_CACHED_KEYS, MAX_CACHED_KEY_BYTES } from '../src/domain.ts'
import { appendKeys, emptyKeyCache } from '../src/client/key-cache.ts'
import { databaseTargetSchema, scanKeysRequestSchema, scanKeysResultSchema } from '../src/typert.shared.ts'
import { redisHostDescriptors } from '../src/typert.host.ts'

const settings = { host: 'localhost', port: 6379, username: '', password: '', tls: null }
const signal = () => new AbortController().signal
function target(view: ConnectionView): DatabaseTarget {
  if (view.id === null) throw new Error('Expected connection')
  return { id: view.id, generation: view.generation, db: view.db }
}
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(done => { resolve = done })
  return { promise, resolve }
}
async function setup(reply: RedisLink['execute']) {
  const close = vi.fn()
  const execute: RedisLink['execute'] = (command, args, requestSignal, guard) => { guard(); return reply(command, args, requestSignal, guard) }
  const connections = new RedisConnections(async () => ({ close, execute, onFailure: () => () => undefined }))
  const connection = await connections.connect('a', settings, signal())
  return { connections, connection, keys: new RedisKeys(connections), close }
}
const page = (cursor: string, ...keys: Buffer[]): RedisReply => [Buffer.from(cursor), keys]

describe('DB and scan identity', () => {
  it('changes generation before SELECT, keeps sessions isolated and rejects old/wrong-DB targets', async () => {
    const execute = vi.fn<RedisLink['execute']>(async () => 'OK')
    const { connections, connection } = await setup(execute)
    try {
      const b = await connections.connect('b', settings, signal())
      const selected = await connections.selectDatabase('a', { ...target(connection), db: 2 }, signal())
      expect(selected).toMatchObject({ state: 'connected', db: 2 })
      expect(selected.generation).toBeGreaterThan(connection.generation)
      expect(connections.status('b')).toEqual(b)
      expect(execute.mock.calls[0]?.slice(0, 2)).toEqual(['SELECT', ['2']])
      await expect(connections.read('a', target(connection), 'SCAN', ['0'], signal())).rejects.toMatchObject({ code: 'stale' })
      await expect(connections.read('a', { ...target(selected), db: 0 }, 'SCAN', ['0'], signal())).rejects.toMatchObject({ code: 'stale' })
      await expect(connections.read('b', target(selected), 'SCAN', ['0'], signal())).rejects.toMatchObject({ code: 'stale' })
      expect(execute).toHaveBeenCalledTimes(1)
    } finally { connections.dispose() }
  })
  it('retains the prior DB after explicit Redis permission/range refusals', async () => {
    for (const [message, code] of [['NOPERM cannot select', 'permission'], ['ERR DB index is out of range', 'database']]) {
      const { connections, connection, close } = await setup(async () => { throw new RedisReplyError(message) })
      try {
        const result = await connections.selectDatabase('a', { ...target(connection), db: 999 }, signal())
        expect(result).toMatchObject({ state: 'connected', db: 0, error: code })
        expect(result.generation).toBeGreaterThan(connection.generation)
        expect(close).not.toHaveBeenCalled()
      } finally { connections.dispose() }
    }
  })
  it('discards an uncertain cancelled SELECT without closing another session', async () => {
    const controller = new AbortController()
    const { connections, connection, close } = await setup(async (_command, _args, requestSignal) => {
      controller.abort(); requestSignal.throwIfAborted(); return 'OK'
    })
    try {
      const other = await connections.connect('b', settings, signal())
      const result = await connections.selectDatabase('a', { ...target(connection), db: 1 }, controller.signal)
      expect(result).toMatchObject({ state: 'error', error: 'cancelled' })
      expect(close).toHaveBeenCalledTimes(1)
      expect(connections.status('b')).toEqual(other)
    } finally { connections.dispose() }
  })
  it('rejects an old reply when the DB generation changes while it is in flight', async () => {
    const pending = deferred<RedisReply>()
    const { connections, connection } = await setup(async command => command === 'SELECT' ? 'OK' : pending.promise)
    try {
      const read = connections.read('a', target(connection), 'SCAN', ['0'], signal())
      const rejected = expect(read).rejects.toMatchObject({ code: 'stale' })
      await connections.selectDatabase('a', { ...target(connection), db: 1 }, signal())
      pending.resolve(page('0', Buffer.from('old-db')))
      await rejected
    } finally { connections.dispose() }
  })
  it('continues empty pages with exact uint64 cursors and preserves binary/empty key identities', async () => {
    const execute = vi.fn<RedisLink['execute']>()
      .mockResolvedValueOnce(page('18446744073709551615'))
      .mockResolvedValueOnce(page('0', Buffer.from([255, 0, 13]), Buffer.alloc(0), Buffer.from([255, 0, 13])))
    const { connections, connection, keys } = await setup(execute)
    try {
      const request = { target: target(connection), pattern: '*' }
      const first = await keys.scan('a', { ...request, cursor: null }, signal())
      expect(first).toMatchObject({ state: 'page', keys: [] })
      expect(first.cursor).not.toBeNull()
      const second = await keys.scan('a', { ...request, cursor: first.cursor }, signal())
      expect(second).toMatchObject({ state: 'page', cursor: null })
      expect(second.keys.map(key => key.base64)).toEqual(['/wAN', ''])
      expect(second.keys[0]).toMatchObject({ byteLength: 3, label: '0xff000d' })
      expect(execute.mock.calls[1]?.[1]).toEqual(['18446744073709551615', 'MATCH', '*', 'COUNT', '100'])
    } finally { keys.dispose(); connections.dispose() }
  })
  it('rejects replay, changed MATCH, session and DB tokens without destroying a valid next page', async () => {
    const execute = vi.fn<RedisLink['execute']>().mockResolvedValue(page('1', Buffer.from('key')))
    const { connections, connection, keys } = await setup(execute)
    try {
      const request = { target: target(connection), pattern: '*', cursor: null }
      const first = await keys.scan('a', request, signal())
      const second = await keys.scan('a', { ...request, cursor: first.cursor }, signal())
      for (const [session, changed] of [
        ['a', { ...request, cursor: first.cursor }],
        ['b', { ...request, cursor: second.cursor }],
        ['a', { ...request, pattern: 'different', cursor: second.cursor }],
        ['a', { ...request, target: { ...request.target, db: 1 }, cursor: second.cursor }],
        ['a', { ...request, target: { ...request.target, generation: request.target.generation + 1 }, cursor: null }],
      ] as const) expect((await keys.scan(session, changed, signal())).error).toBe('stale')
      expect(execute).toHaveBeenCalledTimes(2)
      expect((await keys.scan('a', { ...request, cursor: second.cursor }, signal())).state).toBe('page')
    } finally { keys.dispose(); connections.dispose() }
  })
  it('discards a late page after a newer scan starts, without deleting the new cursor', async () => {
    const pending = deferred<RedisReply>()
    const execute = vi.fn<RedisLink['execute']>().mockReturnValueOnce(pending.promise).mockResolvedValue(page('2'))
    const { connections, connection, keys } = await setup(execute)
    try {
      const request = { target: target(connection), pattern: '*', cursor: null }
      const old = keys.scan('a', request, signal())
      const fresh = await keys.scan('a', { ...request, pattern: 'fresh*' }, signal())
      pending.resolve(page('0', Buffer.from('old')))
      expect((await old).error).toBe('stale')
      expect((await keys.scan('a', { ...request, pattern: 'fresh*', cursor: fresh.cursor }, signal())).state).toBe('page')
    } finally { keys.dispose(); connections.dispose() }
  })
  it('refuses oversized identities/amplified output and malformed scan replies without partial pages', async () => {
    const amplified = Array.from({ length: 12 }, (_value, index) => Buffer.alloc(65536, index))
    for (const [reply, error] of [
      [page('0', Buffer.alloc(65537)), 'oversize'], [page('0', ...amplified), 'oversize'],
      [[Buffer.from([0xb0]), []], 'protocol'], [page('18446744073709551616'), 'protocol'], ['OK', 'protocol'],
    ] as const) {
      const { connections, connection, keys } = await setup(async () => reply as RedisReply)
      try { expect(await keys.scan('a', { target: target(connection), pattern: '*', cursor: null }, signal())).toMatchObject({ state: 'failed', error, keys: [], cursor: null }) }
      finally { keys.dispose(); connections.dispose() }
    }
  })
  it('returns fixed permission/cancel errors and never dispatches a pre-cancelled scan', async () => {
    const execute = vi.fn<RedisLink['execute']>(async () => { throw new RedisReplyError('NOPERM private key or host details') })
    const { connections, connection, keys } = await setup(execute)
    try {
      const request = { target: target(connection), pattern: '*', cursor: null }
      const refused = await keys.scan('a', request, signal())
      expect(refused.error).toBe('permission'); expect(JSON.stringify(refused)).not.toContain('private')
      const controller = new AbortController(); controller.abort()
      expect((await keys.scan('a', request, controller.signal)).error).toBe('cancelled')
      expect(execute).toHaveBeenCalledTimes(1)
    } finally { keys.dispose(); connections.dispose() }
  })
})

describe('bounded key cache and wire contract', () => {
  it('deduplicates by raw identity and labels the cache incomplete at either limit', () => {
    const key = (base64: string): RedisKey => ({ base64, byteLength: Buffer.from(base64, 'base64').length, label: 'same display text' })
    const first = appendKeys(emptyKeyCache(), [key('/w=='), key('/g=='), key('/w==')])
    expect(first.keys).toHaveLength(2)
    const huge = Array.from({ length: 30 }, (_value, index) => key(Buffer.alloc(65536, index).toString('base64')))
    const bytes = appendKeys(emptyKeyCache(), huge)
    expect(bytes.limited).toBe(true); expect(bytes.bytes).toBeLessThanOrEqual(MAX_CACHED_KEY_BYTES); expect(bytes.keys.length).toBeLessThan(30)
    const rows = appendKeys(emptyKeyCache(), Array.from({ length: MAX_CACHED_KEYS + 1 }, (_value, index) => key(Buffer.from(String(index)).toString('base64'))))
    expect(rows.limited).toBe(true); expect(rows.keys).toHaveLength(MAX_CACHED_KEYS)
  })
  it('rejects forged targets/cursors/commands on both request faces', () => {
    const database = { id: 'connection', generation: 1, db: 0 }
    const request = { target: database, pattern: '*', cursor: null }
    const descriptor = redisHostDescriptors.find(value => value.method === 'scanKeys')
    const codec = descriptor?.parameters.find(value => value.name === 'request')?.codec
    if (codec?.mode !== 'strict') throw new Error('Missing scan codec')
    for (const schema of [codec.create(), scanKeysRequestSchema]) {
      expect(schema.parse(request)).toEqual(request)
      for (const bad of [{ ...request, command: 'KEYS *' }, { ...request, sessionId: 'other' }, { ...request, cursor: '42' }, { ...request, target: { ...database, db: -1 } }, { ...request, target: { ...database, generation: 0 } }]) expect(() => schema.parse(bad)).toThrow()
    }
    expect(() => databaseTargetSchema.parse({ ...database, db: 1.5 })).toThrow()
  })
  it('validates canonical binary identities and failed-page consistency on both response faces', () => {
    const result = redisHostDescriptors.find(value => value.method === 'scanKeys')?.result
    if (result?.mode !== 'strict') throw new Error('Missing scan result')
    const valid = { state: 'page', error: null, keys: [{ base64: 'AA==', byteLength: 1, label: '0x00' }], cursor: null, sampledAt: new Date().toISOString() }
    for (const schema of [result.create(), scanKeysResultSchema]) {
      expect(schema.parse(valid)).toEqual(valid)
      for (const bad of [{ ...valid, keys: [{ ...valid.keys[0], base64: 'AB==' }] }, { ...valid, keys: [{ ...valid.keys[0], byteLength: 2 }] }, { ...valid, state: 'failed', error: 'permission' }, { ...valid, password: 'private' }, { ...valid, cursor: '0' }]) expect(() => schema.parse(bad)).toThrow()
    }
  })
})
