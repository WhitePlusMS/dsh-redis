import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import type { ConnectionErrorCode } from '../domain.ts'
import { ConnectionFailure } from './connection-service.ts'
import { MAX_AI_RESULT_BYTES } from './ai-budget.ts'

type AiJson = z.infer<ReturnType<typeof z.json>>
interface Page { readonly state: string; readonly error: ConnectionErrorCode | null; readonly cursor: string | null }
interface State<P> {
  readonly binding: string
  readonly selection: object | null
  token: string | null
  busy: boolean
  page: P | null
  offset: number
  nextCursor: string | null
  delivered: boolean
}
export interface PreparedAiPage { readonly result: AiJson; commit(): void; rollback(): void }
interface Request<P extends Page, Row> {
  readonly sessionId: string
  readonly binding: string
  readonly selection: object | null
  readonly cursor: string | null
  readonly signal: AbortSignal
  readonly maxRows?: number
  readonly fetch: (cursor: string | null) => Promise<P>
  readonly rows: (page: P) => readonly Row[]
  readonly output: (page: P, rows: readonly Row[], cursor: string | null, first: boolean) => unknown
  readonly validate: (error: ConnectionErrorCode | null) => void
  readonly discard: () => void
  readonly oversize: string
}

/** One bounded page per session and reader; delivery commits only with budget accounting. */
export class AiPageStore<P extends Page, Row> {
  private readonly sessions = new Map<string, State<P>>()
  constructor(private readonly prefix: string) {}
  disposeSession(sessionId: string): void { this.sessions.delete(sessionId) }
  dispose(): void { this.sessions.clear() }

  async prepare(request: Request<P, Row>): Promise<PreparedAiPage> {
    const { sessionId, binding, selection, cursor, signal } = request
    signal.throwIfAborted(); request.validate(null)
    let state = this.sessions.get(sessionId)
    if (cursor === null) {
      // Retry a successfully fetched first page that never reached commit.
      if (state === undefined || state.binding !== binding || state.selection !== selection || state.delivered || state.busy || state.page === null) {
        state = { binding, selection, token: null, busy: false, page: null, offset: 0, nextCursor: null, delivered: false }
        this.sessions.set(sessionId, state)
      }
    } else if (state === undefined || state.binding !== binding || state.selection !== selection || state.token !== cursor || state.busy) throw new ConnectionFailure('stale')
    const current = state
    current.busy = true
    const active = () => { if (this.sessions.get(sessionId) !== current) throw new ConnectionFailure('stale') }
    try {
      if (current.page === null) {
        const page = await request.fetch(current.nextCursor)
        active()
        // A successful lower-level page already advanced its token. Retain it
        // before observing late cancellation so the input token can be retried.
        if (page.state === 'page') {
          request.validate(page.error)
          current.page = page; current.offset = 0; current.nextCursor = page.cursor
        }
        signal.throwIfAborted(); request.validate(page.error)
        current.page = page; current.offset = 0; current.nextCursor = page.cursor
      }
      const page = current.page, rows = request.rows(page)
      const token = this.prefix + randomUUID(), remaining = rows.length - current.offset
      const first = !current.delivered && current.offset === 0
      const output = (count: number, next: string | null) => request.output(page, rows.slice(current.offset, current.offset + count), next, first)
      // Measure all enclosing data, not only the row list; a real token's length
      // is included even if Redis's page contains no matching rows.
      const fits = (count: number): boolean => {
        const next = count < remaining || current.nextCursor !== null ? token : null
        return Buffer.byteLength(JSON.stringify(output(count, next))) <= MAX_AI_RESULT_BYTES
      }
      let low = 0, high = Math.min(remaining, request.maxRows ?? remaining)
      while (low < high) { const middle = Math.ceil((low + high) / 2); if (fits(middle)) low = middle; else high = middle - 1 }
      if (!fits(low) || (remaining > 0 && low === 0)) {
        if (this.sessions.get(sessionId) === current) { this.sessions.delete(sessionId); request.discard() }
        throw new Error(request.oversize)
      }
      const end = current.offset + low, next = end < rows.length || current.nextCursor !== null ? token : null
      const result = z.json().parse(output(low, next))
      let finished = false
      return { result,
        commit: () => {
          if (finished) throw new ConnectionFailure('stale')
          signal.throwIfAborted(); active(); request.validate(page.error)
          finished = true; current.delivered = true; current.busy = false; current.offset = end; current.token = next
          if (end === rows.length) { current.page = null; current.offset = 0 }
          if (next === null) this.sessions.delete(sessionId)
        },
        rollback: () => { if (!finished && this.sessions.get(sessionId) === current) current.busy = false },
      }
    } catch (error) { if (this.sessions.get(sessionId) === current) current.busy = false; throw error }
  }
}
