import { expect, it } from 'vitest'
import { actionPointReadResultSchema, hashFieldReadRequestSchema } from '../src/typert.shared.ts'
import { ConnectionFailure, RedisConnections, type RedisLink } from '../src/host/connection-service.ts'
import { RedisSelectedReader } from '../src/host/selected-reader.ts'
import { encodeCommand, RedisReplyError, type RedisReply } from '../src/host/resp.ts'
import { RedisAiReader } from '../src/host/ai-reader.ts'

it('samples exact Hash fields and separates empty values, absence, type change and permissions', async () => {
  const commands: string[] = []
  const link: RedisLink = {
    close: () => undefined, onFailure: () => () => undefined,
    async execute(command, args, signal, guard): Promise<RedisReply> {
      signal.throwIfAborted(); guard(); commands.push(command)
      if (command === 'TYPE') return Buffer.isBuffer(args[0]) && args[0].toString() === 'changed' ? 'string' : 'hash'
      if (command === 'PTTL') return -1n
      if (command !== 'HGET' || !Buffer.isBuffer(args[1])) throw new Error('Unexpected synthetic command')
      if (args[1].toString() === 'denied') throw new RedisReplyError('NOPERM secret')
      if (args[1].toString() === 'missing') return null
      return Buffer.alloc(0)
    },
  }
  const connections = new RedisConnections(async () => link), signal = new AbortController().signal
  try {
    const connection = await connections.connect('fixture', { host: '127.0.0.1', port: 6379, username: '', password: '', tls: null }, signal)
    if (connection.id === null) throw new Error('Missing connection')
    const target = { id: connection.id, generation: connection.generation, db: 0 }, reader = new RedisSelectedReader(connections)
    const read = (key: string, field: string) => reader.read('fixture', target, Buffer.from(key).toString('base64'), { kind: 'hash', fieldBase64: Buffer.from(field).toString('base64') }, signal)
    expect(await read('key', '')).toMatchObject({ state: 'value', cell: { base64: '', byteLength: 0, fullByteLength: 0 } })
    expect(await read('key', 'missing')).toMatchObject({ state: 'selection-missing', cell: null })
    expect(await read('changed', 'field')).toMatchObject({ state: 'changed', cell: null })
    expect(await read('key', 'denied')).toMatchObject({ state: 'failed', error: 'permission' })
    expect(commands).not.toContain('HSCAN')
    expect(hashFieldReadRequestSchema.parse({ target, keyBase64: '', fieldBase64: '' }).fieldBase64).toBe('')
    expect(() => hashFieldReadRequestSchema.parse({ target, keyBase64: '', fieldBase64: 'eA=' })).toThrow()
    expect(() => hashFieldReadRequestSchema.parse({ target, keyBase64: '', fieldBase64: Buffer.alloc(65537).toString('base64') })).toThrow()
    expect(() => actionPointReadResultSchema.parse({ state: 'value', error: null, cell: null, sampledAt: new Date().toISOString() })).toThrow()
  } finally { connections.dispose() }
})

it('does not finish an in-flight field probe after the user changes selection', async () => {
  let release!: (reply: RedisReply) => void, started!: () => void
  const waiting = new Promise<RedisReply>(resolve => { release = resolve }), reading = new Promise<void>(resolve => { started = resolve })
  const link: RedisLink = { close: () => undefined, onFailure: () => () => undefined, async execute(command, _args, signal, guard) { signal.throwIfAborted(); guard(); if (command === 'HGET') { started(); return waiting } return command === 'TYPE' ? 'hash' : -1n } }
  const connections = new RedisConnections(async () => link), signal = new AbortController().signal
  let revision = 1
  const reader = new RedisAiReader(connections, () => undefined, async () => revision, (_session, expected) => revision === expected)
  try {
    const connection = await connections.connect('fixture', { host: '127.0.0.1', port: 6379, username: '', password: '', tls: null }, signal)
    if (connection.id === null) throw new Error('Missing connection')
    const target = { id: connection.id, generation: connection.generation, db: 0 }
    reader.setSelection('fixture', { target, selection: { keyBase64: 'aw==', item: null } })
    const operation = reader.prepareHashField('fixture', 'Zg==', signal)
    await reading; revision += 1; release(Buffer.from('value'))
    await expect(operation).rejects.toMatchObject({ code: 'stale' })
  } finally { release(Buffer.from('value')); reader.dispose(); connections.dispose() }
})

