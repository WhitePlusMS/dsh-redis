import { useEffect, useState } from 'react'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import { MAX_URI_CHARACTERS, parseConnectionUri, type ParsedConnectionUri } from '../connection-uri.ts'
import { NS } from './locales.ts'

type Props = { readonly t: TranslateNS<typeof NS>; readonly open: boolean; readonly disabled: boolean; readonly apply: (value: ParsedConnectionUri) => void }

/** URI text is secret input. Only the existing form receives parsed credentials. */
export function ConnectionUri(props: Props) {
  const [uri, setUri] = useState(''), [error, setError] = useState(false), [db, setDb] = useState<number | null>(null)
  useEffect(() => { if (!props.open) { setUri(''); setError(false); setDb(null) } }, [props.open])
  return <details className="redis-profile-tools">
    <summary>{props.t('connection.uri')}</summary>
    <fieldset disabled={props.disabled}>
      <label>{props.t('connection.uri')}<input name="connectionUri" type="password" value={uri} maxLength={MAX_URI_CHARACTERS} onChange={event => { setUri(event.target.value); setError(false); setDb(null) }} autoComplete="off" spellCheck={false} /></label>
      <div className="redis-actions"><button type="button" disabled={uri.trim() === ''} onClick={() => {
        const parsed = parseConnectionUri(uri)
        setUri(''); setError(parsed === null); setDb(parsed?.db ?? null)
        if (parsed !== null) props.apply(parsed)
      }}>{props.t('connection.applyUri')}</button></div>
    </fieldset>
    {error && <p role="alert" className="redis-error">{props.t('connection.uriError')}</p>}
    {db !== null && <p role="status">{props.t('connection.uriDb')} {db}</p>}
    <p>{props.t('connection.uriHint')}</p>
  </details>
}
