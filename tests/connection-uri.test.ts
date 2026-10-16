import { describe, expect, it } from 'vitest'
import { MAX_URI_CHARACTERS, parseConnectionUri } from '../src/connection-uri.ts'

describe('ephemeral basic Redis URI input', () => {
  it('parses plain and TLS drafts, retaining the DB as a separate explicit selection', () => {
    expect(parseConnectionUri('redis://localhost')).toEqual({ request: { host: 'localhost', port: 6379, username: '', password: '', tls: null }, db: 0 })
    expect(parseConnectionUri(' rediss://reader:p%40ss%3Aw%2Brd@[::1]:6380/2 ')).toEqual({ request: { host: '::1', port: 6380, username: 'reader', password: 'p@ss:w+rd', tls: { caPem: '' } }, db: 2 })
    expect(parseConnectionUri('redis://%E8%AF%BB%E5%8F%96:%F0%9F%98%80@localhost/65535')?.request).toMatchObject({ username: '读取', password: '😀' })
    expect(parseConnectionUri('redis://:password-only@127.0.0.1/')?.request.username).toBe('')
  })
  it('returns only null for unsupported or malformed input without reflecting its credentials', () => {
    for (const text of ['http://:private@host', 'REDIS://:private@host', 'unix:///tmp/redis.sock', 'redis://:private@host?db=2', 'redis://:private@host#private', 'redis://:private@host/2/..', 'redis://:private@host/%30', 'redis://:private@host/-1', 'redis://:private@host/65536', 'redis://:private@host/not-a-db', 'redis://:bad%ZZ@host', 'redis://:private@', 'redis://::1', 'redis://host:0', 'redis://host:65536', 'redis://:private@host\n/0', 'redis://:private@ho st', 'redis://:private@host\\path', 'redis://\ud800@host']) {
      expect(parseConnectionUri(text)).toBeNull()
    }
    expect(parseConnectionUri('redis://host/' + '0'.repeat(MAX_URI_CHARACTERS))).toBeNull()
  })
  it('refuses credential lengths beyond the existing strict connection request', () => {
    expect(parseConnectionUri('redis://reader:' + 'x'.repeat(4097) + '@localhost')).toBeNull()
    expect(parseConnectionUri('redis://' + 'u'.repeat(257) + ':private@localhost')).toBeNull()
  })
})
