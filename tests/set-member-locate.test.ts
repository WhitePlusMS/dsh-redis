import * as NativeToolExecutor from '@deepseek-ai/dsh-tool-executor-native'
import { executeTool } from './tool-test-utils.ts'
import { Context } from '@deepseek-ai/cordis'
import type { Agent } from '@deepseek-ai/dsh-agent'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime from '@deepseek-ai/dsh-tools'
import { expect, it, vi } from 'vitest'
import type { UiAction, UiChannelInput } from '../src/domain.ts'
import { actionPointReadRequestSchema, actionPointReadResultSchema, setMemberReadRequestSchema } from '../src/typert.shared.ts'
import { redisHostDescriptors } from '../src/typert.host.ts'
import { ConnectionFailure, RedisConnections, type RedisLink } from '../src/host/connection-service.ts'
import { RedisSelectedReader } from '../src/host/selected-reader.ts'
import { encodeCommand, RedisReplyError, type RedisReply } from '../src/host/resp.ts'
import { RedisAiReader } from '../src/host/ai-reader.ts'
import { registerRedisLocateTool } from '../src/host/ai-locate-tool.ts'
import { openUiActionChannel } from '../src/host/ui-action-channel.ts'
import { UiActionCoordinator } from '../src/host/ui-action-coordinator.ts'
import { sampleActionPoint } from './action-point-fixture.ts'

const settings = { host: '127.0.0.1', port: 6379, username: '', password: '', tls: null }
const signal = () => new AbortController().signal
function uplink() {
  const queue: UiChannelInput[] = []
  let wake: (() => void) | undefined, ended = false
  const notify = () => { const next = wake; wake = undefined; next?.() }
  return {
    send(value: UiChannelInput) { queue.push(value); notify() },
    end() { ended = true; notify() },
    async *[Symbol.asyncIterator]() { while (!ended) { const value = queue.shift(); if (value !== undefined) { yield value; continue } await new Promise<void>(resolve => { wake = resolve; if (ended || queue.length > 0) notify() }) } },
  }
}

it('uses exact Set membership reads and validates both RPC faces', async () => {
  const commands: string[] = []
  const link: RedisLink = {
    close: () => undefined, onFailure: () => () => undefined,
    async execute(command, args, abort, guard): Promise<RedisReply> {
      abort.throwIfAborted(); guard(); commands.push(command); encodeCommand([command, ...args])
      if (command === 'TYPE') return Buffer.isBuffer(args[0]) && args[0].toString() === 'wrong' ? 'hash' : 'set'
      if (command === 'PTTL') return -1n
      if (command !== 'SISMEMBER' || !Buffer.isBuffer(args[1])) throw new Error('Unexpected synthetic command')
      if (args[1].toString() === 'denied') throw new RedisReplyError('NOPERM synthetic')
      if (args[1].toString() === 'malformed') return 2n
      return args[1].length === 0 || args[1].equals(Buffer.from([0, 255])) ? 1n : 0n
    },
  }
  const connections = new RedisConnections(async () => link)
  try {
    const connection = await connections.connect('a', settings, signal())
    if (connection.id === null) throw new Error('Missing connection')
    const target = { id: connection.id, generation: connection.generation, db: 0 }, reader = new RedisSelectedReader(connections)
    const read = (key: string, member: Buffer) => reader.read('a', target, Buffer.from(key).toString('base64'), { kind: 'set', memberBase64: member.toString('base64') }, signal())
    expect(await read('key', Buffer.alloc(0))).toMatchObject({ state: 'value' })
    expect(await read('key', Buffer.from([0, 255]))).toMatchObject({ state: 'value' })
    expect(await read('key', Buffer.from('missing'))).toMatchObject({ state: 'selection-missing' })
    expect(await read('wrong', Buffer.from('x'))).toMatchObject({ state: 'changed' })
    expect(await read('key', Buffer.from('denied'))).toMatchObject({ state: 'failed', error: 'permission' })
    expect(await read('key', Buffer.from('malformed'))).toMatchObject({ state: 'failed', error: 'protocol' })
    const large = Buffer.alloc(65536, 255).toString('base64')
    expect(await reader.read('a', target, large, { kind: 'set', memberBase64: large }, signal())).toMatchObject({ state: 'failed', error: 'oversize' })
    expect(commands).not.toContain('SSCAN')
    const descriptor = redisHostDescriptors.find(value => value.method === 'readActionPoint')
    const requestCodec = descriptor?.parameters.find(value => value.name === 'request')?.codec, resultCodec = descriptor?.result
    if (requestCodec?.mode !== 'strict' || resultCodec?.mode !== 'strict') throw new Error('Missing Set member codecs')
    expect(setMemberReadRequestSchema.parse({ target, keyBase64: '', memberBase64: '' })).toEqual({ target, keyBase64: '', memberBase64: '' })
    for (const memberBase64 of ['eA=', Buffer.alloc(65537).toString('base64')]) expect(() => setMemberReadRequestSchema.parse({ target, keyBase64: '', memberBase64 })).toThrow()
    const request = { requestId: '12345678-1234-1234-1234-123456789abc' }
    for (const schema of [requestCodec.create(), actionPointReadRequestSchema]) {
      expect(schema.parse(request)).toEqual(request)
      expect(() => schema.parse({ ...request, command: 'SREM' })).toThrow()
    }
    for (const schema of [resultCodec.create(), actionPointReadResultSchema]) {
      const result = { state: 'value', error: null, cell: { base64: '', byteLength: 0, fullByteLength: 0, suffix: '' }, score: null, streamMessage: null, sampledAt: new Date().toISOString() }
      expect(schema.parse(result)).toEqual(result)
      for (const score of ['-inf', '+inf', '1.2345678901234567e+20']) expect(schema.parse({ ...result, score })).toEqual({ ...result, score })
      expect(() => schema.parse({ ...result, score: 'NaN' })).toThrow()
      expect(() => schema.parse({ ...result, error: 'permission' })).toThrow()
      expect(() => schema.parse({ ...result, value: 'private' })).toThrow()
    }
  } finally { connections.dispose() }
})

