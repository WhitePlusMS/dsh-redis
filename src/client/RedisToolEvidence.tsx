import type { Context } from '@deepseek-ai/cordis'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { ToolCallViewProps } from '@deepseek-ai/dsh-client-ui-tool/client'
import { evidenceTools, redisEvidence } from './tool-evidence.ts'
import { EVIDENCE_NS, evidenceEn, evidenceZh } from './tool-evidence-locales.ts'

type Props = ToolCallViewProps & PropsLocale<typeof EVIDENCE_NS>

/** DSH supplies the owning call and session. No state survives across tool records. */
export function RedisToolEvidence(props: Props) {
  const { t } = props
  if (props.phase !== 'result') return <div data-redis-tool={props.toolName} role="status">{t('title')} · {t(props.phase === 'preparing' ? 'preparing' : 'running')}</div>
  const { block } = props
  const raw = block.content.map(item => item.type === 'text' ? item.text : JSON.stringify(item)).join('\n')
  const evidence = block.isError ? null : redisEvidence(props.toolName, raw)
  return <section data-redis-tool={props.toolName} data-call-id={props.callId} aria-label={t('title')}
    style={{ borderLeft: '2px solid var(--dsw-alias-border-l2)', padding: '4px 12px', minWidth: 0 }}>
    <strong>{t(block.isError ? 'failed' : 'title')}</strong>
    {evidence !== null && <>
      <dl style={{ display: 'grid', gridTemplateColumns: 'max-content minmax(0,1fr)', gap: '2px 12px', fontSize: '12px' }}>
        {evidence.rows.map(row => <div key={row.label} style={{ display: 'contents' }}><dt>{row.label}</dt><dd style={{ margin: 0, overflowWrap: 'anywhere', whiteSpace: 'pre-wrap' }}>{row.value}</dd></div>)}
      </dl>
      {evidence.notes.map(note => <p key={note} style={{ margin: '6px 0', fontSize: '12px', color: 'var(--dsw-alias-label-secondary)' }}>{t(note)}</p>)}
    </>}
    <details><summary>{t('raw')}</summary><pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', maxHeight: '360px', overflow: 'auto', fontSize: '12px' }}>{evidence?.raw ?? (raw || block.error?.code || '')}</pre></details>
    {props.inspect !== undefined && <button type="button" onClick={props.inspect}>{t('inspect')}</button>}
  </section>
}

export function registerRedisEvidence(ctx: Context): void {
  ctx.effect(() => ctx.locale.register(EVIDENCE_NS, { zh: evidenceZh, en: evidenceEn }), 'redis evidence dictionaries')
  for (const key of evidenceTools) ctx.effect(() => ctx.slots.inject('tool.call.toolview', () => ctx.slots.register({
    name: 'tool.call.toolview', key, locale: EVIDENCE_NS,
  }, RedisToolEvidence)), `redis evidence ${key}`)
}
