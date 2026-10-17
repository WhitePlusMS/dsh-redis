import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MAX_INFO_BYTES, type DatabasesReadRequest } from '../src/domain.ts'
import { parseDatabaseKeyspace } from '../src/redis-databases.ts'
import { RedisDatabases } from '../src/host/database-reader.ts'
import { RedisConnections, type RedisLink } from '../src/host/connection-service.ts'
import { RedisReplyError } from '../src/host/resp.ts'
import { databasesReadRequestSchema, databasesReadResultSchema } from '../src/typert.shared.ts'
import { redisHostDescriptors } from '../src/typert.host.ts'
const signal = () => new AbortController().signal
const settings = { host: 'localhost', port: 6379, username: '', password: '', tls: null }
const owned: RedisConnections[] = []
beforeEach(() => { vi.spyOn(console, 'info').mockImplementation(() => undefined) })
afterEach(() => { for (const c of owned.splice(0)) c.dispose(); vi.useRealTimers(); vi.restoreAllMocks() })
async function setup() {
  const reply = vi.fn<RedisLink['execute']>().mockImplementation(async command => command === 'DBSIZE' ? 760n : command === 'INFO' ? Buffer.from('# Keyspace\r\ndb0:keys=760,expires=0,avg_ttl=0\r\ndb2:keys=9007199254740993,expires=0,avg_ttl=0\r\n') : [Buffer.from('databases'), Buffer.from('16')])
  const calls: { command: string; args: readonly (string | Buffer)[]; deadline: number | undefined }[] = []
  const execute: RedisLink['execute'] = async (command, args, caller, guard, deadline) => { guard(); calls.push({ command, args, deadline }); return reply(command, args, caller, guard, deadline) }
  const connections = new RedisConnections(async () => ({ execute, close: () => undefined, onFailure: () => () => undefined })); owned.push(connections)
  const view = await connections.connect('a', settings, signal()); if (view.id === null) throw new Error('No connection')
  const request: DatabasesReadRequest = { target: { id: view.id, generation: view.generation, db: 0 } }
  return { reply, calls, connections, request, reader: new RedisDatabases(connections) }
}
describe('readonly database catalog', () => {
  it('uses three fixed commands and one deadline, retaining exact integer text', async () => {
    const f = await setup(), result = await f.reader.read('a', f.request, signal())
    expect(result).toMatchObject({ state: 'value', error: null, catalog: { databaseCount: 16, currentKeys: '760', keyspace: [{ db: 0, keys: '760' }, { db: 2, keys: '9007199254740993' }] } })
    expect(f.calls.map(c => [c.command, c.args])).toEqual([['DBSIZE', []], ['INFO', ['keyspace']], ['CONFIG', ['GET', 'databases']]])
    expect(new Set(f.calls.map(c => c.deadline)).size).toBe(1)
  })
  it('does not invent a count or database limit when ACL or disabled commands hide metadata', async () => {
    const f = await setup(); f.reply.mockRejectedValue(new RedisReplyError('NOPERM secret-user'))
    expect(await f.reader.read('a', f.request, signal())).toMatchObject({ state: 'value', catalog: { databaseCount: null, keyspace: null, currentKeys: null } })
    f.reply.mockRejectedValue(new RedisReplyError('ERR unknown command private'))
    expect(JSON.stringify(await f.reader.read('a', f.request, signal()))).not.toContain('private')
    expect(f.connections.status('a').state).toBe('connected')
  })
  it('keeps visible counts when only CONFIG is forbidden', async () => {
    const f = await setup(); f.reply.mockImplementation(async command => { if (command === 'CONFIG') throw new RedisReplyError('NOPERM config'); return command === 'DBSIZE' ? 0n : Buffer.from('# Keyspace\r\n') })
    expect(await f.reader.read('a', f.request, signal())).toMatchObject({ state: 'value', catalog: { databaseCount: null, currentKeys: '0', keyspace: [] } })
  })
  it('refuses malformed, duplicate, excessive and noninteger keyspace data', async () => {
    expect(parseDatabaseKeyspace('db2:keys=0,expires=0\ndb0:keys=3,expires=0')).toEqual([{ db: 0, keys: '3' }, { db: 2, keys: '0' }])
    for (const text of ['db0:expires=0', 'db0:keys=1,keys=2', 'db0:keys=1\ndb0:keys=2', 'db65536:keys=1', 'db0:keys=01', 'db0:keys=-1', 'db0:keys=9223372036854775808']) expect(() => parseDatabaseKeyspace(text)).toThrow()
    const f = await setup(); f.reply.mockResolvedValueOnce(760n).mockResolvedValueOnce(Buffer.alloc(MAX_INFO_BYTES + 1))
    expect(await f.reader.read('a', f.request, signal())).toMatchObject({ state: 'failed', error: 'oversize', catalog: null })
    f.reply.mockResolvedValueOnce(760n).mockResolvedValueOnce(Buffer.from([255]))
    expect(await f.reader.read('a', f.request, signal())).toMatchObject({ error: 'protocol' })
  })
  it('rejects unexpected CONFIG shapes and never treats network failure as unknown metadata', async () => {
    const f = await setup()
    for (const config of [[], [Buffer.from('maxmemory'), Buffer.from('16')], [Buffer.from('databases'), Buffer.from('0')], [Buffer.from('databases'), Buffer.from('65537')]]) {
      f.reply.mockResolvedValueOnce(760n).mockResolvedValueOnce(Buffer.from('')).mockResolvedValueOnce(config)
      expect(await f.reader.read('a', f.request, signal())).toMatchObject({ state: 'failed', error: 'protocol' })
    }
    f.reply.mockRejectedValue(new Error('private network details'))
    expect(await f.reader.read('a', f.request, signal())).toMatchObject({ state: 'failed', error: 'network', catalog: null })
  })
  it('drops foreign owners, wrong DBs, replaced generations and cancelled requests', async () => {
    const f = await setup()
    expect(await f.reader.read('other', f.request, signal())).toMatchObject({ error: 'stale' })
    expect(await f.reader.read('a', { target: { ...f.request.target, db: 1 } }, signal())).toMatchObject({ error: 'stale' })
    const caller = new AbortController(); caller.abort()
    expect(await f.reader.read('a', f.request, caller.signal)).toMatchObject({ error: 'cancelled' }); expect(f.calls).toHaveLength(0)
    f.reply.mockImplementationOnce(async () => { await f.connections.connect('a', settings, signal()); return 760n })
    expect(await f.reader.read('a', f.request, signal())).toMatchObject({ error: 'stale', catalog: null })
  })
  it('has one absolute ten-second budget for all metadata', async () => {
    const f = await setup(); vi.useFakeTimers()
    f.reply.mockImplementation(async (_command, _args, caller) => new Promise<never>((_resolve, reject) => caller.addEventListener('abort', () => reject(new Error('aborted')), { once: true })))
    const pending = f.reader.read('a', f.request, signal()); await vi.advanceTimersByTimeAsync(10001)
    expect(await pending).toMatchObject({ error: 'timeout', catalog: null })
  })
  it('enforces identical strict request and result DTOs on both RPC faces', async () => {
    const f = await setup(), descriptor = redisHostDescriptors.find(d => d.method === 'readDatabases'), input = descriptor?.parameters.find(p => p.name === 'request')?.codec
    if (input?.mode !== 'strict' || descriptor?.result.mode !== 'strict') throw new Error('Missing codecs')
    for (const schema of [input.create(), databasesReadRequestSchema]) {
      expect(schema.parse(f.request)).toEqual(f.request)
      for (const extra of [{ command: 'FLUSHDB' }, { sessionId: 'other' }, { section: '*' }]) expect(() => schema.parse({ ...f.request, ...extra })).toThrow()
    }
    const result = await f.reader.read('a', f.request, signal())
    for (const schema of [descriptor.result.create(), databasesReadResultSchema]) {
      expect(schema.parse(result)).toEqual(result)
      for (const extra of [{ catalog: {} }, { catalog: { ...result.catalog, currentKeys: 760 } }, { catalog: { ...result.catalog, keyspace: [{ db: 0, keys: '1' }, { db: 0, keys: '2' }] } }, { catalog: null }, { error: 'permission' }, { state: 'failed' }, { password: 'secret' }]) expect(() => schema.parse({ ...result, ...extra })).toThrow()
    }
  })
})
