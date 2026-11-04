import { randomUUID } from 'node:crypto'
import { MAX_PROFILES, type SavedConnection } from '../domain.ts'
import { profileCollectionSchema } from '../typert.shared.ts'

const MAX_SNAPSHOTS = 250
const MAX_STAGES = 250
const SNAPSHOT_LIFETIME_MS = 5 * 60 * 1000

interface Snapshot {
  readonly sessionId: string
  readonly profile: SavedConnection
  readonly expiresAt: number
}
interface PreparedSnapshots {
  readonly tokens: readonly (string | null)[]
  commit(): void
  rollback(): void
}
interface Reservation {
  readonly sessionId: string
  readonly owner: Map<string, string>
  readonly count: number
  readonly tokens: readonly string[]
  readonly expiresAt: number
  active: boolean
}

/** Host-only references. A returned token contains no saved connection settings. */
export class RedisProfileSnapshots {
  private readonly snapshots = new Map<string, Snapshot>()
  private readonly sessions = new Map<string, Map<string, string>>()
  private readonly pendingByOwner = new WeakMap<Map<string, string>, number>()
  private readonly reservedByOwner = new WeakMap<Map<string, string>, number>()
  private readonly reservations = new Set<Reservation>()
  private readonly stagedTokens = new Set<string>()
  private reserved = 0
  private timer: ReturnType<typeof setTimeout> | undefined
  private disposed = false

  private clone(profile: SavedConnection): SavedConnection {
    return profileCollectionSchema.parse({ profiles: [profile], selectedId: null }).profiles[0]!
  }

  private remove(token: string): void {
    const snapshot = this.snapshots.get(token)
    if (snapshot === undefined) return
    this.snapshots.delete(token)
    const session = this.sessions.get(snapshot.sessionId)
    if (session?.get(snapshot.profile.id) === token) session.delete(snapshot.profile.id)
    if (session?.size === 0 && (this.pendingByOwner.get(session) ?? 0) === 0) this.sessions.delete(snapshot.sessionId)
  }

  private prune(): void {
    const now = performance.now()
    for (const [token, snapshot] of this.snapshots) if (snapshot.expiresAt <= now) this.remove(token)
    for (const reservation of this.reservations) if (reservation.expiresAt <= now) this.retire(reservation)
  }

  private retire(reservation: Reservation): void {
    if (!reservation.active) return
    reservation.active = false; this.reservations.delete(reservation)
    this.reserved -= reservation.count
    for (const token of reservation.tokens) this.stagedTokens.delete(token)
    const owner = reservation.owner
    const reserved = (this.reservedByOwner.get(owner) ?? 0) - reservation.count
    if (reserved === 0) this.reservedByOwner.delete(owner)
    else this.reservedByOwner.set(owner, reserved)
    const remaining = (this.pendingByOwner.get(owner) ?? 1) - 1
    if (remaining === 0) this.pendingByOwner.delete(owner)
    else this.pendingByOwner.set(owner, remaining)
    if (remaining === 0 && owner.size === 0 && this.sessions.get(reservation.sessionId) === owner) this.sessions.delete(reservation.sessionId)
  }

  private schedule(): void {
    if (this.timer !== undefined) clearTimeout(this.timer)
    this.timer = undefined
    let earliest = Infinity
    for (const snapshot of this.snapshots.values()) earliest = Math.min(earliest, snapshot.expiresAt)
    for (const reservation of this.reservations) earliest = Math.min(earliest, reservation.expiresAt)
    if (earliest === Infinity) return
    this.timer = setTimeout(() => { this.timer = undefined; this.prune(); this.schedule() }, Math.max(0, earliest - performance.now()))
    this.timer.unref()
  }

