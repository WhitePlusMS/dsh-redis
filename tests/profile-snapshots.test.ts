import { afterEach, describe, expect, it, vi } from 'vitest'
import type { SavedConnection } from '../src/domain.ts'
import { RedisProfileSnapshots } from '../src/host/profile-snapshots.ts'

const profile: SavedConnection = { id: 'fixture-id', name: 'Fixture', group: 'Synthetic', settings: { host: 'private.fixture', port: 6379, username: 'private-user', tls: { caPem: 'private-fixture-ca' } } }
afterEach(() => vi.useRealTimers())

describe('session-bound profile snapshots', () => {
  it('issues random opaque references bound to one session and profile without sharing mutable settings', () => {
    const store = new RedisProfileSnapshots()
    try {
      const original = structuredClone(profile), first = store.issue('a', original)
      const other = store.issue('b', original)
      if (first === null || other === null) throw new Error('Missing fixture token')
      expect(first).not.toBe(other)
      expect(first).not.toContain('private')
      expect(store.resolve('b', original.id, first)).toBeUndefined()
      expect(store.resolve('a', 'wrong-id', first)).toBeUndefined()
      Reflect.set(original.settings, 'host', 'changed.fixture')
      const resolved = store.resolve('a', profile.id, first)
      expect(resolved).toEqual(profile)
      if (resolved === undefined) throw new Error('Missing fixture profile')
      Reflect.set(resolved.settings, 'username', 'changed-user')
      expect(store.resolve('a', profile.id, first)).toEqual(profile)
      const second = store.issue('a', profile)
      expect(second).not.toBe(first)
      expect(store.resolve('a', profile.id, first)).toBeUndefined()
      expect(store.resolve('b', profile.id, other)).toEqual(profile)
    } finally { store.dispose() }
  })

  it('rejects password fields and does not echo their content', () => {
    const store = new RedisProfileSnapshots(), password = 'never-store-fixture-password'
    const invalid = { ...profile, settings: { ...profile.settings, password } }
    try {
      let caught: unknown
      try { store.issue('a', invalid) } catch (error) { caught = error }
      expect(caught).toBeInstanceOf(Error)
      expect(String(caught)).not.toContain(password)
    } finally { store.dispose() }
  })

  it('commits staged references only with delivery, without a concurrent rollback invalidating another stage', () => {
    const store = new RedisProfileSnapshots()
    try {
      const cancelled = store.prepare('a', [profile])
      const other = store.prepare('a', [{ ...profile, id: 'other' }])
      cancelled.rollback()
      other.commit()
      const otherToken = other.tokens[0]
      if (otherToken === null || otherToken === undefined) throw new Error('Missing fixture token')
      expect(store.resolve('a', 'other', otherToken)?.id).toBe('other')
      const first = store.issue('a', profile)
      if (first === null) throw new Error('Missing fixture token')
      const rejected = store.prepare('a', [profile])
      rejected.rollback()
      expect(store.resolve('a', profile.id, first)).toEqual(profile)
      const disposed = store.prepare('a', [profile])
      store.disposeSession('a')
      store.issue('a', profile)
      expect(() => disposed.commit()).toThrow('stale')
      disposed.rollback()
    } finally { store.dispose() }
  })

  it('expires and removes session data using one timer, including explicit disposal', () => {
    vi.useFakeTimers()
    const store = new RedisProfileSnapshots()
    const first = store.issue('a', profile), second = store.issue('b', profile)
    if (first === null || second === null) throw new Error('Missing fixture token')
    expect(vi.getTimerCount()).toBe(1)
    store.disposeSession('a')
    expect(store.resolve('a', profile.id, first)).toBeUndefined()
    expect(store.resolve('b', profile.id, second)).toEqual(profile)
    vi.advanceTimersByTime(5 * 60 * 1000)
    expect(vi.getTimerCount()).toBe(0)
    expect(store.resolve('b', profile.id, second)).toBeUndefined()
    store.issue('b', profile)
    store.dispose()
    expect(vi.getTimerCount()).toBe(0)
    expect(() => store.issue('a', profile)).toThrow('disposed')
  })

  it('bounds each session and the complete store without evicting other sessions', () => {
    const store = new RedisProfileSnapshots()
    try {
      const first = store.issue('s0', { ...profile, id: 'p0' })
      for (let session = 0; session < 5; session++) for (let index = session === 0 ? 1 : 0; index < 50; index++) expect(store.issue(`s${session}`, { ...profile, id: `p${index}` })).not.toBeNull()
      expect(store.issue('s0', { ...profile, id: 'extra' })).toBeNull()
      expect(store.issue('overflow', profile)).toBeNull()
      if (first === null) throw new Error('Missing fixture token')
      expect(store.resolve('s0', 'p0', first)?.id).toBe('p0')
      store.disposeSession('s1')
      expect(store.issue('overflow', profile)).not.toBeNull()
    } finally { store.dispose() }
  })

  it('reserves the final global slot across sessions and releases it on rollback or disposal', () => {
    const store = new RedisProfileSnapshots()
    try {
      let retained: string | null = null
      for (let session = 0; session < 5; session++) for (let index = 0; index < (session === 4 ? 49 : 50); index++) {
        const token = store.issue(`s${session}`, { ...profile, id: `p${index}` })
        if (session === 0 && index === 0) retained = token
      }
      const first = store.prepare('new-a', [profile]), full = store.prepare('new-b', [profile])
      expect(first.tokens[0]).toEqual(expect.any(String))
      expect(full.tokens).toEqual([null])
      first.commit(); expect(() => full.commit()).not.toThrow()
      if (retained === null) throw new Error('Missing retained token')
      expect(store.resolve('s0', 'p0', retained)?.id).toBe('p0')
      store.disposeSession('new-a')
      const rollback = store.prepare('new-c', [profile])
      expect(rollback.tokens[0]).toEqual(expect.any(String))
      rollback.rollback()
      const disposed = store.prepare('new-d', [profile])
      expect(disposed.tokens[0]).toEqual(expect.any(String))
      store.disposeSession('new-d')
      expect(() => disposed.commit()).toThrow('stale')
      disposed.rollback()
      const next = store.prepare('new-e', [profile])
      expect(next.tokens[0]).toEqual(expect.any(String))
      next.commit()
      expect(store.resolve('s0', 'p0', retained)?.id).toBe('p0')
    } finally { store.dispose() }
  })

  it('reserves the final session slot even for concurrent requests for the same profile', () => {
    const store = new RedisProfileSnapshots()
    try {
      for (let index = 0; index < 49; index++) expect(store.issue('a', { ...profile, id: `p${index}` })).not.toBeNull()
      const first = store.prepare('a', [profile]), full = store.prepare('a', [profile])
      expect(first.tokens[0]).toEqual(expect.any(String))
      expect(full.tokens).toEqual([null])
      first.commit()
      expect(() => full.commit()).not.toThrow()
      expect(store.resolve('a', profile.id, first.tokens[0]!)?.id).toBe(profile.id)
    } finally { store.dispose() }
  })

  it('expires an abandoned reservation without expiring newer committed tokens', () => {
    vi.useFakeTimers()
    const store = new RedisProfileSnapshots()
    try {
      const abandoned = store.prepare('waiting', [profile])
      vi.advanceTimersByTime(1000)
      let retained: string | null = null
      for (let session = 0; session < 5; session++) for (let index = 0; index < (session === 4 ? 49 : 50); index++) {
        const token = store.issue(`s${session}`, { ...profile, id: `p${index}` })
        if (session === 0 && index === 0) retained = token
      }
      expect(store.prepare('full', [profile]).tokens).toEqual([null])
      vi.advanceTimersByTime(5 * 60 * 1000 - 1000)
      expect(() => abandoned.commit()).toThrow('stale')
      abandoned.rollback()
      const available = store.prepare('next', [profile])
      expect(available.tokens[0]).toEqual(expect.any(String))
      available.commit()
      if (retained === null) throw new Error('Missing retained token')
      expect(store.resolve('s0', 'p0', retained)?.id).toBe('p0')
    } finally { store.dispose() }
  })
})
