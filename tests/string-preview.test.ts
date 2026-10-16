import { afterEach, describe, expect, it, vi } from 'vitest'
import { RedisConnections, type RedisLink } from '../src/host/connection-service.ts'
import { RedisStrings } from '../src/host/string-reader.ts'
import { RedisReplyError } from '../src/host/resp.ts'
import type { StringReadRequest, StringReadResult } from '../src/domain.ts'
import { previewValue, formatJson } from '../src/client/value-preview.ts'
import { stringReadRequestSchema, stringReadResultSchema } from '../src/typert.shared.ts'
import { redisHostDescriptors } from '../src/typert.host.ts'

const signal = () => new AbortController().signal
const settings = { host: 'localhost', port: 6379, username: '', password: '', tls: null }
const binaryKey = Buffer.from([255, 0, 13])
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })

async function setup(value: Buffer, change?: (command: string) => void) {
  const commands: { command: string; deadline: number | undefined }[] = []
  const current = { type: 'string', value, ttl: -1n }
  const execute: RedisLink['execute'] = async (command, args, _signal, guard, deadline) => {
    guard(); commands.push({ command, deadline }); change?.(command)
    expect(args[0]).toEqual(binaryKey)
    if (command === 'TYPE') return current.type
    if (command === 'PTTL') return current.ttl
    if (command === 'STRLEN') {
      if (current.type !== 'string') throw new RedisReplyError('WRONGTYPE fixture')
      return BigInt(current.value.length)
    }
    if (command === 'GETRANGE') {
      const start = args[1], end = args[2]
      if (typeof start !== 'string' || typeof end !== 'string') throw new Error('Expected byte range')
      return current.value.subarray(Number(BigInt(start) > BigInt(current.value.length) ? BigInt(current.value.length) : BigInt(start)), Number(BigInt(end) + 1n > BigInt(current.value.length) ? BigInt(current.value.length) : BigInt(end) + 1n))
    }
    throw new Error('Unexpected or non-read command')
  }
  const connections = new RedisConnections(async () => ({ close: () => undefined, execute, onFailure: () => () => undefined }))
  const connection = await connections.connect('a', settings, signal())
  if (connection.id === null) throw new Error('Expected live target')
  const request: StringReadRequest = { target: { id: connection.id, generation: connection.generation, db: 0 }, keyBase64: binaryKey.toString('base64'), offset: '0', count: 65536 }
  return { connections, reader: new RedisStrings(connections), request, commands, current }
}