  /** Stage references until the tool result and its budget are committed. */
  prepare(sessionId: string, profiles: readonly SavedConnection[]): PreparedSnapshots {
    if (this.disposed) throw new Error('Redis profile snapshots are disposed.')
    if (sessionId.length === 0 || sessionId.length > 256) throw new Error('Invalid Redis session identity.')
    const saved = profileCollectionSchema.parse({ profiles, selectedId: null }).profiles
    this.prune()
    if (this.reservations.size >= MAX_STAGES) {
      this.schedule()
      return { tokens: saved.map(() => null), commit: () => undefined, rollback: () => undefined }
    }
    let session = this.sessions.get(sessionId)
    if (session === undefined) { session = new Map(); this.sessions.set(sessionId, session) }
    const owner = session, issued = new Set<string>()
    let additions = 0
    const pending = saved.map(profile => {
      const previous = owner.get(profile.id)
      if (previous === undefined && (this.snapshots.size + this.reserved + additions >= MAX_SNAPSHOTS || owner.size + (this.reservedByOwner.get(owner) ?? 0) + additions >= MAX_PROFILES)) return { profile, previous, token: null }
      if (previous === undefined) additions++
      let token: string
      do { token = randomUUID() } while (this.snapshots.has(token) || this.stagedTokens.has(token) || issued.has(token))
      issued.add(token)
      return { profile, previous, token }
    })
    this.pendingByOwner.set(owner, (this.pendingByOwner.get(owner) ?? 0) + 1)
    this.reservedByOwner.set(owner, (this.reservedByOwner.get(owner) ?? 0) + additions)
    this.reserved += additions
    for (const token of issued) this.stagedTokens.add(token)
    const reservation: Reservation = { sessionId, owner, count: additions, tokens: [...issued], expiresAt: performance.now() + SNAPSHOT_LIFETIME_MS, active: true }
    this.reservations.add(reservation); this.schedule()
    let finished = false
    return {
      tokens: pending.map(value => value.token),
      commit: () => {
        if (finished || !reservation.active || this.disposed || this.sessions.get(sessionId) !== owner) throw new Error('Redis profile snapshot is stale.')
        this.prune()
        if (!reservation.active || this.sessions.get(sessionId) !== owner || pending.some(value => value.token !== null && owner.get(value.profile.id) !== value.previous)) throw new Error('Redis profile snapshot is stale.')
        for (const { profile, previous, token } of pending) {
          if (token === null) continue
          if (previous !== undefined) this.snapshots.delete(previous)
          this.snapshots.set(token, { sessionId, profile, expiresAt: performance.now() + SNAPSHOT_LIFETIME_MS })
          owner.set(profile.id, token)
        }
        finished = true
        this.retire(reservation)
        this.schedule()
      },
      rollback: () => {
        if (finished) return
        finished = true
        this.retire(reservation)
        this.schedule()
      },
    }
  }

  /** Reissuing for the same session/profile invalidates its earlier token. */
  issue(sessionId: string, profile: SavedConnection): string | null {
    const prepared = this.prepare(sessionId, [profile])
    try { prepared.commit(); return prepared.tokens[0] ?? null } catch (error) { prepared.rollback(); throw error }
  }

  /** Only trusted Host callers receive a detached copy of the bound profile. */
  resolve(sessionId: string, profileId: string, token: string): SavedConnection | undefined {
    this.prune(); this.schedule()
    const snapshot = this.snapshots.get(token)
    if (snapshot === undefined || snapshot.sessionId !== sessionId || snapshot.profile.id !== profileId) return undefined
    return this.clone(snapshot.profile)
  }

  disposeSession(sessionId: string): void {
    for (const reservation of this.reservations) if (reservation.sessionId === sessionId) this.retire(reservation)
    for (const token of this.sessions.get(sessionId)?.values() ?? []) this.remove(token)
    this.sessions.delete(sessionId)
    this.schedule()
  }

  dispose(): void {
    this.disposed = true
    for (const reservation of this.reservations) this.retire(reservation)
    this.snapshots.clear(); this.sessions.clear()
    if (this.timer !== undefined) clearTimeout(this.timer)
    this.timer = undefined
  }
}
