import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import { MAX_PROFILES, type ConnectionSettings, type ProfileCollection, type ProfileId, type SaveProfileRequest, type SavedConnection } from '../domain.ts'
import { connectionSettingsSchema } from '../typert.shared.ts'
import { Icon } from './Icon.tsx'
import { NS } from './locales.ts'

export interface ProfileActions {
  readonly listProfiles: (signal: AbortSignal) => Promise<RemoteResult<ProfileCollection>>
  readonly saveProfile: (request: SaveProfileRequest, signal: AbortSignal) => Promise<RemoteResult<ProfileCollection>>
  readonly removeProfile: (request: ProfileId, signal: AbortSignal) => Promise<RemoteResult<ProfileCollection>>
}
type Props = ProfileActions & {
  readonly t: TranslateNS<typeof NS>; readonly disabled: boolean; readonly settings: () => ConnectionSettings
  readonly select: (settings: ConnectionSettings | null) => void
  readonly open: boolean; readonly onClose: () => void; readonly children: ReactNode
}

/** List/save replies update metadata only. Only a user's explicit choice fills a
 * profile draft; saving never replaces credentials or the live Redis identity.
 */
export function ProfileChooser(props: Props) {
  const { t } = props
  const [profiles, setProfiles] = useState<readonly SavedConnection[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [name, setName] = useState(''), [group, setGroup] = useState('')
  const [busy, setBusy] = useState(false), [error, setError] = useState<'profile.error' | 'profile.conflict' | 'profile.limit' | null>(null)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const active = useRef<AbortController | null>(null), sequence = useRef(0), dialog = useRef<HTMLDialogElement | null>(null)
  const descriptionId = useId()
  useEffect(() => {
    const element = dialog.current
    if (props.open && !element?.open) element?.showModal()
    else if (!props.open && element?.open) element.close()
    if (!props.open) setConfirmRemove(false)
  }, [props.open])
  async function run(execute: (signal: AbortSignal) => Promise<RemoteResult<ProfileCollection>>, follow = false): Promise<void> {
    active.current?.abort()
    const controller = new AbortController(), current = ++sequence.current
    active.current = controller; setBusy(true); setError(null)
    try {
      const response = await execute(controller.signal)
      if (controller.signal.aborted || current !== sequence.current) return
      if (!response.ok) { setError('profile.error'); return }
      setProfiles(response.value.profiles)
      const id = follow ? response.value.selectedId : selectedId
      const saved = response.value.profiles.find(value => value.id === id)
      if (follow || id !== null && saved === undefined) {
        setSelectedId(saved?.id ?? null); setName(saved?.name ?? ''); setGroup(saved?.group ?? '')
      }
      setConfirmRemove(false)
    } catch { if (!controller.signal.aborted && current === sequence.current) setError('profile.error') }
    finally { if (!controller.signal.aborted && current === sequence.current) setBusy(false) }
  }
  useEffect(() => {
    void run(props.listProfiles)
    return () => { ++sequence.current; active.current?.abort() }
  }, [props.listProfiles])
  const groups = new Map<string, SavedConnection[]>()
  for (const saved of profiles) { const label = saved.group ?? ''; groups.set(label, [...groups.get(label) ?? [], saved]) }
  return <dialog ref={dialog} className="redis-connection-dialog" aria-label={t('connection.settings')} aria-describedby={descriptionId} onClose={props.onClose} onCancel={event => { event.preventDefault(); props.onClose() }}>
    <div className="redis-dialog-heading"><div className="redis-connection-title"><Icon name="database" /><div><h2>{t('connection.settings')}</h2><p id={descriptionId}>{t('connection.subtitle')}</p></div></div><button type="button" className="redis-icon-button" title={t('ui.close')} aria-label={t('ui.close')} onClick={props.onClose}><Icon name="close" /></button></div>
    <div className="redis-dialog-content redis-connection-layout">
      <aside className="redis-profiles" aria-label={t('ui.connections')}><h2>{t('ui.connections')}</h2>
        <fieldset disabled={busy || props.disabled}>
          <label>{t('profile.choose')}<select name="profile" value={selectedId ?? ''} onChange={event => {
            const saved = profiles.find(value => value.id === event.target.value)
            setSelectedId(saved?.id ?? null); setName(saved?.name ?? ''); setGroup(saved?.group ?? ''); setError(null); setConfirmRemove(false)
            props.select(saved?.settings ?? null)
          }}><option value="">{t('profile.new')}</option>{[...groups].map(([label, values]) => <optgroup key={label} label={label || t('profile.ungrouped')}>{values.map(value => <option key={value.id} value={value.id}>{value.name}</option>)}</optgroup>)}</select></label>
          <label>{t('profile.name')}<input name="profileName" value={name} maxLength={80} onChange={event => setName(event.target.value)} autoComplete="off" /></label>
          <details><summary>{t('profile.group')}</summary><label><span className="redis-sr-only">{t('profile.group')}</span><input name="profileGroup" value={group} maxLength={80} onChange={event => setGroup(event.target.value)} autoComplete="off" placeholder={t('profile.ungrouped')} /></label></details>
          <div className="redis-actions">
            <button type="button" disabled={name.trim() === ''} onClick={() => {
              const trimmed = name.trim(), trimmedGroup = group.trim()
              if (profiles.some(value => value.id !== selectedId && value.name === trimmed && (value.group ?? '') === trimmedGroup)) { setError('profile.conflict'); return }
              if (selectedId === null && profiles.length >= MAX_PROFILES) { setError('profile.limit'); return }
              try {
                const settings = connectionSettingsSchema.parse(props.settings())
                void run(signal => props.saveProfile({ id: selectedId, name: trimmed, ...(trimmedGroup ? { group: trimmedGroup } : {}), settings }, signal), true)
              } catch { setError('profile.error') }
            }}>{t(selectedId === null ? 'profile.save' : 'profile.update')}</button>
            <button type="button" disabled={selectedId === null} onClick={() => setConfirmRemove(true)}>{t('profile.remove')}</button>
            <button type="button" className={'redis-icon-button' + (busy ? ' redis-spinning' : '')} title={t('profile.reload')} aria-label={t('profile.reload')} onClick={() => { void run(props.listProfiles) }}><Icon name="refresh" /></button>
          </div>
          {confirmRemove && selectedId !== null && <div className="redis-profile-confirm"><strong>{t('profile.remove')} · {profiles.find(value => value.id === selectedId)?.name}</strong><div className="redis-actions"><button type="button" onClick={() => { const id = selectedId; void run(signal => props.removeProfile({ id }, signal), true) }}>{t('profile.remove')}</button><button type="button" onClick={() => setConfirmRemove(false)}>{t('ui.cancel')}</button></div></div>}
        </fieldset>
        {error !== null && <p className="redis-error" role="alert">{t(error)}</p>}
      </aside>
      <div className="redis-connection-editor">{props.children}</div>
    </div>
  </dialog>
}
