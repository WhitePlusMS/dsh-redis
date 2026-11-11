import { afterEach, describe, expect, it, vi } from 'vitest'
import { RedisWriteProposals, type RedisWriteDraft } from '../src/host/write-proposals.ts'

const target = { id: 'connection-a', generation: 1, db: 0 }
const draft: RedisWriteDraft = { target, host: 'fixture', port: 6379, type: 'string', keyTtl: 'none', fieldTtl: null, keyBase64: 'aw==', fieldBase64: null, beforeBase64: 'b2xk', afterBase64: 'bmV3' }
afterEach(() => vi.useRealTimers())

describe('write proposals', () => {
  it('requires an enabled session and consumes only the unchanged proposal once', () => {
    const store = new RedisWriteProposals()
    try {
      expect(() => store.issue('a', 'turn', Symbol(), draft)).toThrow('未启用')
      store.enable('a', target)
      const token = store.beginTurn('a', 'turn')
      const proposal = store.issue('a', 'turn', token, draft)
      expect(store.consume('b', 'turn', proposal)).toBeNull()
      expect(store.consume('a', 'other-turn', proposal)).toBeNull()
      expect(store.consume('a', 'turn', { ...proposal, afterBase64: 'b3RoZXI=' })).toBeNull()
      expect(store.consume('a', 'turn', { ...proposal, keyTtl: 'invalid' as 'none' })).toBeNull()
      expect(store.consume('a', 'turn', { ...proposal, target: { ...target, db: 1 } })).toBeNull()
      expect(store.consume('a', 'turn', proposal)).toEqual(proposal)
      expect(store.consume('a', 'turn', proposal)).toBeNull()
    } finally { store.dispose() }
  })

  it('detaches caller-owned objects and invalidates on disable or re-enable', () => {
    const store = new RedisWriteProposals()
    try {
      const original = structuredClone(draft)
      store.enable('a', original.target)
      const token = store.beginTurn('a', 'turn')
      const issued = store.issue('a', 'turn', token, original)
      const saved = structuredClone(issued)
      Reflect.set(original.target, 'db', 7)
      Reflect.set(issued.target, 'db', 8)
      expect(store.consume('a', 'turn', saved)?.target.db).toBe(0)
      const replaced = store.issue('a', 'turn', token, draft)
      const next = store.issue('a', 'turn', token, draft)
      expect(store.consume('a', 'turn', replaced)).toBeNull()
      expect(store.consume('a', 'turn', next)?.target.db).toBe(0)
      const stale = store.issue('a', 'turn', token, draft)
      store.disable('a')
      expect(store.consume('a', 'turn', stale)).toBeNull()
      store.enable('a', { ...target, generation: 2 })
      expect(store.isEnabled('a', target)).toBe(false)
      expect(store.consume('a', 'turn', stale)).toBeNull()
    } finally { store.dispose() }
  })

  it('expires a proposal and clears its timer', () => {
    vi.useFakeTimers()
    const store = new RedisWriteProposals()
    try {
      store.enable('a', target)
      const token = store.beginTurn('a', 'turn')
      const proposal = store.issue('a', 'turn', token, draft)
      vi.advanceTimersByTime(60_000)
      expect(store.consume('a', 'turn', proposal)).toBeNull()
      expect(vi.getTimerCount()).toBe(0)
      store.issue('a', 'turn', token, draft)
      store.dispose()
      expect(vi.getTimerCount()).toBe(0)
      expect(store.isEnabled('a', target)).toBe(false)
    } finally { store.dispose() }
  })

  it('invalidates only the proposal owned by an ended turn and binds hash TTL assumptions', () => {
    const store = new RedisWriteProposals()
    try {
      store.enable('a', target)
      const firstToken = store.beginTurn('a', 'turn-1')
      const first = store.issue('a', 'turn-1', firstToken, draft)
      store.endTurn('a', 'turn-1')
      expect(store.consume('a', 'turn-1', first)).toBeNull()
      expect(() => store.issue('a', 'turn-1', firstToken, draft)).toThrow('轮次已结束')
      const secondToken = store.beginTurn('a', 'turn-2')
      const hash = store.issue('a', 'turn-2', secondToken, { ...draft, type: 'hash', fieldTtl: 'none', fieldBase64: 'Zg==' })
      store.endTurn('a', 'turn-1')
      expect(store.consume('a', 'turn-2', { ...hash, fieldTtl: null })).toBeNull()
      expect(store.consume('a', 'turn-2', hash)).toEqual(hash)
    } finally { store.dispose() }
  })

  it('rejects invalid or oversized byte identities and enforces the session capacity', () => {
    const store = new RedisWriteProposals()
    try {
      store.enable('a', target)
      const token = store.beginTurn('a', 'turn')
      for (const invalid of [{ ...draft, keyBase64: 'a' }, { ...draft, afterBase64: Buffer.alloc(4097).toString('base64') }, { ...draft, type: 'hash' as const }, { ...draft, fieldBase64: 'Zg==' }]) {
        expect(() => store.issue('a', 'turn', token, invalid)).toThrow('无效')
      }
      for (let index = 0; index < 63; index++) store.enable(`session-${index}`, target)
      expect(() => store.enable('overflow', target)).toThrow('上限')
      store.disable('session-0')
      expect(() => store.enable('overflow', target)).not.toThrow()
    } finally { store.dispose() }
  })

  it('rejects a late read from an earlier enable cycle in the same turn', () => {
    const store = new RedisWriteProposals()
    try {
      store.enable('a', target)
      const oldToken = store.beginTurn('a', 'turn')
      store.disable('a')
      store.enable('a', target)
      const newToken = store.beginTurn('a', 'turn')
      expect(newToken).not.toBe(oldToken)
      expect(() => store.issue('a', 'turn', oldToken, draft)).toThrow('轮次已结束')
      const current = store.issue('a', 'turn', newToken, draft)
      expect(store.consume('a', 'turn', current)).toEqual(current)
    } finally { store.dispose() }
  })
})
