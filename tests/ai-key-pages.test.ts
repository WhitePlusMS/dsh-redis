import { describe, expect, it, vi } from 'vitest'
import { RedisConnections, type RedisLink } from '../src/host/connection-service.ts'
import { RedisAiReader } from '../src/host/ai-reader.ts'
import { RedisKeys } from '../src/host/key-reader.ts'
import type { RedisReply } from '../src/host/resp.ts'

function decode(value: unknown) {
  if (value === null || typeof value !== 'object' || Array.isArray(value) || !('keys' in value) || !Array.isArray(value.keys) || !('cursor' in value) || !(value.cursor === null || typeof value.cursor === 'string')) throw new Error('Expected AI Key page')
  const keys = value.keys.map(key => {
    if (key === null || typeof key !== 'object' || !('base64' in key) || typeof key.base64 !== 'string') throw new Error('Expected byte identity')
    return key.base64
  })
  if (!('returnedCount' in value) || typeof value.returnedCount !== 'number') throw new Error('Expected AI Key page count')
  return { keys, returnedCount: value.returnedCount, cursor: value.cursor, scanComplete: 'scanComplete' in value && value.scanComplete === true }
}
async function setup(execute: RedisLink['execute']) {
  const transport: RedisLink = { execute, close: () => undefined, onFailure: () => () => undefined }
  const connections = new RedisConnections(async () => transport), reader = new RedisAiReader(connections, () => undefined, async (_session, _target, expected) => expected ?? 0, () => true)
  await connections.connect('a', { host: 'localhost', port: 6379, username: '', password: '', tls: null }, new AbortController().signal)
  const run = (args: { match: string; cursor?: string }, controller = new AbortController()) => reader.withBudget('a', controller.signal, stage => reader.scan('a', args, controller.signal, stage))
  return { connections, reader, run }
}
const page = (cursor: string, keys: readonly Buffer[]): RedisReply => [Buffer.from(cursor), [...keys]]

