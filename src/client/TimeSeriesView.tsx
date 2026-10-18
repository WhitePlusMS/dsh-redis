import { useState } from 'react'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import { MAX_TIMESERIES_SAMPLES, type DatabaseTarget, type RedisKey, type TimeSeriesReadRequest, type TimeSeriesReadResult, type TimeSeriesSample } from '../domain.ts'
import { timeSeriesReadRequestSchema } from '../typert.shared.ts'
import { CollectionTable, type CollectionColumn } from './CollectionTable.tsx'
import { appendTimeSeriesSamples, emptyTimeSeriesCache, type TimeSeriesCache } from './timeseries-cache.ts'
import { useCollectionScan } from './use-collection-scan.ts'
import { NS } from './locales.ts'
import { TimeSeriesChart } from './TimeSeriesChart.tsx'
import { PresentKeyMetadata } from './KeyPresentation.tsx'
import { ReadActions, QueryToggle, ScanProgress } from './ReadControls.tsx'

export interface TimeSeriesActions { readonly readTimeSeries: (request: TimeSeriesReadRequest, signal: AbortSignal) => Promise<RemoteResult<TimeSeriesReadResult>> }
type Props = TimeSeriesActions & { readonly target: DatabaseTarget; readonly selected: RedisKey; readonly t: TranslateNS<typeof NS> }

