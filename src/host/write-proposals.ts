import { randomUUID } from 'node:crypto'
import type { DatabaseTarget } from '../domain.ts'

const MAX_SESSIONS = 64
const MAX_BYTES = 4096
const LIFETIME_MS = 60_000

/** Canonical bytes and connection identity returned by the Host's preflight. */
export interface RedisWriteDraft {
  readonly target: DatabaseTarget
  readonly host: string
  readonly port: number
  readonly type: 'string' | 'hash'
  readonly keyTtl: 'none'
  readonly fieldTtl: 'none' | null
  readonly keyBase64: string
  readonly fieldBase64: string | null
  readonly beforeBase64: string
  readonly afterBase64: string
}

export interface RedisWriteProposal extends RedisWriteDraft {
  readonly id: string
  readonly expiresAt: string
}

interface Entry {
  readonly proposal: RedisWriteProposal
  readonly turnId: string
  readonly token: symbol
  readonly deadline: number
}

function sameTarget(a: DatabaseTarget, b: DatabaseTarget): boolean {
  return a.id === b.id && a.generation === b.generation && a.db === b.db
}

/** Reject noncanonical Base64 rather than silently changing byte identity. */
function validBytes(text: string): boolean {
  if (text.length > Math.ceil(MAX_BYTES / 3) * 4) return false
  const bytes = Buffer.from(text, 'base64')
  return bytes.length <= MAX_BYTES && bytes.toString('base64') === text
}

function sameProposal(a: RedisWriteProposal, b: RedisWriteProposal): boolean {
  return a.id === b.id && a.expiresAt === b.expiresAt && sameTarget(a.target, b.target)
    && a.host === b.host && a.port === b.port && a.type === b.type && a.keyTtl === b.keyTtl && a.fieldTtl === b.fieldTtl
    && a.keyBase64 === b.keyBase64 && a.fieldBase64 === b.fieldBase64
    && a.beforeBase64 === b.beforeBase64 && a.afterBase64 === b.afterBase64
}

function copy(proposal: RedisWriteProposal): RedisWriteProposal {
  return { ...proposal, target: { ...proposal.target } }
}

/** Host-only, per-session write switch and short-lived one-shot proposal. */
export class RedisWriteProposals {
  private readonly enabled = new Map<string, DatabaseTarget>()
  private readonly turns = new Map<string, { readonly id: string; readonly token: symbol }>()
  private readonly entries = new Map<string, Entry>()
  private timer: ReturnType<typeof setTimeout> | undefined
  private disposed = false

  /** Called only from a user-controlled Host/client entry, never a model tool. */
  enable(sessionId: string, target: DatabaseTarget): void {
    if (this.disposed || sessionId.length === 0 || sessionId.length > 256) throw new Error('Redis 写入会话不可用。')
    if (!this.enabled.has(sessionId) && this.enabled.size >= MAX_SESSIONS) throw new Error('Redis 写入会话已达到上限。')
    this.entries.delete(sessionId)
    this.turns.delete(sessionId)
    this.enabled.set(sessionId, { ...target })
    this.schedule()
  }

  disable(sessionId: string): void {
    this.enabled.delete(sessionId)
    this.turns.delete(sessionId)
    this.entries.delete(sessionId)
    this.schedule()
  }

  /** Only a trusted Host lifecycle event may establish the current turn. */
  beginTurn(sessionId: string, turnId: string): symbol {
    if (!this.enabled.has(sessionId) || turnId.length === 0 || turnId.length > 256) throw new Error('Redis 写入轮次不可用。')
    const previous = this.turns.get(sessionId)
    if (previous?.id === turnId) return previous.token
    const token = Symbol('redis-write-turn')
    this.turns.set(sessionId, { id: turnId, token })
    this.entries.delete(sessionId)
    this.schedule()
    return token
  }

  /** A late end event for an older turn must not remove a newer proposal. */
  endTurn(sessionId: string, turnId: string): void {
    if (this.turns.get(sessionId)?.id !== turnId) return
    this.turns.delete(sessionId)
    this.entries.delete(sessionId)
    this.schedule()
  }

  isEnabled(sessionId: string, target: DatabaseTarget): boolean {
    const enabled = this.enabled.get(sessionId)
    return !this.disposed && enabled !== undefined && sameTarget(enabled, target)
  }

  /** Issuing another proposal invalidates the previous one in this session. */
  issue(sessionId: string, turnId: string, token: symbol, draft: RedisWriteDraft): RedisWriteProposal {
    if (!this.isEnabled(sessionId, draft.target)) throw new Error('Redis 写入未启用或连接已变化。')
    const turn = this.turns.get(sessionId)
    if (turn?.id !== turnId || turn.token !== token) throw new Error('Redis 写入轮次已结束或变化。')
    if (turnId.length === 0 || turnId.length > 256 || draft.host.length === 0 || draft.host.length > 1024 || !Number.isInteger(draft.port) || draft.port < 1 || draft.port > 65535
      || draft.keyTtl !== 'none' || !validBytes(draft.keyBase64) || !validBytes(draft.beforeBase64) || !validBytes(draft.afterBase64)
      || (draft.type === 'string' ? draft.fieldBase64 !== null || draft.fieldTtl !== null : draft.type !== 'hash' || draft.fieldTtl !== 'none' || draft.fieldBase64 === null || !validBytes(draft.fieldBase64))) {
      throw new Error('Redis 写入提案无效或超过限制。')
    }
    const proposal: RedisWriteProposal = { ...draft, target: { ...draft.target }, id: randomUUID(), expiresAt: new Date(Date.now() + LIFETIME_MS).toISOString() }
    this.entries.set(sessionId, { proposal, turnId, token, deadline: performance.now() + LIFETIME_MS })
    this.schedule()
    return copy(proposal)
  }

  /** Consume synchronously after the DSH policy permits this exact call. */
  consume(sessionId: string, turnId: string, requested: RedisWriteProposal): RedisWriteProposal | null {
    const entry = this.entries.get(sessionId)
    if (entry === undefined || entry.deadline <= performance.now()) {
      this.entries.delete(sessionId); this.schedule(); return null
    }
    const turn = this.turns.get(sessionId)
    if (entry.turnId !== turnId || turn?.id !== turnId || turn.token !== entry.token || !this.isEnabled(sessionId, entry.proposal.target) || !sameProposal(entry.proposal, requested)) return null
    this.entries.delete(sessionId); this.schedule()
    return copy(entry.proposal)
  }

  private schedule(): void {
    if (this.timer !== undefined) clearTimeout(this.timer)
    this.timer = undefined
    let earliest = Infinity
    for (const entry of this.entries.values()) earliest = Math.min(earliest, entry.deadline)
    if (earliest === Infinity) return
    this.timer = setTimeout(() => {
      this.timer = undefined
      const now = performance.now()
      for (const [session, entry] of this.entries) if (entry.deadline <= now) this.entries.delete(session)
      this.schedule()
    }, Math.max(0, earliest - performance.now()))
    this.timer.unref()
  }

  dispose(): void {
    this.disposed = true
    this.enabled.clear(); this.turns.clear(); this.entries.clear()
    if (this.timer !== undefined) clearTimeout(this.timer)
    this.timer = undefined
  }
}
