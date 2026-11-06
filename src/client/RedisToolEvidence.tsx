import type { Context } from '@deepseek-ai/cordis'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { ToolCallViewProps } from '@deepseek-ai/dsh-client-ui-tool/client'
import { redisEvidence, type EvidenceRow } from './tool-evidence.ts'
import { evidenceTools } from '../redis-read-tools.ts'
import { parseRedisAnswer, type RedisAnswerSection } from '../redis-answer.ts'
import { EVIDENCE_NS, evidenceEn, evidenceZh } from './tool-evidence-locales.ts'

type Props = ToolCallViewProps & PropsLocale<typeof EVIDENCE_NS>

/** The transcript answer and expandable tool record render identical facts. */
export function RedisAnswerContent({ answers }: { readonly answers: readonly RedisAnswerSection[] }) {
  return <>{answers.map(item => <div key={item.callId}>
    {item.paragraphs.map((paragraph, index) => <p key={index} style={{ margin: '6px 0', overflowWrap: 'anywhere' }}>{paragraph}</p>)}
    {item.values.map((value, index) => <div key={index}><span>{value.label}</span><pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', maxHeight: '320px', overflow: 'auto' }}>{value.text}</pre></div>)}
  </div>)}</>
}

function EvidenceRows({ rows }: { readonly rows: readonly EvidenceRow[] }) {
  return <dl style={{ display: 'grid', gridTemplateColumns: 'max-content minmax(0,1fr)', gap: '2px 12px', fontSize: '12px' }}>
    {rows.map(row => <div key={row.label} style={{ display: 'contents' }}><dt>{row.label}</dt><dd style={{ margin: 0, overflowWrap: 'anywhere', whiteSpace: 'pre-wrap' }}>{row.value}</dd></div>)}
  </dl>
}

/** DSH supplies the owning call and session. No state survives across tool records. */
export function RedisToolEvidence(props: Props) {
  const { t } = props
  if (props.phase !== 'result') return <div data-redis-tool={props.toolName} role="status">{t('title')} · {t(props.phase === 'preparing' ? 'preparing' : 'running')}</div>
  const { block } = props
  const raw = block.content.map(item => item.type === 'text' ? item.text : JSON.stringify(item)).join('\n')
  const answer = !block.isError && props.toolName === 'redis_viewer_answer' ? parseRedisAnswer(raw) : null
  if (answer !== null) return <section data-redis-tool={props.toolName} data-call-id={props.callId} aria-label={t('answer')}>
    <RedisAnswerContent answers={answer} />
    {props.inspect !== undefined && <button type="button" onClick={props.inspect}>{t('inspect')}</button>}
  </section>
  const evidence = block.isError ? null : redisEvidence(props.toolName, raw)
  return <section data-redis-tool={props.toolName} data-call-id={props.callId} aria-label={t('title')}
    style={{ borderLeft: '2px solid var(--dsw-alias-border-l2)', padding: '4px 12px', minWidth: 0 }}>
    <strong>{t(block.isError ? 'failed' : 'title')}</strong>
    {evidence !== null && <>
      <EvidenceRows rows={evidence.rows} />
      {evidence.values.map(row => <div key={row.label}>
        <span style={{ fontSize: '12px' }}>{row.label}</span>
        <pre style={{ margin: '4px 0 8px', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', maxHeight: '240px', overflow: 'auto', fontSize: '12px' }}>{row.value}</pre>
      </div>)}
      {evidence.notes.map(note => <p key={note} style={{ margin: '6px 0', fontSize: '12px', color: 'var(--dsw-alias-label-secondary)' }}>{t(note)}</p>)}
      {evidence.details.length > 0 && <details><summary>{t('details')}</summary><EvidenceRows rows={evidence.details} /></details>}
    </>}
    <details><summary>{t('raw')}</summary><pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', maxHeight: '360px', overflow: 'auto', fontSize: '12px' }}>{evidence?.raw ?? (raw || block.error?.code || '')}</pre></details>
    {props.inspect !== undefined && <button type="button" onClick={props.inspect}>{t('inspect')}</button>}
  </section>
}

export function registerRedisEvidence(ctx: Context): void {
  ctx.effect(() => ctx.locale.register(EVIDENCE_NS, { zh: evidenceZh, en: evidenceEn }), 'redis evidence dictionaries')
  for (const key of [...evidenceTools, 'redis_viewer_answer']) ctx.effect(() => ctx.slots.inject('tool.call.toolview', () => ctx.slots.register({
    name: 'tool.call.toolview', key, locale: EVIDENCE_NS,
  }, RedisToolEvidence)), `redis evidence ${key}`)
}
