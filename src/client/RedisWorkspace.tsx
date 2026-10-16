import { useEffect, useState } from 'react'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar-right/client'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import type { RedisHostStatus } from '../domain.ts'
import { BrowsingSession, type BrowsingActions } from './BrowsingSession.tsx'
import { ConnectionForm, type ConnectionActions } from './ConnectionForm.tsx'
import { NS } from './locales.ts'
import { HelpDetails } from './HelpDetails.tsx'

export interface RedisWorkspaceInjected extends ConnectionActions, BrowsingActions {
  readonly sessionKey: string
  readonly status: (signal: AbortSignal) => Promise<RemoteResult<RedisHostStatus>>
}
type Props = PropsRuntime<'sidebar.right.pane.tab'> & PropsLocale<typeof NS> & RedisWorkspaceInjected

/** One request belongs to one mount/retry; late results cannot change a newer view. */
export function RedisWorkspace(props: Props) {
  const [attempt, setAttempt] = useState(0)
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading')
  const t = props.t
  useEffect(() => {
    const controller = new AbortController()
    setPhase('loading')
    void props.status(controller.signal).then(result => {
      if (!controller.signal.aborted) setPhase(result.ok ? 'ready' : 'error')
    }).catch(() => { if (!controller.signal.aborted) setPhase('error') })
    return () => controller.abort()
  }, [props.status, attempt])
  return <section className="dsh-redis" aria-label={t('view.title')}>
    <header className="redis-workspace-heading"><h2>{t('view.title')}</h2><span className="redis-badge">{t('badge.readOnly')}</span><HelpDetails label={t('ui.help')}><p>{t('keys.hint')}</p><p>{t('session.scope')}</p></HelpDetails></header>
    {phase === 'ready' ? <BrowsingSession key={props.sessionKey} {...props}><ConnectionForm {...props} /></BrowsingSession> : <div className="redis-empty">
      <h2>{t('empty.title')}</h2><p>{t('empty.description')}</p>
      {phase === 'error' && <button type="button" onClick={() => setAttempt(value => value + 1)}>{t('action.retry')}</button>}
    </div>}
    <footer className={`redis-status${phase === 'error' ? ' redis-error' : ''}`} role="status" aria-live="polite">
      {t(phase === 'ready' ? 'status.ready' : phase === 'loading' ? 'status.loading' : 'status.error')} · {t('baseline')}
    </footer>
  </section>
}