describe('AI Key page continuation', () => {
  it('returns a large Redis batch in bounded pieces before advancing its underlying cursor', async () => {
    const keys = Array.from({ length: 300 }, (_item, i) => Buffer.from(String(i).padStart(4, '0') + ':' + 'x'.repeat(500)))
    const execute = vi.fn<RedisLink['execute']>().mockResolvedValueOnce(page('7', keys)).mockResolvedValueOnce(page('0', []))
    const f = await setup(execute), output: string[] = []
    try {
      let result = await f.run({ match: 'sample:*' }), chunk = decode(result)
      expect(chunk.cursor).not.toBeNull()
      while (true) {
        expect(Buffer.byteLength(JSON.stringify(result))).toBeLessThanOrEqual(64 * 1024)
        expect(chunk.returnedCount).toBe(chunk.keys.length)
        output.push(...chunk.keys)
        if (chunk.cursor === null) { expect(chunk.scanComplete).toBe(true); break }
        const prior = chunk.cursor
        result = await f.run({ match: 'sample:*', cursor: prior }); chunk = decode(result)
        if (output.length < keys.length) expect(execute).toHaveBeenCalledTimes(1)
        await expect(f.run({ match: 'sample:*', cursor: prior })).rejects.toMatchObject({ code: 'stale' })
      }
      expect(output).toEqual(keys.map(key => key.toString('base64')))
      expect(execute).toHaveBeenCalledTimes(2)
      expect(execute.mock.calls[1]?.[1]).toEqual(['7', 'MATCH', 'sample:*', 'COUNT', '100'])
    } finally { f.reader.dispose(); f.connections.dispose() }
  })
  it('rejects another session or pattern without consuming the valid token', async () => {
    const f = await setup(async () => page('7', [Buffer.from('one')]))
    try {
      const first = decode(await f.run({ match: 'one*' }))
      if (first.cursor === null) throw new Error('Missing cursor')
      await expect(f.run({ match: 'other*', cursor: first.cursor })).rejects.toMatchObject({ code: 'stale' })
      await expect(f.reader.scan('b', { match: 'one*', cursor: first.cursor }, new AbortController().signal)).rejects.toThrow()
      expect(decode(await f.run({ match: 'one*', cursor: first.cursor })).keys).toEqual([Buffer.from('one').toString('base64')])
    } finally { f.reader.dispose(); f.connections.dispose() }
  })
  it('continues an empty Redis page and preserves its cursor after budget exhaustion', async () => {
    const execute = vi.fn<RedisLink['execute']>().mockResolvedValueOnce(page('7', [])).mockResolvedValueOnce(page('0', [Buffer.from('after-empty')]))
    const f = await setup(execute), signal = new AbortController().signal
    try {
      const first = decode(await f.run({ match: '*' }))
      expect(first.keys).toEqual([]); expect(first.returnedCount).toBe(0); expect(first.scanComplete).toBe(false)
      if (first.cursor === null) throw new Error('Missing cursor for empty page')
      for (let i = 1; i < 32; i++) await f.reader.withBudget('a', signal, () => ({ ok: true }))
      await expect(f.run({ match: '*', cursor: first.cursor })).rejects.toThrow('预算已用完')
      expect(execute).toHaveBeenCalledTimes(1)
      expect(f.reader.resumeBudget('a').accepted).toBe(true)
      const next = decode(await f.run({ match: '*', cursor: first.cursor }))
      expect(next).toMatchObject({ keys: [Buffer.from('after-empty').toString('base64')], cursor: null, scanComplete: true })
    } finally { f.reader.dispose(); f.connections.dispose() }
  })
  it('retains a staged tail after cancellation before delivery', async () => {
    const keys = Array.from({ length: 120 }, (_item, i) => Buffer.from(String(i).padStart(4, '0') + 'x'.repeat(600)))
    const execute = vi.fn<RedisLink['execute']>().mockResolvedValue(page('0', keys))
    const f = await setup(execute), controller = new AbortController()
    try {
      await expect(f.reader.withBudget('a', controller.signal, async stage => {
        const result = await f.reader.scan('a', { match: '*' }, controller.signal, stage)
        controller.abort()
        return result
      })).rejects.toThrow()
      let result = await f.run({ match: '*' }), chunk = decode(result), found = [...chunk.keys]
      while (chunk.cursor !== null) { result = await f.run({ match: '*', cursor: chunk.cursor }); chunk = decode(result); found.push(...chunk.keys) }
      expect(found).toEqual(keys.map(key => key.toString('base64')))
      expect(execute).toHaveBeenCalledTimes(1)
    } finally { f.reader.dispose(); f.connections.dispose() }
  })
  it('retains the same continuation when a later staged tail is cancelled', async () => {
    const keys = Array.from({ length: 180 }, (_item, i) => Buffer.from(String(i).padStart(4, '0') + 'x'.repeat(600)))
    const execute = vi.fn<RedisLink['execute']>().mockResolvedValue(page('0', keys))
    const f = await setup(execute), controller = new AbortController()
    try {
      const first = decode(await f.run({ match: '*' }))
      if (first.cursor === null) throw new Error('Missing cursor')
      await expect(f.reader.withBudget('a', controller.signal, async stage => {
        const result = await f.reader.scan('a', { match: '*', cursor: first.cursor! }, controller.signal, stage)
        controller.abort(); return result
      })).rejects.toThrow()
      let result = await f.run({ match: '*', cursor: first.cursor }), chunk = decode(result), found = [...first.keys, ...chunk.keys]
      while (chunk.cursor !== null) { result = await f.run({ match: '*', cursor: chunk.cursor }); chunk = decode(result); found.push(...chunk.keys) }
      expect(found).toEqual(keys.map(key => key.toString('base64')))
      expect(execute).toHaveBeenCalledTimes(1)
    } finally { f.reader.dispose(); f.connections.dispose() }
  })
  it('rejects a staged old page after a DB switch without exposing old data', async () => {
    const f = await setup(async command => command === 'SELECT' ? 'OK' : page('7', [Buffer.from('old')]))
    try {
      const before = f.connections.status('a')
      if (before.id === null) throw new Error('Missing connection')
      await expect(f.reader.withBudget('a', new AbortController().signal, async stage => {
        const result = await f.reader.scan('a', { match: '*' }, new AbortController().signal, stage)
        await f.connections.selectDatabase('a', { id: before.id!, generation: before.generation, db: 1 }, new AbortController().signal, () => f.reader.clearTarget('a'))
        return result
      })).rejects.toMatchObject({ code: 'stale' })
      expect(f.connections.status('a').db).toBe(1)
      expect(f.reader.budgetStatus('a')).toMatchObject({ callsUsed: 1, bytesUsed: 0, inFlight: 0 })
      expect(decode(await f.run({ match: '*' })).keys).toEqual([Buffer.from('old').toString('base64')])
    } finally { f.reader.dispose(); f.connections.dispose() }
  })
  it('rejects an older staged result without destroying a newer scan', async () => {
    let release!: () => void, staged!: () => void
    const waiting = new Promise<void>(resolve => { staged = resolve }), hold = new Promise<void>(resolve => { release = resolve })
    const execute = vi.fn<RedisLink['execute']>().mockResolvedValueOnce(page('7', [Buffer.from('old')])).mockResolvedValueOnce(page('8', [Buffer.from('new')])).mockResolvedValueOnce(page('0', []))
    const f = await setup(execute), signal = new AbortController().signal
    try {
      const old = f.reader.withBudget('a', signal, async stage => { const value = await f.reader.scan('a', { match: '*' }, signal, stage); staged(); await hold; return value })
      const rejected = expect(old).rejects.toMatchObject({ code: 'stale' })
      await waiting
      const fresh = decode(await f.run({ match: 'new*' }))
      const deliveredBytes = f.reader.budgetStatus('a').bytesUsed
      release(); await rejected
      expect(f.reader.budgetStatus('a')).toMatchObject({ bytesUsed: deliveredBytes, inFlight: 0 })
      if (fresh.cursor === null) throw new Error('Missing fresh cursor')
      expect(decode(await f.run({ match: 'new*', cursor: fresh.cursor })).scanComplete).toBe(true)
    } finally { f.reader.dispose(); f.connections.dispose() }
  })
  it('restores the underlying cursor when an in-flight continuation is cancelled', async () => {
    let started!: () => void
    const waiting = new Promise<void>(resolve => { started = resolve })
    const execute = vi.fn<RedisLink['execute']>()
      .mockResolvedValueOnce(page('7', [Buffer.from('first')]))
      .mockImplementationOnce(async (_command, _args, signal) => new Promise<RedisReply>((_resolve, reject) => {
        started(); signal.addEventListener('abort', () => reject(new Error('cancelled')), { once: true })
      }))
      .mockResolvedValueOnce(page('0', [Buffer.from('second')]))
    const f = await setup(execute), controller = new AbortController()
    try {
      const first = decode(await f.run({ match: '*' }))
      if (first.cursor === null) throw new Error('Missing cursor')
      const pending = f.run({ match: '*', cursor: first.cursor }, controller)
      const cancelled = expect(pending).rejects.toThrow()
      await waiting; controller.abort(); await cancelled
      const retried = decode(await f.run({ match: '*', cursor: first.cursor }))
      expect(retried).toMatchObject({ keys: [Buffer.from('second').toString('base64')], cursor: null, scanComplete: true })
      expect(execute.mock.calls[2]?.[1]).toEqual(['7', 'MATCH', '*', 'COUNT', '100'])
    } finally { f.reader.dispose(); f.connections.dispose() }
  })
  it('retains a fetched continuation when cancellation arrives just after the underlying reader advances', async () => {
    const execute = vi.fn<RedisLink['execute']>().mockResolvedValueOnce(page('7', [Buffer.from('first')])).mockResolvedValueOnce(page('0', [Buffer.from('second')]))
    const f = await setup(execute), controller = new AbortController()
    try {
      const first = decode(await f.run({ match: '*' }))
      if (first.cursor === null) throw new Error('Missing cursor')
      const keyReader = Reflect.get(f.reader, 'keys') as RedisKeys
      const original = keyReader.scan.bind(keyReader)
      vi.spyOn(keyReader, 'scan').mockImplementationOnce(async (...args) => {
        const fetched = await original(...args)
        controller.abort()
        return fetched
      })
      await expect(f.run({ match: '*', cursor: first.cursor }, controller)).rejects.toThrow()
      expect(decode(await f.run({ match: '*', cursor: first.cursor }))).toMatchObject({ keys: [Buffer.from('second').toString('base64')], cursor: null, scanComplete: true })
      expect(execute).toHaveBeenCalledTimes(2)
    } finally { vi.restoreAllMocks(); f.reader.dispose(); f.connections.dispose() }
  })
  it('rejects an individual key that cannot fit intact in the result', async () => {
    const f = await setup(async () => page('0', [Buffer.alloc(65536, 255)]))
    try { await expect(f.run({ match: '*' })).rejects.toThrow('单个 Key') }
    finally { f.reader.dispose(); f.connections.dispose() }
  })
})
