import { afterEach, describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import type { Agent } from '@deepseek-ai/dsh-agent'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime from '@deepseek-ai/dsh-tools'
import { RedisConnections, type RedisLink } from '../src/host/connection-service.ts'
import { RedisAiReader } from '../src/host/ai-reader.ts'
import { registerRedisTools } from '../src/host/ai-tools.ts'
import { RedisKeys } from '../src/host/key-reader.ts'
import { RedisHashes } from '../src/host/hash-reader.ts'
import type { RedisReply } from '../src/host/resp.ts'

const cleanups: (() => Promise<void> | void)[] = []
afterEach(async () => { for (const cleanup of cleanups.splice(0).reverse()) await cleanup(); vi.restoreAllMocks() })

/** Synthetic transport with two-page cursors exposes cross-consumer races. */
async function fixture() {
  vi.spyOn(console, 'info').mockImplementation(() => undefined)
  const commands: string[] = []
  const types: Readonly<Record<string, string>> = { plain: 'string', hash: 'hash', list: 'list', set: 'set', zset: 'zset', stream: 'stream', large: 'string', wide: 'set', module: 'ReJSON-RL' }
  const link: RedisLink = {
    close: vi.fn(), onFailure: () => () => undefined,
    async execute(command, args, signal, guard): Promise<RedisReply> {
      signal.throwIfAborted(); guard(); commands.push(command)
      const key = String(args[0]), bulk = (value: string) => Buffer.from(value)
      switch (command) {
        case 'TYPE': return types[key] ?? 'none'
        case 'PTTL': return -1n
        case 'STRLEN': return key === 'large' ? 9000n : 5n
        case 'GETRANGE': return bulk(key === 'large' ? 'x'.repeat(9000) : 'hello').subarray(Number(args[1]), Number(args[2]) + 1)
        case 'SCAN': return [bulk(args[0] === '0' ? '7' : '0'), [bulk(args[0] === '0' ? 'plain' : 'hash')]]
        case 'HLEN': return 2n
        case 'HSCAN': return [bulk(args[1] === '0' ? '7' : '0'), [bulk(args[1] === '0' ? 'first' : 'second'), bulk('字段值')]]
        case 'HGET': return String(args[1]) === 'absent' ? null : bulk('精确字段值')
        case 'LLEN': return 2n
        case 'LRANGE': return [bulk('one'), bulk('two')].slice(Number(args[1]), Number(args[2]) + 1)
        case 'SCARD': return 1n
        case 'SSCAN': return [bulk('0'), [bulk(key === 'wide' ? 'm'.repeat(60000) : 'member')]]
        case 'SISMEMBER': return String(args[1]) === 'absent' ? 0n : 1n
        case 'ZCARD': return 1n
        case 'ZRANGE': return [bulk('member'), bulk('1.2345678901234567')]
        case 'ZSCAN': return [bulk('0'), [bulk('member'), bulk('1.2345678901234567')]]
        case 'ZSCORE': return String(args[1]) === 'absent' ? null : bulk('1.2345678901234567')
        case 'XLEN': return 1n
        case 'XRANGE': case 'XREVRANGE': return [[bulk('1-0'), [bulk('field'), bulk('first'), bulk('field'), bulk('second')]]]
        default: throw new Error('Unexpected fixture command: ' + command)
      }
    },
  }
  const open = vi.fn(async () => link)
  const connections = new RedisConnections(open), reader = new RedisAiReader(connections)
  const view = await connections.connect('a', { host: '127.0.0.1', port: 6379, username: 'reader', password: 'never-in-output', tls: null }, new AbortController().signal)
  if (view.id === null) throw new Error('Missing fixture connection')
  const target = { id: view.id, generation: view.generation, db: view.db }
  const ctx = new Context()
  await ctx.plugin(SystemPrompt); await ctx.plugin(ToolRuntime)
  const fiber = await ctx.plugin({ name: 'redis-ai-test', inject: ['tools'], apply: (scope: Context) => { registerRedisTools(scope, reader) } })
  const agent = { id: 'agent-a', ctx, session: { id: 'a' } } as unknown as Agent
  let calls = 0
  const call = (name: string, args: unknown, options: { readonly agent?: Agent | null; readonly signal?: AbortSignal } = {}) => ctx.tools.execute({
    callId: ('redis-' + ++calls) as Parameters<typeof ctx.tools.execute>[0]['callId'], name, arguments: args,
    ...(options.agent === null ? {} : { agent: options.agent ?? agent }), signal: options.signal ?? new AbortController().signal,
  })
  cleanups.push(async () => { reader.dispose(); connections.dispose(); await ctx.fiber.dispose() })
  return { ctx, fiber, reader, connections, target, commands, open, call }
}
function content(result: Awaited<ReturnType<ToolRuntime['execute']>>): string {
  return result.content.filter(block => block.type === 'text').map(block => block.text).join('\n')
}

describe('official Redis model tools', () => {
  it('registers into the real model schema assembly and unloads with its fiber', async () => {
    const f = await fixture()
    expect((await f.ctx.systemPrompt.assemble()).tools.map(tool => tool.name).sort()).toEqual(['redis_viewer_keys', 'redis_viewer_status', 'redis_viewer_value'])
    await f.fiber.dispose()
    expect(f.ctx.tools.schemas()).toHaveLength(0)
  })
  it('uses the trusted session, exposes no password and never opens a model-selected connection', async () => {
    const f = await fixture(), status = await f.call('redis_viewer_status', {})
    expect(status.isError).toBeFalsy()
    expect(content(status)).not.toContain('never-in-output')
    const other = { id: 'agent-b', ctx: f.ctx, session: { id: 'b' } } as unknown as Agent
    expect(content(await f.call('redis_viewer_status', {}, { agent: other }))).toContain('disconnected')
    expect((await f.call('redis_viewer_value', { key: 'plain' }, { agent: other })).isError).toBe(true)
    expect((await f.call('redis_viewer_status', {}, { agent: null })).isError).toBe(true)
    expect((await f.call('redis_viewer_value', { key: 'plain', sessionId: 'b', command: 'SET plain bad' })).isError).toBe(true)
    expect(f.open).toHaveBeenCalledTimes(1)
  })
  it.each(['plain', 'hash', 'list', 'set', 'zset', 'stream'])('reads %s through actual tool validation and rendering', async key => {
    const f = await fixture(), result = await f.call('redis_viewer_value', { key })
    expect(result.isError).toBeFalsy()
    expect(content(result)).toContain('"state":"' + (key === 'plain' ? 'value' : 'page') + '"')
    expect(content(result)).toContain('"type":"' + (key === 'plain' ? 'string' : key) + '"')
    if (key === 'plain') expect(content(result)).toContain('"text":"hello"')
    if (key === 'hash') expect(content(result)).toContain('字段值')
    if (key === 'zset') expect(content(result)).toContain('1.2345678901234567')
    if (key === 'stream') { expect(content(result)).toContain('"index":0'); expect(content(result)).toContain('"index":1') }
    expect(f.commands.every(command => !['SET', 'HSET', 'DEL', 'KEYS', 'XREADGROUP', 'XACK'].includes(command))).toBe(true)
  })
  it('keeps UI and AI Key/Hash continuation state independent', async () => {
    const f = await fixture(), signal = new AbortController().signal, uiKeys = new RedisKeys(f.connections), uiHashes = new RedisHashes(f.connections)
    cleanups.push(() => { uiKeys.dispose(); uiHashes.dispose() })
    const keyFirst = await uiKeys.scan('a', { target: f.target, pattern: '*', cursor: null }, signal)
    const hashFirst = await uiHashes.scan('a', { target: f.target, keyBase64: Buffer.from('hash').toString('base64'), pattern: '*', cursor: null }, signal)
    await f.call('redis_viewer_keys', {})
    await f.call('redis_viewer_value', { key: 'hash' })
    expect(await uiKeys.scan('a', { target: f.target, pattern: '*', cursor: keyFirst.cursor }, signal)).toMatchObject({ state: 'page', cursor: null })
    expect(await uiHashes.scan('a', { target: f.target, keyBase64: Buffer.from('hash').toString('base64'), pattern: '*', cursor: hashFirst.cursor }, signal)).toMatchObject({ state: 'page', cursor: null })
  })
  it('labels prefixes and filtered/continued pages truthfully and honors pre-cancellation', async () => {
    const f = await fixture()
    const large = await f.call('redis_viewer_value', { key: 'large' })
    expect(content(large)).toContain('"complete":false'); expect(content(large)).toContain('"nextOffset":"4096"')
    const first = await f.reader.read('a', { key: 'hash' }, new AbortController().signal)
    if (first === null || typeof first !== 'object' || Array.isArray(first) || first.value === null || typeof first.value !== 'object' || Array.isArray(first.value) || typeof first.value.cursor !== 'string') throw new Error('Missing hash continuation')
    const last = await f.call('redis_viewer_value', { key: 'hash', cursor: first.value.cursor })
    expect(content(last)).toContain('"scanComplete":true'); expect(content(last)).toContain('"complete":false')
    const before = f.commands.length, controller = new AbortController(); controller.abort()
    expect((await f.call('redis_viewer_value', { key: 'plain' }, { signal: controller.signal })).isError).toBe(true)
    expect(f.commands).toHaveLength(before)
    expect((await f.call('redis_viewer_value', { key: 'plain', keyBase64: 'cGxhaW4=' })).isError).toBe(true)
    expect((await f.call('redis_viewer_value', { key: 'plain', bytes: 0 })).isError).toBe(true)
    expect(content(await f.call('redis_viewer_value', { key: 'module' }))).toContain('unsupported')
    const oversized = await f.call('redis_viewer_value', { key: 'wide' })
    expect(oversized.isError).toBe(true); expect(content(oversized)).toContain('预算')
    expect((await f.call('redis_viewer_value', { key: 'plain' })).isError).toBeFalsy()
  })
  it('reads exact current identities, retaining duplicate Stream field occurrences', async () => {
    const f = await fixture(), base64 = (text: string) => Buffer.from(text).toString('base64')
    const selections = [
      { keyBase64: base64('plain'), item: null },
      { keyBase64: base64('hash'), item: { kind: 'hash' as const, fieldBase64: Buffer.from([0, 255]).toString('base64') } },
      { keyBase64: base64('list'), item: { kind: 'list' as const, index: '1' } },
      { keyBase64: base64('set'), item: { kind: 'set' as const, memberBase64: base64('member') } },
      { keyBase64: base64('zset'), item: { kind: 'zset' as const, memberBase64: base64('member') } },
      { keyBase64: base64('stream'), item: { kind: 'stream' as const, id: '1-0', fieldIndex: 1, fieldBase64: base64('field') } },
    ]
    for (const selection of selections) {
      expect(f.reader.setSelection('a', { target: f.target, selection })).toEqual({ accepted: true })
      const result = await f.call('redis_viewer_value', {})
      expect(result.isError).toBeFalsy(); expect(content(result)).toContain('"state":"value"')
      if (selection.item?.kind === 'stream') expect(content(result)).toContain('"text":"second"')
      if (selection.item?.kind === 'hash') expect(content(result)).toContain('精确字段值')
      if (selection.item?.kind === 'list') expect(content(result)).toContain('"text":"two"')
    }
    expect(f.commands).toContain('HGET'); expect(f.commands).toContain('SISMEMBER'); expect(f.commands).toContain('ZSCORE')
    expect(f.reader.setSelection('b', { target: f.target, selection: selections[0]! })).toEqual({ accepted: false })
    expect(f.reader.setSelection('a', { target: f.target, selection: null })).toEqual({ accepted: true })
    expect((await f.call('redis_viewer_value', {})).isError).toBe(true)
  })
  it('distinguishes missing rows from missing Keys and drops a selection replaced during reading', async () => {
    const f = await fixture(), base64 = (text: string) => Buffer.from(text).toString('base64')
    for (const kind of ['hash', 'set', 'zset'] as const) {
      const item = kind === 'hash' ? { kind, fieldBase64: base64('absent') } : { kind, memberBase64: base64('absent') }
      f.reader.setSelection('a', { target: f.target, selection: { keyBase64: base64(kind), item } })
      expect(content(await f.call('redis_viewer_value', {}))).toContain('selection-missing')
    }
    f.reader.setSelection('a', { target: f.target, selection: { keyBase64: base64('hash'), item: { kind: 'hash', fieldBase64: base64('first') } } })
    const read = f.reader.read('a', {}, new AbortController().signal)
    f.reader.setSelection('a', { target: f.target, selection: { keyBase64: base64('plain'), item: null } })
    await expect(read).rejects.toThrow('选择已变化')
    expect(f.reader.setSelection('a', { target: { ...f.target, generation: f.target.generation + 1 }, selection: null })).toEqual({ accepted: false })
    expect(content(await f.call('redis_viewer_value', {}))).toContain('hello')
  })
})
