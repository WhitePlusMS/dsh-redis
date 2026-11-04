/** Local changes are visible before a debounced selection reaches the Host. */
export interface SelectionEpochSnapshot { readonly revision: number; readonly synchronized: boolean }

export class SelectionEpoch {
  private revision = 0
  private synchronized = false
  private boundaries = 0
  private failed = false
  private readonly listeners = new Set<(snapshot: SelectionEpochSnapshot) => void>()
  private readonly userSelections = new Set<() => void>()
  private publisher: ((input: UiChannelInput) => void) | undefined
  private pending: { readonly id: string; readonly resolve: (result: RemoteResult<SelectionAck>) => void; readonly reject: (error: Error) => void; readonly cleanup: () => void } | undefined
  private confirmation: { readonly id: string; readonly expected: SetSelectionRequest } | undefined

  snapshot(): SelectionEpochSnapshot { return { revision: this.revision, synchronized: this.synchronized } }
  hasFailure(): boolean { return this.failed }

  /** Called synchronously, before the user's selection is changed in React. */
  invalidate(): number {
    this.confirmation = undefined
    return this.advance()
  }

  /** A rendered action can change its own item without being mistaken for user input. */
  invalidateSelection(item: RedisSelectionItem | null): number {
    if (this.confirmation !== undefined && JSON.stringify(this.confirmation.expected.selection?.item ?? null) !== JSON.stringify(item)) this.confirmation = undefined
    return this.advance()
  }
  private advance(): number {
    if (this.revision === Number.MAX_SAFE_INTEGER) throw new RangeError('Redis selection revision exhausted')
    // A late acknowledgement cannot block publishing a newer user selection.
    const pending = this.pending; this.pending = undefined
    pending?.cleanup(); pending?.reject(new Error('Redis selection publication superseded'))
    this.revision += 1
    this.synchronized = false
    this.failed = false
    this.notify()
    return this.revision
  }

  /** An older asynchronous publication cannot make a newer selection ready. */
  synchronize(revision: number): void {
    if (revision !== this.revision || this.synchronized || this.boundaries > 0) return
    this.synchronized = true
    this.failed = false
    this.notify()
  }

  fail(revision: number): void {
    if (revision !== this.revision || this.failed) return
    this.failed = true
    this.notify()
  }

  current(revision: number): boolean { return this.synchronized && revision === this.revision }

  /** Let the active pane take ownership before invalidating an AI action. */
  userSelect(): void { for (const listener of this.userSelections) listener(); this.invalidate() }
  onUserSelect(listener: () => void): () => void { this.userSelections.add(listener); return () => { this.userSelections.delete(listener) } }

  /** The commit frame itself informs Host of this unsynchronized revision. */
  advanceAction(revision: number): number {
    if (!this.current(revision) || revision === Number.MAX_SAFE_INTEGER) throw new Error('Redis selection action is stale')
    this.revision += 1; this.synchronized = false; this.failed = false; this.notify()
    return this.revision
  }

  confirmAction(id: string, expected: SetSelectionRequest): void { this.confirmation = { id, expected } }

  bindPublisher(send: (input: UiChannelInput) => void): () => void {
    if (this.publisher !== undefined) throw new Error('Redis selection stream already bound')
    this.publisher = send
    this.invalidate()
    return () => {
      if (this.publisher !== send) return
      this.publisher = undefined
      const pending = this.pending; this.pending = undefined
      pending?.cleanup(); pending?.reject(new Error('Redis selection stream closed'))
      this.invalidate()
      this.fail(this.revision)
    }
  }

  publish(request: SetSelectionRequest, revision: number, signal: AbortSignal): Promise<RemoteResult<SelectionAck>> {
    if (signal.aborted || revision !== this.revision || this.publisher === undefined || this.pending !== undefined) return Promise.reject(new Error('Redis selection stream unavailable'))
    const send = this.publisher, id = crypto.randomUUID()
    return new Promise((resolve, reject) => {
      const cancel = () => {
        if (this.pending?.id !== id) return
        this.pending = undefined; signal.removeEventListener('abort', cancel); reject(new Error('Redis selection publication cancelled'))
      }
      this.pending = { id, resolve, reject, cleanup: () => signal.removeEventListener('abort', cancel) }
      signal.addEventListener('abort', cancel, { once: true })
      if (signal.aborted) { cancel(); return }
      const confirmation = this.confirmation
      const actionRequestId = confirmation !== undefined && JSON.stringify(confirmation.expected) === JSON.stringify(request) ? confirmation.id : undefined
      try { send({ kind: 'publishSelection', requestId: id, revision, request, ...(actionRequestId === undefined ? {} : { actionRequestId }) }) } catch { cancel() }
    })
  }

  finishPublication(id: string, accepted: boolean): void {
    const pending = this.pending
    if (pending === undefined || pending.id !== id) return
    this.pending = undefined; this.confirmation = undefined; pending.cleanup(); pending.resolve({ ok: true, value: { accepted } })
  }

  /** A pending connection/DB change cannot publish the old selection as ready. */
  beginBoundary(signal: AbortSignal): () => void {
    this.boundaries += 1
    this.invalidate()
    let ended = false
    const end = () => {
      if (ended) return
      ended = true; signal.removeEventListener('abort', end); this.boundaries -= 1
      this.invalidate()
    }
    signal.addEventListener('abort', end, { once: true })
    if (signal.aborted) end()
    return end
  }

  subscribe(listener: (snapshot: SelectionEpochSnapshot) => void): () => void {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  private notify(): void { const snapshot = this.snapshot(); for (const listener of this.listeners) listener(snapshot) }
}
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import type { RedisSelectionItem, SelectionAck, SetSelectionRequest, UiChannelInput } from '../domain.ts'
