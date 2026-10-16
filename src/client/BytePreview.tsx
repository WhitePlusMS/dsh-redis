import { useMemo } from 'react'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type { StringReadResult } from '../domain.ts'
import { previewValue, type PreviewFormat } from './value-preview.ts'
import { NS } from './locales.ts'

type Window = Pick<StringReadResult, 'base64' | 'prefix' | 'suffix' | 'offset' | 'complete'>
const formats: readonly PreviewFormat[] = ['text', 'json', 'hex', 'base64', 'decode-text', 'decode-json']

/** The same byte formatter serves String windows and collection cells. */
export function BytePreview({ value, t, format, onFormatChange }: { readonly value: Window; readonly t: TranslateNS<typeof NS>; readonly format: PreviewFormat; readonly onFormatChange: (format: PreviewFormat) => void }) {
  const preview = useMemo(() => previewValue(value, format), [value, format])
  return <>
    <label>{t('value.format')}<select name="valueFormat" value={format} onChange={event => {
      const choice = formats.find(value => value === event.target.value); if (choice !== undefined) onFormatChange(choice)
    }}>{formats.map(value => <option key={value} value={value}>{t(`value.format.${value}`)}</option>)}</select></label>
    {preview.error !== null ? <p role="alert" className="redis-error">{t(`value.error.${preview.error}`)}</p> : <pre className="redis-value" data-value-preview tabIndex={0}>{preview.text}</pre>}
    {preview.contextBytes > 0 && <p>{t('value.context')} {preview.contextBytes} {t('keys.bytes')}</p>}
  </>
}
