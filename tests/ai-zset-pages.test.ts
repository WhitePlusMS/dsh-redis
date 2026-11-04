import { describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import type { Agent } from '@deepseek-ai/dsh-agent'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime from '@deepseek-ai/dsh-tools'
import { RedisConnections, type RedisLink } from '../src/host/connection-service.ts'
import { RedisAiReader, type AiValueRequest } from '../src/host/ai-reader.ts'
import { RedisZSets } from '../src/host/zset-reader.ts'
import { RedisStrings } from '../src/host/string-reader.ts'
import { registerRedisTools } from '../src/host/ai-tools.ts'
import type { RedisArgument, RedisReply } from '../src/host/resp.ts'

function decode(result: unknown) {
  if (result === null || typeof result !== 'object' || Array.isArray(result) || !('value' in result) || result.value === null || typeof result.value !== 'object' || Array.isArray(result.value)) throw new Error('Expected ZSet result')
  const page = result.value
  if (!('entries' in page) || !Array.isArray(page.entries) || !('cursor' in page) || !(page.cursor === null || typeof page.cursor === 'string')) throw new Error('Expected ZSet page')
  const entries = page.entries.map(item => {
    if (item === null || typeof item !== 'object' || !('member' in item) || item.member === null || typeof item.member !== 'object' || !('base64' in item.member) || typeof item.member.base64 !== 'string' || !('score' in item) || typeof item.score !== 'string' || !('rank' in item) || !(item.rank === null || typeof item.rank === 'string')) throw new Error('Expected complete ZSet entry')
    return { member: item.member.base64, score: item.score, rank: item.rank }
  })
  return { entries, cursor: page.cursor, scanComplete: 'scanComplete' in page && page.scanComplete === true, complete: 'complete' in page && page.complete === true, mode: 'mode' in page ? page.mode : null }
}
const page = (cursor: string, pairs: readonly Buffer[]): RedisReply => [Buffer.from(cursor), [...pairs]]
const settings = { host: 'localhost', port: 6379, username: '', password: '', tls: null }

async function setup(onScan: (args: readonly RedisArgument[], signal: AbortSignal) => Promise<RedisReply>, length = 200n) {
  const commands: string[] = []
  const execute: RedisLink['execute'] = async (command, args, signal, guard) => {
    signal.throwIfAborted(); guard(); commands.push(command)
    switch (command) {
      case 'TYPE': return String(args[0]) === 'hash' ? 'hash' : String(args[0]) === 'set' ? 'set' : 'zset'
      case 'PTTL': return -1n
      case 'ZCARD': return length
      case 'ZSCAN': return onScan(args, signal)
      case 'ZRANGE': return [Buffer.from('ranked'), Buffer.from('1.25')]
      case 'HLEN': return 1n
      case 'HSCAN': return page(args[1] === '0' ? '7' : '0', [Buffer.from('field'), Buffer.from('value')])
      case 'SCARD': return 1n
      case 'SSCAN': return page(args[1] === '0' ? '7' : '0', [Buffer.from('member')])
      case 'SCAN': return page(args[0] === '0' ? '7' : '0', [Buffer.from('other-key')])
      case 'SELECT': return 'OK'
      default: throw new Error('Unexpected command ' + command)
    }
  }
  const transport: RedisLink = { execute, close: () => undefined, onFailure: () => () => undefined }
  const connections = new RedisConnections(async () => transport), reader = new RedisAiReader(connections, () => undefined, async (_session, _target, expected) => expected ?? 0, () => true)
  const view = await connections.connect('a', settings, new AbortController().signal)
  if (view.id === null) throw new Error('Missing connection')
  const target = { id: view.id, generation: view.generation, db: view.db }
  const run = (args: AiValueRequest, controller = new AbortController(), session = 'a') => reader.withBudget(session, controller.signal, stage => reader.read(session, args, controller.signal, stage))
  return { connections, reader, target, run, commands }
}

describe('AI ZSet scan continuation', () => {
  it('preserves a newer ZSet token when an older scan probe finishes late', async () => {
    let ready!: () => void, release!: () => void
    const waiting = new Promise<void>(resolve => { ready = resolve }), hold = new Promise<void>(resolve => { release = resolve })
    const scan = vi.fn().mockResolvedValueOnce(page('7', [Buffer.from('new'), Buffer.from('1')])).mockResolvedValueOnce(page('0', []))
    const f = await setup(scan, 2n)
    try {
      const strings = Reflect.get(f.reader, 'strings') as RedisStrings, original = strings.read.bind(strings)
      vi.spyOn(strings, 'read').mockImplementationOnce(async (...args) => { const result = await original(...args); ready(); await hold; return result })
      const old = f.run({ key: 'zset', match: '*' })
      await waiting
      const fresh = decode(await f.run({ key: 'other', match: '*' }))
      if (fresh.cursor === null) throw new Error('Missing newer cursor')
      release(); const oldOutcome = await old.then(() => 'fulfilled', () => 'rejected')
      expect(decode(await f.run({ key: 'other', match: '*', cursor: fresh.cursor })).scanComplete).toBe(true)
      expect(oldOutcome).toBe('rejected')
    } finally { release(); vi.restoreAllMocks(); f.reader.dispose(); f.connections.dispose() }
  })
  it('keeps the previous ZSet token when a new first scan is cancelled', async () => {
    let ready!: () => void
    const waiting = new Promise<void>(resolve => { ready = resolve })
    const scan = vi.fn().mockResolvedValueOnce(page('7', [Buffer.from('first'), Buffer.from('1')]))
      .mockImplementationOnce(async (_args: readonly RedisArgument[], signal: AbortSignal) => new Promise<RedisReply>((_resolve, reject) => { ready(); signal.addEventListener('abort', () => reject(new Error('cancelled')), { once: true }) }))
      .mockResolvedValueOnce(page('0', [Buffer.from('second'), Buffer.from('2')]))
    const f = await setup(scan, 2n), controller = new AbortController()
    try {
      const first = decode(await f.run({ key: 'zset', match: '*' }))
      if (first.cursor === null) throw new Error('Missing cursor')
      const candidate = f.run({ key: 'other', match: '*' }, controller), rejected = expect(candidate).rejects.toThrow()
      await waiting; controller.abort(); await rejected
      expect(decode(await f.run({ key: 'zset', match: '*', cursor: first.cursor })).scanComplete).toBe(true)
    } finally { f.reader.dispose(); f.connections.dispose() }
  })
  it('does not invalidate a waiting ZSet probe for another type or invalid request', async () => {
    let ready!: () => void, release!: () => void
    const waiting = new Promise<void>(resolve => { ready = resolve }), hold = new Promise<void>(resolve => { release = resolve })
    const f = await setup(async () => page('0', [Buffer.from('a'), Buffer.from('1')]), 1n)
    try {
      const strings = Reflect.get(f.reader, 'strings') as RedisStrings, original = strings.read.bind(strings)
      vi.spyOn(strings, 'read').mockImplementationOnce(async (...args) => { const result = await original(...args); ready(); await hold; return result })
      const older = f.run({ key: 'zset', match: '*' })
      await waiting
      await expect(f.run({ key: 'zset', cursor: 'z:invalid' })).rejects.toMatchObject({ code: 'stale' })
      await expect(f.run({ key: 'hash' })).resolves.toBeDefined()
      await expect(f.run({ key: 'set' })).resolves.toBeDefined()
      release(); expect(decode(await older).scanComplete).toBe(true)
    } finally { release(); vi.restoreAllMocks(); f.reader.dispose(); f.connections.dispose() }
  })
  it('rejects scan/rank mixed arguments before consuming a token', async () => {
    const scan = vi.fn().mockResolvedValueOnce(page('7', [Buffer.from('a'), Buffer.from('1')])).mockResolvedValueOnce(page('0', [Buffer.from('b'), Buffer.from('2')]))
    const f = await setup(scan, 2n)
    try {
      await expect(f.run({ key: 'zset', match: '*', count: 1 })).rejects.toThrow()
      expect(scan).toHaveBeenCalledTimes(0)
      const first = decode(await f.run({ key: 'zset', match: '*' }))
      if (first.cursor === null) throw new Error('Missing cursor')
      await expect(f.run({ key: 'zset', cursor: first.cursor, offset: '0' })).rejects.toThrow()
      await expect(f.run({ key: 'zset', cursor: first.cursor, count: 1 })).rejects.toThrow()
      expect(scan).toHaveBeenCalledTimes(1)
      expect(decode(await f.run({ key: 'zset', cursor: first.cursor, match: '*' })).scanComplete).toBe(true)
      await expect(f.run({ key: 'hash', match: '*' })).resolves.toBeDefined()
      await expect(f.run({ key: 'set', match: '*' })).resolves.toBeDefined()
    } finally { f.reader.dispose(); f.connections.dispose() }
  })
  it('does not let a delayed rank probe invalidate a newer ZSet continuation', async () => {
    let ready!: () => void, release!: () => void
    const waiting = new Promise<void>(resolve => { ready = resolve }), hold = new Promise<void>(resolve => { release = resolve })
    const scan = vi.fn().mockResolvedValueOnce(page('7', [Buffer.from('a'), Buffer.from('1')])).mockResolvedValueOnce(page('8', [Buffer.from('b'), Buffer.from('2')])).mockResolvedValueOnce(page('0', [Buffer.from('c'), Buffer.from('3')]))
    const f = await setup(scan, 3n)
    try {
      const first = decode(await f.run({ key: 'zset', match: '*' }))
      if (first.cursor === null) throw new Error('Missing cursor')
      const strings = Reflect.get(f.reader, 'strings') as RedisStrings, original = strings.read.bind(strings)
      vi.spyOn(strings, 'read').mockImplementationOnce(async (...args) => { const result = await original(...args); ready(); await hold; return result })
      const older = f.run({ key: 'zset', count: 1 })
      await waiting
      const newer = decode(await f.run({ key: 'zset', match: '*', cursor: first.cursor }))
      if (newer.cursor === null) throw new Error('Missing newer cursor')
      release(); expect(decode(await older).mode).toBe('range')
      expect(decode(await f.run({ key: 'zset', match: '*', cursor: newer.cursor })).scanComplete).toBe(true)
    } finally { release(); vi.restoreAllMocks(); f.reader.dispose(); f.connections.dispose() }
  })
  it('keeps a scan cursor when a rank probe is cancelled as it returns', async () => {
    const scan = vi.fn().mockResolvedValueOnce(page('7', [Buffer.from('a'), Buffer.from('1')])).mockResolvedValueOnce(page('0', [Buffer.from('b'), Buffer.from('2')]))
    const f = await setup(scan, 2n), controller = new AbortController()
    try {
      const first = decode(await f.run({ key: 'zset', match: '*' }))
      if (first.cursor === null) throw new Error('Missing cursor')
      const strings = Reflect.get(f.reader, 'strings') as RedisStrings, original = strings.read.bind(strings)
      vi.spyOn(strings, 'read').mockImplementationOnce(async (...args) => { const result = await original(...args); controller.abort(); return result })
      await expect(f.run({ key: 'zset', count: 1 }, controller)).rejects.toThrow()
      expect(f.commands.filter(command => command === 'ZRANGE')).toHaveLength(0)
      expect(decode(await f.run({ key: 'zset', match: '*', cursor: first.cursor })).scanComplete).toBe(true)
    } finally { vi.restoreAllMocks(); f.reader.dispose(); f.connections.dispose() }
  })
  it('does not let invalid, cancelled or other-type requests supersede a valid rank probe', async () => {
    let ready!: () => void, release!: () => void
    const waiting = new Promise<void>(resolve => { ready = resolve }), hold = new Promise<void>(resolve => { release = resolve })
    const f = await setup(async () => page('7', [Buffer.from('a'), Buffer.from('1')]), 1n)
    try {
      const first = decode(await f.run({ key: 'zset', match: '*' }))
      if (first.cursor === null) throw new Error('Missing cursor')
      const strings = Reflect.get(f.reader, 'strings') as RedisStrings, original = strings.read.bind(strings)
      vi.spyOn(strings, 'read').mockImplementationOnce(async (...args) => { const result = await original(...args); ready(); await hold; return result })
      const older = f.run({ key: 'zset', count: 1 })
      await waiting
      await expect(f.run({ key: 'zset', match: '*', cursor: 'z:invalid' })).rejects.toMatchObject({ code: 'stale' })
      await expect(f.run({ key: 'zset', match: '*', cursor: first.cursor, count: 1 })).rejects.toThrow()
      const cancelled = new AbortController(); cancelled.abort()
      await expect(f.run({ key: 'zset', match: '*', cursor: first.cursor }, cancelled)).rejects.toThrow()
      await expect(f.run({ key: 'hash', match: '*' })).resolves.toBeDefined()
      await expect(f.run({ key: 'set', match: '*' })).resolves.toBeDefined()
      release()
      expect(decode(await older).mode).toBe('range')
    } finally { release(); vi.restoreAllMocks(); f.reader.dispose(); f.connections.dispose() }
  })
  it('keeps a rank result and a newer scan independent', async () => {
    let ready!: () => void, release!: () => void
    const waiting = new Promise<void>(resolve => { ready = resolve }), hold = new Promise<void>(resolve => { release = resolve })
    const scan = vi.fn().mockResolvedValueOnce(page('7', [Buffer.from('a'), Buffer.from('1')])).mockResolvedValueOnce(page('0', [Buffer.from('b'), Buffer.from('2')]))
    const f = await setup(scan, 2n)
    try {
      const zsets = Reflect.get(f.reader, 'zsetRanks') as RedisZSets, original = zsets.read.bind(zsets)
      vi.spyOn(zsets, 'read').mockImplementationOnce(async (...args) => { const result = await original(...args); ready(); await hold; return result })
      const older = f.run({ key: 'zset', count: 1 })
      await waiting
      const newer = decode(await f.run({ key: 'zset', match: '*' }))
      if (newer.cursor === null) throw new Error('Missing cursor')
      release(); expect(decode(await older).mode).toBe('range')
      expect(decode(await f.run({ key: 'zset', match: '*', cursor: newer.cursor })).scanComplete).toBe(true)
    } finally { release(); vi.restoreAllMocks(); f.reader.dispose(); f.connections.dispose() }
  })
  it('splits a scan while preserving member bytes, score text and lack of ranks', async () => {
    const rows = Array.from({ length: 180 }, (_item, i) => [Buffer.from(String(i).padStart(4, '0') + ':' + 'x'.repeat(500)), Buffer.from(i % 2 ? '-0' : '1.0000000000000002')]).flat()
    const scan = vi.fn().mockResolvedValueOnce(page('7', rows)).mockResolvedValueOnce(page('0', []))
    const f = await setup(scan, 180n), found: { member: string; score: string; rank: string | null }[] = []
    try {
      let result = await f.run({ key: 'zset', match: 'm*' }), chunk = decode(result)
      expect(chunk.cursor).toMatch(/^z:/u)
      while (true) {
        expect(Buffer.byteLength(JSON.stringify(result))).toBeLessThanOrEqual(64 * 1024)
        expect(chunk.complete).toBe(false); expect(chunk.mode).toBe('scan'); found.push(...chunk.entries)
        if (chunk.cursor === null) { expect(chunk.scanComplete).toBe(true); break }
        const prior = chunk.cursor, before = f.commands.length
        result = await f.run({ key: 'zset', match: 'm*', cursor: prior }); chunk = decode(result)
        if (found.length < rows.length / 2) expect(f.commands).toHaveLength(before)
        await expect(f.run({ key: 'zset', match: 'm*', cursor: prior })).rejects.toMatchObject({ code: 'stale' })
      }
      expect(found).toEqual(Array.from({ length: rows.length / 2 }, (_value, i) => ({ member: rows[i * 2]!.toString('base64'), score: rows[i * 2 + 1]!.toString('utf8'), rank: null })))
      expect(scan).toHaveBeenCalledTimes(2)
      expect(scan.mock.calls[1]?.[0]).toEqual([Buffer.from('zset'), '7', 'MATCH', 'm*', 'COUNT', '100'])
    } finally { f.reader.dispose(); f.connections.dispose() }
  })
  it('binds session, Key, MATCH and selection, and validates input before consuming the token', async () => {
    const scan = vi.fn().mockResolvedValue(page('7', [Buffer.from('a'), Buffer.from('1')]))
    const f = await setup(scan, 1n)
    try {
      await f.connections.connect('b', settings, new AbortController().signal)
      const first = decode(await f.run({ key: 'zset', match: 'a*' }))
      if (first.cursor === null) throw new Error('Missing cursor')
      await expect(f.run({ key: 'other', match: 'a*', cursor: first.cursor })).rejects.toMatchObject({ code: 'stale' })
      await expect(f.run({ key: 'zset', match: 'b*', cursor: first.cursor })).rejects.toMatchObject({ code: 'stale' })
      await expect(f.run({ key: 'zset', match: 'a*', cursor: first.cursor }, new AbortController(), 'b')).rejects.toMatchObject({ code: 'stale' })
      await expect(f.run({ key: 'zset', match: 'a*', cursor: first.cursor, bytes: 0 })).rejects.toThrow()
      await expect(f.run({ key: 'zset', match: 'a*', cursor: first.cursor, offset: '-1' })).rejects.toThrow()
      f.reader.setSelection('a', { target: f.target, selection: { keyBase64: Buffer.from('zset').toString('base64'), item: null } })
      await expect(f.run({ match: 'a*', cursor: first.cursor })).rejects.toMatchObject({ code: 'stale' })
      expect(scan).toHaveBeenCalledTimes(1)
      expect(decode(await f.run({ key: 'zset', match: 'a*', cursor: first.cursor })).entries).toHaveLength(1)
    } finally { f.reader.dispose(); f.connections.dispose() }
  })
  it('keeps a previous scan usable after a successful rank read', async () => {
    const scan = vi.fn().mockResolvedValue(page('7', [Buffer.from('scanned'), Buffer.from('2')]))
    const f = await setup(scan, 1n)
    try {
      const first = decode(await f.run({ key: 'zset', match: '*' }))
      if (first.cursor === null) throw new Error('Missing cursor')
      const rank = decode(await f.run({ key: 'zset', offset: '0', count: 1 }))
      expect(rank).toMatchObject({ mode: 'range', entries: [{ member: Buffer.from('ranked').toString('base64'), score: '1.25', rank: '0' }] })
      expect(decode(await f.run({ key: 'zset', match: '*', cursor: first.cursor })).entries).toHaveLength(1)
      expect(f.commands.filter(command => command === 'ZSCAN')).toHaveLength(2)
      expect(f.commands.filter(command => command === 'ZRANGE')).toHaveLength(1)
    } finally { f.reader.dispose(); f.connections.dispose() }
  })
  it('keeps the scan token when a started rank read is cancelled', async () => {
    const scan = vi.fn().mockResolvedValueOnce(page('7', [Buffer.from('a'), Buffer.from('1')])).mockResolvedValueOnce(page('0', [Buffer.from('b'), Buffer.from('2')]))
    const f = await setup(scan, 2n), controller = new AbortController()
    try {
      const first = decode(await f.run({ key: 'zset', match: '*' }))
      if (first.cursor === null) throw new Error('Missing cursor')
      const rankReader = Reflect.get(f.reader, 'zsetRanks') as RedisZSets, original = rankReader.read.bind(rankReader)
      vi.spyOn(rankReader, 'read').mockImplementationOnce(async (...args) => { const result = await original(...args); controller.abort(); return result })
      await expect(f.run({ key: 'zset', count: 1 }, controller)).rejects.toThrow()
      expect(decode(await f.run({ key: 'zset', match: '*', cursor: first.cursor })).scanComplete).toBe(true)
    } finally { vi.restoreAllMocks(); f.reader.dispose(); f.connections.dispose() }
  })
  it('retains the scan token and delayed rank after an in-flight scan is cancelled', async () => {
    let probeReady!: () => void, releaseProbe!: () => void, scanReady!: () => void
    const probeWaiting = new Promise<void>(resolve => { probeReady = resolve }), probeHold = new Promise<void>(resolve => { releaseProbe = resolve }), scanWaiting = new Promise<void>(resolve => { scanReady = resolve })
    const scan = vi.fn().mockResolvedValueOnce(page('7', [Buffer.from('a'), Buffer.from('1')]))
    scan.mockImplementationOnce(async (_args: readonly RedisArgument[], signal: AbortSignal) => new Promise<RedisReply>((_resolve, reject) => { scanReady(); signal.addEventListener('abort', () => reject(new Error('cancelled')), { once: true }) }))
    scan.mockResolvedValueOnce(page('0', [Buffer.from('b'), Buffer.from('2')]))
    const f = await setup(scan, 2n), controller = new AbortController()
    try {
      const first = decode(await f.run({ key: 'zset', match: '*' }))
      if (first.cursor === null) throw new Error('Missing cursor')
      const strings = Reflect.get(f.reader, 'strings') as RedisStrings, original = strings.read.bind(strings)
      vi.spyOn(strings, 'read').mockImplementationOnce(async (...args) => { const result = await original(...args); probeReady(); await probeHold; return result })
      const rank = f.run({ key: 'zset', count: 1 })
      await probeWaiting
      const continuation = f.run({ key: 'zset', match: '*', cursor: first.cursor }, controller), cancelled = expect(continuation).rejects.toThrow()
      await scanWaiting; controller.abort(); await cancelled
      releaseProbe(); expect(decode(await rank).mode).toBe('range')
      expect(decode(await f.run({ key: 'zset', match: '*', cursor: first.cursor })).scanComplete).toBe(true)
    } finally { releaseProbe(); vi.restoreAllMocks(); f.reader.dispose(); f.connections.dispose() }
  })
  it('keeps the scan token when the rank reader fails', async () => {
    const scan = vi.fn().mockResolvedValueOnce(page('7', [Buffer.from('a'), Buffer.from('1')])).mockResolvedValueOnce(page('0', [Buffer.from('b'), Buffer.from('2')]))
    const f = await setup(scan, 2n)
    try {
      const first = decode(await f.run({ key: 'zset', match: '*' }))
      if (first.cursor === null) throw new Error('Missing cursor')
      const rankReader = Reflect.get(f.reader, 'zsetRanks') as RedisZSets
      vi.spyOn(rankReader, 'read').mockRejectedValueOnce(new Error('rank failed'))
      await expect(f.run({ key: 'zset', count: 1 })).rejects.toThrow('rank failed')
      expect(decode(await f.run({ key: 'zset', match: '*', cursor: first.cursor })).scanComplete).toBe(true)
    } finally { vi.restoreAllMocks(); f.reader.dispose(); f.connections.dispose() }
  })
  it('rejects an invalid rank request without invalidating the scan token', async () => {
    const scan = vi.fn().mockResolvedValueOnce(page('7', [Buffer.from('first'), Buffer.from('1')])).mockResolvedValueOnce(page('0', [Buffer.from('second'), Buffer.from('2')]))
    const f = await setup(scan, 2n)
    try {
      const first = decode(await f.run({ key: 'zset', match: '*' }))
      if (first.cursor === null) throw new Error('Missing cursor')
      await expect(f.run({ key: 'zset', count: 0 })).rejects.toThrow()
      expect(f.commands.filter(command => command === 'ZRANGE')).toHaveLength(0)
      expect(decode(await f.run({ key: 'zset', match: '*', cursor: first.cursor })).entries[0]?.score).toBe('2')
    } finally { f.reader.dispose(); f.connections.dispose() }
  })
  it('keeps the empty scan token through an exhausted budget and manual resume', async () => {
    const scan = vi.fn().mockResolvedValueOnce(page('7', [])).mockResolvedValueOnce(page('0', [Buffer.from('a'), Buffer.from('1')]))
    const f = await setup(scan, 1n), signal = new AbortController().signal
    try {
      const first = decode(await f.run({ key: 'zset', match: '*' }))
      expect(first.entries).toEqual([]); expect(first.scanComplete).toBe(false)
      if (first.cursor === null) throw new Error('Missing empty cursor')
      for (let i = 1; i < 32; i++) await f.reader.withBudget('a', signal, () => ({ ok: true }))
      await expect(f.run({ key: 'zset', match: '*', cursor: first.cursor })).rejects.toThrow('预算已用完')
      expect(scan).toHaveBeenCalledTimes(1); expect(f.reader.resumeBudget('a').accepted).toBe(true)
      expect(decode(await f.run({ key: 'zset', match: '*', cursor: first.cursor })).scanComplete).toBe(true)
    } finally { f.reader.dispose(); f.connections.dispose() }
  })
  it('rejects a competing ZSet scan while a staged page is in flight', async () => {
    let release!: () => void, staged!: () => void
    const waiting = new Promise<void>(resolve => { staged = resolve }), hold = new Promise<void>(resolve => { release = resolve })
    const scan = vi.fn().mockResolvedValueOnce(page('7', [Buffer.from('old'), Buffer.from('1')])).mockResolvedValueOnce(page('8', [Buffer.from('new'), Buffer.from('2')])).mockResolvedValueOnce(page('0', []))
    const f = await setup(scan, 1n), signal = new AbortController().signal
    try {
      const old = f.reader.withBudget('a', signal, async stage => { const value = await f.reader.read('a', { key: 'zset', match: '*' }, signal, stage); staged(); await hold; return value })
      await waiting
      await expect(f.run({ key: 'other', match: '*' })).rejects.toThrow('正在执行')
      release(); await old
      const fresh = decode(await f.run({ key: 'other', match: '*' }))
      expect(f.reader.budgetStatus('a').inFlight).toBe(0)
      if (fresh.cursor === null) throw new Error('Missing cursor')
      expect(decode(await f.run({ key: 'other', match: '*', cursor: fresh.cursor })).scanComplete).toBe(true)
    } finally { f.reader.dispose(); f.connections.dispose() }
  })
  it('preserves a fetched page on late cancellation and retries an in-flight cursor', async () => {
    const scan = vi.fn().mockResolvedValueOnce(page('7', [Buffer.from('first'), Buffer.from('1')])).mockResolvedValueOnce(page('8', [Buffer.from('second'), Buffer.from('2')]))
    const f = await setup(scan, 3n), controller = new AbortController()
    try {
      const first = decode(await f.run({ key: 'zset', match: '*' }))
      if (first.cursor === null) throw new Error('Missing cursor')
      const zsetReader = Reflect.get(f.reader, 'zsets') as RedisZSets, original = zsetReader.read.bind(zsetReader)
      vi.spyOn(zsetReader, 'read').mockImplementationOnce(async (...args) => { const fetched = await original(...args); controller.abort(); return fetched })
      await expect(f.run({ key: 'zset', match: '*', cursor: first.cursor }, controller)).rejects.toThrow()
      const second = decode(await f.run({ key: 'zset', match: '*', cursor: first.cursor }))
      expect(second.entries[0]?.score).toBe('2'); expect(scan).toHaveBeenCalledTimes(2)
      if (second.cursor === null) throw new Error('Missing second cursor')
      let started!: () => void
      const waiting = new Promise<void>(resolve => { started = resolve }), during = new AbortController()
      scan.mockImplementationOnce(async (_args: readonly RedisArgument[], signal: AbortSignal) => new Promise<RedisReply>((_resolve, reject) => { started(); signal.addEventListener('abort', () => reject(new Error('cancelled')), { once: true }) }))
      scan.mockResolvedValueOnce(page('0', [Buffer.from('third'), Buffer.from('3')]))
      const pending = f.run({ key: 'zset', match: '*', cursor: second.cursor }, during), cancelled = expect(pending).rejects.toThrow()
      await waiting; during.abort(); await cancelled
      expect(decode(await f.run({ key: 'zset', match: '*', cursor: second.cursor })).scanComplete).toBe(true)
    } finally { vi.restoreAllMocks(); f.reader.dispose(); f.connections.dispose() }
  })
  it('rejects selection or DB changes at commit without charging bytes', async () => {
    const f = await setup(async () => page('7', [Buffer.from('a'), Buffer.from('1')]), 1n), signal = new AbortController().signal
    try {
      f.reader.setSelection('a', { target: f.target, selection: { keyBase64: Buffer.from('zset').toString('base64'), item: null } })
      await expect(f.reader.withBudget('a', signal, async stage => {
        const result = await f.reader.read('a', { match: '*' }, signal, stage)
        f.reader.setSelection('a', { target: f.target, selection: { keyBase64: Buffer.from('other').toString('base64'), item: null } })
        return result
      })).rejects.toThrow('选择已变化')
      await expect(f.reader.withBudget('a', signal, async stage => {
        const result = await f.reader.read('a', { key: 'zset', match: '*' }, signal, stage)
        await f.connections.selectDatabase('a', { ...f.target, db: 1 }, signal, () => f.reader.clearTarget('a'))
        return result
      })).rejects.toMatchObject({ code: 'stale' })
      expect(f.reader.budgetStatus('a')).toMatchObject({ callsUsed: 2, bytesUsed: 0, inFlight: 0 })
    } finally { f.reader.dispose(); f.connections.dispose() }
  })
  it('keeps other type cursors when one indivisible ZSet member is too large', async () => {
    const f = await setup(async () => page('0', [Buffer.alloc(65536, 255), Buffer.from('0')]), 1n), signal = new AbortController().signal
    try {
      const keys = await f.reader.scan('a', { match: '*' }, signal)
      if (keys === null || typeof keys !== 'object' || Array.isArray(keys) || typeof keys.cursor !== 'string') throw new Error('Missing Key cursor')
      const hash = await f.run({ key: 'hash' }), set = await f.run({ key: 'set' })
      const hashPage = hash !== null && typeof hash === 'object' && !Array.isArray(hash) ? hash.value : null
      const setPage = set !== null && typeof set === 'object' && !Array.isArray(set) ? set.value : null
      if (hashPage === null || typeof hashPage !== 'object' || Array.isArray(hashPage) || typeof hashPage.cursor !== 'string' || setPage === null || typeof setPage !== 'object' || Array.isArray(setPage) || typeof setPage.cursor !== 'string') throw new Error('Missing Hash/Set cursor')
      await expect(f.run({ key: 'zset', match: '*' })).rejects.toThrow('单个 ZSet 成员')
      expect(await f.reader.scan('a', { match: '*', cursor: keys.cursor }, signal)).toMatchObject({ state: 'page', scanComplete: true })
      expect(await f.run({ key: 'hash', cursor: hashPage.cursor })).toMatchObject({ value: { state: 'page', scanComplete: true } })
      expect(await f.run({ key: 'set', cursor: setPage.cursor })).toMatchObject({ value: { state: 'page', scanComplete: true } })
    } finally { f.reader.dispose(); f.connections.dispose() }
  })
  it('reads a multi-part ZSCAN via the registered value tool', async () => {
    const pairs = Array.from({ length: 100 }, (_item, i) => [Buffer.from('member-' + i + 'x'.repeat(900)), Buffer.from(i % 2 ? '-0' : '1.0000000000000002')]).flat()
    const f = await setup(async () => page('0', pairs), 100n), ctx = new Context()
    try {
      await ctx.plugin(SystemPrompt); await ctx.plugin(ToolRuntime)
      await ctx.plugin({ name: 'zset-ai-test', inject: ['tools'], apply: (scope: Context) => { registerRedisTools(scope, f.reader) } })
      const agent = { id: 'agent-a', ctx, session: { id: 'a' } } as unknown as Agent
      const found: { member: string; score: string; rank: string | null }[] = []
      let cursor: string | null = null, callId = 0
      do {
        const args = cursor === null ? { key: 'zset', match: '*' } : { key: 'zset', match: '*', cursor }
        const reply = await ctx.tools.execute({ callId: ('zset-' + ++callId) as Parameters<typeof ctx.tools.execute>[0]['callId'], name: 'redis_viewer_value', arguments: args, agent, signal: new AbortController().signal })
        expect(reply.isError).toBeFalsy()
        const text = reply.content.filter(block => block.type === 'text').map(block => block.text).join('')
        expect(Buffer.byteLength(text)).toBeLessThanOrEqual(64 * 1024)
        const chunk = decode(JSON.parse(text) as unknown)
        found.push(...chunk.entries); cursor = chunk.cursor
      } while (cursor !== null)
      expect(found).toEqual(Array.from({ length: 100 }, (_item, i) => ({ member: pairs[i * 2]!.toString('base64'), score: pairs[i * 2 + 1]!.toString('utf8'), rank: null })))
      expect(f.commands.filter(command => command === 'ZSCAN')).toHaveLength(1)
    } finally { await ctx.fiber.dispose(); f.reader.dispose(); f.connections.dispose() }
  })
})
