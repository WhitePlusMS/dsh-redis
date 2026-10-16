import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MAX_INFO_BYTES, OVERVIEW_FIELDS, type OverviewReadRequest } from '../src/domain.ts'
import { isOverviewValue, parseRedisInfo } from '../src/redis-info.ts'
import { RedisOverview } from '../src/host/overview-reader.ts'
import { RedisConnections, type RedisLink } from '../src/host/connection-service.ts'
import { RedisReplyError } from '../src/host/resp.ts'
import { overviewReadRequestSchema, overviewReadResultSchema } from '../src/typert.shared.ts'
import { redisHostDescriptors } from '../src/typert.host.ts'

const settings = { host: 'localhost', port: 6379, username: '', password: '', tls: null }
const signal = () => new AbortController().signal
const owned: RedisConnections[] = []
beforeEach(() => { vi.spyOn(console, 'info').mockImplementation(() => undefined) })
afterEach(() => { for (const connections of owned.splice(0)) connections.dispose(); vi.useRealTimers(); vi.restoreAllMocks() })
async function setup() {
  const reply = vi.fn<RedisLink['execute']>().mockResolvedValue(Buffer.from('# Server\r\nredis_version:8.2.6\r\nredis_mode:standalone\r\nuptime_in_seconds:0\r\nused_memory:9007199254740993\r\nkeyspace_hits:18446744073709551615\r\n'))
  const calls: { command: string; args: readonly (string | Buffer)[]; deadline: number | undefined }[] = []
  const execute: RedisLink['execute'] = async (command, args, caller, guard, deadline) => { guard(); calls.push({ command, args, deadline }); return reply(command, args, caller, guard, deadline) }
  const connections = new RedisConnections(async () => ({ execute, close: () => undefined, onFailure: () => () => undefined })); owned.push(connections)
  const view = await connections.connect('a', settings, signal())
  if (view.id === null) throw new Error('Missing target')
  const request: OverviewReadRequest = { target: { id: view.id, generation: view.generation, db: 0 } }
  return { reply, calls, connections, request, reader: new RedisOverview(connections) }
}

