import * as NativeToolExecutor from '@deepseek-ai/dsh-tool-executor-native'
import { executeTool } from './tool-test-utils.ts'
import { describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import type { Agent } from '@deepseek-ai/dsh-agent'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime from '@deepseek-ai/dsh-tools'
import { RedisConnections, type RedisLink } from '../src/host/connection-service.ts'
import { RedisAiReader, type AiValueRequest } from '../src/host/ai-reader.ts'
import { RedisHashes } from '../src/host/hash-reader.ts'
import { RedisStrings } from '../src/host/string-reader.ts'
import { registerRedisTools } from '../src/host/ai-tools.ts'
import type { RedisArgument, RedisReply } from '../src/host/resp.ts'

function decode(result: unknown) {
  if (result === null || typeof result !== 'object' || Array.isArray(result) || !('value' in result) || result.value === null || typeof result.value !== 'object' || Array.isArray(result.value)) throw new Error('Expected Hash result')
  const page = result.value
  if (!('entries' in page) || !Array.isArray(page.entries) || !('cursor' in page) || !(page.cursor === null || typeof page.cursor === 'string')) throw new Error('Expected Hash page')
  const entries = page.entries.map(entry => {
    if (entry === null || typeof entry !== 'object' || !('field' in entry) || entry.field === null || typeof entry.field !== 'object' || !('base64' in entry.field) || typeof entry.field.base64 !== 'string' || !('value' in entry) || entry.value === null || typeof entry.value !== 'object' || !('base64' in entry.value) || typeof entry.value.base64 !== 'string') throw new Error('Expected complete field and preview')
    return { field: entry.field.base64, value: entry.value.base64 }
  })
  return { entries, cursor: page.cursor, scanComplete: 'scanComplete' in page && page.scanComplete === true, complete: 'complete' in page && page.complete === true }
}
const page = (cursor: string, fields: readonly Buffer[]): RedisReply => [Buffer.from(cursor), [...fields]]
const settings = { host: 'localhost', port: 6379, username: '', password: '', tls: null }

async function setup(onScan: (args: readonly RedisArgument[], signal: AbortSignal) => Promise<RedisReply>, length = 200n) {
  const commands: string[] = []
  const execute: RedisLink['execute'] = async (command, args, signal, guard) => {
    signal.throwIfAborted(); guard(); commands.push(command)
    switch (command) {
      case 'TYPE': return 'hash'
      case 'PTTL': return -1n
      case 'HLEN': return length
      case 'HSCAN': return onScan(args, signal)
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

describe('AI Hash page continuation', () => {
  it('preserves a newer Hash token when an older first-read probe finishes late', async () => {
    let ready!: () => void, release!: () => void
    const waiting = new Promise<void>(resolve => { ready = resolve }), hold = new Promise<void>(resolve => { release = resolve })
    const scan = vi.fn().mockResolvedValueOnce(page('7', [Buffer.from('new'), Buffer.from('1')])).mockResolvedValueOnce(page('0', []))
    const f = await setup(scan, 2n)
    try {
      const strings = Reflect.get(f.reader, 'strings') as RedisStrings, original = strings.read.bind(strings)
      vi.spyOn(strings, 'read').mockImplementationOnce(async (...args) => { const result = await original(...args); ready(); await hold; return result })
      const old = f.run({ key: 'hash' })
      await waiting
      const fresh = decode(await f.run({ key: 'other' }))
      if (fresh.cursor === null) throw new Error('Missing newer cursor')
      release(); const oldOutcome = await old.then(() => 'fulfilled', () => 'rejected')
      expect(decode(await f.run({ key: 'other', cursor: fresh.cursor })).scanComplete).toBe(true)
      expect(oldOutcome).toBe('rejected')
    } finally { release(); vi.restoreAllMocks(); f.reader.dispose(); f.connections.dispose() }
  })
  it('keeps the previous Hash token when a new first read is cancelled', async () => {
    let ready!: () => void
    const waiting = new Promise<void>(resolve => { ready = resolve })
    const scan = vi.fn().mockResolvedValueOnce(page('7', [Buffer.from('first'), Buffer.from('1')]))
      .mockImplementationOnce(async (_args: readonly RedisArgument[], signal: AbortSignal) => new Promise<RedisReply>((_resolve, reject) => { ready(); signal.addEventListener('abort', () => reject(new Error('cancelled')), { once: true }) }))
      .mockResolvedValueOnce(page('0', [Buffer.from('second'), Buffer.from('2')]))
    const f = await setup(scan, 2n), controller = new AbortController()
    try {
      const first = decode(await f.run({ key: 'hash' }))
      if (first.cursor === null) throw new Error('Missing cursor')
      const candidate = f.run({ key: 'other' }, controller), rejected = expect(candidate).rejects.toThrow()
      await waiting; controller.abort(); await rejected
      expect(decode(await f.run({ key: 'hash', cursor: first.cursor })).scanComplete).toBe(true)
    } finally { f.reader.dispose(); f.connections.dispose() }
  })
  it('replaces the previous Hash token only after a new first read commits', async () => {
    const scan = vi.fn().mockResolvedValueOnce(page('7', [Buffer.from('first'), Buffer.from('1')])).mockResolvedValueOnce(page('8', [Buffer.from('new'), Buffer.from('2')])).mockResolvedValueOnce(page('0', []))
    const f = await setup(scan, 2n)
    try {
      const first = decode(await f.run({ key: 'hash' }))
      const next = decode(await f.run({ key: 'other' }))
      if (first.cursor === null || next.cursor === null) throw new Error('Missing cursor')
      await expect(f.run({ key: 'hash', cursor: first.cursor })).rejects.toMatchObject({ code: 'stale' })
      expect(decode(await f.run({ key: 'other', cursor: next.cursor })).scanComplete).toBe(true)
    } finally { f.reader.dispose(); f.connections.dispose() }
  })
  it('splits a bounded Hash response without losing fields or fetching the next Redis page early', async () => {
    const fields = Array.from({ length: 200 }, (_item, i) => [Buffer.from('field-' + i), Buffer.from('value-' + i + 'x'.repeat(900))]).flat()
    const scan = vi.fn().mockResolvedValueOnce(page('7', fields)).mockResolvedValueOnce(page('0', []))
    const f = await setup(scan), output: { field: string; value: string }[] = []
    try {
      let result = await f.run({ key: 'hash', match: 'field*' }), chunk = decode(result)
      expect(chunk.cursor).toMatch(/^h:/u)
      while (true) {
        expect(Buffer.byteLength(JSON.stringify(result))).toBeLessThanOrEqual(64 * 1024)
        expect(chunk.complete).toBe(false)
        output.push(...chunk.entries)
        if (chunk.cursor === null) { expect(chunk.scanComplete).toBe(true); break }
        const prior = chunk.cursor, before = f.commands.length
        result = await f.run({ key: 'hash', match: 'field*', cursor: prior }); chunk = decode(result)
        if (output.length < fields.length / 2) expect(f.commands).toHaveLength(before)
        await expect(f.run({ key: 'hash', match: 'field*', cursor: prior })).rejects.toMatchObject({ code: 'stale' })
      }
      expect(output).toEqual(Array.from({ length: fields.length / 2 }, (_value, i) => ({ field: fields[i * 2]!.toString('base64'), value: fields[i * 2 + 1]!.toString('base64') })))
      expect(scan).toHaveBeenCalledTimes(2)
      expect(scan.mock.calls[1]?.[0]).toEqual([Buffer.from('hash'), '7', 'MATCH', 'field*', 'COUNT', '100'])
    } finally { f.reader.dispose(); f.connections.dispose() }
  })
  it('rejects changed session, Key, pattern and selection without consuming the valid token', async () => {
    const scan = vi.fn().mockResolvedValue(page('7', [Buffer.from('a'), Buffer.from('1')]))
    const f = await setup(scan, 1n)
    try {
      await f.connections.connect('b', settings, new AbortController().signal)
      const first = decode(await f.run({ key: 'hash', match: 'a*' }))
      if (first.cursor === null) throw new Error('Missing cursor')
      await expect(f.run({ key: 'other', match: 'a*', cursor: first.cursor })).rejects.toMatchObject({ code: 'stale' })
      await expect(f.run({ key: 'hash', match: 'b*', cursor: first.cursor })).rejects.toMatchObject({ code: 'stale' })
      await expect(f.run({ key: 'hash', match: 'a*', cursor: first.cursor }, new AbortController(), 'b')).rejects.toMatchObject({ code: 'stale' })
      f.reader.setSelection('a', { target: f.target, selection: { keyBase64: Buffer.from('hash').toString('base64'), item: null } })
      await expect(f.run({ match: 'a*', cursor: first.cursor })).rejects.toMatchObject({ code: 'stale' })
      expect(decode(await f.run({ key: 'hash', match: 'a*', cursor: first.cursor })).entries).toHaveLength(1)
    } finally { f.reader.dispose(); f.connections.dispose() }
  })
  it('rejects invalid shared parameters before consuming a Hash cursor', async () => {
    const scan = vi.fn().mockResolvedValueOnce(page('7', [Buffer.from('first'), Buffer.from('1')])).mockResolvedValueOnce(page('0', [Buffer.from('second'), Buffer.from('2')]))
    const f = await setup(scan, 2n)
    try {
      const first = decode(await f.run({ key: 'hash' }))
      if (first.cursor === null) throw new Error('Missing cursor')
      await expect(f.run({ key: 'hash', cursor: first.cursor, bytes: 0 })).rejects.toThrow()
      await expect(f.run({ key: 'hash', cursor: first.cursor, offset: '-1' })).rejects.toThrow()
      expect(scan).toHaveBeenCalledTimes(1)
      expect(decode(await f.run({ key: 'hash', cursor: first.cursor }))).toMatchObject({ entries: [{ field: Buffer.from('second').toString('base64'), value: Buffer.from('2').toString('base64') }], scanComplete: true })
    } finally { f.reader.dispose(); f.connections.dispose() }
  })
  it('preserves fetched fields when cancellation arrives after the Hash reader advanced', async () => {
    const scan = vi.fn().mockResolvedValueOnce(page('7', [Buffer.from('first'), Buffer.from('1')])).mockResolvedValueOnce(page('0', [Buffer.from('second'), Buffer.from('2')]))
    const f = await setup(scan, 2n), controller = new AbortController()
    try {
      const first = decode(await f.run({ key: 'hash' }))
      if (first.cursor === null) throw new Error('Missing cursor')
      const hashReader = Reflect.get(f.reader, 'hashes') as RedisHashes, original = hashReader.scan.bind(hashReader)
      vi.spyOn(hashReader, 'scan').mockImplementationOnce(async (...args) => { const fetched = await original(...args); controller.abort(); return fetched })
      await expect(f.run({ key: 'hash', cursor: first.cursor }, controller)).rejects.toThrow()
      expect(decode(await f.run({ key: 'hash', cursor: first.cursor }))).toMatchObject({ entries: [{ field: Buffer.from('second').toString('base64'), value: Buffer.from('2').toString('base64') }], cursor: null, scanComplete: true })
      expect(scan).toHaveBeenCalledTimes(2)
    } finally { vi.restoreAllMocks(); f.reader.dispose(); f.connections.dispose() }
  })
  it('retries the same underlying Hash cursor after an in-flight cancellation', async () => {
    let started!: () => void
    const waiting = new Promise<void>(resolve => { started = resolve })
    const scan = vi.fn().mockResolvedValueOnce(page('7', [Buffer.from('first'), Buffer.from('1')]))
      .mockImplementationOnce(async (_args: readonly RedisArgument[], signal: AbortSignal) => new Promise<RedisReply>((_resolve, reject) => { started(); signal.addEventListener('abort', () => reject(new Error('cancelled')), { once: true }) }))
      .mockResolvedValueOnce(page('0', [Buffer.from('second'), Buffer.from('2')]))
    const f = await setup(scan, 2n), controller = new AbortController()
    try {
      const first = decode(await f.run({ key: 'hash' }))
      if (first.cursor === null) throw new Error('Missing cursor')
      const pending = f.run({ key: 'hash', cursor: first.cursor }, controller), cancelled = expect(pending).rejects.toThrow()
      await waiting; controller.abort(); await cancelled
      expect(decode(await f.run({ key: 'hash', cursor: first.cursor })).scanComplete).toBe(true)
      expect(scan.mock.calls[2]?.[0]).toEqual([Buffer.from('hash'), '7', 'MATCH', '*', 'COUNT', '100'])
    } finally { f.reader.dispose(); f.connections.dispose() }
  })
  it('rejects a changed sidebar selection before staged delivery without charging bytes', async () => {
    const f = await setup(async () => page('0', [Buffer.from('a'), Buffer.from('1')]), 1n), signal = new AbortController().signal
    try {
      f.reader.setSelection('a', { target: f.target, selection: { keyBase64: Buffer.from('hash').toString('base64'), item: null } })
      await expect(f.reader.withBudget('a', signal, async stage => {
        const result = await f.reader.read('a', {}, signal, stage)
        f.reader.setSelection('a', { target: f.target, selection: { keyBase64: Buffer.from('other').toString('base64'), item: null } })
        return result
      })).rejects.toThrow('选择已变化')
      expect(f.reader.budgetStatus('a')).toMatchObject({ callsUsed: 1, bytesUsed: 0, inFlight: 0 })
    } finally { f.reader.dispose(); f.connections.dispose() }
  })
  it('retains the same tail when cancellation occurs after staging', async () => {
    const fields = Array.from({ length: 100 }, (_item, i) => [Buffer.from('field-' + i), Buffer.from('x'.repeat(900))]).flat()
    const scan = vi.fn().mockResolvedValue(page('0', fields)), f = await setup(scan, 100n), controller = new AbortController()
    try {
      const first = decode(await f.run({ key: 'hash' }))
      if (first.cursor === null) throw new Error('Missing cursor')
      await expect(f.reader.withBudget('a', controller.signal, async stage => {
        const result = await f.reader.read('a', { key: 'hash', cursor: first.cursor! }, controller.signal, stage)
        controller.abort(); return result
      })).rejects.toThrow()
      let chunk = decode(await f.run({ key: 'hash', cursor: first.cursor }))
      const entries = [...first.entries, ...chunk.entries]
      while (chunk.cursor !== null) { chunk = decode(await f.run({ key: 'hash', cursor: chunk.cursor })); entries.push(...chunk.entries) }
      expect(entries.map(entry => entry.field)).toEqual(Array.from({ length: 100 }, (_value, i) => Buffer.from('field-' + i).toString('base64')))
      expect(scan).toHaveBeenCalledTimes(1)
    } finally { f.reader.dispose(); f.connections.dispose() }
  })
  it('keeps an empty page cursor through an exhausted budget and manual resume', async () => {
    const scan = vi.fn().mockResolvedValueOnce(page('7', [])).mockResolvedValueOnce(page('0', [Buffer.from('a'), Buffer.from('1')]))
    const f = await setup(scan, 1n), signal = new AbortController().signal
    try {
      const first = decode(await f.run({ key: 'hash' }))
      expect(first.entries).toEqual([]); expect(first.scanComplete).toBe(false)
      if (first.cursor === null) throw new Error('Missing empty-page cursor')
      for (let i = 1; i < 32; i++) await f.reader.withBudget('a', signal, () => ({ ok: true }))
      await expect(f.run({ key: 'hash', cursor: first.cursor })).rejects.toThrow('预算已用完')
      expect(scan).toHaveBeenCalledTimes(1)
      expect(f.reader.resumeBudget('a').accepted).toBe(true)
      expect(decode(await f.run({ key: 'hash', cursor: first.cursor })).scanComplete).toBe(true)
    } finally { f.reader.dispose(); f.connections.dispose() }
  })
  it('rejects a staged result after DB changes without charging its result bytes', async () => {
    const f = await setup(async () => page('7', [Buffer.from('a'), Buffer.from('1')]), 1n), signal = new AbortController().signal
    try {
      await expect(f.reader.withBudget('a', signal, async stage => {
        const result = await f.reader.read('a', { key: 'hash' }, signal, stage)
        await f.connections.selectDatabase('a', { ...f.target, db: 1 }, signal, () => f.reader.clearTarget('a'))
        return result
      })).rejects.toMatchObject({ code: 'stale' })
      expect(f.reader.budgetStatus('a')).toMatchObject({ callsUsed: 1, bytesUsed: 0, inFlight: 0 })
    } finally { f.reader.dispose(); f.connections.dispose() }
  })
  it('rejects a competing Hash read while a staged page is in flight', async () => {
    let release!: () => void, staged!: () => void
    const waiting = new Promise<void>(resolve => { staged = resolve }), hold = new Promise<void>(resolve => { release = resolve })
    const scan = vi.fn().mockResolvedValueOnce(page('7', [Buffer.from('old'), Buffer.from('1')])).mockResolvedValueOnce(page('8', [Buffer.from('new'), Buffer.from('2')])).mockResolvedValueOnce(page('0', []))
    const f = await setup(scan, 1n), signal = new AbortController().signal
    try {
      const old = f.reader.withBudget('a', signal, async stage => { const value = await f.reader.read('a', { key: 'hash' }, signal, stage); staged(); await hold; return value })
      await waiting
      await expect(f.run({ key: 'other' })).rejects.toThrow('正在执行')
      release(); await old
      const fresh = decode(await f.run({ key: 'other' }))
      expect(f.reader.budgetStatus('a').inFlight).toBe(0)
      if (fresh.cursor === null) throw new Error('Missing new cursor')
      expect(decode(await f.run({ key: 'other', cursor: fresh.cursor })).scanComplete).toBe(true)
    } finally { f.reader.dispose(); f.connections.dispose() }
  })
  it('refuses an oversized indivisible field without affecting a Key scan', async () => {
    const f = await setup(async () => page('0', [Buffer.alloc(65536, 255), Buffer.from('x')]), 1n)
    try {
      const keys = await f.reader.scan('a', { match: '*' }, new AbortController().signal)
      if (keys === null || typeof keys !== 'object' || Array.isArray(keys) || typeof keys.cursor !== 'string') throw new Error('Missing Key cursor')
      await expect(f.run({ key: 'hash' })).rejects.toThrow('单个 Hash 字段')
      const continuation = await f.reader.scan('a', { match: '*', cursor: keys.cursor }, new AbortController().signal)
      expect(continuation).toMatchObject({ state: 'page', scanComplete: true })
    }
    finally { f.reader.dispose(); f.connections.dispose() }
  })
  it('uses the registered value tool for a multi-part Hash batch', async () => {
    const fields = Array.from({ length: 100 }, (_item, i) => [Buffer.from('field-' + i), Buffer.from('x'.repeat(900))]).flat()
    const f = await setup(async () => page('0', fields), 100n), ctx = new Context()
    try {
      await ctx.plugin(SystemPrompt); await ctx.plugin(ToolRuntime); await ctx.plugin(NativeToolExecutor)
      await ctx.plugin({ name: 'hash-ai-test', inject: ['tools'], apply: (scope: Context) => { registerRedisTools(scope, f.reader) } })
      const agent = { id: 'agent-a', ctx, session: { id: 'a' } } as unknown as Agent
      const found: string[] = []
      let cursor: string | null = null, callId = 0
      do {
        const reply = await executeTool(ctx.tools, { callId: ('hash-' + ++callId) as string, name: 'redis_viewer_value', arguments: cursor === null ? { key: 'hash' } : { key: 'hash', cursor }, agent, signal: new AbortController().signal })
        expect(reply.isError).toBeFalsy()
        const text = reply.content.filter(block => block.type === 'text').map(block => block.text).join('')
        expect(Buffer.byteLength(text)).toBeLessThanOrEqual(64 * 1024)
        const chunk = decode(JSON.parse(text) as unknown)
        found.push(...chunk.entries.map(entry => entry.field)); cursor = chunk.cursor
      } while (cursor !== null)
      expect(found).toEqual(Array.from({ length: 100 }, (_value, i) => Buffer.from('field-' + i).toString('base64')))
      expect(f.commands.filter(command => command === 'HSCAN')).toHaveLength(1)
    } finally { await ctx.fiber.dispose(); f.reader.dispose(); f.connections.dispose() }
  })
})