it.each(['oversize', 'network'] as const)('keeps the actual %s failure when the same connection fails during HGET', async code => {
  let failure: (code: 'oversize' | 'network') => void = () => undefined
  const link: RedisLink = {
    close: () => undefined,
    onFailure(listener) { failure = listener; return () => undefined },
    async execute(command, _args, signal, guard) {
      signal.throwIfAborted(); guard()
      if (command === 'TYPE') return 'hash'
      if (command === 'HGET') { failure(code); throw new ConnectionFailure(code) }
      throw new Error('Unexpected synthetic command')
    },
  }
  const connections = new RedisConnections(async () => link), signal = new AbortController().signal
  const reader = new RedisAiReader(connections, () => undefined, async () => 1, () => true)
  try {
    const connection = await connections.connect('fixture', { host: '127.0.0.1', port: 6379, username: '', password: '', tls: null }, signal)
    if (connection.id === null) throw new Error('Missing connection')
    const target = { id: connection.id, generation: connection.generation, db: 0 }
    reader.setSelection('fixture', { target, selection: { keyBase64: 'aw==', item: null } })
    expect((await reader.prepareHashField('fixture', 'Zg==', signal)).sample).toMatchObject({ state: 'failed', error: code })
  } finally { reader.dispose(); connections.dispose() }
})

it('reports oversize when the largest Key and field exceed the RESP request budget', async () => {
  const link: RedisLink = {
    close: () => undefined, onFailure: () => () => undefined,
    async execute(command, args, signal, guard) {
      signal.throwIfAborted(); guard(); encodeCommand([command, ...args])
      if (command === 'TYPE') return 'hash'
      throw new Error('The oversized HGET must not be sent')
    },
  }
  const connections = new RedisConnections(async () => link), signal = new AbortController().signal
  const reader = new RedisAiReader(connections, () => undefined, async () => 1, () => true)
  try {
    const connection = await connections.connect('fixture', { host: '127.0.0.1', port: 6379, username: '', password: '', tls: null }, signal)
    if (connection.id === null) throw new Error('Missing connection')
    const target = { id: connection.id, generation: connection.generation, db: 0 }, identity = Buffer.alloc(65536, 255).toString('base64')
    reader.setSelection('fixture', { target, selection: { keyBase64: identity, item: null } })
    expect((await reader.prepareHashField('fixture', identity, signal)).sample).toMatchObject({ state: 'failed', error: 'oversize' })
  } finally { reader.dispose(); connections.dispose() }
})

it('rejects the original selection if a connection is replaced during HGET', async () => {
  let release!: (reply: RedisReply) => void, started!: () => void
  const waiting = new Promise<RedisReply>(resolve => { release = resolve }), reading = new Promise<void>(resolve => { started = resolve })
  const link: RedisLink = { close: () => undefined, onFailure: () => () => undefined, async execute(command, _args, signal, guard) { signal.throwIfAborted(); guard(); if (command === 'HGET') { started(); return waiting } return command === 'TYPE' ? 'hash' : -1n } }
  const connections = new RedisConnections(async () => link), signal = new AbortController().signal
  const reader = new RedisAiReader(connections, () => undefined, async () => 1, () => true)
  const settings = { host: '127.0.0.1', port: 6379, username: '', password: '', tls: null }
  try {
    const connection = await connections.connect('fixture', settings, signal)
    if (connection.id === null) throw new Error('Missing connection')
    const target = { id: connection.id, generation: connection.generation, db: 0 }
    reader.setSelection('fixture', { target, selection: { keyBase64: 'aw==', item: null } })
    const operation = reader.prepareHashField('fixture', 'Zg==', signal)
    await reading; await connections.connect('fixture', settings, signal); release(Buffer.from('value'))
    await expect(operation).rejects.toMatchObject({ code: 'stale' })
  } finally { release(Buffer.from('value')); reader.dispose(); connections.dispose() }
})
