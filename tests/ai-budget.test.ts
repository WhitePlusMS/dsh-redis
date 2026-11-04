import { describe, expect, it } from 'vitest'
import { RedisAiBudget } from '../src/host/ai-budget.ts'
import { budgetResumeError } from '../src/client/RedisWorkspace.tsx'

function start(budget: RedisAiBudget, sessionId = 'a') {
  const result = budget.begin(sessionId)
  if (!result.ok) throw new Error(`Unexpected ${result.reason} budget`)
  return result.lease
}

describe('AI session result budget', () => {
  it('counts admitted calls even when a read fails or is cancelled', () => {
    const budget = new RedisAiBudget({ maxCalls: 2, maxBytes: 100, maxResultBytes: 20 })
    expect(budget.finish(start(budget), 0)).toBe(true)
    expect(budget.finish(start(budget), 0)).toBe(true)
    expect(budget.begin('a')).toMatchObject({ ok: false, reason: 'exhausted', status: { callsUsed: 2, bytesUsed: 0 } })
    expect(budget.resume('a')).toBe(true)
    expect(budget.status('a')).toMatchObject({ callsUsed: 0, bytesUsed: 0, stopped: false })
  })

  it('reserves concurrent results and releases only unused bytes after finishing', () => {
    const budget = new RedisAiBudget({ maxCalls: 10, maxBytes: 100, maxResultBytes: 40 })
    const first = start(budget), second = start(budget)
    expect(budget.begin('a')).toMatchObject({ ok: false, reason: 'busy', status: { callsUsed: 2, inFlight: 2 } })
    expect(budget.finish(first, 20)).toBe(true)
    const third = start(budget)
    expect(budget.finish(second, 40)).toBe(true)
    expect(budget.finish(third, 40)).toBe(true)
    expect(budget.begin('a')).toMatchObject({ ok: false, reason: 'exhausted', status: { bytesUsed: 100, inFlight: 0 } })
  })

  it('stops if the remaining bytes cannot cover another complete result', () => {
    const budget = new RedisAiBudget({ maxCalls: 10, maxBytes: 100, maxResultBytes: 40 })
    budget.finish(start(budget), 31)
    budget.finish(start(budget), 31)
    expect(budget.begin('a')).toMatchObject({ ok: false, reason: 'exhausted', status: { callsUsed: 2, bytesUsed: 62 } })
  })

  it('does not resume while a call is in flight or before a limit is reached', () => {
    const budget = new RedisAiBudget({ maxCalls: 1, maxBytes: 100, maxResultBytes: 40 })
    const lease = start(budget)
    expect(budget.resume('a')).toBe(false)
    expect(budget.finish(lease, 5)).toBe(true)
    expect(budget.resume('a')).toBe(true)
    expect(budget.resume('a')).toBe(false)
  })

  it('does not report a false failure when another pane has already resumed the session', () => {
    const budget = new RedisAiBudget({ maxCalls: 1, maxBytes: 40, maxResultBytes: 40 })
    budget.finish(start(budget), 5)
    const first = { accepted: budget.resume('a'), status: budget.status('a') }
    const second = { accepted: budget.resume('a'), status: budget.status('a') }
    expect(first.accepted).toBe(true)
    expect(second).toMatchObject({ accepted: false, status: { stopped: false } })
    expect(budgetResumeError(second)).toBe(false)
    expect(budgetResumeError({ accepted: false, status: { ...second.status, stopped: true } })).toBe(true)
  })

  it('isolates sessions and rejects stale or replayed leases after disposal', () => {
    const budget = new RedisAiBudget({ maxCalls: 1, maxBytes: 40, maxResultBytes: 40 })
    const old = start(budget), other = start(budget, 'b')
    budget.disposeSession('a')
    const current = start(budget)
    expect(budget.finish(old, 40)).toBe(false)
    expect(budget.finish(current, 10)).toBe(true)
    expect(budget.finish(current, 10)).toBe(false)
    expect(budget.finish(other, 20)).toBe(true)
    expect(budget.status('a').bytesUsed).toBe(10)
    expect(budget.status('b').bytesUsed).toBe(20)
    budget.dispose()
    expect(budget.status('b').callsUsed).toBe(0)
  })

  it('rejects malformed byte counts without retaining an in-flight reservation', () => {
    const budget = new RedisAiBudget({ maxCalls: 2, maxBytes: 40, maxResultBytes: 40 })
    const lease = start(budget)
    expect(() => budget.finish(lease, 41)).toThrow(RangeError)
    expect(budget.status('a')).toMatchObject({ callsUsed: 1, bytesUsed: 0, inFlight: 0 })
    expect(budget.finish(lease, 0)).toBe(false)
  })
  it('keeps a failed synchronous commit uncharged until zero-byte cleanup', () => {
    const budget = new RedisAiBudget({ maxCalls: 2, maxBytes: 40, maxResultBytes: 40 })
    const lease = start(budget)
    expect(() => budget.finish(lease, 20, () => { throw new Error('stale') })).toThrow('stale')
    expect(budget.status('a')).toMatchObject({ callsUsed: 1, bytesUsed: 0, inFlight: 1 })
    expect(budget.finish(lease, 0)).toBe(true)
    expect(budget.status('a')).toMatchObject({ callsUsed: 1, bytesUsed: 0, inFlight: 0 })
  })

  it('rejects invalid limits and missing owner identity', () => {
    expect(() => new RedisAiBudget({ maxCalls: 0 })).toThrow(RangeError)
    expect(() => new RedisAiBudget({ maxBytes: 2, maxResultBytes: 3 })).toThrow(RangeError)
    expect(() => new RedisAiBudget().begin('')).toThrow('Missing AI session identity')
  })
})