/** Bounded raw samples and a local chart share the same cache and read lifecycle. */
export function TimeSeriesView(props: Props) {
  const { t } = props
  const [view, setView] = useState<'table' | 'chart'>('table')
  const [optionsOpen, setOptionsOpen] = useState(false)
  const [direction, setDirection] = useState<'forward' | 'reverse'>('forward')
  const [start, setStart] = useState('-'), [end, setEnd] = useState('+'), [count, setCount] = useState(MAX_TIMESERIES_SAMPLES)
  const [range, setRange] = useState({ start: '-', end: '+', count: MAX_TIMESERIES_SAMPLES, attempt: 0 }), [rangeError, setRangeError] = useState(false)
  const page = useCollectionScan<TimeSeriesCache, TimeSeriesReadResult>({ target: props.target, keyBase64: props.selected.base64, queryKey: JSON.stringify([direction, range]), empty: emptyTimeSeriesCache,
    append: (previous, response) => appendTimeSeriesSamples(previous, response.samples),
    load: (cursor, signal) => props.readTimeSeries({ target: props.target, keyBase64: props.selected.base64, direction, start: range.start, end: range.end, count: range.count, cursor }, signal),
  })
  const { result, cache, cursor, busy, error, progress } = page
  const columns: readonly CollectionColumn<TimeSeriesSample>[] = [
    { id: 'timestamp', title: t('timeseries.timestamp'), render: sample => <span data-ts-timestamp={sample.timestamp}>{sample.timestamp}</span> },
    { id: 'value', title: t('timeseries.value'), render: sample => <span data-ts-value={sample.timestamp}>{sample.value}</span> },
  ]
  return <section className="redis-details redis-timeseries" aria-label={t('timeseries.title')}>
    <PresentKeyMetadata value={result?.metadata ?? null} />
    <h2>{t('timeseries.title')} · <span>{props.selected.label}</span></h2>
    <div className="redis-view-tools"><label><span className="redis-sr-only">{t('stream.direction')}</span><select name="timeseriesDirection" title={t('stream.direction')} value={direction} onChange={event => { page.clear(); setRangeError(false); setDirection(event.target.value === 'reverse' ? 'reverse' : 'forward') }}><option value="forward">{t('timeseries.forward')}</option><option value="reverse">{t('timeseries.reverse')}</option></select></label><ReadActions t={t} busy={busy} refresh={() => page.scan(false)} cancel={page.cancel}><QueryToggle label={t('read.range')} open={optionsOpen} active={range.start !== '-' || range.end !== '+'} toggle={() => setOptionsOpen(value => !value)} /></ReadActions></div>
    {optionsOpen && <form onSubmit={event => {
      event.preventDefault()
      try { timeSeriesReadRequestSchema.parse({ target: props.target, keyBase64: props.selected.base64, direction, start, end, count, cursor: null }); setRangeError(false); setRange({ start, end, count, attempt: range.attempt + 1 }); setOptionsOpen(false) }
      catch { setRangeError(true) }
    }}>
      <div className="redis-address redis-bounds">
        <label>{t('timeseries.start')}<input name="timeseriesStart" required maxLength={19} value={start} onChange={event => setStart(event.target.value)} /></label>
        <label>{t('timeseries.end')}<input name="timeseriesEnd" required maxLength={19} value={end} onChange={event => setEnd(event.target.value)} /></label>
      </div>
      <label>{t('timeseries.count')}<select name="timeseriesCount" value={count} onChange={event => setCount(Number(event.target.value))}>{[1, 10, 25, MAX_TIMESERIES_SAMPLES].map(size => <option key={size} value={size}>{size}</option>)}</select></label>
      <div className="redis-actions">
        <button type="submit" disabled={busy}>{t('workbench.apply')}</button>
      </div>
    </form>}

    <div className="redis-collection-state"><ScanProgress t={t} busy={busy} progress={progress} /><span title={t('timeseries.loaded')}><b data-loaded-samples>{cache.samples.length}</b>{range.start === '-' && range.end === '+' && result?.info !== null && result?.info !== undefined ? ` / ${result.info.totalSamples}` : ` ${t('read.items')}`}</span>{(range.start !== '-' || range.end !== '+') && <button type="button" className="redis-chip" title={t('stream.bounds')} onClick={() => setOptionsOpen(true)}>{range.start} … {range.end}</button>}</div>
    {rangeError && <p role="alert" className="redis-error">{t('timeseries.rangeError')}</p>}
    {error !== null && <p role="alert" className="redis-error">{t(`connection.error.${error}`)}</p>}
    {result !== null && <>
      {result.metadata !== null && <dl className="redis-metadata redis-key-metadata"><dt>TYPE</dt><dd>{result.metadata.type}</dd><dt>TTL (ms)</dt><dd>{result.metadata.ttlMs === '-1' ? t('value.persistent') : result.metadata.ttlMs}</dd></dl>}
      {result.state !== 'page' && result.state !== 'failed' && <p role="status">{t(result.state === 'unsupported' || result.state === 'unavailable' ? `timeseries.${result.state}` : `value.state.${result.state}`)}</p>}
      {result.infoState !== null && result.infoState !== 'available' && <p role="status" data-ts-info-status={result.infoState}>{t(`timeseries.info.${result.infoState}`)}</p>}
      {result.info !== null && <dl className="redis-metadata redis-secondary-metadata"><dt>{t('timeseries.total')}</dt><dd data-ts-total>{result.info.totalSamples}</dd><dt>{t('timeseries.first')}</dt><dd>{result.info.firstTimestamp}</dd><dt>{t('timeseries.last')}</dt><dd>{result.info.lastTimestamp}</dd><dt>{t('timeseries.retention')}</dt><dd>{result.info.retentionTime}</dd></dl>}
    </>}
    <div className="redis-actions redis-data-views" role="group" aria-label={t('chart.title')}><button type="button" aria-pressed={view === 'table'} onClick={() => setView('table')}>{t('chart.table')}</button><button type="button" aria-pressed={view === 'chart'} onClick={() => setView('chart')}>{t('chart.view')}</button></div>
    {view === 'chart' ? <TimeSeriesChart samples={cache.samples} t={t} /> : (cache.samples.length > 0 || cursor !== null) ? <CollectionTable rows={cache.samples} identity={sample => sample.timestamp} columns={columns} label={t('timeseries.title')} loading={busy} onEnd={cursor === null || cache.limited || error !== null ? undefined : () => page.scan(true)} /> : result?.state === 'page' && <p>{t('timeseries.empty')}</p>}
  </section>
}
