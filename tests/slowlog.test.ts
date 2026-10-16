import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SlowLogReadRequest } from '../src/domain.ts'
import { RedisConnections, type RedisLink } from '../src/host/connection-service.ts'
import { RedisSlowLog } from '../src/host/slowlog-reader.ts'
import { RedisFrameError, RedisReplyError, type RedisReply } from '../src/host/resp.ts'
import { slowLogReadRequestSchema, slowLogReadResultSchema } from '../src/typert.shared.ts'
import { redisHostDescriptors } from '../src/typert.host.ts'
const signal = () => new AbortController().signal
const settings = { host: 'localhost', port: 6379, username: '', password: '', tls: null }
const owned: RedisConnections[] = []
beforeEach(() => { vi.spyOn(console, 'info').mockImplementation(() => undefined) })
afterEach(() => { for (const c of owned.splice(0)) c.dispose(); vi.useRealTimers(); vi.restoreAllMocks() })
const entry = (id = 12n): RedisReply[] => [id, 1792150000n, 9007199254740993n, [Buffer.from('AUTH'), Buffer.from('private-password'), Buffer.from([255, 0]), Buffer.alloc(200000, 97)], Buffer.from('private-address:1234'), Buffer.from('private-client-name')]
async function setup() {
  const reply = vi.fn<RedisLink['execute']>().mockResolvedValue([entry(12n), entry(11n), entry(10n)])
  const calls: { command: string; args: readonly (string | Buffer)[]; deadline: number | undefined }[] = []
  const execute: RedisLink['execute'] = async (command, args, caller, guard, deadline) => { guard(); calls.push({ command, args, deadline }); return reply(command, args, caller, guard, deadline) }
  const connections = new RedisConnections(async () => ({ execute, close: () => undefined, onFailure: () => () => undefined })); owned.push(connections)
  const view = await connections.connect('a', settings, signal()); if (view.id === null) throw new Error('Missing target')
  const request: SlowLogReadRequest = { target: { id: view.id, generation: view.generation, db: 0 }, count: 2 }
  return { reply, calls, connections, request, reader: new RedisSlowLog(connections) }
}
describe('bounded readonly SLOWLOG summaries', () => {
  it('uses only GET count+1 and returns exact integer metadata without argument bodies or client identities', async () => {
    const f = await setup(), result = await f.reader.read('a', f.request, signal())
    expect(f.calls).toEqual([{ command: 'SLOWLOG', args: ['GET', '3'], deadline: expect.any(Number) }])
    expect(result).toMatchObject({ state: 'page', error: null, count: 2, more: true, entries: [{ id: '12', timestampSeconds: '1792150000', durationUs: '9007199254740993', command: 'AUTH', loggedArgumentCount: 4, argumentBytes: [16, 2, 200000], originalArgumentCount: null }, { id: '11' }] })
    expect(JSON.stringify(result)).not.toContain('private'); expect(JSON.stringify(result).length).toBeLessThan(2000)
  })
  it('distinguishes empty/exact/latest slices and 4/6/7 field shapes without a command fallback', async () => {
    const f = await setup()
    f.reply.mockResolvedValue([]); expect(await f.reader.read('a', f.request, signal())).toMatchObject({ entries: [], state: 'page', more: false })
    for (const shape of [entry().slice(0, 4), entry(), [...entry(), 40n]]) {
      f.reply.mockResolvedValue([shape]); const result = await f.reader.read('a', f.request, signal())
      expect(result).toMatchObject({ state: 'page', more: false }); expect(result.entries[0]?.originalArgumentCount).toBe(shape.length === 7 ? '40' : null)
    }
    f.reply.mockResolvedValue([entry(1n), entry(0n)]); expect(await f.reader.read('a', f.request, signal())).toMatchObject({ more: false, entries: [{ id: '1' }, { id: '0' }] })
  })
  it('limits displayed parameter lengths to eight and never decodes an unsafe command token', async () => {
    const f = await setup(), row = entry()
    row[3] = [Buffer.from('MSET'), ...Array.from({ length: 20 }, (_, i) => Buffer.alloc(i))]; f.reply.mockResolvedValue([row])
    expect((await f.reader.read('a', f.request, signal())).entries[0]).toMatchObject({ loggedArgumentCount: 21, argumentBytes: [0, 1, 2, 3, 4, 5, 6, 7] })
    for (const name of [Buffer.from([255]), Buffer.from('private\nvalue'), Buffer.alloc(65, 97)]) {
      row[3] = [name]; f.reply.mockResolvedValue([row]); expect((await f.reader.read('a', f.request, signal())).entries[0]?.command).toBeNull()
    }
  })
  it('refuses malformed arrays, integers, duplicate/order ambiguity and too many entries/arguments', async () => {
    const f = await setup()
    const missing = entry(); missing[3] = []
    const badInteger = entry(); badInteger[2] = -1n
    const badTotal = [...entry(), 1n]
    for (const value of [null, Buffer.from('x'), [entry().slice(0, 5)], [missing], [badInteger], [badTotal], [entry(1n), entry(1n)], [entry(1n), entry(2n)], [entry(4n), entry(3n), entry(2n), entry(1n)]]) {
      f.reply.mockResolvedValue(value); expect(await f.reader.read('a', f.request, signal())).toMatchObject({ state: 'failed', error: 'protocol', entries: [], more: false })
    }
    const giant = entry(); giant[3] = Array.from({ length: 129 }, () => Buffer.from('x')); f.reply.mockResolvedValue([giant])
    expect(await f.reader.read('a', f.request, signal())).toMatchObject({ error: 'oversize', entries: [] })
    f.reply.mockRejectedValue(new RedisFrameError('oversize')); expect(await f.reader.read('a', f.request, signal())).toMatchObject({ error: 'oversize', entries: [] })
  })
  it('keeps permission, unavailable commands and empty success distinct with no raw errors', async () => {
    const f = await setup()
    f.reply.mockRejectedValue(new RedisReplyError('NOPERM private-user'))
    const denied = await f.reader.read('a', f.request, signal()); expect(denied).toMatchObject({ state: 'failed', error: 'permission', entries: [] }); expect(JSON.stringify(denied)).not.toContain('private')
    f.reply.mockRejectedValue(new RedisReplyError('ERR unknown command SLOWLOG private-user'))
    expect(await f.reader.read('a', f.request, signal())).toMatchObject({ state: 'unavailable', error: null, entries: [] }); expect(f.calls).toHaveLength(2)
  })
  it('rejects foreign/stale DB targets and drops late results after a newer connection while B survives', async () => {
    const f = await setup(); await f.connections.connect('b', settings, signal())
    expect(await f.reader.read('other', f.request, signal())).toMatchObject({ error: 'stale' })
    expect(await f.reader.read('a', { ...f.request, target: { ...f.request.target, db: 1 } }, signal())).toMatchObject({ error: 'stale' }); expect(f.calls).toHaveLength(0)
    f.reply.mockImplementationOnce(async () => { await f.connections.connect('a', settings, signal()); return [entry()] })
    expect(await f.reader.read('a', f.request, signal())).toMatchObject({ error: 'stale', entries: [] }); expect(f.connections.status('b').state).toBe('connected')
  })
  it('honors pre-cancel and one production ten-second read deadline', async () => {
    const f = await setup(), caller = new AbortController(); caller.abort()
    expect(await f.reader.read('a', f.request, caller.signal)).toMatchObject({ error: 'cancelled' }); expect(f.calls).toHaveLength(0)
    vi.useFakeTimers(); f.reply.mockImplementation(async (_c, _a, caller) => new Promise<never>((_resolve, reject) => caller.addEventListener('abort', () => reject(new Error('aborted')), { once: true })))
    const pending = f.reader.read('a', f.request, signal()); await vi.advanceTimersByTimeAsync(10001)
    expect(await pending).toMatchObject({ error: 'timeout', entries: [] })
  })
  it('keeps both RPC faces exact and rejects secrets, arbitrary commands, invalid counts and forged summaries', async () => {
    const f = await setup(), descriptor = redisHostDescriptors.find(d => d.method === 'readSlowLog'), input = descriptor?.parameters.find(p => p.name === 'request')?.codec
    if (input?.mode !== 'strict' || descriptor?.result.mode !== 'strict') throw new Error('Missing slowlog codecs')
    for (const schema of [input.create(), slowLogReadRequestSchema]) {
      expect(schema.parse(f.request)).toEqual(f.request)
      for (const extra of [{ count: 0 }, { count: 101 }, { count: 1.1 }, { count: -1 }, { command: 'RESET' }, { client: 'private' }, { sessionId: 'other' }]) expect(() => schema.parse({ ...f.request, ...extra })).toThrow()
    }
    const result = await f.reader.read('a', f.request, signal()), row = result.entries[0]
    if (row === undefined) throw new Error('Missing row')
    for (const schema of [descriptor.result.create(), slowLogReadResultSchema]) {
      expect(schema.parse(result)).toEqual(result)
      for (const extra of [{ more: false, count: 1 }, { error: 'permission' }, { state: 'unavailable' }, { entries: [{ ...row, durationUs: 1 }] }, { entries: [{ ...row, argumentBytes: [] }] }, { entries: [{ ...row, arguments: ['private'] }] }, { entries: [{ ...row, originalArgumentCount: '1' }] }, { entries: [{ ...row, clientAddress: 'private' }] }, { count: 0 }, { sampledAt: 'yesterday' }]) expect(() => schema.parse({ ...result, ...extra })).toThrow()
    }
  })
})
