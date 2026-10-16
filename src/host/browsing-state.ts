import { MAX_VALUE_BYTES, type SessionBrowsingState } from '../domain.ts'
import { browsingStateSchema } from '../typert.shared.ts'

export function emptyBrowsingState(): SessionBrowsingState {
  return { profileId: null, db: 0, pattern: '*', keyBase64: null, formats: { string: 'text', hash: 'text', list: 'text', set: 'text', zset: 'text', stream: 'text', geo: 'text', json: 'json' }, stringOffset: '0', stringCount: MAX_VALUE_BYTES }
}

/** Host-session lifetime only: no browser storage, disk file or Redis operation.
 * Copies at both boundaries prevent callers from mutating another mounted view.
 */
export class RedisBrowsingStates {
  private readonly sessions = new Map<string, SessionBrowsingState>()
  load(sessionId: string, signal: AbortSignal): SessionBrowsingState {
    signal.throwIfAborted()
    return browsingStateSchema.parse(this.sessions.get(sessionId) ?? emptyBrowsingState())
  }
  save(sessionId: string, state: SessionBrowsingState, signal: AbortSignal): SessionBrowsingState {
    signal.throwIfAborted()
    const checked = browsingStateSchema.parse(state)
    this.sessions.set(sessionId, checked)
    return browsingStateSchema.parse(checked)
  }
  disposeSession(sessionId: string): void { this.sessions.delete(sessionId) }
  dispose(): void { this.sessions.clear() }
}
