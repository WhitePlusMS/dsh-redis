import { ConnectionFailure } from './connection-service.ts'
import type { PreparedAiPage } from './ai-page-store.ts'

interface Slot { disposeSession(sessionId: string): void; dispose(): void }
interface Session { revision: bigint; current: 0 | 1 | null; busy: object | null }

/** A candidate first page must commit before it replaces an existing cursor. */
export class AiPageCoordinator<T extends Slot> {
  private readonly sessions = new Map<string, Session>()
  private revision = 0n
  constructor(private readonly slots: readonly [T, T]) {}

  snapshot(sessionId: string): bigint { return this.sessions.get(sessionId)?.revision ?? 0n }

  async prepare(sessionId: string, cursor: string | null, snapshot: bigint, fetch: (slot: T) => Promise<PreparedAiPage>): Promise<PreparedAiPage> {
    let state = this.sessions.get(sessionId)
    if (state === undefined) {
      if (cursor !== null || snapshot !== 0n) throw new ConnectionFailure('stale')
      state = { revision: 0n, current: null, busy: null }; this.sessions.set(sessionId, state)
    }
    if (cursor === null && state.revision !== snapshot) throw new ConnectionFailure('stale')
    if (state.busy !== null) throw new Error('该类型的读取正在执行，请等待后重试。')
    if (cursor !== null && state.current === null) throw new ConnectionFailure('stale')
    const index: 0 | 1 = cursor === null ? (state.current === 0 ? 1 : 0) : state.current === 1 ? 1 : 0
    const owner = {}, current = state, slot = this.slots[index]
    current.busy = owner
    const active = () => this.sessions.get(sessionId) === current && current.busy === owner
    const release = (discard: boolean) => {
      if (!active()) return
      if (discard && cursor === null) slot.disposeSession(sessionId)
      current.busy = null
      if (current.current === null && current.revision === 0n) this.sessions.delete(sessionId)
    }
    try {
      const page = await fetch(slot)
      let finished = false
      return { result: page.result, isPage: page.isPage,
        commit: () => {
          if (finished || !active()) throw new ConnectionFailure('stale')
          page.commit()
          if (cursor === null && page.isPage) {
            const previous = current.current
            current.current = index
            if (previous !== null) this.slots[previous].disposeSession(sessionId)
          }
          if (page.isPage) current.revision = ++this.revision
          finished = true
          release(!page.isPage)
        },
        rollback: () => {
          if (finished) return
          page.rollback()
          release(true)
        },
      }
    } catch (error) {
      release(true)
      throw error
    }
  }

  disposeSession(sessionId: string): void { this.sessions.delete(sessionId); for (const slot of this.slots) slot.disposeSession(sessionId) }
  dispose(): void { this.sessions.clear(); for (const slot of this.slots) slot.dispose() }
}
