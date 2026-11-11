import type { DatabaseTarget } from '../domain.ts'
import type { RedisWriteResult } from './redis-write-transaction.ts'

const MAX_RECORDS = 128
const MAX_SESSION_RECORDS = 16
const RETENTION_MS = 10 * 60 * 1000

export interface RedisWriteRecord {
  readonly id: string
  readonly target: DatabaseTarget
  readonly identity: RedisWriteIdentity
  readonly state: 'pending' | 'submitting' | RedisWriteResult
  readonly startedAt: string
  readonly updatedAt: string
  readonly readbackAt: string | null
}

export interface RedisWriteIdentity {
  readonly type: 'string' | 'hash'
  readonly keyBase64: string
  readonly fieldBase64: string | null
}

export interface RedisWriteRecordHandle {
  submitted(): void
  finish(result: RedisWriteResult, readbackAt?: string): void
}

interface Entry {
  readonly sessionId: string
  record: RedisWriteRecord
  deadline: number | null
}

function copy(record: RedisWriteRecord): RedisWriteRecord {
  return { ...record, target: { ...record.target }, identity: { ...record.identity } }
}

function validBytes(text: string): boolean {
  if (text.length > Math.ceil(4096 / 3) * 4) return false
  const bytes = Buffer.from(text, 'base64')
  return bytes.length <= 4096 && bytes.toString('base64') === text
}

/** Bounded Host memory only: no credentials, old values or new values are stored. */
export class RedisWriteHistory {
  private readonly entries = new Map<string, Entry>()
  private timer: ReturnType<typeof setTimeout> | undefined
  private disposed = false

  start(sessionId: string, id: string, target: DatabaseTarget, identity: RedisWriteIdentity): RedisWriteRecordHandle {
    if (this.disposed || sessionId.length === 0 || sessionId.length > 256 || !/^[0-9a-f-]{36}$/u.test(id)) throw new Error('Redis 操作记录身份无效。')
    if (!validBytes(identity.keyBase64) || (identity.type === 'string' ? identity.fieldBase64 !== null : identity.type !== 'hash' || identity.fieldBase64 === null || !validBytes(identity.fieldBase64))) throw new Error('Redis 操作目标无效。')
    this.prune()
    if (this.entries.has(id) || this.entries.size >= MAX_RECORDS || [...this.entries.values()].filter(entry => entry.sessionId === sessionId).length >= MAX_SESSION_RECORDS) throw new Error('Redis 操作记录已存在或达到容量上限。')
    const now = new Date().toISOString()
    const entry: Entry = { sessionId, record: { id, target: { id: target.id, generation: target.generation, db: target.db }, identity: { type: identity.type, keyBase64: identity.keyBase64, fieldBase64: identity.fieldBase64 }, state: 'pending', startedAt: now, updatedAt: now, readbackAt: null }, deadline: null }
    this.entries.set(id, entry)
    const current = () => !this.disposed && this.entries.get(id) === entry
    return {
      submitted: () => {
        if (!current() || entry.record.state !== 'pending') throw new Error('Redis 操作记录不可提交。')
        entry.record = { ...entry.record, state: 'submitting', updatedAt: new Date().toISOString() }
      },
      finish: (result, readbackAt) => {
        if (!current() || entry.deadline !== null) return
        const didSubmit = entry.record.state === 'submitting'
        const timestamp = readbackAt === undefined ? NaN : Date.parse(readbackAt)
        const validReadback = Number.isFinite(timestamp) && new Date(timestamp).toISOString() === readbackAt
        // Once dispatch may have happened, a generic pre-dispatch result is unsafe.
        // Conversely, a claimed successful write without dispatch evidence is unknown.
        const state = didSubmit && result === 'not-executed' || !didSubmit && result.startsWith('written-') ? 'unknown' : result === 'written-verified' && !validReadback ? 'written-unverified' : result
        entry.record = { ...entry.record, state, readbackAt: validReadback && (state === 'written-verified' || state === 'written-mismatch') ? readbackAt! : null, updatedAt: new Date().toISOString() }
        entry.deadline = performance.now() + RETENTION_MS
        this.schedule()
      },
    }
  }

  /** A caller may only inspect records from its own trusted session. */
  get(sessionId: string, id: string): RedisWriteRecord | null {
    this.prune(); this.schedule()
    const entry = this.entries.get(id)
    return entry?.sessionId === sessionId ? copy(entry.record) : null
  }

  private prune(): void {
    const now = performance.now()
    for (const [id, entry] of this.entries) if (entry.deadline !== null && entry.deadline <= now) this.entries.delete(id)
  }

  private schedule(): void {
    if (this.timer !== undefined) clearTimeout(this.timer)
    this.timer = undefined
    let earliest = Infinity
    for (const entry of this.entries.values()) if (entry.deadline !== null) earliest = Math.min(earliest, entry.deadline)
    if (earliest === Infinity) return
    this.timer = setTimeout(() => { this.timer = undefined; this.prune(); this.schedule() }, Math.max(0, earliest - performance.now()))
    this.timer.unref()
  }

  dispose(): void {
    this.disposed = true
    this.entries.clear()
    if (this.timer !== undefined) clearTimeout(this.timer)
    this.timer = undefined
  }
}
