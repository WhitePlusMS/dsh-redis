import type { ReactNode } from 'react'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import { Icon } from './Icon.tsx'
import { NS } from './locales.ts'

/** All manual refreshes use the committed query; forms submit drafts separately. */
export function ReadActions({ t, busy, refresh, cancel, children, label }: { readonly t: TranslateNS<typeof NS>; readonly busy: boolean; readonly refresh: () => void; readonly cancel: () => void; readonly children?: ReactNode; readonly label?: string }) {
  const name = label ?? t('value.refresh')
  return <div className="redis-reader-actions">
    <button type="button" className={`redis-icon-button${busy ? ' redis-spinning' : ''}`} title={busy ? t('read.busy') : name} aria-label={name} aria-busy={busy} disabled={busy} onClick={refresh}><Icon name="refresh" /></button>
    {busy && <button type="button" className="redis-icon-button" title={t('keys.cancel')} aria-label={t('keys.cancel')} onClick={cancel}><Icon name="close" /></button>}
    {children}
  </div>
}

export function QueryToggle({ label, open, active = false, toggle }: { readonly label: string; readonly open: boolean; readonly active?: boolean; readonly toggle: () => void }) {
  return <button type="button" className="redis-icon-button" title={label} aria-label={label} aria-expanded={open} aria-pressed={active} onClick={toggle}><Icon name="filter" /></button>
}

/** Completion refers to the submitted scan/range, never to all server data. */
export function ScanProgress({ busy, progress, t }: { readonly busy: boolean; readonly progress: 'idle' | 'more' | 'complete' | 'limited'; readonly t: TranslateNS<typeof NS> }) {
  if (!busy && progress === 'idle') return null
  const label = t(busy ? 'read.busy' : progress === 'limited' ? 'read.partialRange' : progress === 'complete' ? 'read.rangeDone' : 'read.more')
  return <span className={`redis-scan-mark${busy ? ' redis-spinning' : ''}${progress === 'limited' ? ' redis-warning' : ''}`} role="img" title={label} aria-label={label}><Icon name={busy ? 'refresh' : progress === 'limited' ? 'warning' : progress === 'complete' ? 'check' : 'down'} />{progress === 'limited' && <span>{t('read.partial')}</span>}</span>
}

export function ReadTime({ sampledAt, label }: { readonly sampledAt: string; readonly label: string }) {
  return <details className="redis-read-time"><summary title={`${label} · ${new Date(sampledAt).toLocaleString()}`} aria-label={label}><Icon name="history" /></summary><time dateTime={sampledAt}>{new Date(sampledAt).toLocaleString()}</time></details>
}