describe('bounded String reads', () => {
  it('uses a byte range with one shared operation deadline and exact binary key/TTL', async () => {
    const { connections, reader, request, commands, current } = await setup(Buffer.from('hello'))
    current.ttl = 9007199254740993n
    try {
      const result = await reader.read('a', request, signal())
      expect(result).toMatchObject({ state: 'value', metadata: { type: 'string', ttlMs: '9007199254740993', length: '5' }, base64: Buffer.from('hello').toString('base64'), byteLength: 5, complete: true, nextOffset: null })
      expect(commands.map(value => value.command)).toEqual(['TYPE', 'PTTL', 'STRLEN', 'GETRANGE', 'TYPE', 'STRLEN', 'PTTL'])
      expect(new Set(commands.map(value => value.deadline)).size).toBe(1)
      expect(commands[0]?.deadline).toBeGreaterThan(Date.now())
    } finally { connections.dispose() }
  })
  it('caps a large value, keeps exact window/context bytes and distinguishes EOF from empty values', async () => {
    const original = Buffer.alloc(4 * 1024 * 1024, 97)
    const { connections, reader, request, current } = await setup(original)
    try {
      const first = await reader.read('a', request, signal())
      expect(first).toMatchObject({ complete: false, byteLength: 65536, nextOffset: '65536' })
      expect(Buffer.from(first.suffix, 'base64')).toHaveLength(3)
      const second = await reader.read('a', { ...request, offset: '65536', count: 256 }, signal())
      expect(second).toMatchObject({ byteLength: 256, offset: '65536', nextOffset: '65792', complete: false })
      expect(Buffer.from(second.prefix, 'base64')).toHaveLength(3)
      const beyond = await reader.read('a', { ...request, offset: '9223372036854775807' }, signal())
      expect(beyond).toMatchObject({ state: 'value', byteLength: 0, nextOffset: null, complete: false })
      current.value = Buffer.alloc(0)
      expect(await reader.read('a', request, signal())).toMatchObject({ state: 'value', byteLength: 0, complete: true, metadata: { length: '0' } })
    } finally { connections.dispose() }
  })
  it('separates missing, expired and other types without issuing GETRANGE for them', async () => {
    for (const state of ['none', 'hash', 'expired']) {
      const { connections, reader, request, current, commands } = await setup(Buffer.from('value'))
      current.type = state === 'expired' ? 'string' : state; if (state === 'expired') current.ttl = -2n
      try {
        const result = await reader.read('a', request, signal())
        expect(result.state).toBe(state === 'hash' ? 'unsupported' : 'missing')
        expect(result.base64).toBe(''); expect(commands.some(value => value.command === 'GETRANGE')).toBe(false)
      } finally { connections.dispose() }
    }
  })
  it('discards bytes when the type/length changes during a range read', async () => {
    for (const mutation of ['type', 'length', 'missing']) {
      let types = 0
      const fixture = await setup(Buffer.from('value'), command => {
        if (command === 'TYPE' && ++types === 2) {
          if (mutation === 'length') fixture.current.value = Buffer.from('different length')
          else fixture.current.type = mutation === 'missing' ? 'none' : 'hash'
        }
      })
      try {
        const result = await fixture.reader.read('a', fixture.request, signal())
        expect(result).toMatchObject({ state: mutation === 'missing' ? 'missing' : 'changed', base64: '', metadata: null })
      } finally { fixture.connections.dispose() }
    }
  })
  it('maps wrong-type and denied commands to fixed non-data results', async () => {
    for (const message of ['WRONGTYPE private details', 'NOPERM private details']) {
      const fixture = await setup(Buffer.from('value'), command => { if (command === 'STRLEN') throw new RedisReplyError(message) })
      try {
        const result = await fixture.reader.read('a', fixture.request, signal())
        expect(result).toMatchObject({ state: message.startsWith('WRONGTYPE') ? 'changed' : 'failed', error: message.startsWith('WRONGTYPE') ? null : 'permission', base64: '' })
        expect(JSON.stringify(result)).not.toContain('private')
      } finally { fixture.connections.dispose() }
    }
  })
  it('does not dispatch a pre-cancelled request', async () => {
    const fixture = await setup(Buffer.from('value')), controller = new AbortController(); controller.abort()
    try {
      expect((await fixture.reader.read('a', fixture.request, controller.signal)).error).toBe('cancelled')
      expect(fixture.commands).toEqual([])
    } finally { fixture.connections.dispose() }
  })
  it('enforces a ten-second total operation budget even while a command is hanging', async () => {
    vi.useFakeTimers()
    const connections = new RedisConnections(async () => ({ close: () => undefined, onFailure: () => () => undefined,
      execute: async (_command, _args, requestSignal) => new Promise((_done, reject) => { requestSignal.addEventListener('abort', () => reject(new Error('aborted')), { once: true }) }),
    }))
    try {
      const view = await connections.connect('a', settings, signal()); if (view.id === null) throw new Error('Expected target')
      const read = new RedisStrings(connections).read('a', { target: { id: view.id, generation: view.generation, db: 0 }, keyBase64: '', offset: '0', count: 256 }, signal())
      await vi.advanceTimersByTimeAsync(10000)
      expect((await read).error).toBe('timeout')
    } finally { connections.dispose() }
  })
})