it('commits a binary Set member only through the Host action handshake', async () => {
  const commands: string[] = []
  const link: RedisLink = {
    close: () => undefined, onFailure: () => () => undefined,
    async execute(command, args, abort, guard) {
      abort.throwIfAborted(); guard(); commands.push(command)
      if (command === 'TYPE') return 'set'
      if (command === 'PTTL') return -1n
      if (command === 'SISMEMBER' && Buffer.isBuffer(args[1])) return args[1].equals(Buffer.from([0, 255])) ? 1n : 0n
      throw new Error('Unexpected synthetic command')
    },
  }
  const connections = new RedisConnections(async () => link), actions = new UiActionCoordinator<UiAction>()
  const reader = new RedisAiReader(connections, session => actions.invalidateSession(session), async (session, target, expected, abort) => {
    const revision = actions.selectionRevision(session)
    if (revision === null || (expected !== null && revision !== expected)) throw new ConnectionFailure('stale')
    const current = () => actions.selectionRevision(session) === revision
    if (await actions.dispatch(session, { kind: 'confirmSelection' }, target, revision, current, abort) !== 'applied' || !current()) throw new ConnectionFailure('stale')
    return revision
  }, (session, revision) => { const current = actions.selectionRevision(session); return current !== null && (revision === null || current === revision) })
  const ctx = new Context(), abort = new AbortController(), input = uplink()
  vi.spyOn(console, 'info').mockImplementation(() => undefined)
  await ctx.plugin(SystemPrompt); await ctx.plugin(ToolRuntime); await ctx.plugin(NativeToolExecutor)
  await ctx.plugin({ name: 'set-locate-fixture', inject: ['tools'], apply: (scope: Context) => registerRedisLocateTool(scope, reader, actions) })
  const agent = { id: 'a', ctx, session: { id: 'a' } } as unknown as Agent
  const call = (args: unknown) => executeTool(ctx.tools, { callId: 'set-locate' as string, name: 'redis_viewer_locate_set_member', arguments: args, agent, signal: abort.signal })
  const content = (result: Awaited<ReturnType<typeof call>>) => result.content.filter(item => item.type === 'text').map(item => item.text).join('')
  const connection = await connections.connect('a', settings, abort.signal)
  if (connection.id === null) throw new Error('Missing fixture connection')
  const target = { id: connection.id, generation: connection.generation, db: 0 }
  reader.setSelection('a', { target, selection: { keyBase64: 'aw==', item: null } })
  const stream = openUiActionChannel(actions, 'a', abort.signal, input, (request, source) => source === 'action' ? reader.commitSelection('a', request) : reader.setSelection('a', request))
  let next = stream.next(), revision = 1
  const confirm = async () => {
    const frame = await next
    if (frame.done || frame.value.kind !== 'action' || frame.value.request.action.kind !== 'confirmSelection') throw new Error('Missing selection confirmation')
    input.send({ requestId: frame.value.request.requestId, target, selectionRevision: revision, outcome: 'applied' }); next = stream.next()
  }
  try {
    input.send({ kind: 'selection', revision, synchronized: true })
    await vi.waitFor(() => expect(actions.selectionRevision('a')).toBe(revision))
    const locate = call({ memberBase64: 'AP8=' })
    await confirm()
    const frame = await next
    if (frame.done || frame.value.kind !== 'action' || frame.value.request.action.kind !== 'selectSetMember') throw new Error('Missing Set action')
    expect(frame.value.request.action).toMatchObject({ keyBase64: 'aw==', member: { base64: 'AP8=' } })
    expect(await sampleActionPoint(connections, actions, 'a', frame.value.request.requestId, abort.signal)).toMatchObject({ state: 'value' })
    const id = frame.value.request.requestId
    next = stream.next(); input.send({ kind: 'commitSelection', requestId: id, revision, nextRevision: revision + 1 })
    expect(await next).toMatchObject({ value: { kind: 'selectionResult', accepted: true } })
    expect(actions.selectionRevision('a')).toBeNull()
    revision++; next = stream.next()
    input.send({ kind: 'publishSelection', requestId: '12345678-1234-1234-1234-123456789abc', actionRequestId: id, revision, request: { target, selection: { keyBase64: 'aw==', item: { kind: 'set', memberBase64: 'AP8=' } } } })
    expect(await next).toMatchObject({ value: { kind: 'selectionResult', accepted: true } })
    input.send({ kind: 'selection', revision, synchronized: true })
    const output = await locate
    expect(output.isError).toBeFalsy(); expect(content(output)).toContain('"outcome":"applied"')
    expect(reader.status('a')).toMatchObject({ currentSelection: { selection: { keyBase64: 'aw==', item: { kind: 'set', memberBase64: 'AP8=' } } } })
    for (const args of [{}, { member: 'x', memberBase64: 'eA==' }, { memberBase64: 'eA=' }, { member: 'x', command: 'SREM' }]) expect((await call(args)).isError).toBe(true)
    next = stream.next()
    const missing = call({ member: 'missing' })
    await confirm()
    expect(content(await missing)).toContain('采样时该 Set 成员不存在')
    expect(commands).toEqual(['TYPE', 'SISMEMBER', 'TYPE', 'PTTL', 'TYPE', 'SISMEMBER', 'TYPE', 'PTTL', 'TYPE', 'SISMEMBER', 'TYPE', 'PTTL'])
  } finally { abort.abort(); input.end(); await next; reader.dispose(); actions.dispose(); connections.dispose(); await ctx.fiber.dispose(); vi.restoreAllMocks() }
}, 15000)

