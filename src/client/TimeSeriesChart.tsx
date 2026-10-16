import { useMemo, useRef, useState, type KeyboardEvent } from 'react'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type { TimeSeriesSample } from '../domain.ts'
import { MAX_CHART_POINTS, projectSamples, sampleUtc, type PlotPoint } from './timeseries-plot.ts'
import { NS } from './locales.ts'

const xAt = (point: PlotPoint): number => 24 + point.x * 552
const yAt = (point: PlotPoint): number => 280 - point.y * 260

/** A local projection only: exact text remains on every dot and in the selected point. */
export function TimeSeriesChart({ samples, t }: { readonly samples: readonly TimeSeriesSample[]; readonly t: TranslateNS<typeof NS> }) {
  const plot = useMemo(() => projectSamples(samples), [samples])
  const [selected, setSelected] = useState<string | null>(null), viewport = useRef<HTMLDivElement>(null)
  const active = plot.points.find(point => point.timestamp === selected) ?? plot.points[0]
  const utc = active === undefined ? null : sampleUtc(active.timestamp)
  function navigate(event: KeyboardEvent<SVGSVGElement>): void {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    const current = Math.max(0, plot.points.findIndex(point => point.timestamp === active?.timestamp))
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? plot.points.length - 1 : Math.max(0, Math.min(plot.points.length - 1, current + (event.key === 'ArrowRight' ? 1 : -1)))
    const point = plot.points[next]
    if (point === undefined) return
    setSelected(point.timestamp)
    // Follow the selected dot inside this viewport, without scrolling the DSH document.
    const element = viewport.current
    if (element !== null) element.scrollLeft = xAt(point) / 600 * element.scrollWidth - element.clientWidth / 2
  }
  if (plot.state === 'invalid') return <p role="alert" className="redis-error">{t('chart.invalid')}</p>
  if (plot.state === 'empty') return <p data-ts-chart-empty>{t('chart.empty')}</p>
  return <div className="redis-ts-chart">
    <p data-ts-chart-coverage>{t('chart.drawn')} <span data-ts-chart-count>{plot.points.length}</span> / {plot.loaded} · {t('chart.scope')}</p>
    {plot.omitted > 0 && <p role="status" data-ts-chart-omitted>{t('chart.notDrawn')} {plot.omitted} · {t('chart.prefix')} {MAX_CHART_POINTS}</p>}
    <div ref={viewport} className="redis-chart-viewport">
      <svg data-ts-chart-svg viewBox="0 0 600 300" role="group" tabIndex={0} aria-label={t('chart.title') + '. ' + t('chart.keyboard')} onKeyDown={navigate}>
        <path className="redis-chart-grid" d="M24 20H576M24 150H576M24 280H576M24 20V280" />
        {plot.points.length > 1 && <polyline className="redis-chart-line" points={plot.points.map(point => xAt(point) + ',' + yAt(point)).join(' ')} />}
        {plot.points.map(point => <circle key={point.timestamp} className="redis-chart-dot" data-ts-chart-timestamp={point.timestamp} data-ts-chart-value={point.value} data-chart-selected={point.timestamp === active?.timestamp} cx={xAt(point)} cy={yAt(point)} r={point.timestamp === active?.timestamp ? 4 : 2.5} onMouseEnter={() => setSelected(point.timestamp)} onClick={() => setSelected(point.timestamp)}><title>{point.timestamp + ' ms · ' + point.value}</title></circle>)}
      </svg>
    </div>
    <div className="redis-chart-stats">
      <dl><dt>{t('chart.from')}</dt><dd data-ts-chart-from>{plot.from}</dd></dl><dl><dt>{t('chart.to')}</dt><dd data-ts-chart-to>{plot.to}</dd></dl>
      <dl><dt>{t('chart.min')}</dt><dd>{plot.minValue}</dd></dl><dl><dt>{t('chart.max')}</dt><dd>{plot.maxValue}</dd></dl>
    </div>
    {active !== undefined && <dl className="redis-metadata redis-chart-point" data-ts-chart-active={active.timestamp} aria-live="polite">
      <dt>{t('chart.timestamp')}</dt><dd data-ts-chart-time>{active.timestamp}</dd><dt>{t('chart.value')}</dt><dd data-ts-chart-value-text>{active.value}</dd>
      <dt>UTC</dt><dd data-ts-chart-utc>{utc ?? t('chart.noDate')}</dd>
    </dl>}
  </div>
}
