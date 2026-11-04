import { describe, expect, it } from 'vitest'
import { redisHostDescriptors } from '../src/typert.host.ts'
import { aiBudgetResumeSchema, aiBudgetStatusSchema, connectionRequestSchema, connectionViewSchema, emptyRequestSchema, redisDescriptors, statusSchema, saveProfileSchema, profileCollectionSchema } from '../src/typert.shared.ts'
import { DSH_VERSION, PROTOCOL_VERSION } from '../src/domain.ts'
import { setSelectionRequestSchema, selectionAckSchema } from '../src/typert.shared.ts'
import { uiActionAckSchema, uiChannelInputSchema, uiChannelMessageSchema } from '../src/typert.shared.ts'

const valid = { state: 'ready', readOnly: true, hostVersion: DSH_VERSION, protocolVersion: PROTOCOL_VERSION }

it('uses a scoped, cancellable stream with strict action and acknowledgement frames', () => {
  const id = '12345678-1234-1234-1234-123456789abc'
  const request = { requestId: id, action: { kind: 'show' }, target: null, selectionRevision: 0, expiresAt: 123 }
  const message = { kind: 'action', request }, cancel = { kind: 'cancel', requestId: id }
  const ack = { requestId: id, target: null, selectionRevision: 0, outcome: 'applied' }
  for (const descriptor of [redisHostDescriptors.find(value => value.method === 'openUiChannel'), redisDescriptors.find(value => value.method === 'openUiChannel')]) {
    if (descriptor?.mode !== 'stream' || descriptor.result.mode !== 'strict' || descriptor.uplink?.codec.mode !== 'strict') throw new Error('Missing strict UI stream')
    const uplink = descriptor.uplink.codec, result = descriptor.result
    expect(descriptor.parameters[0]).toMatchObject({ source: 'lookup', lookup: 'agent', wire: 'agentId' })
    expect(descriptor.cancellation).toEqual({ parameter: 'signal' })
    expect(result.create().parse(message)).toEqual(message)
    expect(result.create().parse(cancel)).toEqual(cancel)
    expect(uplink.create().parse(ack)).toEqual(ack)
    expect(uplink.create().parse({ ...ack, outcome: 'ambiguous' })).toEqual({ ...ack, outcome: 'ambiguous' })
    expect(() => result.create().parse({ ...message, secret: 'private' })).toThrow()
    expect(() => uplink.create().parse({ ...ack, outcome: 'unexpected' })).toThrow()
  }
  expect(() => uiChannelMessageSchema.parse({ kind: 'action', request: { ...request, action: { kind: 'delete' } } })).toThrow()
  expect(() => uiActionAckSchema.parse({ ...ack, sessionId: 'other' })).toThrow()
})

it('decodes selection identities strictly on both Host and browser faces', () => {
  const target = { id: 'test', generation: 1, db: 0 }, keyBase64 = 'aw=='
  const selection = { keyBase64, item: { kind: 'stream', id: '1-0', fieldIndex: 1, fieldBase64: '' } }
  for (const schema of [setSelectionRequestSchema]) {
    expect(schema.parse({ target, selection })).toEqual({ target, selection })
    expect(schema.parse({ target, selection: null })).toEqual({ target, selection: null })
    for (const item of [{ kind: 'hash', fieldBase64: '%bad' }, { kind: 'list', index: '-1' }, { kind: 'stream', id: '0-0', fieldIndex: 0, fieldBase64: '' }, { kind: 'stream', id: '1-0', fieldIndex: 4096, fieldBase64: '' }, { kind: 'set', memberBase64: '', value: 'not-identity' }]) expect(() => schema.parse({ target, selection: { keyBase64, item } })).toThrow()
    expect(() => schema.parse({ target, selection, sessionId: 'other' })).toThrow()
  }
  const requestId = '12345678-1234-1234-1234-123456789abc'
  const frame = { kind: 'publishSelection', requestId, revision: 1, request: { target, selection } }
  for (const descriptor of [redisHostDescriptors.find(value => value.method === 'openUiChannel'), redisDescriptors.find(value => value.method === 'openUiChannel')]) {
    if (descriptor?.uplink?.codec.mode !== 'strict') throw new Error('Missing selection uplink')
    const codec = descriptor.uplink.codec
    expect(codec.create().parse(frame)).toEqual(frame)
    expect(() => codec.create().parse({ ...frame, extra: true })).toThrow()
  }
  expect(uiChannelInputSchema.parse(frame)).toEqual(frame)
  expect(selectionAckSchema.parse({ accepted: true })).toEqual({ accepted: true })
  expect(() => selectionAckSchema.parse({ accepted: 'true' })).toThrow()
})

