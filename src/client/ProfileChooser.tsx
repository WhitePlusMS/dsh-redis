import { useEffect, useRef, useState } from 'react'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import type { ConnectionSettings, ProfileCollection, ProfileId, SaveProfileRequest, SavedConnection } from '../domain.ts'
import { connectionSettingsSchema } from '../typert.shared.ts'
import { useBrowsingState } from './BrowsingSession.tsx'
import { NS } from './locales.ts'

export interface ProfileActions {
  readonly listProfiles: (signal: AbortSignal) => Promise<RemoteResult<ProfileCollection>>
  readonly saveProfile: (request: SaveProfileRequest, signal: AbortSignal) => Promise<RemoteResult<ProfileCollection>>
  readonly removeProfile: (request: ProfileId, signal: AbortSignal) => Promise<RemoteResult<ProfileCollection>>
}
type Props = ProfileActions & {
  readonly t: TranslateNS<typeof NS>
  readonly disabled: boolean
  readonly settings: () => ConnectionSettings
  readonly select: (settings: ConnectionSettings | null) => void
}

/** This component manages configuration only; selecting a profile never calls connect. */
export function ProfileChooser(props: Props) {
  const browsing = useBrowsingState()
  const [profiles, setProfiles] = useState<readonly SavedConnection[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(browsing.state.profileId)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)
  const active = useRef<AbortController | null>(null)
  const sequence = useRef(0)
  const { t } = props

  async function run(operation: (signal: AbortSignal) => Promise<RemoteResult<ProfileCollection>>, followSelection = false): Promise<void> {
    active.current?.abort()
    const controller = new AbortController()
    active.current = controller
    const current = ++sequence.current
    setBusy(true); setError(false)
    try {
      const result = await operation(controller.signal)
      if (controller.signal.aborted || current !== sequence.current) return
      if (!result.ok) { setError(true); return }
      setProfiles(result.value.profiles)
      const profile = result.value.profiles.find(value => value.id === (followSelection ? result.value.selectedId : selectedId))
      const id = profile?.id ?? null
      setSelectedId(id); setName(profile?.name ?? '')
      if (id !== browsing.state.profileId) browsing.update({ profileId: id })
      if (profile !== undefined) props.select(profile.settings)
    } catch { if (!controller.signal.aborted && current === sequence.current) setError(true) }
    finally { if (!controller.signal.aborted && current === sequence.current) setBusy(false) }
  }
  useEffect(() => {
    void run(props.listProfiles)
    return () => { ++sequence.current; active.current?.abort() }
  }, [props.listProfiles])

  return <div className="redis-profiles">
    <fieldset disabled={busy || props.disabled}>
      <label>{t('profile.choose')}<select name="profile" value={selectedId ?? ''} onChange={event => {
        const profile = profiles.find(value => value.id === event.target.value)
        setSelectedId(profile?.id ?? null); setName(profile?.name ?? ''); setError(false)
        browsing.update({ profileId: profile?.id ?? null })
        props.select(profile?.settings ?? null)
      }}><option value="">{t('profile.new')}</option>{profiles.map(value => <option key={value.id} value={value.id}>{value.name}</option>)}</select></label>
      <label>{t('profile.name')}<input name="profileName" value={name} maxLength={80} onChange={event => setName(event.target.value)} autoComplete="off" /></label>
      <div className="redis-actions">
        <button type="button" disabled={name.trim() === ''} onClick={() => {
          try {
            const settings = connectionSettingsSchema.parse(props.settings())
            void run(signal => props.saveProfile({ id: selectedId, name: name.trim(), settings }, signal), true)
          } catch { setError(true) }
        }}>{t(selectedId === null ? 'profile.save' : 'profile.update')}</button>
        <button type="button" disabled={selectedId === null} onClick={() => {
          if (selectedId === null) return
          const id = selectedId
          void run(signal => props.removeProfile({ id }, signal), true)
        }}>{t('profile.remove')}</button>
        <button type="button" onClick={() => { void run(props.listProfiles) }}>{t('profile.reload')}</button>
      </div>
    </fieldset>
    {error && <p className="redis-error" role="alert">{t('profile.error')}</p>}
    <p>{t('profile.privacy')}</p>
  </div>
}
