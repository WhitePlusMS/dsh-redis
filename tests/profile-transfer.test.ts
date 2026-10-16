import { describe, expect, it } from 'vitest'
import { MAX_PROFILE_DOCUMENT_BYTES } from '../src/domain.ts'
import { importProfilesSchema } from '../src/typert.shared.ts'
import { conflictingProfiles, createProfileDocument, parseProfileDocument, profileLabel, serializeProfileDocument } from '../src/profile-transfer.ts'

const portable = { name: '开发', group: '个人', settings: { host: 'localhost', port: 6379, username: 'reader', tls: true } }

describe('non-secret portable connection documents', () => {
  it('exports an explicit whitelist even when runtime objects contain unexpected credentials', () => {
    const saved = { id: 'local-runtime-identity', name: portable.name, group: portable.group, password: 'outer-private-marker', settings: { host: 'localhost', port: 6379, username: 'reader', password: 'inner-private-marker', tls: { caPem: 'certificate-private-marker' } } }
    expect(createProfileDocument([saved])).toEqual({ format: 'dsh-redis-connections', version: 1, profiles: [portable] })
    const text = serializeProfileDocument([saved])
    expect(parseProfileDocument(text).profiles).toEqual([portable])
    for (const forbidden of ['local-runtime-identity', 'private-marker', 'password', 'caPem', 'generation']) expect(text).not.toContain(forbidden)
  })
  it('refuses unknown formats and secret or identity fields at every document boundary', () => {
    const valid = { format: 'dsh-redis-connections', version: 1, profiles: [portable] }
    const invalidEntries = [{ ...portable, password: 'secret' }, { ...portable, id: 'foreign' }, { ...portable, uri: 'redis://:secret@localhost' }, { ...portable, settings: { ...portable.settings, password: 'secret' } }, { ...portable, settings: { ...portable.settings, caPem: 'secret' } }, { ...portable, settings: { ...portable.settings, tls: { caPem: 'secret' } } }, { ...portable, group: '' }, { ...portable, group: ' untrimmed' }]
    for (const entry of invalidEntries) {
      expect(() => parseProfileDocument(JSON.stringify({ ...valid, profiles: [entry] }))).toThrow('invalid document')
      expect(() => importProfilesSchema.parse({ profiles: [entry] })).toThrow()
    }
    for (const document of [{ ...valid, password: 'secret' }, { ...valid, version: 2 }, { ...valid, format: 'other' }, { ...valid, profiles: Array(51).fill(portable) }]) expect(() => parseProfileDocument(JSON.stringify(document))).toThrow('invalid document')
    expect(() => importProfilesSchema.parse({ profiles: [] })).toThrow()
    expect(() => importProfilesSchema.parse({ profiles: [portable], overwrite: true })).toThrow()
  })
  it('checks the UTF-8 byte ceiling before JSON parsing, not just JavaScript character count', () => {
    expect(() => parseProfileDocument(' '.repeat(MAX_PROFILE_DOCUMENT_BYTES + 1))).toThrow('limit')
    expect(() => parseProfileDocument('é'.repeat(MAX_PROFILE_DOCUMENT_BYTES / 2 + 1))).toThrow('limit')
    expect(parseProfileDocument('{"format":"dsh-redis-connections","version":1,"profiles":[]}').profiles).toEqual([])
    expect(() => parseProfileDocument('bad-json-with-private-marker')).toThrow('Redis profiles: invalid document')
  })
  it('detects existing and in-batch label conflicts without normalizing distinct groups or Unicode', () => {
    const current = [{ name: 'Reader' }, { name: 'x', group: 'a:b' }]
    expect([...conflictingProfiles(current, [{ name: 'Reader' }, { name: 'new' }, { name: 'new' }])]).toEqual([profileLabel({ name: 'Reader' }), profileLabel({ name: 'new' })])
    expect(conflictingProfiles(current, [{ name: 'Reader', group: 'dev' }, { name: 'reader' }, { name: 'b:x', group: 'a' }, { name: 'é' }, { name: 'e\u0301' }]).size).toBe(0)
  })
})
