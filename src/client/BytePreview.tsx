import { useEffect, useMemo, useRef, useState } from 'react'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type { StringReadResult } from '../domain.ts'
import { previewValue, type PreviewFormat } from './value-preview.ts'
import { NS } from './locales.ts'
import { Icon } from './Icon.tsx'

type Window = Pick<StringReadResult, 'base64' | 'prefix' | 'suffix' | 'offset' | 'complete'>
const formats: readonly PreviewFormat[] = ['text', 'json', 'hex', 'base64']
const decodedFormats: readonly PreviewFormat[] = ['decode-text', 'decode-json']

/** The same byte formatter serves String windows and collection cells. */
export function BytePreview({ value, t, format, onFormatChange }: { readonly value: Window; readonly t: TranslateNS<typeof NS>; readonly format: PreviewFormat; readonly onFormatChange: (format: PreviewFormat) => void }) {
  const preview = useMemo(() => previewValue(value, format), [value, format])
  const [copyState, setCopyState] = useState<'copied' | 'failed' | null>(null)
  const copySequence = useRef(0)
  useEffect(() => { ++copySequence.current; setCopyState(null); return () => { ++copySequence.current } }, [preview.text, format])
  return <>
    <div className="redis-format-toolbar" role="group" aria-label={t('value.format')}>
      {formats.map(choice => <button key={choice} type="button" data-value-format={choice} aria-pressed={format === choice} onClick={() => onFormatChange(choice)}>{choice === 'base64' ? 'Base64' : t(`value.format.${choice}`)}</button>)}
      <select name="decodeFormat" aria-label={t('ui.decode')} value={decodedFormats.includes(format) ? format : ''} onChange={event => { const choice = decodedFormats.find(value => value === event.target.value); if (choice !== undefined) onFormatChange(choice) }}>
        <option value="" disabled>{t('ui.decode')}</option>{decodedFormats.map(choice => <option key={choice} value={choice}>{t(`value.format.${choice}`)}</option>)}
      </select>
      <button type="button" className="redis-icon-button redis-copy-button" title={t('ui.copy')} aria-label={t('ui.copy')} disabled={preview.error !== null} onClick={() => {
        const current = ++copySequence.current
        if (navigator.clipboard === undefined) { setCopyState('failed'); return }
        void navigator.clipboard.writeText(preview.text).then(() => { if (current === copySequence.current) setCopyState('copied') }).catch(() => { if (current === copySequence.current) setCopyState('failed') })
      }}><Icon name="copy" /></button>
      {copyState !== null && <small role="status">{t(copyState === 'copied' ? 'ui.copied' : 'ui.copyError')}</small>}
    </div>
    {preview.error !== null ? <p role="alert" className="redis-error">{t(`value.error.${preview.error}`)}</p> : <pre className="redis-value" data-value-preview tabIndex={0}>{preview.text}</pre>}
    {preview.contextBytes > 0 && <p>{t('value.context')} {preview.contextBytes} {t('keys.bytes')}</p>}
  </>
}
