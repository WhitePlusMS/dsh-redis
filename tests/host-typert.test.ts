import { describe, expect, it } from 'vitest'
import { redisHostDescriptors } from '../src/typert.host.ts'
import { connectionRequestSchema, connectionViewSchema, emptyRequestSchema, redisDescriptors, statusSchema, saveProfileSchema, profileCollectionSchema } from '../src/typert.shared.ts'
import { DSH_VERSION, PROTOCOL_VERSION } from '../src/domain.ts'

const valid = { state: 'ready', readOnly: true, hostVersion: DSH_VERSION, protocolVersion: PROTOCOL_VERSION }

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
    expect(redisDescriptors.map(value => value.method)).toEqual(['status', 'connect', 'disconnect', 'connectionStatus', 'listProfiles', 'saveProfile', 'removeProfile', 'selectDatabase', 'scanKeys', 'readString', 'scanHash', 'readList', 'scanSet', 'readZSet', 'readStream', 'readDatabases'])
    expect(redisDescriptors[0].parameters[0]).toMatchObject({ source: 'lookup', lookup: 'agent', wire: 'agentId' })
    expect(redisDescriptors[0].cancellation).toEqual({ parameter: 'signal' })
  })
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
      for (const invalid of [{ ...valid, host: 'redis://user:secret@host' }, { ...valid, port: 0 }, { ...valid, port: 1.5 }, { ...valid, password: 'x'.repeat(4097) }, { ...valid, command: 'SET x y' }, { ...valid, tls: true }]) {
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