describe('selected readonly INFO snapshots', () => {
  it('selects exactly sixteen fields and preserves uint64 integers, zero and missing values', async () => {
    const f = await setup(), result = await f.reader.read('a', f.request, signal())
    expect(result).toMatchObject({ state: 'value', error: null, fields: { redis_version: '8.2.6', used_memory: '9007199254740993', keyspace_hits: '18446744073709551615', uptime_in_seconds: '0', maxmemory: null } })
    expect(Object.keys(result.fields ?? {})).toEqual(OVERVIEW_FIELDS)
    expect(f.calls).toEqual([{ command: 'INFO', args: [], deadline: expect.any(Number) }])
    expect(Date.parse(result.sampledAt)).toBeLessThanOrEqual(Date.now())
  })
  it('ignores unknown fields and rejects ambiguous repeated selected names', () => {
    expect(parseRedisInfo('# future\nsecret:private\nsecret:other\nmaxmemory:0\n')).toMatchObject({ maxmemory: '0', used_memory: null })
    expect(() => parseRedisInfo('used_memory:1\r\nused_memory:2\r\n')).toThrow()
    expect(() => parseRedisInfo('used_memory:bad\nused_memory:1')).toThrow()
    expect(JSON.stringify(parseRedisInfo('secret:private'))).not.toContain('private')
  })
  it('shows invalid/negative/floating/overflow/leading-zero metrics as unreported without losing valid zero', () => {
    for (const value of ['-1', '1.5', '01', ' 1', '1 ', '1e3', '18446744073709551616', '']) expect(parseRedisInfo('used_memory:' + value).used_memory).toBeNull()
    expect(parseRedisInfo('redis_version:bad value\nredis_mode:' + 'a'.repeat(65)).redis_version).toBeNull()
    expect(isOverviewValue('used_memory', '0')).toBe(true)
    expect(isOverviewValue('redis_version', '8.2.6-rc1')).toBe(true)
  })
  it('bounds semantic bytes and refuses non-bulk, damaged UTF8 or repeated replies without raw leakage', async () => {
    const f = await setup()
    for (const reply of [null, '8.2', 1n, [Buffer.from('x')], Buffer.from([255]), Buffer.from('used_memory:1\nused_memory:2')]) {
      f.reply.mockResolvedValue(reply)
      expect(await f.reader.read('a', f.request, signal())).toMatchObject({ state: 'failed', error: 'protocol', fields: null })
    }
    f.reply.mockResolvedValue(Buffer.alloc(MAX_INFO_BYTES + 1, 97))
    expect(await f.reader.read('a', f.request, signal())).toMatchObject({ state: 'failed', error: 'oversize', fields: null })
    expect(() => parseRedisInfo('字'.repeat(MAX_INFO_BYTES / 2))).toThrow()
    expect(Object.values(parseRedisInfo('#' + 'a'.repeat(MAX_INFO_BYTES - 1))).every(value => value === null)).toBe(true)
  })
  it('uses fixed safe errors for denied INFO and dispatches nothing for foreign/stale DB owners', async () => {
    const f = await setup()
    expect(await f.reader.read('other', f.request, signal())).toMatchObject({ error: 'stale' })
    expect(await f.reader.read('a', { target: { ...f.request.target, db: 1 } }, signal())).toMatchObject({ error: 'stale' })
    expect(f.calls).toHaveLength(0)
    f.reply.mockRejectedValue(new RedisReplyError('NOPERM private-password-and-user'))
    const denied = await f.reader.read('a', f.request, signal())
    expect(denied).toMatchObject({ state: 'failed', error: 'permission', fields: null }); expect(JSON.stringify(denied)).not.toContain('private')
  })
  it('drops a late generation result and leaves another owner connected', async () => {
    const f = await setup(); await f.connections.connect('b', settings, signal())
    f.reply.mockImplementationOnce(async () => { await f.connections.connect('a', settings, signal()); return Buffer.from('used_memory:1') })
    expect(await f.reader.read('a', f.request, signal())).toMatchObject({ error: 'stale', fields: null })
    expect(f.connections.status('a').state).toBe('connected'); expect(f.connections.status('b').state).toBe('connected')
  })
  it('does not dispatch a pre-cancelled request and terminates one shared ten-second deadline', async () => {
    const f = await setup(), caller = new AbortController(); caller.abort()
    expect(await f.reader.read('a', f.request, caller.signal)).toMatchObject({ error: 'cancelled' }); expect(f.calls).toHaveLength(0)
    vi.useFakeTimers()
    f.reply.mockImplementation(async (_command, _args, caller) => new Promise<never>((_resolve, reject) => caller.addEventListener('abort', () => reject(new Error('aborted')), { once: true })))
    const pending = f.reader.read('a', f.request, signal()); await vi.advanceTimersByTimeAsync(10001)
    expect(await pending).toMatchObject({ error: 'timeout', fields: null })
  })
  it('keeps both RPC faces strict and rejects hidden sections, missing fields, imprecise numbers and inconsistent states', async () => {
    const f = await setup(), descriptor = redisHostDescriptors.find(value => value.method === 'readOverview'), input = descriptor?.parameters.find(value => value.name === 'request')?.codec
    if (input?.mode !== 'strict' || descriptor?.result.mode !== 'strict') throw new Error('Missing overview codecs')
    for (const schema of [input.create(), overviewReadRequestSchema]) {
      expect(schema.parse(f.request)).toEqual(f.request)
      for (const extra of [{ section: 'all' }, { command: 'CONFIG' }, { keyBase64: '' }, { sessionId: 'other' }, { target: { ...f.request.target, db: -1 } }]) expect(() => schema.parse({ ...f.request, ...extra })).toThrow()
    }
    const result = await f.reader.read('a', f.request, signal())
    for (const schema of [descriptor.result.create(), overviewReadResultSchema]) {
      expect(schema.parse(result)).toEqual(result)
      for (const extra of [{ fields: {} }, { fields: { ...result.fields, used_memory: 9007199254740992 } }, { fields: { ...result.fields, used_memory: '18446744073709551616' } }, { fields: { ...result.fields, secret: 'private' } }, { fields: null }, { error: 'permission' }, { state: 'failed' }, { sampledAt: 'yesterday' }, { password: 'private' }]) expect(() => schema.parse({ ...result, ...extra })).toThrow()
    }
  })
})