it.each(['selection', 'connection'] as const)('rejects a pending membership probe after %s changes', async mode => {
  let release!: (reply: RedisReply) => void, started!: () => void
  const waiting = new Promise<RedisReply>(resolve => { release = resolve }), reading = new Promise<void>(resolve => { started = resolve })
  const link: RedisLink = {
    close: () => undefined, onFailure: () => () => undefined,
    async execute(command, _args, abort, guard) {
      abort.throwIfAborted(); guard()
      if (command === 'SISMEMBER') { started(); return waiting }
      return command === 'TYPE' ? 'set' : -1n
    },
  }
  const connections = new RedisConnections(async () => link)
  let revision = 1
  const reader = new RedisAiReader(connections, () => undefined, async () => revision, (_session, expected) => revision === expected)
  try {
    const connection = await connections.connect('a', settings, signal())
    if (connection.id === null) throw new Error('Missing connection')
    const target = { id: connection.id, generation: connection.generation, db: 0 }
    reader.setSelection('a', { target, selection: { keyBase64: 'aw==', item: null } })
    const operation = reader.prepareSetMember('a', 'AP8=', signal())
    await reading
    if (mode === 'selection') revision++
    else await connections.connect('a', settings, signal())
    release(1n)
    await expect(operation).rejects.toMatchObject({ code: 'stale' })
  } finally { release(1n); reader.dispose(); connections.dispose() }
})