describe('strict rc.2 sidebar protocol', () => {
  it('rejects extra request fields on both faces, including hidden command text', () => {
    const descriptor = redisHostDescriptors[0]
    const request = descriptor.parameters.find(parameter => parameter.name === 'request')
    if (request === undefined || request.codec.mode !== 'strict') throw new Error('Missing request codec')
    const schema = request.codec.create()
    expect(schema.parse({})).toEqual({})
    expect(() => schema.parse({ command: 'SET x y' })).toThrow()
    expect(() => emptyRequestSchema.parse({ command: 'SET x y' })).toThrow()
    expect(() => emptyRequestSchema.parse([])).toThrow()
  })
  it('rejects the wrong baseline, missing fields and unexpected response fields', () => {
    const result = redisHostDescriptors[0].result
    if (result.mode !== 'strict') throw new Error('Expected strict result codec')
    const host = result.create()
    for (const schema of [host, statusSchema]) {
      expect(schema.parse(valid)).toEqual(valid)
      expect(() => schema.parse({ ...valid, hostVersion: '0.2.1-alpha.4' })).toThrow()
      expect(() => schema.parse({ ...valid, readOnly: false })).toThrow()
      expect(() => schema.parse({ ...valid, password: 'must not appear' })).toThrow()
      expect(() => schema.parse({ state: 'ready' })).toThrow()
    }
  })
  it('keeps matching endpoints and trusted Agent lookup, without command or write methods', () => {
    expect(redisDescriptors.map(value => value.id)).toEqual(redisHostDescriptors.map(value => value.id))
    expect(redisDescriptors.map(value => value.method)).toEqual(['status', 'connect', 'disconnect', 'connectionStatus', 'listProfiles', 'saveProfile', 'removeProfile', 'selectDatabase', 'scanKeys', 'readString', 'scanHash', 'readActionPoint', 'readList', 'scanSet', 'readZSet', 'readStream', 'readDatabases', 'aiBudgetStatus', 'resumeAiBudget', 'openUiChannel'])
    expect(redisDescriptors[0].parameters[0]).toMatchObject({ source: 'lookup', lookup: 'agent', wire: 'agentId' })
    expect(redisDescriptors[0].cancellation).toEqual({ parameter: 'signal' })
  })
})

it('validates budget requests and responses equally on both protocol faces', () => {
  const status = { callsUsed: 1, maxCalls: 32, bytesUsed: 10, maxBytes: 1048576, inFlight: 0, stopped: false }
  for (const method of ['aiBudgetStatus', 'resumeAiBudget'] as const) {
    const descriptor = redisHostDescriptors.find(value => value.method === method)
    const request = descriptor?.parameters.find(value => value.name === 'request')?.codec, result = descriptor?.result
    if (request?.mode !== 'strict' || result?.mode !== 'strict') throw new Error('Missing budget codec')
    expect(request.create().parse({})).toEqual({})
    expect(() => request.create().parse({ sessionId: 'other' })).toThrow()
    const valid = method === 'aiBudgetStatus' ? status : { accepted: true, status }
    const shared = method === 'aiBudgetStatus' ? aiBudgetStatusSchema : aiBudgetResumeSchema
    for (const codec of [result.create(), shared]) {
      expect(codec.parse(valid)).toEqual(valid)
      expect(() => codec.parse({ ...valid, secret: 'private' })).toThrow()
    }
  }
  expect(() => aiBudgetStatusSchema.parse({ ...status, callsUsed: 33 })).toThrow()
  expect(() => aiBudgetStatusSchema.parse({ ...status, inFlight: 2 })).toThrow()
})

