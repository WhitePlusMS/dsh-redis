import { PreviewFormats } from './PreviewFormats.tsx'
import { useEffect, useState } from 'react'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar-right/client'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import type { RedisHostStatus } from '../domain.ts'
import { ConnectionForm, type ConnectionActions } from './ConnectionForm.tsx'
import { NS } from './locales.ts'
import { RefreshVisibility } from './AutoRefresh.tsx'
import { Icon } from './Icon.tsx'

export interface RedisWorkspaceInjected extends ConnectionActions {
  readonly sessionKey: string
  readonly status: (signal: AbortSignal) => Promise<RemoteResult<RedisHostStatus>>
}
type Props = PropsRuntime<'sidebar.right.pane.tab'> & PropsLocale<typeof NS> & RedisWorkspaceInjected

/** One request belongs to one mount/retry; late results cannot change a newer view. */
export function RedisWorkspace(props: Props) {
  const [attempt, setAttempt] = useState(0)
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading')
  const [infoOpen, setInfoOpen] = useState(false)
  const t = props.t
  const { tab } = props.useTabInfo()
  useEffect(() => {
    const controller = new AbortController()
    setPhase('loading')
    void props.status(controller.signal).then(result => {
      if (!controller.signal.aborted) setPhase(result.ok ? 'ready' : 'error')
    }).catch(() => { if (!controller.signal.aborted) setPhase('error') })
    return () => controller.abort()
  }, [props.status, attempt])
  return <section className="dsh-redis" aria-label={t('view.title')}>
    <header className="redis-workspace-heading"><h2>{t('view.title')}</h2><span className="redis-readonly" title={t('badge.readOnly')} role="img" aria-label={t('badge.readOnly')}><Icon name="lock" /></span><button type="button" className="redis-icon-button redis-plugin-info-toggle" title={t('ui.pluginInfo')} aria-label={t('ui.pluginInfo')} aria-expanded={infoOpen} onClick={() => setInfoOpen(value => !value)}><Icon name="info" /></button></header>
    {infoOpen && <div className="redis-plugin-info"><span>{t('baseline')}</span><span>{t(phase === 'ready' ? 'status.ready' : phase === 'loading' ? 'status.loading' : 'status.error')}</span></div>}
    {phase === 'ready' ? <RefreshVisibility.Provider value={tab}><PreviewFormats key={props.sessionKey}><ConnectionForm {...props} /></PreviewFormats></RefreshVisibility.Provider> : <div className="redis-empty">
      <h2>{t('empty.title')}</h2><p>{t('empty.description')}</p>
      {phase === 'error' && <button type="button" onClick={() => setAttempt(value => value + 1)}>{t('action.retry')}</button>}
    </div>}
    {phase !== 'ready' && <footer className={`redis-status${phase === 'error' ? ' redis-error' : ''}`} role="status" aria-live="polite">{t(phase === 'loading' ? 'status.loading' : 'status.error')}</footer>}
  </section>
}
