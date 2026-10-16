import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CLIENT_LIST_FIELDS, MAX_CLIENT_LIST_BYTES, type ClientListReadRequest } from '../src/domain.ts'
import { isClientListValue, parseClientList } from '../src/redis-client-list.ts'
import { RedisConnections, type RedisLink } from '../src/host/connection-service.ts'
import { RedisClientList } from '../src/host/client-list-reader.ts'
import { RedisFrameError, RedisReplyError } from '../src/host/resp.ts'
import { clientListReadRequestSchema, clientListReadResultSchema } from '../src/typert.shared.ts'
import { redisHostDescriptors } from '../src/typert.host.ts'
const signal = () => new AbortController().signal
const settings = { host: 'localhost', port: 6379, username: '', password: '', tls: null }
const owned: RedisConnections[] = []
beforeEach(() => { vi.spyOn(console, 'info').mockImplementation(() => undefined) })
afterEach(() => { for (const c of owned.splice(0)) c.dispose(); vi.useRealTimers(); vi.restoreAllMocks() })
const line = 'id=9007199254740993 addr=private-host:1234 name= user=default age=0 idle=2 flags=N db=0 cmd=client|list qbuf=0 omem=0 sub=0 psub=0 ssub=0'
async function setup() {
  const reply = vi.fn<RedisLink['execute']>().mockResolvedValue(Buffer.from(line + '\n'))
  const calls: { command: string; args: readonly (string | Buffer)[]; deadline: number | undefined }[] = []
  const execute: RedisLink['execute'] = async (command, args, caller, guard, deadline) => { guard(); calls.push({ command, args, deadline }); return reply(command, args, caller, guard, deadline) }
  const connections = new RedisConnections(async () => ({ execute, close: () => undefined, onFailure: () => () => undefined })); owned.push(connections)
  const view = await connections.connect('a', settings, signal()); if (view.id === null) throw new Error('Missing target')
  const request: ClientListReadRequest = { target: { id: view.id, generation: view.generation, db: 0 } }
  return { reply, calls, connections, request, reader: new RedisClientList(connections) }
}
describe('bounded CLIENT LIST snapshots', () => {
  it('uses exactly LIST and preserves fourteen selected fields, uint64 ID text, zero and an empty name without routine address logs', async () => {
    const f = await setup(), result = await f.reader.read('a', f.request, signal())
    expect(f.calls).toEqual([{ command: 'CLIENT', args: ['LIST'], deadline: expect.any(Number) }])
    expect(result).toMatchObject({ state: 'page', total: 1, limited: false, entries: [{ id: '9007199254740993', addr: 'private-host:1234', name: '', age: '0', cmd: 'client|list' }] })
    expect(Object.keys(result.entries[0] ?? {})).toEqual(CLIENT_LIST_FIELDS)
    expect(JSON.stringify(vi.mocked(console.info).mock.calls)).not.toContain('private-host')
  })
  it('keeps missing and empty fields distinct, ignores additions and refuses selected-field or displayed-ID ambiguity', () => {
    const parsed = parseClientList('name= user=开发 future=private future=ignored\r\n')
    expect(parsed.entries[0]).toMatchObject({ id: null, name: '', user: '开发', addr: null, ssub: null })
    expect(JSON.stringify(parsed)).not.toContain('future'); expect(parseClientList('name=a=b').entries[0]?.name).toBe('a=b')
    for (const text of ['id=1 id=2', 'id=bad id=1', 'id=1\nid=1']) expect(() => parseClientList(text)).toThrow()
    expect(parseClientList('name=a\nname=b').entries).toHaveLength(2)
  })
  it('reports the full bounded returned-record count while interpreting only the first 200 in server order', () => {
    const result = parseClientList(Array.from({ length: 205 }, (_, i) => 'id=' + String(i)).join('\n'))
    expect(result).toMatchObject({ total: 205, limited: true }); expect(result.entries).toHaveLength(200)
    expect(result.entries[0]?.id).toBe('0'); expect(result.entries[199]?.id).toBe('199')
    expect(parseClientList('\r\n')).toEqual({ entries: [], total: 0, limited: false })
  })
  it('bounds characters/UTF8 and uint64 metrics, reporting invalid selected values as null rather than zero', () => {
    for (const value of ['-1', '01', '1.1', '18446744073709551616', '']) expect(parseClientList('age=' + value).entries[0]?.age).toBeNull()
    expect(parseClientList('id=18446744073709551615').entries[0]?.id).toBe('18446744073709551615')
    expect(parseClientList('name=' + '字'.repeat(200)).entries[0]?.name).toBeNull()
    expect(isClientListValue('name', String.fromCharCode(0xd800))).toBe(false)
    expect(isClientListValue('addr', '')).toBe(false); expect(isClientListValue('name', '')).toBe(true)
    expect(() => parseClientList('x'.repeat(MAX_CLIENT_LIST_BYTES + 1))).toThrow()
    expect(() => parseClientList('字'.repeat(90000))).toThrow()
    expect(parseClientList('x'.repeat(MAX_CLIENT_LIST_BYTES)).total).toBe(1)
  })
  it('refuses bad UTF8/non-bulk/ambiguous results and distinguishes post-receive and RESP budget failures', async () => {
    const f = await setup()
    for (const value of [null, 'not-bulk', 1n, [], Buffer.from([255]), Buffer.from('id=1 id=2')]) {
      f.reply.mockResolvedValue(value); expect(await f.reader.read('a', f.request, signal())).toMatchObject({ state: 'failed', error: 'protocol', entries: [], total: 0, limited: false })
    }
    f.reply.mockResolvedValue(Buffer.alloc(MAX_CLIENT_LIST_BYTES + 1, 97)); expect(await f.reader.read('a', f.request, signal())).toMatchObject({ error: 'oversize', entries: [] })
    expect(f.connections.status('a').state).toBe('connected')
    f.reply.mockRejectedValue(new RedisFrameError('oversize')); expect(await f.reader.read('a', f.request, signal())).toMatchObject({ error: 'oversize', entries: [] })
  })
  it('separates real command permission/unavailability errors and successful empty data without raw messages', async () => {
    const f = await setup(); f.reply.mockRejectedValue(new RedisReplyError('NOPERM private-address'))
    const denied = await f.reader.read('a', f.request, signal()); expect(denied).toMatchObject({ state: 'failed', error: 'permission', total: 0 }); expect(JSON.stringify(denied)).not.toContain('private')
    f.reply.mockRejectedValue(new RedisReplyError('ERR unknown subcommand LIST private-address'))
    expect(await f.reader.read('a', f.request, signal())).toMatchObject({ state: 'unavailable', error: null, entries: [] })
    f.reply.mockResolvedValue(Buffer.alloc(0)); expect(await f.reader.read('a', f.request, signal())).toMatchObject({ state: 'page', error: null, entries: [], total: 0, limited: false })
  })
  it('rejects foreign/stale DB targets and discards late results while another owner remains usable', async () => {
    const f = await setup(); await f.connections.connect('b', settings, signal())
    expect(await f.reader.read('other', f.request, signal())).toMatchObject({ error: 'stale' })
    expect(await f.reader.read('a', { target: { ...f.request.target, db: 1 } }, signal())).toMatchObject({ error: 'stale' }); expect(f.calls).toHaveLength(0)
    f.reply.mockImplementationOnce(async () => { await f.connections.connect('a', settings, signal()); return Buffer.from(line) })
    expect(await f.reader.read('a', f.request, signal())).toMatchObject({ error: 'stale', entries: [] }); expect(f.connections.status('b').state).toBe('connected')
  })
  it('does not dispatch after pre-cancel and enforces the shared ten-second total deadline', async () => {
    const f = await setup(), caller = new AbortController(); caller.abort()
    expect(await f.reader.read('a', f.request, caller.signal)).toMatchObject({ error: 'cancelled' }); expect(f.calls).toHaveLength(0)
    vi.useFakeTimers(); f.reply.mockImplementation(async (_c, _a, caller) => new Promise<never>((_resolve, reject) => caller.addEventListener('abort', () => reject(new Error('aborted')), { once: true })))
    const pending = f.reader.read('a', f.request, signal()); await vi.advanceTimersByTimeAsync(10001)
    expect(await pending).toMatchObject({ error: 'timeout', entries: [] })
  })
  it('keeps both RPC faces strict about targets, field values, coverage and extra/secret properties', async () => {
    const f = await setup(), descriptor = redisHostDescriptors.find(d => d.method === 'readClients'), input = descriptor?.parameters.find(p => p.name === 'request')?.codec
    if (input?.mode !== 'strict' || descriptor?.result.mode !== 'strict') throw new Error('Missing client codecs')
    for (const schema of [input.create(), clientListReadRequestSchema]) {
      expect(schema.parse(f.request)).toEqual(f.request)
      for (const extra of [{ command: 'KILL' }, { type: 'normal' }, { clientId: '1' }, { sessionId: 'other' }, { target: { ...f.request.target, db: -1 } }]) expect(() => schema.parse({ ...f.request, ...extra })).toThrow()
    }
    const result = await f.reader.read('a', f.request, signal()), row = result.entries[0]
    if (row === undefined) throw new Error('Missing row')
    for (const schema of [descriptor.result.create(), clientListReadResultSchema]) {
      expect(schema.parse(result)).toEqual(result)
      for (const extra of [{ total: 0 }, { limited: true }, { error: 'permission' }, { state: 'unavailable' }, { entries: [{}] }, { entries: [{ ...row, id: 9007199254740992 }] }, { entries: [{ ...row, qbuf: '01' }] }, { entries: [{ ...row, password: 'secret' }] }, { entries: [row, row], total: 2 }, { sampledAt: 'yesterday' }]) expect(() => schema.parse({ ...result, ...extra })).toThrow()
    }
  })
})
