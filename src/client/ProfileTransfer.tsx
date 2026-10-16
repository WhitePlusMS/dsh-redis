import { useEffect, useRef, useState } from 'react'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import { MAX_PROFILE_DOCUMENT_BYTES, MAX_PROFILES, type ImportProfilesRequest, type PortableConnection, type SavedConnection } from '../domain.ts'
import { importProfilesSchema } from '../typert.shared.ts'
import { conflictingProfiles, parseProfileDocument, serializeProfileDocument } from '../profile-transfer.ts'
import { NS } from './locales.ts'

type Row = { readonly value: PortableConnection; readonly include: boolean }
type Props = { readonly t: TranslateNS<typeof NS>; readonly open: boolean; readonly disabled: boolean; readonly profiles: readonly SavedConnection[]; readonly import: (request: ImportProfilesRequest) => Promise<boolean> }

/** Owns a bounded preview only; ProfileChooser remains the sole saved-list owner. */
export function ProfileTransfer(props: Props) {
  const [rows, setRows] = useState<readonly Row[]>([]), [reading, setReading] = useState(false)
  const [error, setError] = useState(false), [imported, setImported] = useState(false)
  const sequence = useRef(0)
  useEffect(() => {
    if (!props.open) { ++sequence.current; setRows([]); setError(false); setImported(false); setReading(false) }
    return () => { ++sequence.current }
  }, [props.open])
  const selected = rows.filter(row => row.include).map(({ value }) => {
    const { group, ...entry } = value
    return { ...entry, name: entry.name.trim(), ...(group?.trim() ? { group: group.trim() } : {}) }
  })
  let valid = true
  if (selected.length !== 0) { try { importProfilesSchema.parse({ profiles: selected }) } catch { valid = false } }
  const conflicts = conflictingProfiles(props.profiles, selected)
  const disabled = props.disabled || reading
  async function read(file: File): Promise<void> {
    const current = ++sequence.current
    setReading(true); setRows([]); setError(false); setImported(false)
    try {
      if (file.size > MAX_PROFILE_DOCUMENT_BYTES) throw new Error('Document limit')
      const bytes = await file.arrayBuffer()
      if (bytes.byteLength > MAX_PROFILE_DOCUMENT_BYTES) throw new Error('Document limit')
      // Reject damaged UTF-8 instead of replacing bytes in an imported address.
      const document = parseProfileDocument(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
      if (current === sequence.current) setRows(document.profiles.map(value => ({ value, include: true })))
    } catch { if (current === sequence.current) setError(true) }
    finally { if (current === sequence.current) setReading(false) }
  }
  function edit(index: number, field: 'name' | 'group', value: string): void {
    setImported(false)
    setRows(previous => previous.map((row, i) => i === index ? { ...row, value: { ...row.value, [field]: value } } : row))
  }
  return <details className="redis-profile-tools">
    <summary>{props.t('profile.transfer')}</summary>
    <fieldset disabled={disabled}>
      <div className="redis-actions"><button type="button" disabled={props.profiles.length === 0} onClick={() => {
        let url: string | null = null
        const anchor = document.createElement('a')
        try {
          const content = serializeProfileDocument(props.profiles)
          url = URL.createObjectURL(new Blob([content], { type: 'application/json;charset=utf-8' }))
          anchor.href = url; anchor.download = 'dsh-redis-connections.json'
          document.body.append(anchor); anchor.click()
          setError(false)
        } catch { setError(true) }
        finally { anchor.remove(); if (url !== null) URL.revokeObjectURL(url) }
      }}>{props.t('profile.export')}</button></div>
      <label>{props.t('profile.file')}<input name="profilesFile" type="file" accept="application/json,.json" onChange={event => {
        const file = event.currentTarget.files?.[0]
        event.currentTarget.value = ''
        if (file !== undefined) void read(file)
      }} /></label>
      {rows.length !== 0 && <div className="redis-import-preview" aria-label={props.t('profile.preview')}>
        {rows.map((row, index) => <fieldset key={index} className="redis-import-row" data-profile-preview-row={index}>
          <label className="redis-checkbox"><input type="checkbox" checked={row.include} onChange={event => { setImported(false); setRows(previous => previous.map((value, i) => i === index ? { ...value, include: event.target.checked } : value)) }} />{props.t('profile.include')} {index + 1}</label>
          <div className="redis-address redis-bounds">
            <label>{props.t('profile.name')}<input name="importProfileName" maxLength={80} value={row.value.name} onChange={event => edit(index, 'name', event.target.value)} autoComplete="off" /></label>
            <label>{props.t('profile.group')}<input name="importProfileGroup" maxLength={80} value={row.value.group ?? ''} onChange={event => edit(index, 'group', event.target.value)} autoComplete="off" /></label>
          </div>
          <p>{row.value.settings.host}:{row.value.settings.port}{row.value.settings.tls ? ' · TLS' : ''}</p>
        </fieldset>)}
      </div>}
      {rows.length !== 0 && <div className="redis-actions"><button type="button" disabled={selected.length === 0 || !valid || conflicts.size !== 0 || props.profiles.length + selected.length > MAX_PROFILES} onClick={() => {
        const current = ++sequence.current
        void props.import({ profiles: selected }).then(success => {
          if (current === sequence.current && success) { setRows([]); setImported(true); setError(false) }
        })
      }}>{props.t('profile.import')} ({selected.length})</button></div>}
    </fieldset>
    {(error || !valid) && <p className="redis-error" role="alert">{props.t('profile.invalidDocument')}</p>}
    {conflicts.size !== 0 && <p className="redis-error" role="alert">{props.t('profile.conflict')} {conflicts.size}</p>}
    {props.profiles.length + selected.length > MAX_PROFILES && <p className="redis-error" role="alert">{props.t('profile.limit')}</p>}
    {reading && <p role="status">{props.t('connection.busy')}</p>}
    {imported && <p role="status">{props.t('profile.imported')}</p>}
    <p>{props.t('profile.transferHint')}</p>
  </details>
}
