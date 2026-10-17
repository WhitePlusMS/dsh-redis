import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import type { ConnectionSettings, ProfileCollection, ImportProfilesRequest, ProfileId, SaveProfileRequest, SavedConnection } from '../domain.ts'
import { connectionSettingsSchema } from '../typert.shared.ts'
import { useBrowsingState } from './BrowsingSession.tsx'
import { NS } from './locales.ts'
import { HelpDetails } from './HelpDetails.tsx'
import { Icon } from './Icon.tsx'
import { ProfileTransfer } from './ProfileTransfer.tsx'
import { ConnectionUri } from './ConnectionUri.tsx'
import type { ParsedConnectionUri } from '../connection-uri.ts'

export interface ProfileActions {
  readonly importProfiles: (request: ImportProfilesRequest, signal: AbortSignal) => Promise<RemoteResult<ProfileCollection>>
  readonly listProfiles: (signal: AbortSignal) => Promise<RemoteResult<ProfileCollection>>
  readonly saveProfile: (request: SaveProfileRequest, signal: AbortSignal) => Promise<RemoteResult<ProfileCollection>>
  readonly removeProfile: (request: ProfileId, signal: AbortSignal) => Promise<RemoteResult<ProfileCollection>>
}
type Props = ProfileActions & {
  readonly t: TranslateNS<typeof NS>
  readonly disabled: boolean
  readonly settings: () => ConnectionSettings
  readonly select: (settings: ConnectionSettings | null) => void
  readonly applyUri: (value: ParsedConnectionUri) => void
  readonly open: boolean
  readonly onClose: () => void
  readonly children: ReactNode
}

/** This component manages configuration only; selecting a profile never calls connect. */
export function ProfileChooser(props: Props) {
  const browsing = useBrowsingState()
  const [profiles, setProfiles] = useState<readonly SavedConnection[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(browsing.state.profileId)
  const [name, setName] = useState(''), [group, setGroup] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)
  const active = useRef<AbortController | null>(null)
  const sequence = useRef(0)
  const { t } = props
  const dialog = useRef<HTMLDialogElement | null>(null)
  useEffect(() => {
    const element = dialog.current
    if (element === null) return
    if (props.open && !element.open) element.showModal()
    else if (!props.open && element.open) element.close()
  }, [props.open])

  function choose(profile: SavedConnection | undefined): void {
    setSelectedId(profile?.id ?? null); setName(profile?.name ?? ''); setGroup(profile?.group ?? ''); setError(false)
    browsing.update({ profileId: profile?.id ?? null })
    props.select(profile?.settings ?? null)
  }

  async function run(operation: (signal: AbortSignal) => Promise<RemoteResult<ProfileCollection>>, selection: 'refresh' | 'follow' | 'keep' = 'refresh'): Promise<boolean> {
    active.current?.abort()
    const controller = new AbortController()
    active.current = controller
    const current = ++sequence.current
    setBusy(true); setError(false)
    try {
      const result = await operation(controller.signal)
      if (controller.signal.aborted || current !== sequence.current) return false
      if (!result.ok) { setError(true); return false }
      setProfiles(result.value.profiles)
      if (selection === 'keep') return true
      const profile = result.value.profiles.find(value => value.id === (selection === 'follow' ? result.value.selectedId : selectedId))
      const id = profile?.id ?? null
      setSelectedId(id); setName(profile?.name ?? ''); setGroup(profile?.group ?? '')
      if (id !== browsing.state.profileId) browsing.update({ profileId: id })
      if (profile !== undefined) props.select(profile.settings)
      return true
    } catch { if (!controller.signal.aborted && current === sequence.current) setError(true); return false }
    finally { if (!controller.signal.aborted && current === sequence.current) setBusy(false) }
  }
  useEffect(() => {
    void run(props.listProfiles)
    return () => { ++sequence.current; active.current?.abort() }
  }, [props.listProfiles])

  const groups = new Map<string, SavedConnection[]>()
  for (const profile of profiles) {
    const label = profile.group ?? ''
    const values = groups.get(label) ?? []
    values.push(profile); groups.set(label, values)
  }
  return <>
    <dialog ref={dialog} className="redis-connection-dialog" aria-label={t('connection.settings')} onClose={props.onClose} onCancel={props.onClose}>
      <div className="redis-dialog-heading"><h2>{t('connection.settings')}</h2><button type="button" className="redis-icon-button" title={t('ui.close')} aria-label={t('ui.close')} onClick={props.onClose}><Icon name="close" /></button></div>
      <div className="redis-dialog-content">
      <div className="redis-profiles">
    <fieldset disabled={busy || props.disabled}>
      <label>{t('profile.choose')}<select name="profile" value={selectedId ?? ''} onChange={event => {
        choose(profiles.find(value => value.id === event.target.value))
      }}><option value="">{t('profile.new')}</option>{[...groups].map(([label, values]) => <optgroup key={label} label={label || t('profile.ungrouped')}>{values.map(value => <option key={value.id} value={value.id}>{value.name}</option>)}</optgroup>)}</select></label>
      <label>{t('profile.name')}<input name="profileName" value={name} maxLength={80} onChange={event => setName(event.target.value)} autoComplete="off" /></label>
      <label>{t('profile.group')}<input name="profileGroup" value={group} maxLength={80} onChange={event => setGroup(event.target.value)} autoComplete="off" placeholder={t('profile.ungrouped')} /></label>
      <div className="redis-actions">
        <button type="button" disabled={name.trim() === ''} onClick={() => {
          try {
            const settings = connectionSettingsSchema.parse(props.settings())
            void run(signal => props.saveProfile({ id: selectedId, name: name.trim(), ...(group.trim() ? { group: group.trim() } : {}), settings }, signal), 'follow')
          } catch { setError(true) }
        }}>{t(selectedId === null ? 'profile.save' : 'profile.update')}</button>
        <button type="button" disabled={selectedId === null} onClick={() => {
          if (selectedId === null) return
          const id = selectedId
          void run(signal => props.removeProfile({ id }, signal), 'follow')
        }}>{t('profile.remove')}</button>
        <button type="button" onClick={() => { void run(props.listProfiles) }}>{t('profile.reload')}</button>
      </div>
    </fieldset>
    {error && <p className="redis-error" role="alert">{t('profile.error')}</p>}
      </div>
      <ConnectionUri t={t} open={props.open} disabled={busy || props.disabled} apply={value => { choose(undefined); props.applyUri(value) }} />
      {props.children}
      <ProfileTransfer t={t} open={props.open} disabled={busy || props.disabled} profiles={profiles} import={request => run(signal => props.importProfiles(request, signal), 'keep')} />
      <HelpDetails label={t('ui.help')}><p>{t('profile.privacy')}</p></HelpDetails>
      </div>
    </dialog>
  </>
}
