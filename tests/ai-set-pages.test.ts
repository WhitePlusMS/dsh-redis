import { describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import type { Agent } from '@deepseek-ai/dsh-agent'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime from '@deepseek-ai/dsh-tools'
import { RedisConnections, type RedisLink } from '../src/host/connection-service.ts'
import { RedisAiReader, type AiValueRequest } from '../src/host/ai-reader.ts'
import { RedisSets } from '../src/host/set-reader.ts'
import { RedisStrings } from '../src/host/string-reader.ts'
import { registerRedisTools } from '../src/host/ai-tools.ts'
import type { RedisArgument, RedisReply } from '../src/host/resp.ts'

function decode(result: unknown) {
  if (result === null || typeof result !== 'object' || Array.isArray(result) || !('value' in result) || result.value === null || typeof result.value !== 'object' || Array.isArray(result.value)) throw new Error('Expected Set result')
  const page = result.value
  if (!('members' in page) || !Array.isArray(page.members) || !('cursor' in page) || !(page.cursor === null || typeof page.cursor === 'string')) throw new Error('Expected Set page')
  const members = page.members.map(item => {
    if (item === null || typeof item !== 'object' || !('base64' in item) || typeof item.base64 !== 'string') throw new Error('Expected complete member')
    return item.base64
  })
  return { members, cursor: page.cursor, scanComplete: 'scanComplete' in page && page.scanComplete === true, complete: 'complete' in page && page.complete === true }
}
const page = (cursor: string, members: readonly Buffer[]): RedisReply => [Buffer.from(cursor), [...members]]
const settings = { host: 'localhost', port: 6379, username: '', password: '', tls: null }

async function setup(onScan: (args: readonly RedisArgument[], signal: AbortSignal) => Promise<RedisReply>, length = 200n) {
  const commands: string[] = []
  const execute: RedisLink['execute'] = async (command, args, signal, guard) => {
    signal.throwIfAborted(); guard(); commands.push(command)
    switch (command) {
      case 'TYPE': return String(args[0]) === 'hash' ? 'hash' : 'set'
      case 'PTTL': return -1n
      case 'SCARD': return length
      case 'SSCAN': return onScan(args, signal)
      case 'HLEN': return 1n
      case 'HSCAN': return page(args[1] === '0' ? '7' : '0', [Buffer.from('field'), Buffer.from('value')])
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

describe('AI Set page continuation', () => {
  it('preserves a newer Set token when an older first-read probe finishes late', async () => {
    let ready!: () => void, release!: () => void
    const waiting = new Promise<void>(resolve => { ready = resolve }), hold = new Promise<void>(resolve => { release = resolve })
    const scan = vi.fn().mockResolvedValueOnce(page('7', [Buffer.from('new')])).mockResolvedValueOnce(page('0', []))
    const f = await setup(scan, 2n)
    try {
      const strings = Reflect.get(f.reader, 'strings') as RedisStrings, original = strings.read.bind(strings)
      vi.spyOn(strings, 'read').mockImplementationOnce(async (...args) => { const result = await original(...args); ready(); await hold; return result })
      const old = f.run({ key: 'set' })
      await waiting
      const fresh = decode(await f.run({ key: 'other' }))
      if (fresh.cursor === null) throw new Error('Missing newer cursor')
      release(); const oldOutcome = await old.then(() => 'fulfilled', () => 'rejected')
      expect(decode(await f.run({ key: 'other', cursor: fresh.cursor })).scanComplete).toBe(true)
      expect(oldOutcome).toBe('rejected')
    } finally { release(); vi.restoreAllMocks(); f.reader.dispose(); f.connections.dispose() }
  })
  it('keeps the previous Set token when a new first read is cancelled', async () => {
    let ready!: () => void
    const waiting = new Promise<void>(resolve => { ready = resolve })
    const scan = vi.fn().mockResolvedValueOnce(page('7', [Buffer.from('first')]))
      .mockImplementationOnce(async (_args: readonly RedisArgument[], signal: AbortSignal) => new Promise<RedisReply>((_resolve, reject) => { ready(); signal.addEventListener('abort', () => reject(new Error('cancelled')), { once: true }) }))
      .mockResolvedValueOnce(page('0', [Buffer.from('second')]))
    const f = await setup(scan, 2n), controller = new AbortController()
    try {
      const first = decode(await f.run({ key: 'set' }))
      if (first.cursor === null) throw new Error('Missing cursor')
      const candidate = f.run({ key: 'other' }, controller), rejected = expect(candidate).rejects.toThrow()
      await waiting; controller.abort(); await rejected
      expect(decode(await f.run({ key: 'set', cursor: first.cursor })).scanComplete).toBe(true)
    } finally { f.reader.dispose(); f.connections.dispose() }
  })
  it('splits a Set response into bounded chunks before advancing the Redis cursor', async () => {
    const members = Array.from({ length: 300 }, (_item, i) => Buffer.from(String(i).padStart(4, '0') + ':' + 'x'.repeat(500)))
    const scan = vi.fn().mockResolvedValueOnce(page('7', members)).mockResolvedValueOnce(page('0', []))
    const f = await setup(scan, 300n), output: string[] = []
    try {
      let result = await f.run({ key: 'set', match: 'member*' }), chunk = decode(result)
      expect(chunk.cursor).toMatch(/^s:/u)
      while (true) {
        expect(Buffer.byteLength(JSON.stringify(result))).toBeLessThanOrEqual(64 * 1024)
        expect(chunk.complete).toBe(false); output.push(...chunk.members)
        if (chunk.cursor === null) { expect(chunk.scanComplete).toBe(true); break }
        const prior = chunk.cursor, before = f.commands.length
        result = await f.run({ key: 'set', match: 'member*', cursor: prior }); chunk = decode(result)
        if (output.length < members.length) expect(f.commands).toHaveLength(before)
        await expect(f.run({ key: 'set', match: 'member*', cursor: prior })).rejects.toMatchObject({ code: 'stale' })
      }
      expect(output).toEqual(members.map(member => member.toString('base64')))
      expect(scan).toHaveBeenCalledTimes(2)
      expect(scan.mock.calls[1]?.[0]).toEqual([Buffer.from('set'), '7', 'MATCH', 'member*', 'COUNT', '100'])
    } finally { f.reader.dispose(); f.connections.dispose() }
  })
  it('binds session, Key, MATCH and selection without consuming a valid token', async () => {
    const f = await setup(async () => page('7', [Buffer.from('a')]), 1n)
    try {
      await f.connections.connect('b', settings, new AbortController().signal)
      const first = decode(await f.run({ key: 'set', match: 'a*' }))
      if (first.cursor === null) throw new Error('Missing cursor')
      await expect(f.run({ key: 'other', match: 'a*', cursor: first.cursor })).rejects.toMatchObject({ code: 'stale' })
      await expect(f.run({ key: 'set', match: 'b*', cursor: first.cursor })).rejects.toMatchObject({ code: 'stale' })
      await expect(f.run({ key: 'set', match: 'a*', cursor: first.cursor }, new AbortController(), 'b')).rejects.toMatchObject({ code: 'stale' })
      f.reader.setSelection('a', { target: f.target, selection: { keyBase64: Buffer.from('set').toString('base64'), item: null } })
      await expect(f.run({ match: 'a*', cursor: first.cursor })).rejects.toMatchObject({ code: 'stale' })
      expect(decode(await f.run({ key: 'set', match: 'a*', cursor: first.cursor })).members).toHaveLength(1)
    } finally { f.reader.dispose(); f.connections.dispose() }
  })
  it('rejects invalid shared parameters before consuming a Set cursor', async () => {
    const scan = vi.fn().mockResolvedValueOnce(page('7', [Buffer.from('first')])).mockResolvedValueOnce(page('0', [Buffer.from('second')]))
    const f = await setup(scan, 2n)
    try {
      const first = decode(await f.run({ key: 'set' }))
      if (first.cursor === null) throw new Error('Missing cursor')
      await expect(f.run({ key: 'set', cursor: first.cursor, bytes: 0 })).rejects.toThrow()
      await expect(f.run({ key: 'set', cursor: first.cursor, offset: '-1' })).rejects.toThrow()
      expect(scan).toHaveBeenCalledTimes(1)
      expect(decode(await f.run({ key: 'set', cursor: first.cursor }))).toMatchObject({ members: [Buffer.from('second').toString('base64')], scanComplete: true })
    } finally { f.reader.dispose(); f.connections.dispose() }
  })
  it('preserves an advanced page when cancellation arrives before it is staged', async () => {
    const scan = vi.fn().mockResolvedValueOnce(page('7', [Buffer.from('first')])).mockResolvedValueOnce(page('0', [Buffer.from('second')]))
    const f = await setup(scan, 2n), controller = new AbortController()
    try {
      const first = decode(await f.run({ key: 'set' }))
      if (first.cursor === null) throw new Error('Missing cursor')
      const setReader = Reflect.get(f.reader, 'sets') as RedisSets, original = setReader.scan.bind(setReader)
      vi.spyOn(setReader, 'scan').mockImplementationOnce(async (...args) => { const fetched = await original(...args); controller.abort(); return fetched })
      await expect(f.run({ key: 'set', cursor: first.cursor }, controller)).rejects.toThrow()
      expect(decode(await f.run({ key: 'set', cursor: first.cursor }))).toMatchObject({ members: [Buffer.from('second').toString('base64')], cursor: null, scanComplete: true })
      expect(scan).toHaveBeenCalledTimes(2)
    } finally { vi.restoreAllMocks(); f.reader.dispose(); f.connections.dispose() }
  })
  it('retries the same underlying cursor after in-flight cancellation', async () => {
    let started!: () => void
    const waiting = new Promise<void>(resolve => { started = resolve })
    const scan = vi.fn().mockResolvedValueOnce(page('7', [Buffer.from('first')]))
      .mockImplementationOnce(async (_args: readonly RedisArgument[], signal: AbortSignal) => new Promise<RedisReply>((_resolve, reject) => { started(); signal.addEventListener('abort', () => reject(new Error('cancelled')), { once: true }) }))
      .mockResolvedValueOnce(page('0', [Buffer.from('second')]))
    const f = await setup(scan, 2n), controller = new AbortController()
    try {
      const first = decode(await f.run({ key: 'set' }))
      if (first.cursor === null) throw new Error('Missing cursor')
      const pending = f.run({ key: 'set', cursor: first.cursor }, controller), cancelled = expect(pending).rejects.toThrow()
      await waiting; controller.abort(); await cancelled
      expect(decode(await f.run({ key: 'set', cursor: first.cursor })).scanComplete).toBe(true)
      expect(scan.mock.calls[2]?.[0]).toEqual([Buffer.from('set'), '7', 'MATCH', '*', 'COUNT', '100'])
    } finally { f.reader.dispose(); f.connections.dispose() }
  })
  it('rejects changed selection and DB before delivery without charging bytes', async () => {
    const f = await setup(async () => page('7', [Buffer.from('a')]), 1n), signal = new AbortController().signal
    try {
      f.reader.setSelection('a', { target: f.target, selection: { keyBase64: Buffer.from('set').toString('base64'), item: null } })
      await expect(f.reader.withBudget('a', signal, async stage => {
        const result = await f.reader.read('a', {}, signal, stage)
        f.reader.setSelection('a', { target: f.target, selection: { keyBase64: Buffer.from('other').toString('base64'), item: null } })
        return result
      })).rejects.toThrow('选择已变化')
      expect(f.reader.budgetStatus('a')).toMatchObject({ callsUsed: 1, bytesUsed: 0, inFlight: 0 })
      await expect(f.reader.withBudget('a', signal, async stage => {
        const result = await f.reader.read('a', { key: 'set' }, signal, stage)
        await f.connections.selectDatabase('a', { ...f.target, db: 1 }, signal, () => f.reader.clearTarget('a'))
        return result
      })).rejects.toMatchObject({ code: 'stale' })
      expect(f.reader.budgetStatus('a')).toMatchObject({ callsUsed: 2, bytesUsed: 0, inFlight: 0 })
    } finally { f.reader.dispose(); f.connections.dispose() }
  })
  it('retains a staged tail after cancellation and an empty cursor through budget resume', async () => {
    const members = Array.from({ length: 150 }, (_item, i) => Buffer.from(String(i).padStart(4, '0') + 'x'.repeat(600)))
    const scan = vi.fn().mockResolvedValueOnce(page('7', members)).mockResolvedValueOnce(page('0', []))
    const f = await setup(scan, 150n), controller = new AbortController(), signal = new AbortController().signal
    try {
      const first = decode(await f.run({ key: 'set' }))
      if (first.cursor === null) throw new Error('Missing cursor')
      await expect(f.reader.withBudget('a', controller.signal, async stage => {
        const result = await f.reader.read('a', { key: 'set', cursor: first.cursor! }, controller.signal, stage)
        controller.abort(); return result
      })).rejects.toThrow()
      let chunk = decode(await f.run({ key: 'set', cursor: first.cursor })), found = [...first.members, ...chunk.members]
      while (chunk.cursor !== null && found.length < members.length) { chunk = decode(await f.run({ key: 'set', cursor: chunk.cursor })); found.push(...chunk.members) }
      expect(found).toEqual(members.map(member => member.toString('base64')))
      if (chunk.cursor === null) throw new Error('Missing underlying cursor')
      const callsUsed = f.reader.budgetStatus('a').callsUsed
      for (let i = callsUsed; i < 32; i++) await f.reader.withBudget('a', signal, () => ({ ok: true }))
      await expect(f.run({ key: 'set', cursor: chunk.cursor })).rejects.toThrow('预算已用完')
      expect(scan).toHaveBeenCalledTimes(1); expect(f.reader.resumeBudget('a').accepted).toBe(true)
      expect(decode(await f.run({ key: 'set', cursor: chunk.cursor })).scanComplete).toBe(true)
    } finally { f.reader.dispose(); f.connections.dispose() }
  })
  it('rejects a competing Set read while a staged page is in flight', async () => {
    let release!: () => void, staged!: () => void
    const waiting = new Promise<void>(resolve => { staged = resolve }), hold = new Promise<void>(resolve => { release = resolve })
    const scan = vi.fn().mockResolvedValueOnce(page('7', [Buffer.from('old')])).mockResolvedValueOnce(page('8', [Buffer.from('new')])).mockResolvedValueOnce(page('0', []))
    const f = await setup(scan, 1n), signal = new AbortController().signal
    try {
      const old = f.reader.withBudget('a', signal, async stage => { const value = await f.reader.read('a', { key: 'set' }, signal, stage); staged(); await hold; return value })
      await waiting
      await expect(f.run({ key: 'other' })).rejects.toThrow('正在执行')
      release(); await old
      const fresh = decode(await f.run({ key: 'other' }))
      expect(f.reader.budgetStatus('a').inFlight).toBe(0)
      if (fresh.cursor === null) throw new Error('Missing cursor')
      expect(decode(await f.run({ key: 'other', cursor: fresh.cursor })).scanComplete).toBe(true)
    } finally { f.reader.dispose(); f.connections.dispose() }
  })
  it('refuses a single oversized member while preserving Key and Hash cursors', async () => {
    const f = await setup(async () => page('0', [Buffer.alloc(65536, 255)]), 1n)
    try {
      const keys = await f.reader.scan('a', { match: '*' }, new AbortController().signal)
      if (keys === null || typeof keys !== 'object' || Array.isArray(keys) || typeof keys.cursor !== 'string') throw new Error('Missing Key cursor')
      const hash = await f.run({ key: 'hash' })
      if (hash === null || typeof hash !== 'object' || Array.isArray(hash) || hash.value === null || typeof hash.value !== 'object' || Array.isArray(hash.value) || typeof hash.value.cursor !== 'string') throw new Error('Missing Hash cursor')
      await expect(f.run({ key: 'set' })).rejects.toThrow('单个 Set 成员')
      expect(await f.reader.scan('a', { match: '*', cursor: keys.cursor }, new AbortController().signal)).toMatchObject({ state: 'page', scanComplete: true })
      expect(await f.run({ key: 'hash', cursor: hash.value.cursor })).toMatchObject({ value: { state: 'page', scanComplete: true } })
    } finally { f.reader.dispose(); f.connections.dispose() }
  })
  it('reads a multi-part Set page through the registered value tool', async () => {
    const members = Array.from({ length: 100 }, (_item, i) => Buffer.from('member-' + i + 'x'.repeat(900)))
    const f = await setup(async () => page('0', members), 100n), ctx = new Context()
    try {
      await ctx.plugin(SystemPrompt); await ctx.plugin(ToolRuntime)
      await ctx.plugin({ name: 'set-ai-test', inject: ['tools'], apply: (scope: Context) => { registerRedisTools(scope, f.reader) } })
      const agent = { id: 'agent-a', ctx, session: { id: 'a' } } as unknown as Agent
      const found: string[] = []
      let cursor: string | null = null, callId = 0
      do {
        const reply = await ctx.tools.execute({ callId: ('set-' + ++callId) as Parameters<typeof ctx.tools.execute>[0]['callId'], name: 'redis_viewer_value', arguments: cursor === null ? { key: 'set' } : { key: 'set', cursor }, agent, signal: new AbortController().signal })
        expect(reply.isError).toBeFalsy()
        const text = reply.content.filter(block => block.type === 'text').map(block => block.text).join('')
        expect(Buffer.byteLength(text)).toBeLessThanOrEqual(64 * 1024)
        const chunk = decode(JSON.parse(text) as unknown)
        found.push(...chunk.members); cursor = chunk.cursor
      } while (cursor !== null)
      expect(found).toEqual(members.map(member => member.toString('base64')))
      expect(f.commands.filter(command => command === 'SSCAN')).toHaveLength(1)
    } finally { await ctx.fiber.dispose(); f.reader.dispose(); f.connections.dispose() }
  })
})
