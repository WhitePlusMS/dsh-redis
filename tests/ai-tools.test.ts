import { afterEach, describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import type { Agent } from '@deepseek-ai/dsh-agent'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime from '@deepseek-ai/dsh-tools'
import { ConnectionFailure, RedisConnections, type RedisLink } from '../src/host/connection-service.ts'
import type { ConnectionErrorCode, DatabaseTarget, UiAction } from '../src/domain.ts'
import type { PreparedAiPage } from '../src/host/ai-page-store.ts'
import { RedisAiReader } from '../src/host/ai-reader.ts'
import { registerRedisTools } from '../src/host/ai-tools.ts'
import { registerRedisFormatTool, registerRedisRefreshTool } from '../src/host/ai-ui-tools.ts'
import { RedisKeys } from '../src/host/key-reader.ts'
import { RedisHashes } from '../src/host/hash-reader.ts'
import { RedisReplyError, type RedisReply } from '../src/host/resp.ts'
import { RedisRemoteService } from '../src/remote-service.ts'
import { UiActionCoordinator } from '../src/host/ui-action-coordinator.ts'
import { connectionErrorMessages } from '../src/connection-errors.ts'
import { zh } from '../src/client/locales.ts'

const cleanups: (() => Promise<void> | void)[] = []
afterEach(async () => { for (const cleanup of cleanups.splice(0).reverse()) await cleanup(); vi.restoreAllMocks() })

/** Synthetic transport with two-page cursors exposes cross-consumer races. */
async function fixture(select?: RedisLink['execute'], scan?: RedisLink['execute'], checks?: { readonly confirm: (session: string, target: DatabaseTarget, expected: number | null, signal: AbortSignal) => Promise<number>; readonly current: (session: string, revision: number | null) => boolean }, memory?: RedisLink['execute'], slowlog?: RedisLink['execute'], overview?: RedisLink['execute'], groups?: RedisLink['execute'], clients?: RedisLink['execute'], compareRead?: RedisLink['execute']) {
  vi.spyOn(console, 'info').mockImplementation(() => undefined)
  const commands: string[] = []
  let changingTypeReads = 0
  let changingMemberReads = 0
  const failures = new Set<(code: ConnectionErrorCode) => void>()
  const failNetwork = () => { for (const listener of failures) listener('network'); throw new ConnectionFailure('network') }
  const types: Readonly<Record<string, string>> = { plain: 'string', changing: 'string', hash: 'hash', list: 'list', set: 'set', zset: 'zset', stream: 'stream', large: 'string', wide: 'set', module: 'ReJSON-RL' }
  const link: RedisLink = {
    close: vi.fn(), onFailure: listener => { failures.add(listener); return () => { failures.delete(listener) } },
    async execute(command, args, signal, guard): Promise<RedisReply> {
      signal.throwIfAborted(); guard(); commands.push(command)
      const key = String(args[0]), bulk = (value: string) => Buffer.from(value)
      switch (command) {
        case 'MEMORY': {
          if (memory !== undefined) return memory(command, args, signal, guard)
          if (String(args[1]) === 'denied') throw new RedisReplyError('NOPERM synthetic-secret')
          return String(args[1]) === 'missing' ? null : 123n
        }
        case 'SLOWLOG': return slowlog === undefined ? [] : slowlog(command, args, signal, guard)
        case 'INFO': return overview === undefined ? Buffer.alloc(0) : overview(command, args, signal, guard)
        case 'XINFO': return groups === undefined ? [] : groups(command, args, signal, guard)
        case 'CLIENT': return clients === undefined ? Buffer.alloc(0) : clients(command, args, signal, guard)
        case 'TYPE': if (key === 'network') failNetwork(); if (key === 'denied') throw new RedisReplyError('NOPERM fixture denied'); if (key === 'changing-type') return changingTypeReads++ === 0 ? 'hash' : 'list'; if (key === 'changing-member') return changingMemberReads++ === 0 ? 'set' : 'zset'; if (/^order:\d+$/u.test(key)) return 'hash'; return types[key] ?? 'none'
        case 'SELECT': if (select !== undefined) return select(command, args, signal, guard); if (args[0] === '3') throw new RedisReplyError('NOPERM fixture denied'); return 'OK'
        case 'PTTL': return -1n
        case 'STRLEN': return key === 'large' ? 9000n : key === 'changing' ? 6n : 5n
        case 'GETRANGE': return compareRead === undefined ? bulk(key === 'large' ? 'x'.repeat(9000) : 'hello').subarray(Number(args[1]), Number(args[2]) + 1) : compareRead(command, args, signal, guard)
        case 'SCAN': if (scan !== undefined) return scan(command, args, signal, guard); if (args[2] === 'network*') failNetwork(); if (args[2] === 'denied*') throw new RedisReplyError('NOPERM fixture denied'); return [bulk(args[0] === '0' ? '7' : '0'), [bulk(args[0] === '0' ? 'plain' : 'hash')]]
        case 'HLEN': return 2n
        case 'HSCAN': return [bulk(args[1] === '0' ? '7' : '0'), [bulk(args[1] === '0' ? 'first' : 'second'), bulk('字段值')]]
        case 'HGET': {
          if (/^order:\d+$/u.test(key)) {
            const index = Number(key.slice(6))
            if (index === 8) throw new RedisReplyError('NOPERM synthetic-secret')
            if (index === 9) return null
            return bulk(index % 3 === 0 ? 'failed' : 'synthetic-secret')
          }
          return String(args[1]) === 'absent' ? null : bulk('精确字段值')
        }
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
  const actions = new UiActionCoordinator<UiAction>()
  const connections = new RedisConnections(open), reader = new RedisAiReader(connections, session => actions.invalidateSession(session), checks?.confirm ?? (async (_session, _target, expected) => expected ?? 0), checks?.current ?? (() => true))
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
  cleanups.push(async () => { actions.dispose(); reader.dispose(); connections.dispose(); await ctx.fiber.dispose() })
  return { ctx, fiber, reader, connections, target, commands, open, call, agent, actions }
}
function content(result: Awaited<ReturnType<ToolRuntime['execute']>>): string {
  return result.content.filter(block => block.type === 'text').map(block => block.text).join('\n')
}
/** Prototype fixtures must initialize the same Host state used by connection methods. */
function remoteFixture(connections: RedisConnections, reader: RedisAiReader): RedisRemoteService {
  const remote = Object.create(RedisRemoteService.prototype) as RedisRemoteService
  const uiActions = new UiActionCoordinator()
  Reflect.set(remote, 'connections', connections); Reflect.set(remote, 'ai', reader); Reflect.set(remote, 'uiActions', uiActions)
  cleanups.push(() => uiActions.dispose())
  return remote
}

describe('official Redis model tools', () => {
  it('validates the format tool and binds it to the confirmed session selection', async () => {
    const f = await fixture()
    await f.ctx.plugin({ name: 'format-fixture', inject: ['tools'], apply: (scope: Context) => registerRedisFormatTool(scope, f.reader, f.actions) })
    expect(f.reader.setSelection('a', { target: f.target, selection: { keyBase64: Buffer.from('plain').toString('base64'), item: null } }).accepted).toBe(true)
    let received: UiAction | null = null
    const unregister = f.actions.register('a', async request => { received = request.action; return { requestId: request.requestId, target: request.target, selectionRevision: request.selectionRevision, outcome: 'applied' } })
    const result = await f.call('redis_viewer_format', { format: 'json' })
    expect(content(result)).toContain('"outcome":"applied"')
    expect(received).toEqual({ kind: 'setFormat', keyBase64: Buffer.from('plain').toString('base64'), format: 'json' })
    for (const args of [{ format: 'yaml' }, { format: 'json', sessionId: 'b' }, {}]) expect((await f.call('redis_viewer_format', args)).isError).toBe(true)
    unregister()
  })
  it('binds a one-shot refresh tool to the trusted session and confirmed current selection', async () => {
    const f = await fixture()
    await f.ctx.plugin({ name: 'refresh-fixture', inject: ['tools'], apply: (scope: Context) => registerRedisRefreshTool(scope, f.reader, f.actions) })
    expect(f.reader.setSelection('a', { target: f.target, selection: { keyBase64: Buffer.from('plain').toString('base64'), item: null } }).accepted).toBe(true)
    let received: UiAction | null = null
    const unregister = f.actions.register('a', async request => {
      received = request.action
      return { requestId: request.requestId, target: request.target, selectionRevision: request.selectionRevision, outcome: 'applied' }
    })
    const result = await f.call('redis_viewer_refresh', {})
    expect(content(result)).toContain('"outcome":"applied"')
    expect(received).toEqual({ kind: 'refresh', target: f.target, keyBase64: Buffer.from('plain').toString('base64') })
    expect((await f.call('redis_viewer_refresh', { sessionId: 'b' })).isError).toBe(true)
    f.reader.setSelection('a', { target: f.target, selection: null })
    expect((await f.call('redis_viewer_refresh', {})).isError).toBe(true)
    unregister()
  })
  it('reads bounded Stream group counters with binary identities and explicit lag semantics', async () => {
    const field = (name: string) => Buffer.from(name)
    const row: RedisReply[] = [field('name'), Buffer.from([0, 255]), field('consumers'), 2n, field('pending'), 3n, field('last-delivered-id'), field('5-0'), field('entries-read'), null, field('lag'), null]
    const requests: Array<readonly unknown[]> = []
    const f = await fixture(undefined, undefined, undefined, undefined, undefined, undefined, async (_command, args) => { requests.push(args); return Array.from({ length: 21 }, () => row) })
    const result = JSON.parse(content(await f.call('redis_viewer_stream_groups', { key: 'stream' })))
    expect(result).toMatchObject({ state: 'value', totalCount: 21, complete: false, groups: Array.from({ length: 20 }, () => ({ name: { base64: 'AP8=' }, consumers: '2', pending: '3', lastDeliveredId: '5-0', entriesRead: null, entriesReadReported: true, lag: null, lagStatus: 'unknown' })) })
    expect(requests).toEqual([['GROUPS', Buffer.from('stream')]])
    expect(f.commands).toEqual(['TYPE', 'XINFO', 'TYPE'])
    expect(JSON.parse(content(await f.call('redis_viewer_stream_groups', { key: 'missing' })))).toMatchObject({ state: 'missing', totalCount: null })
    expect(JSON.parse(content(await f.call('redis_viewer_stream_groups', { key: 'plain' })))).toMatchObject({ state: 'unsupported', type: 'string' })
    for (const args of [{}, { key: 'stream', keyBase64: 'c3RyZWFt' }, { keyBase64: 'invalid' }, { key: '\ud800' }, { key: 'stream', command: 'XACK' }]) expect((await f.call('redis_viewer_stream_groups', args)).isError).toBe(true)
    expect(requests).toHaveLength(1)
  })
  it('distinguishes missing lag, permission failure and malformed group records', async () => {
    const b = (value: string) => Buffer.from(value)
    const old = await fixture(undefined, undefined, undefined, undefined, undefined, undefined, async () => [[b('name'), b('group'), b('consumers'), 1n, b('pending'), 0n, b('last-delivered-id'), b('0-0')]])
    expect(JSON.parse(content(await old.call('redis_viewer_stream_groups', { key: 'stream' })))).toMatchObject({ state: 'value', complete: true, groups: [{ lag: null, lagStatus: 'not-reported', entriesReadReported: false }] })
    const denied = await fixture(undefined, undefined, undefined, undefined, undefined, undefined, async () => { throw new RedisReplyError('NOPERM synthetic-secret') })
    const denial = content(await denied.call('redis_viewer_stream_groups', { key: 'stream' }))
    expect(denial).toContain('"error":"permission"'); expect(denial).not.toContain('synthetic-secret')
    const removed = await fixture(undefined, undefined, undefined, undefined, undefined, undefined, async () => { throw new RedisReplyError('ERR no such key') })
    expect(JSON.parse(content(await removed.call('redis_viewer_stream_groups', { key: 'stream' })))).toMatchObject({ state: 'missing', error: null })
    const malformed = await fixture(undefined, undefined, undefined, undefined, undefined, undefined, async () => [[b('name'), b('group'), b('pending'), -1n]])
    expect(content(await malformed.call('redis_viewer_stream_groups', { key: 'stream' }))).toContain('"error":"protocol"')
  })
  it('rejects group results if the owning connection is replaced in flight', async () => {
    let release!: (value: RedisReply) => void, observed!: () => void
    const pending = new Promise<RedisReply>(resolve => { release = resolve })
    const started = new Promise<void>(resolve => { observed = resolve })
    const f = await fixture(undefined, undefined, undefined, undefined, undefined, undefined, async () => { observed(); return pending })
    const operation = f.call('redis_viewer_stream_groups', { key: 'stream' })
    await started
    await f.connections.connect('a', { host: '127.0.0.1', port: 6379, username: '', password: '', tls: null }, new AbortController().signal)
    release([])
    expect((await operation).isError).toBe(true)
  })
  it('compares String samples without exposing values or asserting equality for prefixes', async () => {
    const f = await fixture()
    const equal = content(await f.call('redis_viewer_compare_strings', { left: 'plain', right: 'plain' }))
    expect(JSON.parse(equal)).toMatchObject({ comparison: 'equal', snapshot: false, left: { state: 'value', complete: true }, right: { state: 'value', complete: true } })
    expect(equal).not.toContain('hello'); expect(equal).not.toContain('aGVsbG8=')
    expect(JSON.parse(content(await f.call('redis_viewer_compare_strings', { left: 'large', right: 'large' })))).toMatchObject({ comparison: 'undetermined', left: { complete: false }, right: { complete: false } })
    expect(JSON.parse(content(await f.call('redis_viewer_compare_strings', { left: 'plain', right: 'large' })))).toMatchObject({ comparison: 'different' })
    expect(JSON.parse(content(await f.call('redis_viewer_compare_strings', { left: 'missing', right: 'hash' })))).toMatchObject({ comparison: 'unavailable', left: { state: 'missing' }, right: { state: 'unsupported' } })
    expect(JSON.parse(content(await f.call('redis_viewer_compare_strings', { leftBase64: Buffer.from('plain').toString('base64'), right: 'plain' })))).toMatchObject({ comparison: 'equal' })
    for (const args of [{ left: 'plain' }, { left: 'plain', leftBase64: 'cGxhaW4=', right: 'plain' }, { leftBase64: 'invalid', right: 'plain' }]) expect((await f.call('redis_viewer_compare_strings', args)).isError).toBe(true)
    expect((await f.call('redis_viewer_compare_strings', { left: 'plain', right: 'plain', command: 'SET' })).isError).toBe(true)
  })
  it('rejects a comparison when its connection changes during the first read', async () => {
    let release!: (value: RedisReply) => void, observed!: () => void
    const pending = new Promise<RedisReply>(resolve => { release = resolve })
    const started = new Promise<void>(resolve => { observed = resolve })
    const f = await fixture(undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, async () => { observed(); return pending })
    const operation = f.call('redis_viewer_compare_strings', { left: 'plain', right: 'plain' })
    await started
    await f.connections.connect('a', { host: '127.0.0.1', port: 6379, username: '', password: '', tls: null }, new AbortController().signal)
    release(Buffer.from('hello'))
    expect((await operation).isError).toBe(true)
    expect(f.commands.filter(command => command === 'GETRANGE')).toHaveLength(1)
  })
  it('projects bounded client details without addresses, names or commands', async () => {
    const row = 'id=12 addr=private:6379 name=synthetic-secret age=90 idle=3 flags=N db=2 cmd=get user=private\n'
    const f = await fixture(undefined, undefined, undefined, undefined, undefined, undefined, undefined, async (_command, args) => { expect(args).toEqual(['LIST']); return Buffer.from(row.repeat(21)) })
    const text = content(await f.call('redis_viewer_clients', {}))
    expect(JSON.parse(text)).toMatchObject({ scope: 'server', state: 'value', totalCount: 21, complete: false, clients: Array.from({ length: 20 }, () => ({ id: '12', ageSeconds: '90', idleSeconds: '3', db: '2', flags: 'N' })) })
    expect(text).not.toContain('private'); expect(text).not.toContain('synthetic-secret'); expect(text).not.toContain('cmd')
    expect((await f.call('redis_viewer_clients', { command: 'KILL' })).isError).toBe(true)
    const denied = await fixture(undefined, undefined, undefined, undefined, undefined, undefined, undefined, async () => { throw new RedisReplyError('NOPERM synthetic-secret') })
    const failure = content(await denied.call('redis_viewer_clients', {}))
    expect(failure).toContain('"error":"permission"'); expect(failure).not.toContain('synthetic-secret')
    const malformed = await fixture(undefined, undefined, undefined, undefined, undefined, undefined, undefined, async () => Buffer.from('id=1 id=2 age=1 idle=1 db=0 flags=N\n'))
    expect(content(await malformed.call('redis_viewer_clients', {}))).toContain('"error":"protocol"')
  })
  it('returns only validated server overview fields and marks unavailable fields', async () => {
    const requests: Array<readonly unknown[]> = []
    const f = await fixture(undefined, undefined, undefined, undefined, undefined, async (_command, args) => {
      requests.push(args)
      return Buffer.from('# Memory\r\nused_memory:12345678901234567890\r\nused_memory_rss:bad-value\r\nmaxmemory:0\r\nmem_fragmentation_ratio:1.25\r\nprivate_metric:synthetic-secret\r\n')
    })
    const text = content(await f.call('redis_viewer_overview', { section: 'memory' }))
    expect(JSON.parse(text)).toMatchObject({ scope: 'server', section: 'memory', state: 'partial', fields: { used_memory: '12345678901234567890', maxmemory: '0', mem_fragmentation_ratio: '1.25' }, missing: ['used_memory_rss'] })
    expect(text).not.toContain('synthetic-secret'); expect(text).not.toContain('bad-value')
    expect(requests).toEqual([['memory']])
    for (const args of [{}, { section: 'all' }, { section: 'memory', command: 'CONFIG SET' }]) expect((await f.call('redis_viewer_overview', args)).isError).toBe(true)
    expect(requests).toHaveLength(1)
  })
  it('reports overview permission and malformed replies without leaking server text', async () => {
    const denied = await fixture(undefined, undefined, undefined, undefined, undefined, async () => { throw new RedisReplyError('NOPERM synthetic-secret') })
    const text = content(await denied.call('redis_viewer_overview', { section: 'clients' }))
    expect(text).toContain('"state":"failed"'); expect(text).toContain('"error":"permission"'); expect(text).not.toContain('synthetic-secret')
    const duplicate = await fixture(undefined, undefined, undefined, undefined, undefined, async () => Buffer.from('connected_clients:1\r\nconnected_clients:2\r\n'))
    expect(content(await duplicate.call('redis_viewer_overview', { section: 'clients' }))).toContain('"error":"protocol"')
  })
  it('returns only bounded server-wide slow-log metadata without arguments or client details', async () => {
    const requests: Array<readonly unknown[]> = []
    const f = await fixture(undefined, undefined, undefined, undefined, async (_command, args) => {
      requests.push(args)
      return [[7n, 1700000000n, 1500n, [Buffer.from('set'), Buffer.from('private-key'), Buffer.from('synthetic-secret')], Buffer.from('private-client'), Buffer.from('private-name')], [8n, 1700000001n, 2n, [Buffer.from([0xff])], Buffer.from('private-client'), Buffer.from('')]]
    })
    const text = content(await f.call('redis_viewer_slowlog', { count: 3 }))
    const result = JSON.parse(text)
    expect(result).toMatchObject({ scope: 'server', state: 'value', requestedCount: 3, returnedCount: 2, entries: [{ id: '7', timestampSeconds: '1700000000', durationMicroseconds: '1500', command: 'SET' }, { command: null }] })
    expect(text).not.toContain('private-key'); expect(text).not.toContain('synthetic-secret'); expect(text).not.toContain('private-client'); expect(text).not.toContain('private-name')
    expect(requests).toEqual([['GET', '3']])
    for (const args of [{ count: 0 }, { count: 11 }, { count: -1 }, { count: 1.5 }, { count: 2, command: 'RESET' }]) expect((await f.call('redis_viewer_slowlog', args)).isError).toBe(true)
    expect(requests).toHaveLength(1)
  })
  it('distinguishes denied and malformed slow logs from an empty log', async () => {
    const denied = await fixture(undefined, undefined, undefined, undefined, async () => { throw new RedisReplyError('NOPERM synthetic-secret') })
    const text = content(await denied.call('redis_viewer_slowlog', {}))
    expect(text).toContain('"state":"failed"'); expect(text).toContain('"error":"permission"'); expect(text).not.toContain('synthetic-secret')
    const malformed = await fixture(undefined, undefined, undefined, undefined, async () => [[1n, 2n, 'bad', [Buffer.from('GET')]]])
    expect(content(await malformed.call('redis_viewer_slowlog', {}))).toContain('"error":"protocol"')
    const empty = await fixture()
    expect(JSON.parse(content(await empty.call('redis_viewer_slowlog', {})))).toMatchObject({ state: 'value', returnedCount: 0, requestedCount: 10 })
  })
  it('uses one bounded memory estimate for an explicit Key and preserves error meaning', async () => {
    const requests: Array<readonly unknown[]> = []
    const f = await fixture(undefined, undefined, undefined, async (_command, args) => {
      requests.push(args)
      if (String(args[1]) === 'denied') throw new RedisReplyError('NOPERM synthetic-secret')
      return String(args[1]) === 'missing' ? null : 123n
    })
    const result = JSON.parse(content(await f.call('redis_viewer_memory', { key: 'hash' })))
    expect(result).toMatchObject({ state: 'value', bytes: '123', samples: 5, key: { base64: 'aGFzaA==' }, error: null })
    expect(requests[0]).toEqual(['USAGE', Buffer.from('hash'), 'SAMPLES', '5'])
    expect(JSON.parse(content(await f.call('redis_viewer_memory', { keyBase64: 'AP8=' })))).toMatchObject({ state: 'value', key: { base64: 'AP8=' } })
    expect(requests[1]?.[1]).toEqual(Buffer.from([0, 255]))
    expect(JSON.parse(content(await f.call('redis_viewer_memory', { key: 'missing' })))).toMatchObject({ state: 'missing', bytes: null })
    const denied = content(await f.call('redis_viewer_memory', { key: 'denied' }))
    expect(denied).toContain('"error":"permission"'); expect(denied).not.toContain('synthetic-secret')
    const before = requests.length
    for (const args of [{}, { key: 'x', keyBase64: 'eA==' }, { keyBase64: 'not-base64' }, { key: '\ud800' }, { key: 'x', samples: 0 }]) expect((await f.call('redis_viewer_memory', args)).isError).toBe(true)
    expect(requests).toHaveLength(before)
  })
  it('does not publish a memory result from a replaced connection', async () => {
    let release!: (value: RedisReply) => void, observed!: () => void
    const pending = new Promise<RedisReply>(resolve => { release = resolve })
    const started = new Promise<void>(resolve => { observed = resolve })
    const f = await fixture(undefined, undefined, undefined, async () => { observed(); return pending })
    const operation = f.call('redis_viewer_memory', { key: 'hash' })
    await started
    await f.connections.connect('a', { host: '127.0.0.1', port: 6379, username: '', password: '', tls: null }, new AbortController().signal)
    release(123n)
    expect((await operation).isError).toBe(true)
  })
  it('filters bounded batches without exposing other values or consuming the normal Key cursor', async () => {
    const f = await fixture(undefined, async (_command, args) => {
      if (args[2] === 'normal:*') return [Buffer.from(args[0] === '0' ? '7' : '0'), [Buffer.from('plain')]]
      return [Buffer.from('0'), Array.from({ length: 21 }, (_value, index) => Buffer.from('order:' + index))]
    })
    const normal = JSON.parse(content(await f.call('redis_viewer_keys', { match: 'normal:*' }))) as { cursor: string }
    const first = JSON.parse(content(await f.call('redis_viewer_filter_hash', { match: 'order:*', field: 'status', equals: 'failed' }))) as { counts: Record<string, number>; cursor: string; scanComplete: boolean; errors: string[] }
    expect(first).toMatchObject({ counts: { checked: 10, matched: 3, different: 5, missingField: 1, failed: 1 }, errors: ['permission'], scanComplete: false })
    expect(first.cursor).toMatch(/^f:/u)
    expect(JSON.stringify(first)).not.toContain('synthetic-secret')
    expect((await f.call('redis_viewer_filter_hash', { match: 'order:*', field: 'status', equals: 'other', cursor: first.cursor })).isError).toBe(true)
    const second = JSON.parse(content(await f.call('redis_viewer_filter_hash', { match: 'order:*', field: 'status', equals: 'failed', cursor: first.cursor }))) as { counts: Record<string, number>; cursor: string; scanComplete: boolean }
    expect(second).toMatchObject({ counts: { checked: 10, matched: 3 }, scanComplete: false })
    const last = JSON.parse(content(await f.call('redis_viewer_filter_hash', { match: 'order:*', field: 'status', equals: 'failed', cursor: second.cursor })))
    expect(last).toMatchObject({ counts: { checked: 1, matched: 0 }, cursor: null, scanComplete: true })
    expect((await f.call('redis_viewer_keys', { match: 'normal:*', cursor: normal.cursor })).isError).toBeFalsy()
    expect(f.commands.filter(command => command === 'SCAN')).toHaveLength(3)
    expect(f.commands.filter(command => command === 'HGET')).toHaveLength(21)
    expect(f.commands.every(command => !['SET', 'HSET', 'DEL', 'KEYS'].includes(command))).toBe(true)
    for (const args of [{ field: 'status', equals: 'failed' }, { match: '\ud800', field: 'status', equals: 'failed' }, { match: '*', field: '\ud800', equals: 'failed' }, { match: '*', field: 'a'.repeat(1025), equals: 'failed' }, { match: '*', field: 'status', equals: 'x'.repeat(4097) }]) expect((await f.call('redis_viewer_filter_hash', args)).isError).toBe(true)
  })
  it('continues a filter after an empty SCAN page without claiming it finished', async () => {
    const f = await fixture(undefined, async (_command, args) => args[0] === '0' ? [Buffer.from('7'), []] : [Buffer.from('0'), [Buffer.from('order:0')]])
    const first = JSON.parse(content(await f.call('redis_viewer_filter_hash', { match: 'order:*', field: 'status', equals: 'failed' }))) as { cursor: string }
    expect(first).toMatchObject({ counts: { checked: 0, matched: 0 }, scanComplete: false })
    const last = JSON.parse(content(await f.call('redis_viewer_filter_hash', { match: 'order:*', field: 'status', equals: 'failed', cursor: first.cursor })))
    expect(last).toMatchObject({ counts: { checked: 1, matched: 1 }, scanComplete: true })
  })
  it('retains the filter batch when cancellation happens before a field read completes', async () => {
    const f = await fixture(undefined, async () => [Buffer.from('0'), [Buffer.from('order:0')]])
    const original = f.connections.read.bind(f.connections), cancelled = new AbortController()
    let release!: () => void, started!: () => void
    const waiting = new Promise<void>(resolve => { release = resolve }), observed = new Promise<void>(resolve => { started = resolve })
    const spy = vi.spyOn(f.connections, 'read').mockImplementation(async (...args) => { if (args[2] === 'HGET') { started(); await waiting }; return original(...args) })
    const pending = f.call('redis_viewer_filter_hash', { match: 'order:*', field: 'status', equals: 'failed' }, { signal: cancelled.signal })
    await observed; cancelled.abort(); release()
    expect((await pending).isError).toBe(true)
    spy.mockRestore()
    expect(JSON.parse(content(await f.call('redis_viewer_filter_hash', { match: 'order:*', field: 'status', equals: 'failed' })))).toMatchObject({ counts: { checked: 1, matched: 1 }, scanComplete: true })
    expect(f.commands.filter(command => command === 'SCAN')).toHaveLength(1)
  })
  it('reads explicit Set and ZSet members without a synchronized sidebar', async () => {
    const f = await fixture(undefined, undefined, { confirm: async () => { throw new Error('面板不可用') }, current: () => false })
    expect(JSON.parse(content(await f.call('redis_viewer_value', { key: 'set', member: 'member' })))).toMatchObject({ source: 'explicit', value: { state: 'value', metadata: { type: 'set' } } })
    expect(JSON.parse(content(await f.call('redis_viewer_value', { key: 'zset', memberBase64: Buffer.from([0, 255]).toString('base64') })))).toMatchObject({ member: { base64: 'AP8=' }, value: { state: 'value', metadata: { type: 'zset' }, score: '1.2345678901234567' } })
    expect(JSON.parse(content(await f.call('redis_viewer_value', { key: 'set', member: 'absent' })))).toMatchObject({ errorMessage: '采样时指定的成员不存在。', value: { state: 'selection-missing' } })
    expect(JSON.parse(content(await f.call('redis_viewer_value', { key: 'missing', member: 'x' })))).toMatchObject({ value: { state: 'missing' } })
    expect(JSON.parse(content(await f.call('redis_viewer_value', { key: 'hash', member: 'x' })))).toMatchObject({ value: { state: 'unsupported', type: 'hash' } })
    expect(JSON.parse(content(await f.call('redis_viewer_value', { key: 'changing-member', member: 'x' })))).toMatchObject({ value: { state: 'changed' } })
    expect(JSON.parse(content(await f.call('redis_viewer_value', { key: 'denied', member: 'x' })))).toMatchObject({ value: { state: 'failed', error: 'permission' } })
    expect(f.commands).toContain('SISMEMBER'); expect(f.commands).toContain('ZSCORE')
    expect(f.commands).not.toContain('SSCAN'); expect(f.commands).not.toContain('ZSCAN')
    for (const args of [{ member: 'x' }, { key: 'set', member: 'x', memberBase64: 'eA==' }, { key: 'set', member: 'x', field: 'y' }, { key: 'set', member: 'x', count: 1 }, { key: 'set', memberBase64: '!!!' }, { key: 'set', member: '\ud800' }]) expect((await f.call('redis_viewer_value', args)).isError).toBe(true)
  })
  it('reads an explicitly named Hash field without a visible or synchronized sidebar', async () => {
    const f = await fixture(undefined, undefined, { confirm: async () => { throw new Error('面板不可用') }, current: () => false })
    const result = await f.call('redis_viewer_value', { key: 'hash', field: 'status' })
    expect(result.isError).toBeFalsy()
    expect(JSON.parse(content(result))).toMatchObject({ source: 'explicit', value: { state: 'value', cell: { text: '精确字段值', complete: true } } })
    expect(f.commands).toContain('HGET')
    expect(f.commands).not.toContain('HSCAN')
    const binary = await f.call('redis_viewer_value', { keyBase64: Buffer.from('hash').toString('base64'), fieldBase64: Buffer.from([0, 255]).toString('base64') })
    expect(binary.isError).toBeFalsy()
    expect(JSON.parse(content(binary))).toMatchObject({ field: { base64: 'AP8=' }, value: { state: 'value' } })
    expect(JSON.parse(content(await f.call('redis_viewer_value', { key: 'hash', field: 'absent' })))).toMatchObject({ errorMessage: '采样时指定的 Hash 字段不存在。', value: { state: 'selection-missing', cell: null } })
    expect(JSON.parse(content(await f.call('redis_viewer_value', { key: 'missing', field: 'status' })))).toMatchObject({ value: { state: 'missing' } })
    expect(JSON.parse(content(await f.call('redis_viewer_value', { key: 'plain', field: 'status' })))).toMatchObject({ value: { state: 'changed' } })
    for (const args of [{ field: 'status' }, { key: 'hash', field: 'status', fieldBase64: 'eA==' }, { key: 'hash', field: 'status', match: '*' }, { key: 'hash', fieldBase64: '!!!' }, { key: 'hash', field: '\ud800' }]) expect((await f.call('redis_viewer_value', args)).isError).toBe(true)
  })
  it('rejects a named field read when its connection changes before dispatch', async () => {
    const f = await fixture(), original = f.connections.read.bind(f.connections)
    let release!: () => void, started!: () => void
    const blocked = new Promise<void>(resolve => { release = resolve })
    const observed = new Promise<void>(resolve => { started = resolve })
    vi.spyOn(f.connections, 'read').mockImplementation(async (...args) => {
      if (args[2] === 'HGET') { started(); await blocked }
      return original(...args)
    })
    const pending = f.call('redis_viewer_value', { key: 'hash', field: 'status' })
    await observed
    await f.connections.connect('a', { host: '127.0.0.1', port: 6379, username: 'reader', password: 'never-in-output', tls: null }, new AbortController().signal)
    release()
    const result = await pending
    expect(result.isError).toBe(true)
    expect(content(result)).not.toContain('精确字段值')
    expect(f.commands).not.toContain('HGET')
  })
  it('does not read an old selection when the interface cannot confirm its version', async () => {
    const f = await fixture(undefined, undefined, { confirm: async () => { throw new Error('选择未同步') }, current: () => false })
    f.reader.setSelection('a', { target: f.target, selection: { keyBase64: Buffer.from('hash').toString('base64'), item: { kind: 'hash', fieldBase64: Buffer.from('first').toString('base64') } } })
    await expect(f.reader.read('a', {}, new AbortController().signal)).rejects.toThrow('选择未同步')
    expect(f.commands).not.toContain('HGET')
    const explicit = await f.reader.read('a', { key: 'plain' }, new AbortController().signal)
    expect(explicit).toMatchObject({ source: 'explicit' })
  })
  it('rejects a staged selection page if the view changes before commit', async () => {
    let revision = 1
    const f = await fixture(undefined, undefined, { confirm: async (_session, _target, expected) => expected ?? revision, current: (_session, expected) => expected === revision })
    f.reader.setSelection('a', { target: f.target, selection: { keyBase64: Buffer.from('hash').toString('base64'), item: null } })
    const pages: PreparedAiPage[] = []
    await f.reader.read('a', {}, new AbortController().signal, page => { pages.push(page) })
    expect(pages).toHaveLength(1)
    revision += 1
    expect(() => pages[0]?.commit()).toThrow('侧栏选择已变化')
    pages[0]?.rollback()
    const retry: PreparedAiPage[] = []
    await f.reader.read('a', {}, new AbortController().signal, page => { retry.push(page) })
    expect(retry).toHaveLength(1)
    expect(() => retry[0]?.commit()).not.toThrow()
  })
  it('retains a fetched continuation when the final UI confirmation fails', async () => {
    let calls = 0
    const f = await fixture(undefined, undefined, {
      confirm: async (_session, _target, expected) => { calls += 1; if (calls === 4) throw new Error('选择已变化'); return expected ?? 1 },
      current: () => true,
    })
    f.reader.setSelection('a', { target: f.target, selection: { keyBase64: Buffer.from('hash').toString('base64'), item: null } })
    const first = await f.reader.read('a', {}, new AbortController().signal) as { value: { cursor: string } }
    expect(first.value.cursor).toMatch(/^h:/)
    await expect(f.reader.read('a', { cursor: first.value.cursor }, new AbortController().signal)).rejects.toThrow('选择已变化')
    expect(f.commands.filter(command => command === 'HSCAN')).toHaveLength(2)
    const retry = await f.reader.read('a', { cursor: first.value.cursor }, new AbortController().signal)
    expect(retry).toMatchObject({ source: 'selection' })
    expect(f.commands.filter(command => command === 'HSCAN')).toHaveLength(2)
  })
  it('invalidates pending UI actions on actual selection or DB changes', async () => {
    const f = await fixture(), signal = new AbortController().signal
    const selection = { keyBase64: Buffer.from('plain').toString('base64'), item: null }
    f.reader.setSelection('a', { target: f.target, selection })
    const signals: AbortSignal[] = []
    f.actions.register('a', async (_request, pendingSignal) => { signals.push(pendingSignal); return new Promise(() => undefined) })
    const dispatch = () => f.actions.dispatch('a', { kind: 'show' }, f.target, 0, () => true, signal)
    let pending = dispatch()
    await vi.waitFor(() => expect(signals).toHaveLength(1))
    f.reader.setSelection('a', { target: f.target, selection })
    expect(signals[0]?.aborted).toBe(false)
    f.reader.setSelection('a', { target: f.target, selection: null })
    expect(await pending).toBe('stale'); expect(signals[0]?.aborted).toBe(true)
    pending = dispatch()
    await vi.waitFor(() => expect(signals).toHaveLength(2))
    await f.reader.selectDatabase('a', 2, signal)
    expect(await pending).toBe('stale'); expect(signals[1]?.aborted).toBe(true)
  })
  it('does not expose sensitive text in an injected permission denial', async () => {
    const marker = 'ro04-fake-denial-secret'
    const f = await fixture(undefined, async () => { throw new RedisReplyError('NOPERM ' + marker) })
    const result = await f.call('redis_viewer_keys', {})
    expect(content(result)).toContain(connectionErrorMessages.permission.zh)
    expect(JSON.stringify(result)).not.toContain(marker)
  })
  it('describes generation as a view version in both model-facing schemas', async () => {
    const f = await fixture(), schemas = f.ctx.tools.schemas()
    for (const name of ['redis_viewer_status', 'redis_viewer_select_db']) {
      const schema = schemas.find(item => item.name === name)
      expect(schema?.description).toContain('connection.generation 是插件连接与 DB 视图的版本')
      expect(schema?.description).toContain('不能仅凭版本变化推断物理连接重建或 Redis 服务器重启')
    }
  })
  it('continues a split Key page through the registered tool without losing identities', async () => {
    const keys = Array.from({ length: 180 }, (_value, index) => Buffer.from(String(index).padStart(4, '0') + 'x'.repeat(500)))
    const f = await fixture(undefined, async () => [Buffer.from('0'), keys])
    const found: string[] = []
    let cursor: string | undefined
    do {
      const result = await f.call('redis_viewer_keys', cursor === undefined ? {} : { cursor })
      expect(result.isError).toBeFalsy()
      const text = content(result)
      expect(Buffer.byteLength(text)).toBeLessThanOrEqual(64 * 1024)
      const value: unknown = JSON.parse(text)
      if (value === null || typeof value !== 'object' || Array.isArray(value) || !('keys' in value) || !Array.isArray(value.keys) || !('cursor' in value) || !(value.cursor === null || typeof value.cursor === 'string')) throw new Error('Invalid tool page')
      for (const item of value.keys) {
        if (item === null || typeof item !== 'object' || !('base64' in item) || typeof item.base64 !== 'string') throw new Error('Invalid key identity')
        found.push(item.base64)
      }
      cursor = value.cursor ?? undefined
    } while (cursor !== undefined)
    expect(found).toEqual(keys.map(key => key.toString('base64')))
    expect(f.commands.filter(command => command === 'SCAN')).toHaveLength(1)
  })
  it('shares the limit across tools and keeps it across DB changes until the user resumes', async () => {
    const f = await fixture(), signal = new AbortController().signal
    const remote = remoteFixture(f.connections, f.reader)
    for (const key of ['keys', 'hashes', 'sets', 'zsets', 'streams']) Reflect.set(remote, key, { disposeSession: () => undefined })
    expect((await f.call('redis_viewer_status', {})).isError).toBeFalsy()
    expect((await f.call('redis_viewer_keys', { match: '*' })).isError).toBeFalsy()
    expect((await f.call('redis_viewer_value', { key: 'plain' })).isError).toBeFalsy()
    expect((await f.call('redis_viewer_select_db', { db: 2 })).isError).toBeFalsy()
    expect(f.reader.budgetStatus('a')).toMatchObject({ callsUsed: 4 })
    const current = f.connections.status('a')
    if (current.id === null) throw new Error('Missing connected identity')
    await remote.disconnect(f.agent, { id: current.id, generation: current.generation }, signal)
    await remote.connect(f.agent, { host: '127.0.0.1', port: 6379, username: '', password: '', tls: null }, signal)
    expect(f.reader.budgetStatus('a')).toMatchObject({ callsUsed: 4 })
    for (let i = 4; i < 32; i++) expect((await f.call('redis_viewer_status', {})).isError).toBeFalsy()
    const before = f.commands.length
    const stopped = content(await f.call('redis_viewer_keys', {}))
    expect(stopped).toContain('预算已用完')
    expect(stopped).toContain('AI 读取预算')
    expect(stopped).toContain('刷新状态')
    expect(stopped).toContain('继续读取')
    expect(f.commands).toHaveLength(before)
    const otherAgent = { session: { id: 'b' } } as unknown as Agent
    expect(await remote.resumeAiBudget(otherAgent, {}, signal)).toMatchObject({ accepted: false })
    expect(await remote.aiBudgetStatus(f.agent, {}, signal)).toMatchObject({ callsUsed: 32, stopped: true })
    expect(await remote.resumeAiBudget(f.agent, {}, signal)).toMatchObject({ accepted: true, status: { callsUsed: 0, stopped: false } })
    expect((await f.call('redis_viewer_keys', {})).isError).toBeFalsy()
  })
  it('counts failed admitted operations, rejects model reset arguments and prevents in-flight reset', async () => {
    const f = await fixture(), signal = new AbortController().signal
    expect((await f.call('redis_viewer_value', { key: 'plain', keyBase64: 'cGxhaW4=' })).isError).toBe(true)
    expect(f.reader.budgetStatus('a').callsUsed).toBe(1)
    expect((await f.call('redis_viewer_status', { resume: true })).isError).toBe(true)
    let release!: () => void
    const pending = new Promise<void>(resolve => { release = resolve })
    const operation = f.reader.withBudget('a', signal, async () => { await pending; return { ok: true } })
    expect(f.reader.budgetStatus('a').inFlight).toBe(1)
    expect(f.reader.resumeBudget('a').accepted).toBe(false)
    release(); await operation
    expect(f.reader.budgetStatus('a').inFlight).toBe(0)
    const controller = new AbortController()
    let complete!: () => void
    const delayed = new Promise<void>(resolve => { complete = resolve })
    const cancelled = f.reader.withBudget('a', controller.signal, async () => { await delayed; return { ok: true } })
    const callsBeforeCancel = f.reader.budgetStatus('a').callsUsed
    controller.abort(); complete()
    await expect(cancelled).rejects.toThrow()
    expect(f.reader.budgetStatus('a')).toMatchObject({ callsUsed: callsBeforeCancel, inFlight: 0 })
  })
  it('reports sampled connection state, the actual scan pattern and the source of a value', async () => {
    const f = await fixture(), requestSignal = new AbortController().signal
    const timestamp = expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u)
    expect(f.reader.status('a')).toMatchObject({ sampledAt: timestamp, connection: { db: 0 }, currentSelection: null })
    expect(await f.reader.scan('a', { match: 'order:*' }, requestSignal)).toMatchObject({ pattern: 'order:*', sampledAt: timestamp })
    expect(await f.reader.read('a', { key: 'plain' }, requestSignal)).toMatchObject({ source: 'explicit', value: { sampledAt: timestamp } })
    f.reader.setSelection('a', { target: f.target, selection: { keyBase64: Buffer.from('plain').toString('base64'), item: null } })
    expect(await f.reader.read('a', {}, requestSignal)).toMatchObject({ source: 'selection', value: { sampledAt: timestamp } })
    expect(await f.reader.selectDatabase('a', 2, requestSignal)).toMatchObject({ requestedDb: 2, sampledAt: timestamp, connection: { db: 2 } })
    expect(content(await f.call('redis_viewer_value', { key: 'plain' }))).toContain('"source":"explicit"')
  })
  it('reports the requested DB separately when the server refuses a switch', async () => {
    const f = await fixture()
    const result = await f.call('redis_viewer_select_db', { db: 3 })
    expect(result.isError).toBeFalsy()
    expect(content(result)).toContain('"requestedDb":3')
    expect(content(result)).toContain('"db":0')
    expect(content(result)).toContain('"error":"permission"')
    expect(content(result)).toContain(connectionErrorMessages.permission.zh)
    expect(f.connections.status('a')).toMatchObject({ db: 0, state: 'connected', error: 'permission' })
  })
  it('uses the sidebar explanation for denied key and value reads without exposing server text', async () => {
    const f = await fixture(), expected = zh['connection.error.permission']
    expect(expected).toBe(connectionErrorMessages.permission.zh)
    for (const result of [await f.call('redis_viewer_keys', { match: 'denied*' }), await f.call('redis_viewer_value', { key: 'denied' })]) {
      expect(content(result)).toContain(expected)
      expect(content(result)).toContain('"error":"permission"')
      expect(content(result)).not.toContain('fixture denied')
    }
  })
  it('explains missing and changed keys using the sidebar messages', async () => {
    const f = await fixture()
    for (const [key, state] of [['missing', 'missing'], ['changing', 'changed'], ['changing-type', 'changed']] as const) {
      const result = await f.call('redis_viewer_value', { key })
      expect(content(result)).toContain(`"state":"${state}"`)
      expect(content(result)).toContain(zh[`value.state.${state}`])
    }
    f.reader.setSelection('a', { target: f.target, selection: { keyBase64: Buffer.from('plain').toString('base64'), item: { kind: 'hash', fieldBase64: Buffer.from('field').toString('base64') } } })
    expect(content(await f.call('redis_viewer_value', {}))).toContain(zh['value.state.changed'])
    for (const item of [{ kind: 'list' as const, index: '0' }, { kind: 'stream' as const, id: '1-0', fieldIndex: 0, fieldBase64: Buffer.from('field').toString('base64') }]) {
      f.reader.setSelection('a', { target: f.target, selection: { keyBase64: Buffer.from('hash').toString('base64'), item } })
      const result = await f.call('redis_viewer_value', {})
      expect(content(result)).toContain('"state":"changed"')
      expect(content(result)).toContain(zh['value.state.changed'])
    }
  })
  it.each(['keys', 'value', 'selection'] as const)('reports a same-connection network failure for %s without calling it stale', async kind => {
    const f = await fixture()
    if (kind === 'selection') f.reader.setSelection('a', { target: f.target, selection: { keyBase64: Buffer.from('network').toString('base64'), item: { kind: 'hash', fieldBase64: Buffer.from('field').toString('base64') } } })
    const result = kind === 'keys' ? await f.call('redis_viewer_keys', { match: 'network*' }) : await f.call('redis_viewer_value', kind === 'value' ? { key: 'network' } : {})
    expect(result.isError).toBeFalsy()
    expect(content(result)).toContain('"error":"network"')
    expect(content(result)).toContain(connectionErrorMessages.network.zh)
    expect(f.connections.status('a')).toMatchObject({ state: 'error', error: 'network' })
    expect(content(await f.call('redis_viewer_value', { key: 'plain' }))).toContain(connectionErrorMessages.network.zh)
  })
  it('rejects a failed read if the session reconnects before the result returns', async () => {
    const f = await fixture()
    const operation = f.reader.read('a', { key: 'network' }, new AbortController().signal)
    const rejected = expect(operation).rejects.toMatchObject({ code: 'stale' })
    const replacement = await f.connections.connect('a', { host: '127.0.0.1', port: 6379, username: '', password: '', tls: null }, new AbortController().signal)
    await rejected
    expect(replacement.state).toBe('connected')
    expect(f.connections.status('a')).toEqual(replacement)
  })
  it.each(['tool', 'remote'] as const)('preserves a replacement connection selection when an old %s switch finishes', async entry => {
    let release!: (value: RedisReply) => void, observed!: () => void
    const pending = new Promise<RedisReply>(resolve => { release = resolve })
    const started = new Promise<void>(resolve => { observed = resolve })
    const f = await fixture(async () => { observed(); return pending })
    const remote = remoteFixture(f.connections, f.reader)
    const operation = entry === 'tool'
      ? f.call('redis_viewer_select_db', { db: 2 })
      : remote.selectDatabase(f.agent, { ...f.target, db: 2 }, new AbortController().signal)
    await started
    const replacement = await f.connections.connect('a', { host: '127.0.0.1', port: 6379, username: '', password: '', tls: null }, new AbortController().signal)
    if (replacement.id === null) throw new Error('Missing replacement connection')
    const selection = { keyBase64: Buffer.from('plain').toString('base64'), item: null }
    expect(f.reader.setSelection('a', { target: { id: replacement.id, generation: replacement.generation, db: replacement.db }, selection })).toEqual({ accepted: true })
    release('OK')
    const result = await operation
    if (entry === 'tool') expect(result).toMatchObject({ isError: true })
    else expect(result).toMatchObject({ id: replacement.id, generation: replacement.generation, db: 0, error: 'stale' })
    expect(f.reader.status('a')).toMatchObject({ connection: { generation: replacement.generation }, currentSelection: { selection } })
  })
  it.each(['tool', 'remote'] as const)('preserves a replacement selection when both old and new %s switches are denied', async entry => {
    let rejectOld!: (error: Error) => void, observed!: () => void
    const pending = new Promise<RedisReply>((_resolve, reject) => { rejectOld = reject })
    const started = new Promise<void>(resolve => { observed = resolve })
    const f = await fixture(async (_command, args) => {
      if (args[0] === '2') { observed(); return pending }
      throw new RedisReplyError('NOPERM fixture denied')
    })
    const remote = remoteFixture(f.connections, f.reader)
    const operation = entry === 'tool'
      ? f.call('redis_viewer_select_db', { db: 2 })
      : remote.selectDatabase(f.agent, { ...f.target, db: 2 }, new AbortController().signal)
    await started
    const replacement = await f.connections.connect('a', { host: '127.0.0.1', port: 6379, username: '', password: '', tls: null }, new AbortController().signal)
    if (replacement.id === null) throw new Error('Missing replacement connection')
    const denied = await f.connections.selectDatabase('a', { id: replacement.id, generation: replacement.generation, db: 3 }, new AbortController().signal)
    expect(denied).toMatchObject({ db: 0, state: 'connected', error: 'permission' })
    const selection = { keyBase64: Buffer.from('plain').toString('base64'), item: null }
    expect(f.reader.setSelection('a', { target: { id: replacement.id, generation: denied.generation, db: denied.db }, selection })).toEqual({ accepted: true })
    rejectOld(new RedisReplyError('NOPERM old fixture denied'))
    const result = await operation
    if (entry === 'tool') expect(result).toMatchObject({ isError: true })
    else expect(result).toMatchObject({ generation: denied.generation, db: 0, error: 'stale' })
    expect(f.reader.status('a')).toMatchObject({ connection: { generation: denied.generation, error: 'permission' }, currentSelection: { selection } })
  })
  it.each(['tool', 'remote'] as const)('preserves a new DB selection made before the %s switch returns', async entry => {
    const f = await fixture()
    const selectDatabase = f.connections.selectDatabase.bind(f.connections)
    const selection = { keyBase64: Buffer.from('plain').toString('base64'), item: null }
    vi.spyOn(f.connections, 'selectDatabase').mockImplementation(async (sessionId, target, requestSignal, onInvalidate) => {
      const view = await selectDatabase(sessionId, target, requestSignal, onInvalidate)
      if (view.id === null) throw new Error('Missing selected connection')
      expect(f.reader.setSelection(sessionId, { target: { id: view.id, generation: view.generation, db: view.db }, selection })).toEqual({ accepted: true })
      return view
    })
    const remote = remoteFixture(f.connections, f.reader)
    const result = entry === 'tool'
      ? await f.call('redis_viewer_select_db', { db: 2 })
      : await remote.selectDatabase(f.agent, { ...f.target, db: 2 }, new AbortController().signal)
    if (entry === 'tool') expect(result).toMatchObject({ isError: false })
    else expect(result).toMatchObject({ db: 2, state: 'connected', error: null })
    expect(f.reader.status('a')).toMatchObject({ connection: { db: 2 }, currentSelection: { selection } })
  })
  it('registers into the real model schema assembly and unloads with its fiber', async () => {
    const f = await fixture()
    expect((await f.ctx.systemPrompt.assemble()).tools.map(tool => tool.name).sort()).toEqual(['redis_viewer_clients', 'redis_viewer_compare_strings', 'redis_viewer_filter_hash', 'redis_viewer_keys', 'redis_viewer_memory', 'redis_viewer_overview', 'redis_viewer_select_db', 'redis_viewer_slowlog', 'redis_viewer_status', 'redis_viewer_stream_groups', 'redis_viewer_value'])
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
  it('keeps an AI Key continuation when an unrelated value result is too large', async () => {
    const f = await fixture(), signal = new AbortController().signal
    const first = await f.reader.scan('a', {}, signal)
    if (first === null || typeof first !== 'object' || Array.isArray(first) || typeof first.cursor !== 'string') throw new Error('Missing Key continuation')
    expect((await f.call('redis_viewer_value', { key: 'wide' })).isError).toBe(true)
    const continued = await f.call('redis_viewer_keys', { cursor: first.cursor })
    expect(continued.isError).toBeFalsy()
    expect(content(continued)).toContain('"scanComplete":true')
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
  it('switches only through its dedicated tool, advances identity and clears old selection', async () => {
    const f = await fixture(), selection = { keyBase64: Buffer.from('plain').toString('base64'), item: null }
    f.reader.setSelection('a', { target: f.target, selection })
    await f.call('redis_viewer_value', { key: 'plain' })
    expect(f.commands).not.toContain('SELECT')
    expect((await f.call('redis_viewer_select_db', { db: 0 })).isError).toBeFalsy()
    expect(content(await f.call('redis_viewer_status', {}))).toContain('currentSelection":{"target"')
    const selected = await f.call('redis_viewer_select_db', { db: 2 })
    expect(selected.isError).toBeFalsy(); expect(f.connections.status('a').db).toBe(2)
    expect(f.connections.status('a').id).toBe(f.target.id)
    expect(f.connections.status('a').generation).toBeGreaterThan(f.target.generation)
    expect(JSON.parse(content(selected)) as unknown).toMatchObject({ connection: { id: f.target.id, db: 2, generation: f.connections.status('a').generation } })
    expect(content(await f.call('redis_viewer_status', {}))).toContain('"currentSelection":null')
    expect((await f.call('redis_viewer_value', {})).isError).toBe(true)
    for (const args of [{ db: -1 }, { db: 65536 }, { db: 1.5 }, {}, { db: 1, sessionId: 'other' }]) expect((await f.call('redis_viewer_select_db', args)).isError).toBe(true)
    expect(f.commands.filter(command => command === 'SELECT')).toHaveLength(1)
    expect(f.open).toHaveBeenCalledTimes(1)
  })
})