describe('strict non-secret saved profile protocol', () => {
  it('rejects credentials and extra properties on both saved-settings request codecs', () => {
    const codec = redisHostDescriptors.find(value => value.method === 'saveProfile')?.parameters.find(value => value.name === 'request')?.codec
    if (codec?.mode !== 'strict') throw new Error('Missing profile codec')
    const settings = { host: 'localhost', port: 6379, username: 'reader', tls: { caPem: '' } }
    const valid = { id: null, name: 'Reader', settings }
    for (const schema of [codec.create(), saveProfileSchema]) {
      expect(schema.parse(valid)).toEqual(valid)
      expect(() => schema.parse({ ...valid, password: 'private' })).toThrow()
      expect(() => schema.parse({ ...valid, settings: { ...settings, password: 'private' } })).toThrow()
      expect(() => schema.parse({ ...valid, name: '   ' })).toThrow()
      expect(() => schema.parse({ ...valid, name: 'a'.repeat(81) })).toThrow()
    }
  })
  it('rejects secret fields, duplicate identities and unknown selected profiles in public lists', () => {
    const codec = redisHostDescriptors.find(value => value.method === 'listProfiles')?.result
    if (codec?.mode !== 'strict') throw new Error('Missing profile result codec')
    const saved = { id: 'one', name: 'Reader', settings: { host: 'localhost', port: 6379, username: '', tls: null } }
    for (const schema of [codec.create(), profileCollectionSchema]) {
      expect(schema.parse({ profiles: [saved], selectedId: 'one' })).toMatchObject({ selectedId: 'one' })
      expect(() => schema.parse({ profiles: [saved, saved], selectedId: null })).toThrow()
      expect(() => schema.parse({ profiles: [saved], selectedId: 'missing' })).toThrow()
      expect(() => schema.parse({ profiles: [{ ...saved, settings: { ...saved.settings, password: 'private' } }], selectedId: null })).toThrow()
    }
  })
})


describe('strict connection protocol', () => {
  it('accepts standalone credentials and rejects URI hosts, invalid ports and arbitrary commands', () => {
    const descriptor = redisHostDescriptors.find(value => value.method === 'connect')
    const codec = descriptor?.parameters.find(value => value.name === 'request')?.codec
    if (codec?.mode !== 'strict') throw new Error('Missing strict connect codec')
    const valid = { host: 'localhost', port: 6379, username: '', password: '', tls: null }
    for (const schema of [codec.create(), connectionRequestSchema]) {
      expect(schema.parse(valid)).toEqual(valid)
      expect(schema.parse({ ...valid, environment: '测试' })).toEqual({ ...valid, environment: '测试' })
      for (const invalid of [{ ...valid, host: 'redis://user:secret@host' }, { ...valid, port: 0 }, { ...valid, port: 1.5 }, { ...valid, password: 'x'.repeat(4097) }, { ...valid, command: 'SET x y' }, { ...valid, tls: true }, ...['', ' 测试 ', 'x'.repeat(81), 'a\nb', null].map(environment => ({ ...valid, environment }))]) {
        expect(() => schema.parse(invalid)).toThrow()
      }
    }
  })
  it('rejects any credentials added to public connection replies', () => {
    const codec = redisHostDescriptors.find(value => value.method === 'connect')?.result
    if (codec?.mode !== 'strict') throw new Error('Missing strict reply codec')
    const valid = { id: 'connection-id', generation: 1, db: 0, state: 'connected', error: null, target: { host: 'localhost', port: 6379, username: 'reader', tls: false } }
    for (const schema of [codec.create(), connectionViewSchema]) {
      expect(schema.parse(valid)).toEqual(valid)
      expect(schema.parse({ ...valid, target: { ...valid.target, environment: '测试' } })).toEqual({ ...valid, target: { ...valid.target, environment: '测试' } })
      expect(() => schema.parse({ ...valid, password: 'private' })).toThrow()
      expect(() => schema.parse({ ...valid, target: { ...valid.target, password: 'private' } })).toThrow()
    }
  })
  it('allows only a bounded CA PEM and never accepts a verification bypass or client key', () => {
    const codec = redisHostDescriptors.find(value => value.method === 'connect')?.parameters.find(value => value.name === 'request')?.codec
    if (codec?.mode !== 'strict') throw new Error('Missing strict connect codec')
    const valid = { host: 'localhost', port: 6379, username: '', password: '', tls: { caPem: '' } }
    for (const schema of [codec.create(), connectionRequestSchema]) {
      expect(schema.parse(valid)).toEqual(valid)
      for (const tls of [{ caPem: '', rejectUnauthorized: false }, { caPem: '', key: 'private-key' }, { caPem: '', caPath: 'C:/private/file' }, { caPem: 'x'.repeat(65537) }, {}, false]) {
        expect(() => schema.parse({ ...valid, tls })).toThrow()
      }
      const { tls: _tls, ...missing } = valid
      expect(() => schema.parse(missing)).toThrow()
    }
  })
})
