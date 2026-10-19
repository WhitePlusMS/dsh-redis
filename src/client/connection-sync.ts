import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import type { ConnectionView } from '../domain.ts'

interface Options {
  readonly read: (signal: AbortSignal) => Promise<RemoteResult<ConnectionView>>
  readonly current: () => ConnectionView | null
  readonly busy: () => boolean
  readonly visible: () => boolean
  readonly apply: (value: ConnectionView) => void
  readonly failed: () => void
  readonly healthy: () => void
}

/** Poll only Host memory. Content refresh and Redis sockets have other owners. */
export class ConnectionSync {
  private timer: ReturnType<typeof setTimeout> | undefined
  private active: AbortController | undefined
  private disposed = false
  constructor(private readonly options: Options) {}
  visibilityChanged(): void {
    clearTimeout(this.timer)
    if (this.disposed || !this.options.visible()) { this.active?.abort(); return }
    if (this.active === undefined) void this.read()
  }
  private async read(): Promise<void> {
    if (this.disposed || !this.options.visible()) return
    if (!this.options.busy()) {
      const controller = new AbortController(), before = JSON.stringify(this.options.current())
      this.active = controller
      const current = () => !this.disposed && !controller.signal.aborted && this.options.visible() && !this.options.busy() && JSON.stringify(this.options.current()) === before
      try {
        const response = await this.options.read(AbortSignal.any([controller.signal, AbortSignal.timeout(5000)]))
        if (current()) {
          if (!response.ok) this.options.failed()
          // A transient SELECT/connect is not a new pane identity. Applying it
          // would unmount the UI that may still own that request's cancellation.
          else if (response.value.state !== 'connecting') {
            this.options.healthy()
            if (JSON.stringify(response.value) !== before) this.options.apply(response.value)
          }
        }
      } catch { if (current()) this.options.failed() }
      finally { if (this.active === controller) this.active = undefined }
    }
    if (!this.disposed && this.options.visible()) this.timer = setTimeout(() => { void this.read() }, 1000)
  }
  dispose(): void { this.disposed = true; clearTimeout(this.timer); this.active?.abort() }
}
