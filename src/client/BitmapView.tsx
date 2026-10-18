import { useAutoRefreshReader } from './AutoRefresh.tsx'
import { useEffect, useRef, useState } from 'react'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type { DatabaseTarget, RedisKey, StringReadResult } from '../domain.ts'
import type { StringActions } from './KeyDetails.tsx'
import { bitmapByteRange, bitmapWindow, MAX_BITMAP_BITS, type BitmapWindow, type BitmapRow } from './bitmap-preview.ts'
import { CollectionTable, type CollectionColumn } from './CollectionTable.tsx'
import { NS } from './locales.ts'
import { PresentKeyMetadata } from './KeyPresentation.tsx'
import { ReadActions, QueryToggle } from './ReadControls.tsx'
import { Icon } from './Icon.tsx'

type Props = StringActions & { readonly target: DatabaseTarget; readonly selected: RedisKey; readonly t: TranslateNS<typeof NS> }

/** Explicit String interpretation using the existing bounded, cancellable read;
 * no BITFIELD/SETBIT operation or automatic type inference is introduced.
 */
export function BitmapView(props: Props) {
  const { t } = props
  const [offset, setOffset] = useState('0'), [count, setCount] = useState(256)
  const [request, setRequest] = useState({ offset: '0', count: 256, attempt: 0 })
  const [result, setResult] = useState<StringReadResult | null>(null), [window, setWindow] = useState<BitmapWindow | null>(null)
  const [busy, setBusy] = useState(false), [rpcError, setRpcError] = useState(false), [cancelled, setCancelled] = useState(false), [rangeError, setRangeError] = useState(false)
  const active = useRef<AbortController | null>(null)
  const [optionsOpen, setOptionsOpen] = useState(false)
  const auto = useAutoRefreshReader({ active: true, busy, result, failed: rpcError, refresh: () => setRequest(value => ({ ...value, attempt: value.attempt + 1 })), cancel: cancelRead })
  function cancelRead(): void { auto.reset('cancelled'); active.current?.abort(); setBusy(false); setCancelled(true); setResult(null); setWindow(null) }
  useEffect(() => {
    if (!auto.begin()) return
    const controller = new AbortController(); active.current = controller
    setBusy(true); setResult(null); setWindow(null); setRpcError(false); setCancelled(false)
    const bytes = bitmapByteRange(request)
    void props.readString({ target: props.target, keyBase64: props.selected.base64, ...bytes }, controller.signal).then(response => {
      if (controller.signal.aborted) return
      if (response.ok) {
        const next = response.value.state === 'value' ? bitmapWindow(response.value, request) : null
        setResult(response.value); setWindow(next)
      } else setRpcError(true)
    }).catch(() => { if (!controller.signal.aborted) setRpcError(true) })
      .finally(() => { if (!controller.signal.aborted) setBusy(false) })
    return () => controller.abort()
  }, [props.readString, props.target.id, props.target.generation, props.target.db, props.selected.base64, request])
  const columns: readonly CollectionColumn<BitmapRow>[] = [
    { id: 'offset', title: t('bitmap.offset'), render: row => row.offset },
    { id: 'bits', title: t('bitmap.bits'), render: row => <code data-bitmap-offset={row.offset} data-bitmap-bits>{row.bits}</code> },
  ]
  return <section className="redis-details" aria-label={t('bitmap.title')}>
    <PresentKeyMetadata value={result?.metadata ?? null} />
    <h2>{t('bitmap.title')} · <span>{props.selected.label}</span></h2>
    <div className="redis-view-tools"><span className="redis-chip">Bitmap</span><ReadActions t={t} busy={busy} refresh={() => setRequest(value => ({ ...value, attempt: value.attempt + 1 }))} cancel={cancelRead}>
      <button type="button" className="redis-icon-button" title={t('bitmap.next')} aria-label={t('bitmap.next')} disabled={busy || window?.nextOffset === null || window === null} onClick={() => {
        if (window?.nextOffset === null || window === null) return
        setOffset(window.nextOffset); setCount(request.count); setRequest({ offset: window.nextOffset, count: request.count, attempt: request.attempt + 1 })
      }}><Icon name="right" /></button>
      <QueryToggle label={t('read.range')} open={optionsOpen} active={request.offset !== '0'} toggle={() => setOptionsOpen(value => !value)} />
    </ReadActions></div>
    {optionsOpen && <form onSubmit={event => {
      event.preventDefault()
      try { bitmapByteRange({ offset, count }); setRangeError(false); setRequest({ offset, count, attempt: request.attempt + 1 }); setOptionsOpen(false) }
      catch { setRangeError(true) }
    }}>
      <div className="redis-address">
        <label>{t('bitmap.offset')}<input name="bitOffset" required inputMode="numeric" maxLength={19} value={offset} onChange={event => setOffset(event.target.value)} /></label>
        <label>{t('bitmap.count')}<select name="bitCount" value={count} onChange={event => setCount(Number(event.target.value))}>{[8, 64, 256, 1024, MAX_BITMAP_BITS].map(size => <option key={size} value={size}>{size}</option>)}</select></label>
      </div>
      <div className="redis-actions">
        <button type="submit" disabled={busy}>{t('workbench.apply')}</button>
      </div>
    </form>}

    {rangeError && <p role="alert" className="redis-error">{t('bitmap.rangeError')}</p>}
    {rpcError && <p role="alert" className="redis-error">{t('connection.error.rpc')}</p>}
    {cancelled && <p role="status">{t('connection.error.cancelled')}</p>}
    {result !== null && <>
      {result.metadata !== null && <dl className="redis-metadata redis-key-metadata"><dt>TYPE</dt><dd>{result.metadata.type}</dd><dt>TTL (ms)</dt><dd>{result.metadata.ttlMs === '-1' ? t('value.persistent') : result.metadata.ttlMs}</dd></dl>}
      {result.state === 'failed' && result.error !== null ? <p role="alert" className="redis-error">{t(`connection.error.${result.error}`)}</p> : result.state !== 'value' && <p role="status">{t(result.state === 'unsupported' ? 'bitmap.unsupported' : `value.state.${result.state}`)}</p>}
    </>}
    {window !== null && <>
      <div className="redis-collection-state" data-bitmap-coverage data-bitmap-start={window.offset} title={`${t('bitmap.total')}: ${window.totalBits} · ${t('bitmap.offset')}: ${window.offset} · ${t('bitmap.returned')}: ${window.count}`}><span className="redis-chip">#{window.offset}–{window.count === 0 ? window.offset : (BigInt(window.offset) + BigInt(window.count) - 1n).toString()}</span><b data-bitmap-count>{window.count}</b> bits · {t('bitmap.total')} {window.totalBits}</div>
      {window.count === 0 ? <p>{t('bitmap.empty')}</p> : <CollectionTable rows={window.rows} identity={row => row.offset} columns={columns} label={t('bitmap.title')} />}
    </>}
  </section>
}
