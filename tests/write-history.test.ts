import { afterEach, describe, expect, it, vi } from 'vitest'
import { RedisWriteHistory } from '../src/host/write-history.ts'

const id = (suffix: number) => '00000000-0000-4000-8000-' + String(suffix).padStart(12, '0')
const target = { id: 'fixture-connection', generation: 1, db: 0 }
const identity = { type: 'string' as const, keyBase64: 'aw==', fieldBase64: null }
const readbackAt = '2026-11-11T00:00:00.000Z'
afterEach(() => vi.useRealTimers())

describe('bounded write operation history', () => {
  it('isolates sessions, detaches returned data, and preserves final facts against late callbacks', () => {
    const history = new RedisWriteHistory()
    try {
      const inputTarget = { ...target, password: 'secret' }, inputIdentity = { ...identity, value: 'secret-value' }
      const operation = history.start('a', id(1), inputTarget, inputIdentity)
      expect(history.get('b', id(1))).toBeNull()
      const pending = history.get('a', id(1))
      expect(pending?.state).toBe('pending')
      if (pending === null) throw new Error('Missing record')
      Reflect.set(pending.target, 'db', 9)
      expect(history.get('a', id(1))?.target.db).toBe(0)
      operation.submitted()
      expect(history.get('a', id(1))?.state).toBe('submitting')
      operation.finish('written-verified', readbackAt)
      operation.finish('unknown')
      expect(history.get('a', id(1))?.state).toBe('written-verified')
      expect(history.get('a', id(1))?.readbackAt).toBe(readbackAt)
      expect(JSON.stringify(history.get('a', id(1)))).not.toContain('secret')
      expect(() => operation.submitted()).toThrow('不可提交')
    } finally { history.dispose() }
  })

  it('does not claim an unsent result after dispatch or a successful write without dispatch evidence', () => {
    const history = new RedisWriteHistory()
    try {
      const sent = history.start('a', id(1), target, identity)
      sent.submitted(); sent.finish('not-executed')
      expect(history.get('a', id(1))?.state).toBe('unknown')
      const unsent = history.start('a', id(2), target, identity)
      unsent.finish('written-verified')
      expect(history.get('a', id(2))?.state).toBe('unknown')
      const conflict = history.start('a', id(3), target, identity)
      conflict.finish('conflict')
      expect(history.get('a', id(3))?.state).toBe('conflict')
    } finally { history.dispose() }
  })

  it('expires completed records but does not discard in-flight operations', () => {
    vi.useFakeTimers()
    const history = new RedisWriteHistory()
    try {
      const pending = history.start('a', id(1), target, identity)
      const finished = history.start('a', id(2), target, identity)
      finished.finish('not-executed')
      vi.advanceTimersByTime(10 * 60 * 1000)
      expect(history.get('a', id(2))).toBeNull()
      expect(history.get('a', id(1))?.state).toBe('pending')
      pending.submitted(); pending.finish('unknown')
      expect(history.get('a', id(1))?.state).toBe('unknown')
      history.dispose()
      expect(vi.getTimerCount()).toBe(0)
    } finally { history.dispose() }
  })

  it('rejects duplicate and excess records without evicting active entries', () => {
    const history = new RedisWriteHistory()
    try {
      for (let index = 0; index < 16; index++) history.start('a', id(index), target, identity)
      expect(() => history.start('a', id(16), target, identity)).toThrow('容量')
      expect(() => history.start('b', id(0), target, identity)).toThrow('已存在')
      expect(history.get('a', id(0))?.state).toBe('pending')
    } finally { history.dispose() }
  })

  it('records the exact target identity and does not invent a missing readback timestamp', () => {
    const history = new RedisWriteHistory()
    try {
      const hash = { type: 'hash' as const, keyBase64: 'aw==', fieldBase64: 'Zg==' }
      const operation = history.start('a', id(1), target, hash)
      operation.submitted(); operation.finish('written-verified')
      expect(history.get('a', id(1))).toMatchObject({ identity: hash, state: 'written-unverified', readbackAt: null })
      expect(history.get('b', id(1))).toBeNull()
      expect(() => history.start('a', id(2), target, { ...hash, keyBase64: 'invalid!' })).toThrow('目标无效')
    } finally { history.dispose() }
  })
})
