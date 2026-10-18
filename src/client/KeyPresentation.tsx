import { createContext, useContext, useLayoutEffect, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type { KeyMetadata } from '../domain.ts'
import { Icon } from './Icon.tsx'
import { NS } from './locales.ts'

interface Report { readonly owner: symbol; readonly value: KeyMetadata | null }
const HeaderMetadata = createContext<KeyMetadata | null>(null)
const PublishMetadata = createContext<Dispatch<SetStateAction<Report | null>> | null>(null)

/** Only display metadata is lifted. Readers retain their own result and lifetime. */
export function KeyPresentation({ children }: { readonly children: ReactNode }) {
  const [report, publish] = useState<Report | null>(null)
  return <PublishMetadata.Provider value={publish}><HeaderMetadata.Provider value={report?.value ?? null}>{children}</HeaderMetadata.Provider></PublishMetadata.Provider>
}

/** Rendered by the active leaf view, including explicit Bitmap/HLL/GEO views.
 * Cleanup checks the owner so an old view cannot erase a new view's header.
 */
export function PresentKeyMetadata({ value }: { readonly value: KeyMetadata | null }) {
  const publish = useContext(PublishMetadata), owner = useRef(Symbol('Key metadata view')).current
  if (publish === null) throw new Error('Missing Key presentation boundary')
  useLayoutEffect(() => {
    publish({ owner, value })
    return () => publish(previous => previous?.owner === owner ? null : previous)
  }, [publish, owner, value])
  return null
}

function ttlLabel(value: string): string {
  if (value === '-1') return '∞'
  const ms = BigInt(value)
  if (ms < 0n) return '—'
  if (ms >= 86_400_000n) return `${ms / 86_400_000n}d`
  if (ms >= 3_600_000n) return `${ms / 3_600_000n}h`
  if (ms >= 60_000n) return `${ms / 60_000n}m`
  return ms >= 1000n ? `${ms / 1000n}s` : `${ms}ms`
}

export function KeyMetadataSummary({ t, inspect }: { readonly t: TranslateNS<typeof NS>; readonly inspect: () => void }) {
  const metadata = useContext(HeaderMetadata)
  if (metadata === null) return null
  const ttl = metadata.ttlMs === '-1' ? t('value.persistent') : metadata.ttlMs === '-2' ? t('value.state.missing') : `${metadata.ttlMs} ms`
  return <button type="button" className="redis-key-facts" aria-label={`${t('ui.metadata')} · ${metadata.type} · TTL: ${ttl}`} title={`TYPE: ${metadata.type} · TTL: ${ttl}`} onClick={inspect}>
    <span className="redis-type">{metadata.type}</span><span className="redis-ttl"><Icon name="history" />{ttlLabel(metadata.ttlMs)}</span>
  </button>
}
