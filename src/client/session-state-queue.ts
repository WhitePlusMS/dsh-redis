/** Serialize only this Host preference channel, not Redis reads. A remounted
 * sidebar loads after its preceding saves; separate sessions never block each other.
 */
export class SessionStateQueue {
  private readonly pending = new Map<string, Promise<void>>()
  run<T>(sessionId: string, operation: () => Promise<T>): Promise<T> {
    const result = (this.pending.get(sessionId) ?? Promise.resolve()).then(operation)
    const settled = result.then(() => undefined, () => undefined)
    this.pending.set(sessionId, settled)
    void settled.then(() => { if (this.pending.get(sessionId) === settled) this.pending.delete(sessionId) })
    return result
  }
}
