import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { Context } from '@deepseek-ai/cordis'
import type { Agent } from '@deepseek-ai/dsh-agent'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime from '@deepseek-ai/dsh-tools'
import { RedisConnections, type RedisLink } from '../src/host/connection-service.ts'
import { RedisAiReader, type AiValueRequest } from '../src/host/ai-reader.ts'
import { RedisStrings } from '../src/host/string-reader.ts'
import { RedisStreams } from '../src/host/stream-reader.ts'
import { registerRedisTools } from '../src/host/ai-tools.ts'
import type { RedisArgument, RedisReply } from '../src/host/resp.ts'

const resultSchema = z.object({ value: z.object({ cursor: z.string().nullable(), scanComplete: z.boolean(), complete: z.boolean(), messages: z.array(z.object({ id: z.string(), fields: z.array(z.object({ index: z.number(), field: z.object({ base64: z.string() }), value: z.object({ base64: z.string(), complete: z.boolean(), fullByteLength: z.number() }) })) })) }) })
const message = (id: string, fields: readonly Buffer[]): RedisReply => [Buffer.from(id), [...fields]]
const settings = { host: 'localhost', port: 6379, username: '', password: '', tls: null }

async function setup(onRange: (args: readonly RedisArgument[], signal: AbortSignal) => Promise<RedisReply>, length: bigint) {
  const commands: string[] = []
  const execute: RedisLink['execute'] = async (command, args, signal, guard) => {
    signal.throwIfAborted(); guard(); commands.push(command)
    switch (command) {
      case 'TYPE': return String(args[0]) === 'hash' ? 'hash' : 'stream'
      case 'PTTL': return -1n
      case 'XLEN': return length
      case 'HLEN': return 1n
      case 'HSCAN': return [Buffer.from(args[1] === '0' ? '7' : '0'), [Buffer.from('f'), Buffer.from('v')]]
      case 'SCAN': return [Buffer.from(args[0] === '0' ? '7' : '0'), [Buffer.from('key')]]
      case 'XRANGE': case 'XREVRANGE': return onRange(args, signal)
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
  return { reader, connections, target, commands, run }
}

describe('AI Stream message continuation', () => {
  it('splits a large page by whole messages, retaining repeated fields and order', async () => {
    const rows = Array.from({ length: 70 }, (_item, i) => message(`${i + 1}-0`, [Buffer.from('same'), Buffer.from('a'.repeat(900)), Buffer.from('same'), Buffer.from('b'.repeat(900))]))
    const range = vi.fn().mockResolvedValue(rows), f = await setup(range, 70n)
    try {
      let result = await f.run({ key: 'stream', count: 100 }), chunk = resultSchema.parse(result).value
      const messages = [...chunk.messages]
      expect(chunk.cursor).toMatch(/^x:/u)
      while (chunk.cursor !== null) {
        expect(Buffer.byteLength(JSON.stringify(result))).toBeLessThanOrEqual(64 * 1024)
        const cursor = chunk.cursor
        result = await f.run({ key: 'stream', count: 100, cursor }); chunk = resultSchema.parse(result).value
        messages.push(...chunk.messages)
        await expect(f.run({ key: 'stream', count: 100, cursor })).rejects.toMatchObject({ code: 'stale' })
      }
      expect(Buffer.byteLength(JSON.stringify(result))).toBeLessThanOrEqual(64 * 1024)
      expect(messages.map(item => item.id)).toEqual(rows.map((_row, i) => `${i + 1}-0`))
      for (const item of messages) expect(item.fields.map(field => [field.index, field.field.base64, field.value.complete])).toEqual([[0, Buffer.from('same').toString('base64'), true], [1, Buffer.from('same').toString('base64'), true]])
      expect(chunk.scanComplete).toBe(true); expect(range).toHaveBeenCalledTimes(1)
    } finally { f.reader.dispose(); f.connections.dispose() }
  })
  it('applies a smaller count to every cached continuation', async () => {
    const rows = Array.from({ length: 70 }, (_item, i) => message(`${i + 1}-0`, [Buffer.from('f'), Buffer.from('x'.repeat(2000))]))
    const range = vi.fn().mockResolvedValue(rows), f = await setup(range, 70n)
    try {
      const first = resultSchema.parse(await f.run({ key: 'stream', count: 100 })).value
      if (first.cursor === null) throw new Error('Missing cursor')
      const result = await f.run({ key: 'stream', count: 1, cursor: first.cursor })
      const second = resultSchema.parse(result).value
      expect(second.messages).toHaveLength(1)
      expect(Buffer.byteLength(JSON.stringify(result))).toBeLessThanOrEqual(64 * 1024)
      expect(range).toHaveBeenCalledTimes(1)
      if (second.cursor === null) throw new Error('Missing next cursor')
      await expect(f.run({ key: 'stream', count: 1, cursor: first.cursor })).rejects.toMatchObject({ code: 'stale' })
      expect(resultSchema.parse(await f.run({ key: 'stream', count: 1, cursor: second.cursor })).value.messages).toHaveLength(1)
    } finally { f.reader.dispose(); f.connections.dispose() }
  })
  it('retries a continuation cancelled while its range read is in flight', async () => {
    let ready!: () => void
    const waiting = new Promise<void>(resolve => { ready = resolve })
    const range = vi.fn().mockResolvedValueOnce([message('1-0', [Buffer.from('f'), Buffer.from('a')])])
      .mockImplementationOnce(async (_args: readonly RedisArgument[], signal: AbortSignal) => new Promise<RedisReply>((_resolve, reject) => { ready(); signal.addEventListener('abort', () => reject(new Error('cancelled')), { once: true }) }))
      .mockResolvedValueOnce([message('2-0', [Buffer.from('f'), Buffer.from('b')])])
    const f = await setup(range, 2n), controller = new AbortController()
    try {
      const first = resultSchema.parse(await f.run({ key: 'stream', count: 1 })).value
      if (first.cursor === null) throw new Error('Missing cursor')
      const pending = f.run({ key: 'stream', count: 1, cursor: first.cursor }, controller), rejected = expect(pending).rejects.toThrow()
      await waiting; controller.abort(); await rejected
      expect(resultSchema.parse(await f.run({ key: 'stream', count: 2, cursor: first.cursor })).value.messages[0]?.id).toBe('2-0')
    } finally { f.reader.dispose(); f.connections.dispose() }
  })
  it('binds session, target, selection and range while allowing a valid count change', async () => {
    const range = vi.fn().mockResolvedValueOnce([message('1-0', [Buffer.from('f'), Buffer.from('a')])]).mockResolvedValueOnce([message('2-0', [Buffer.from('f'), Buffer.from('b')])])
    const f = await setup(range, 2n)
    try {
      await f.connections.connect('b', settings, new AbortController().signal)
      const args = { key: 'stream', start: '1-0', end: '2-0', direction: 'forward', count: 1 }
      const first = resultSchema.parse(await f.run(args)).value
      if (first.cursor === null) throw new Error('Missing cursor')
      await expect(f.run({ ...args, key: 'other', cursor: first.cursor })).rejects.toMatchObject({ code: 'stale' })
      await expect(f.run({ ...args, start: '-', cursor: first.cursor })).rejects.toMatchObject({ code: 'stale' })
      await expect(f.run({ ...args, direction: 'reverse', cursor: first.cursor })).rejects.toMatchObject({ code: 'stale' })
      await expect(f.run({ ...args, cursor: first.cursor }, new AbortController(), 'b')).rejects.toMatchObject({ code: 'stale' })
      await expect(f.run({ ...args, count: 0, cursor: first.cursor })).rejects.toThrow()
      await expect(f.run({ ...args, bytes: 0, cursor: first.cursor })).rejects.toThrow()
      f.reader.setSelection('a', { target: f.target, selection: { keyBase64: Buffer.from('stream').toString('base64'), item: null } })
      await expect(f.run({ start: '1-0', end: '2-0', direction: 'forward', cursor: first.cursor })).rejects.toMatchObject({ code: 'stale' })
      expect(resultSchema.parse(await f.run({ ...args, count: 2, cursor: first.cursor })).value.messages[0]?.id).toBe('2-0')
      expect(range.mock.calls[1]?.[0]).toEqual([Buffer.from('stream'), '(1-0', '2-0', 'COUNT', '2'])
    } finally { f.reader.dispose(); f.connections.dispose() }
  })
  it('uses reverse range bounds and preserves message order', async () => {
    const range = vi.fn().mockResolvedValueOnce([message('3-0', [Buffer.from('f'), Buffer.from('a')]), message('2-0', [Buffer.from('f'), Buffer.from('b')])]).mockResolvedValueOnce([message('1-0', [Buffer.from('f'), Buffer.from('c')])])
    const f = await setup(range, 3n)
    try {
      const args = { key: 'stream', direction: 'reverse', start: '1-0', end: '3-0', count: 2 }
      const first = resultSchema.parse(await f.run(args)).value
      expect(first.messages.map(item => item.id)).toEqual(['3-0', '2-0'])
      if (first.cursor === null) throw new Error('Missing cursor')
      const second = resultSchema.parse(await f.run({ ...args, cursor: first.cursor })).value
      expect(second.messages.map(item => item.id)).toEqual(['1-0']); expect(second.scanComplete).toBe(true)
      expect(range.mock.calls[0]?.[0]).toEqual([Buffer.from('stream'), '3-0', '1-0', 'COUNT', '2'])
      expect(range.mock.calls[1]?.[0]).toEqual([Buffer.from('stream'), '(2-0', '1-0', 'COUNT', '2'])
    } finally { f.reader.dispose(); f.connections.dispose() }
  })
  it('keeps an old token when a candidate is cancelled', async () => {
    let ready!: () => void
    const waiting = new Promise<void>(resolve => { ready = resolve })
    const range = vi.fn().mockResolvedValueOnce([message('1-0', [Buffer.from('f'), Buffer.from('a')])])
      .mockImplementationOnce(async (_args: readonly RedisArgument[], signal: AbortSignal) => new Promise<RedisReply>((_resolve, reject) => { ready(); signal.addEventListener('abort', () => reject(new Error('cancelled')), { once: true }) }))
      .mockResolvedValueOnce([message('2-0', [Buffer.from('f'), Buffer.from('b')])])
    const f = await setup(range, 2n), controller = new AbortController()
    try {
      const first = resultSchema.parse(await f.run({ key: 'stream', count: 1 })).value
      if (first.cursor === null) throw new Error('Missing cursor')
      const pending = f.run({ key: 'other', count: 1 }, controller), rejected = expect(pending).rejects.toThrow()
      await waiting; controller.abort(); await rejected
      expect(resultSchema.parse(await f.run({ key: 'stream', count: 2, cursor: first.cursor })).value.messages[0]?.id).toBe('2-0')
    } finally { f.reader.dispose(); f.connections.dispose() }
  })
  it('rejects an older late probe without consuming the newer stream token', async () => {
    let ready!: () => void, release!: () => void
    const waiting = new Promise<void>(resolve => { ready = resolve }), hold = new Promise<void>(resolve => { release = resolve })
    const range = vi.fn().mockResolvedValueOnce([message('1-0', [Buffer.from('f'), Buffer.from('a')])]).mockResolvedValueOnce([message('2-0', [Buffer.from('f'), Buffer.from('b')])])
    const f = await setup(range, 2n)
    try {
      const strings = Reflect.get(f.reader, 'strings') as RedisStrings, original = strings.read.bind(strings)
      vi.spyOn(strings, 'read').mockImplementationOnce(async (...args) => { const result = await original(...args); ready(); await hold; return result })
      const old = f.run({ key: 'stream', count: 1 }), rejected = expect(old).rejects.toMatchObject({ code: 'stale' })
      await waiting
      const fresh = resultSchema.parse(await f.run({ key: 'other', count: 1 })).value
      if (fresh.cursor === null) throw new Error('Missing cursor')
      release(); await rejected
      expect(resultSchema.parse(await f.run({ key: 'other', count: 2, cursor: fresh.cursor })).value.messages[0]?.id).toBe('2-0')
    } finally { release(); vi.restoreAllMocks(); f.reader.dispose(); f.connections.dispose() }
  })
  it('retains an advanced page when cancellation arrives after the range read', async () => {
    const range = vi.fn().mockResolvedValueOnce([message('1-0', [Buffer.from('f'), Buffer.from('a')])]).mockResolvedValueOnce([message('2-0', [Buffer.from('f'), Buffer.from('b')])])
    const f = await setup(range, 2n), controller = new AbortController()
    try {
      const first = resultSchema.parse(await f.run({ key: 'stream', count: 1 })).value
      if (first.cursor === null) throw new Error('Missing cursor')
      const streams = Reflect.get(f.reader, 'streams') as RedisStreams, original = streams.read.bind(streams)
      vi.spyOn(streams, 'read').mockImplementationOnce(async (...args) => { const result = await original(...args); controller.abort(); return result })
      await expect(f.run({ key: 'stream', count: 2, cursor: first.cursor }, controller)).rejects.toThrow()
      expect(resultSchema.parse(await f.run({ key: 'stream', count: 2, cursor: first.cursor })).value.messages[0]?.id).toBe('2-0')
      expect(range).toHaveBeenCalledTimes(2)
    } finally { vi.restoreAllMocks(); f.reader.dispose(); f.connections.dispose() }
  })
  it('rejects an oversized single message without consuming Key or Hash cursors', async () => {
    const range = vi.fn().mockResolvedValue([message('1-0', [Buffer.alloc(50000, 255), Buffer.from('a')])])
    const f = await setup(range, 1n), signal = new AbortController().signal
    try {
      const keys = await f.reader.scan('a', { match: '*' }, signal)
      if (keys === null || typeof keys !== 'object' || Array.isArray(keys) || typeof keys.cursor !== 'string') throw new Error('Missing Key cursor')
      const hash = await f.run({ key: 'hash' })
      if (hash === null || typeof hash !== 'object' || Array.isArray(hash) || hash.value === null || typeof hash.value !== 'object' || Array.isArray(hash.value) || typeof hash.value.cursor !== 'string') throw new Error('Missing Hash cursor')
      await expect(f.run({ key: 'stream' })).rejects.toThrow('单条 Stream 消息')
      expect(await f.reader.scan('a', { match: '*', cursor: keys.cursor }, signal)).toMatchObject({ state: 'page', scanComplete: true })
      expect(await f.run({ key: 'hash', cursor: hash.value.cursor })).toMatchObject({ value: { state: 'page', scanComplete: true } })
    } finally { f.reader.dispose(); f.connections.dispose() }
  })
  it('keeps the old Stream token when a candidate message is oversized', async () => {
    const range = vi.fn().mockResolvedValueOnce([message('1-0', [Buffer.from('f'), Buffer.from('a')])]).mockResolvedValueOnce([message('1-0', [Buffer.alloc(50000, 255), Buffer.from('b')])]).mockResolvedValueOnce([message('2-0', [Buffer.from('f'), Buffer.from('c')])])
    const f = await setup(range, 2n)
    try {
      const old = resultSchema.parse(await f.run({ key: 'stream', count: 1 })).value
      if (old.cursor === null) throw new Error('Missing cursor')
      await expect(f.run({ key: 'other' })).rejects.toThrow('单条 Stream 消息')
      expect(resultSchema.parse(await f.run({ key: 'stream', count: 2, cursor: old.cursor })).value.messages[0]?.id).toBe('2-0')
    } finally { f.reader.dispose(); f.connections.dispose() }
  })
  it('reports an empty stream and a truncated field value accurately', async () => {
    const range = vi.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([message('1-0', [Buffer.from('f'), Buffer.from('a'.repeat(5000))])])
    const f = await setup(range, 1n)
    try {
      const empty = resultSchema.parse(await f.run({ key: 'stream' })).value
      expect(empty.messages).toEqual([]); expect(empty.scanComplete).toBe(true); expect(empty.complete).toBe(false)
      const preview = resultSchema.parse(await f.run({ key: 'stream' })).value
      expect(preview.messages[0]?.fields[0]?.value).toMatchObject({ complete: false, fullByteLength: 5000 })
      expect(Buffer.from(preview.messages[0]!.fields[0]!.value.base64, 'base64')).toHaveLength(4096)
      expect(preview.complete).toBe(false)
    } finally { f.reader.dispose(); f.connections.dispose() }
  })
  it('keeps the cursor through budget exhaustion and manual resume', async () => {
    const range = vi.fn().mockResolvedValueOnce([message('1-0', [Buffer.from('f'), Buffer.from('a')])]).mockResolvedValueOnce([message('2-0', [Buffer.from('f'), Buffer.from('b')])])
    const f = await setup(range, 2n), signal = new AbortController().signal
    try {
      const first = resultSchema.parse(await f.run({ key: 'stream', count: 1 })).value
      if (first.cursor === null) throw new Error('Missing cursor')
      for (let i = 1; i < 32; i++) await f.reader.withBudget('a', signal, () => ({ ok: true }))
      await expect(f.run({ key: 'stream', count: 2, cursor: first.cursor })).rejects.toThrow('预算已用完')
      expect(range).toHaveBeenCalledTimes(1); expect(f.reader.resumeBudget('a').accepted).toBe(true)
      expect(resultSchema.parse(await f.run({ key: 'stream', count: 2, cursor: first.cursor })).value.scanComplete).toBe(true)
    } finally { f.reader.dispose(); f.connections.dispose() }
  })
  it('replaces the old token only after a successful new scan', async () => {
    const range = vi.fn().mockResolvedValueOnce([message('1-0', [Buffer.from('f'), Buffer.from('a')])]).mockResolvedValueOnce([message('1-0', [Buffer.from('f'), Buffer.from('b')])]).mockResolvedValueOnce([message('2-0', [Buffer.from('f'), Buffer.from('c')])])
    const f = await setup(range, 2n)
    try {
      const old = resultSchema.parse(await f.run({ key: 'stream', count: 1 })).value
      const fresh = resultSchema.parse(await f.run({ key: 'other', count: 1 })).value
      if (old.cursor === null || fresh.cursor === null) throw new Error('Missing cursor')
      await expect(f.run({ key: 'stream', cursor: old.cursor })).rejects.toMatchObject({ code: 'stale' })
      expect(resultSchema.parse(await f.run({ key: 'other', count: 2, cursor: fresh.cursor })).value.messages[0]?.id).toBe('2-0')
    } finally { f.reader.dispose(); f.connections.dispose() }
  })
  it('rejects selection and database changes at commit without charging bytes', async () => {
    const f = await setup(async () => [message('1-0', [Buffer.from('f'), Buffer.from('a')])], 1n), signal = new AbortController().signal
    try {
      f.reader.setSelection('a', { target: f.target, selection: { keyBase64: Buffer.from('stream').toString('base64'), item: null } })
      await expect(f.reader.withBudget('a', signal, async stage => {
        const result = await f.reader.read('a', {}, signal, stage)
        f.reader.setSelection('a', { target: f.target, selection: { keyBase64: Buffer.from('other').toString('base64'), item: null } })
        return result
      })).rejects.toThrow('选择已变化')
      await expect(f.reader.withBudget('a', signal, async stage => {
        const result = await f.reader.read('a', { key: 'stream' }, signal, stage)
        await f.connections.selectDatabase('a', { ...f.target, db: 1 }, signal, () => f.reader.clearTarget('a'))
        return result
      })).rejects.toMatchObject({ code: 'stale' })
      expect(f.reader.budgetStatus('a')).toMatchObject({ callsUsed: 2, bytesUsed: 0, inFlight: 0 })
    } finally { f.reader.dispose(); f.connections.dispose() }
  })
  it('reads a split Stream batch through the registered value tool', async () => {
    const rows = Array.from({ length: 50 }, (_item, i) => message(`${i + 1}-0`, [Buffer.from('f'), Buffer.from('x'.repeat(1500))]))
    const f = await setup(async () => rows, 50n), ctx = new Context()
    try {
      await ctx.plugin(SystemPrompt); await ctx.plugin(ToolRuntime)
      await ctx.plugin({ name: 'stream-ai-test', inject: ['tools'], apply: (scope: Context) => { registerRedisTools(scope, f.reader) } })
      const agent = { id: 'agent-a', ctx, session: { id: 'a' } } as unknown as Agent
      let cursor: string | null = null, callId = 0
      const ids: string[] = []
      do {
        const args = cursor === null ? { key: 'stream', count: 100 } : { key: 'stream', count: 100, cursor }
        const reply = await ctx.tools.execute({ callId: ('stream-' + ++callId) as Parameters<typeof ctx.tools.execute>[0]['callId'], name: 'redis_viewer_value', arguments: args, agent, signal: new AbortController().signal })
        expect(reply.isError).toBeFalsy()
        const text = reply.content.filter(block => block.type === 'text').map(block => block.text).join('')
        expect(Buffer.byteLength(text)).toBeLessThanOrEqual(64 * 1024)
        const chunk = resultSchema.parse(JSON.parse(text) as unknown).value
        ids.push(...chunk.messages.map(item => item.id)); cursor = chunk.cursor
      } while (cursor !== null)
      expect(ids).toEqual(rows.map((_row, i) => `${i + 1}-0`))
      expect(f.commands.filter(command => command === 'XRANGE')).toHaveLength(1)
    } finally { await ctx.fiber.dispose(); f.reader.dispose(); f.connections.dispose() }
  })
})
