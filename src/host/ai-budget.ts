import type { AiBudgetStatus } from '../domain.ts'

/** Independent limits for one DSH session, shared by all AI result producers. */
export const MAX_AI_RESULT_BYTES = 64 * 1024
export const MAX_AI_SESSION_CALLS = 32
export const MAX_AI_SESSION_BYTES = 1024 * 1024

/** Opaque identity: only the exact object returned by begin can be finished. */
export interface AiBudgetLease { readonly sessionId: string }
export type AiBudgetStart =
  | { readonly ok: true; readonly lease: AiBudgetLease; readonly status: AiBudgetStatus }
  | { readonly ok: false; readonly reason: 'exhausted' | 'busy'; readonly status: AiBudgetStatus }

interface BudgetState {
  callsUsed: number
  bytesUsed: number
  readonly leases: Set<AiBudgetLease>
}

/**
 * Reserves a full result before dispatch, so overlapping calls cannot exceed
 * the session budget. The caller must finish every admitted call, including
 * failures and cancellation, with the number of bytes actually returned.
 */
export class RedisAiBudget {
  private readonly sessions = new Map<string, BudgetState>()
  private readonly maxCalls: number
  private readonly maxBytes: number
  private readonly maxResultBytes: number

  constructor(limits: { readonly maxCalls?: number; readonly maxBytes?: number; readonly maxResultBytes?: number } = {}) {
    this.maxCalls = limits.maxCalls ?? MAX_AI_SESSION_CALLS
    this.maxBytes = limits.maxBytes ?? MAX_AI_SESSION_BYTES
    this.maxResultBytes = limits.maxResultBytes ?? MAX_AI_RESULT_BYTES
    if (![this.maxCalls, this.maxBytes, this.maxResultBytes].every(value => Number.isSafeInteger(value) && value > 0) || this.maxResultBytes > this.maxBytes) {
      throw new RangeError('Invalid AI budget limits')
    }
  }

  private snapshot(state: BudgetState | undefined): AiBudgetStatus {
    const callsUsed = state?.callsUsed ?? 0, bytesUsed = state?.bytesUsed ?? 0
    return {
      callsUsed, maxCalls: this.maxCalls, bytesUsed, maxBytes: this.maxBytes,
      inFlight: state?.leases.size ?? 0,
      // A partial remaining allowance cannot safely reserve a complete result.
      stopped: callsUsed >= this.maxCalls || bytesUsed + this.maxResultBytes > this.maxBytes,
    }
  }

  status(sessionId: string): AiBudgetStatus { return this.snapshot(this.sessions.get(sessionId)) }

  begin(sessionId: string): AiBudgetStart {
    if (sessionId.length === 0) throw new Error('Missing AI session identity')
    let state = this.sessions.get(sessionId)
    if (state === undefined) { state = { callsUsed: 0, bytesUsed: 0, leases: new Set() }; this.sessions.set(sessionId, state) }
    const status = this.snapshot(state)
    if (status.stopped) return { ok: false, reason: 'exhausted', status }
    if (state.bytesUsed + (state.leases.size + 1) * this.maxResultBytes > this.maxBytes) return { ok: false, reason: 'busy', status }
    const lease: AiBudgetLease = Object.freeze({ sessionId })
    state.callsUsed++
    state.leases.add(lease)
    return { ok: true, lease, status: this.snapshot(state) }
  }

  /** Returns false for a stale, already finished, or disposed lease. */
  finish(lease: AiBudgetLease, returnedBytes: number, commit?: () => void): boolean {
    const state = this.sessions.get(lease.sessionId)
    if (state === undefined || !state.leases.has(lease)) return false
    if (!Number.isSafeInteger(returnedBytes) || returnedBytes < 0 || returnedBytes > this.maxResultBytes) {
      state.leases.delete(lease)
      throw new RangeError('Invalid AI result byte count')
    }
    // Commit and accounting run synchronously as one transition. A rejected
    // commit leaves the lease for the caller's zero-byte failure cleanup.
    commit?.()
    state.leases.delete(lease)
    state.bytesUsed += returnedBytes
    return true
  }

  /** Called only by a trusted user action; pending work cannot cross a reset. */
  resume(sessionId: string): boolean {
    const state = this.sessions.get(sessionId)
    if (state === undefined || state.leases.size !== 0 || !this.snapshot(state).stopped) return false
    state.callsUsed = 0
    state.bytesUsed = 0
    return true
  }

  disposeSession(sessionId: string): void { this.sessions.delete(sessionId) }
  dispose(): void { this.sessions.clear() }
}