const window = (text: string) => ({ base64: Buffer.from(text).toString('base64'), prefix: '', suffix: '', offset: '0', complete: true })
describe('lossless byte previews', () => {
  it('completes every UTF-8 split with context and keeps Hex/Base64 exactly on the requested bytes', async () => {
    const raw = Buffer.from('A中😀Z'), fixture = await setup(raw)
    try {
      for (let offset = 0; offset < raw.length; offset++) {
        const result = await fixture.reader.read('a', { ...fixture.request, offset: String(offset), count: 1 }, signal())
        const preview = previewValue(result, 'text')
        expect(preview.error).toBeNull(); expect(preview.text).not.toContain('\ufffd')
        expect(preview.text.length).toBeGreaterThan(0)
        expect(previewValue(result, 'base64').text).toBe(raw.subarray(offset, offset + 1).toString('base64'))
      }
    } finally { fixture.connections.dispose() }
  })
  it('preserves invalid UTF-8 and BOM/control bytes without replacement', () => {
    const invalid = { ...window(''), base64: Buffer.from([255, 0, 13, 10]).toString('base64') }
    expect(previewValue(invalid, 'text').error).toBe('utf8')
    expect(previewValue(invalid, 'hex').text).toBe('00000000  FF 00 0D 0A')
    expect(previewValue(window('\ufeffhello'), 'text').text).toBe('\ufeffhello')
  })
  it('formats JSON without changing integers, exponents, signed zero, escapes or duplicate fields', () => {
    const source = '{"id":900719925474099312345,"huge":1e400,"zero":-0,"same":1,"same":2,"escape":"\\u0041\\n","array":[{},[]]}'
    const formatted = formatJson(source)
    for (const token of ['900719925474099312345', '1e400', '-0', '"\\u0041\\n"']) expect(formatted).toContain(token)
    expect(formatted.match(/"same"/gu)).toHaveLength(2)
    expect(formatted).toContain('\n')
    expect(previewValue({ ...window(source), complete: false }, 'json').error).toBe('partial-json')
    expect(previewValue(window('{bad'), 'json').error).toBe('json')
    expect(previewValue(window('['.repeat(65) + '0' + ']'.repeat(65)), 'json').error).toBe('limit')
  })
  it('decodes Base64 only when explicitly selected and reports invalid encoding/decoded bytes', () => {
    const text = '{"integer":9007199254740993}', encoded = Buffer.from(text).toString('base64')
    expect(previewValue(window(encoded), 'text').text).toBe(encoded)
    expect(previewValue(window(encoded), 'decode-json').text).toContain('9007199254740993')
    expect(previewValue(window('%%%'), 'decode-text').error).toBe('base64')
    expect(previewValue(window('/w=='), 'decode-text').error).toBe('utf8')
    expect(previewValue(window('AB=='), 'decode-text').error).toBe('base64')
  })
})

describe('strict String wire contract', () => {
  it('rejects invalid byte identities, unbounded ranges and command/owner injection on both faces', () => {
    const codec = redisHostDescriptors.find(value => value.method === 'readString')?.parameters.find(value => value.name === 'request')?.codec
    if (codec?.mode !== 'strict') throw new Error('Missing String request codec')
    const valid = { target: { id: 'connection', generation: 1, db: 0 }, keyBase64: '/wA=', offset: '0', count: 65536 }
    for (const schema of [codec.create(), stringReadRequestSchema]) {
      expect(schema.parse(valid)).toEqual(valid)
      for (const bad of [{ ...valid, offset: '9223372036854775808' }, { ...valid, offset: '1e5' }, { ...valid, offset: '-1' }, { ...valid, offset: 0 }, { ...valid, count: 65537 }, { ...valid, count: 0 }, { ...valid, keyBase64: 'AB==' }, { ...valid, command: 'GET key' }, { ...valid, sessionId: 'other' }]) expect(() => schema.parse(bad)).toThrow()
    }
  })
  it('rejects inconsistent lengths, complete flags and data in failed responses', () => {
    const codec = redisHostDescriptors.find(value => value.method === 'readString')?.result
    if (codec?.mode !== 'strict') throw new Error('Missing String result codec')
    const valid: StringReadResult = { state: 'value', error: null, metadata: { type: 'string', ttlMs: '-1', length: '1' }, offset: '0', base64: 'YQ==', byteLength: 1, prefix: '', suffix: '', complete: true, nextOffset: null, sampledAt: new Date().toISOString() }
    for (const schema of [codec.create(), stringReadResultSchema]) {
      expect(schema.parse(valid)).toEqual(valid)
      for (const bad of [{ ...valid, byteLength: 2 }, { ...valid, complete: false }, { ...valid, state: 'missing' }, { ...valid, state: 'failed', error: 'permission' }, { ...valid, nextOffset: '1' }, { ...valid, password: 'private' }]) expect(() => schema.parse(bad)).toThrow()
    }
  })
})
