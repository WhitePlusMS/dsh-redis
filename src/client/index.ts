/** Native right-sidebar registration adapted from the latest Git Graph source. */
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-api-gateway/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar-right/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-session/client'
import { TYPERT_REMOTE } from '../typert.remote-client.ts'
import { RedisWorkspace, type RedisWorkspaceInjected } from './RedisWorkspace.tsx'
import { installRedisStyles } from './styles.ts'
import { en, NS, zh } from './locales.ts'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { ConnectionHandle } from '@deepseek-ai/dsh-api-remotes/client'
import type { SetSelectionRequest } from '../domain.ts'
import { consumeUiActions } from './ui-actions.ts'
import { showRedisPane, UiPanePresence } from './ui-pane-presence.ts'
import { SelectionEpoch } from './selection-epoch.ts'
import { registerRedisEvidence } from './RedisToolEvidence.tsx'
import { registerRedisTurnAnswer } from './RedisTurnAnswer.tsx'

export const inject = ['remote', 'connection', 'slots', 'locale', 'sidebarRightTabs', 'sidebarRight', 'uiConversation']

export function apply(ctx: Context): void {
  registerRedisEvidence(ctx)
  registerRedisTurnAnswer(ctx)
  ctx.effect(installRedisStyles)
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'redis dictionaries')
  const t = ctx.locale.bind(NS)
  const panePresence = new UiPanePresence()
  const epochs = new Map<SessionId, SelectionEpoch>()
  const epochFor = (sessionId: SessionId): SelectionEpoch => {
    let epoch = epochs.get(sessionId)
    if (epoch === undefined) { epoch = new SelectionEpoch(); epochs.set(sessionId, epoch) }
    return epoch
  }
  ctx.effect(() => () => epochs.clear(), 'redis selection epochs')
  let remoteReady: ReturnType<typeof ctx.remote.$mount> | undefined
  const selectionUpdates = new Map<SessionId, Promise<unknown>>()
  let retryChannel: (sessionId: SessionId) => void = () => undefined
  // Rejected mounts are not cached, so an explicit retry can discover a recovered Host.
  const remote = async () => {
    if (remoteReady === undefined) {
      const pending = ctx.remote.$mount(TYPERT_REMOTE).catch((error: unknown) => {
        remoteReady = undefined
        throw error
      })
      remoteReady = pending
      ctx.effect(() => pending, 'redis remote')
    }
    await remoteReady
    return ctx.get('remote.redisViewer') as typeof ctx.remote.redisViewer
  }
  // Serialize identity-only publications over the owning session stream.
  const setSelection = (sessionId: SessionId, request: SetSelectionRequest, signal: AbortSignal) => {
    const epoch = epochFor(sessionId), revision = epoch.snapshot().revision
    const previous = selectionUpdates.get(sessionId) ?? Promise.resolve()
    const pending = previous.catch(() => undefined).then(() => {
      if (panePresence.count(sessionId) !== 1 || ctx.sidebarRight.mounted.getSnapshot() !== sessionId) throw new Error('Redis selection has no unique visible pane')
      return epoch.publish(request, revision, signal)
    })
    selectionUpdates.set(sessionId, pending)
    const settled = () => { if (selectionUpdates.get(sessionId) === pending) selectionUpdates.delete(sessionId) }
    void pending.then(settled, settled)
    return pending
  }
  ctx.effect(() => ctx.sidebarRightTabs.register({
    id: 'dsh-redis', kind: 'redis', title: () => t('view.title'),
    guide: [{ id: 'redis', order: 30, title: () => t('view.title'), description: () => t('guide.description') }],
  }), 'redis tab type')
  ctx.effect(() => ctx.slots.inject('sidebar.right.pane.tab', () => ctx.slots.register({
    name: 'sidebar.right.pane.tab', key: 'dsh-redis', locale: NS,
    inject: (sessionId): RedisWorkspaceInjected => ({
      sessionKey: sessionId,
      selectionEpoch: epochFor(sessionId),
      retrySelection: () => { epochFor(sessionId).invalidate(); retryChannel(sessionId) },
      status: async signal => (await remote()).status(sessionId, {}, signal),
      aiBudgetStatus: async signal => (await remote()).aiBudgetStatus(sessionId, {}, signal),
      resumeAiBudget: async signal => (await remote()).resumeAiBudget(sessionId, {}, signal),
      writeModeStatus: async signal => (await remote()).writeModeStatus(sessionId, {}, signal),
      setWriteMode: async (request, signal) => (await remote()).setWriteMode(sessionId, request, signal),
      registerVisiblePane: () => panePresence.attach(sessionId),
      registerKeyHandler: handler => panePresence.registerKeyHandler(sessionId, handler),
      registerRefreshHandler: handler => panePresence.registerRefreshHandler(sessionId, handler),
      registerFormatHandler: handler => panePresence.registerFormatHandler(sessionId, handler),
      registerMatchHandler: handler => panePresence.registerMatchHandler(sessionId, handler),
      registerHashHandler: handler => panePresence.registerHashHandler(sessionId, handler),
      registerListHandler: handler => panePresence.registerListHandler(sessionId, handler),
      registerSetHandler: handler => panePresence.registerSetHandler(sessionId, handler),
      registerZSetHandler: handler => panePresence.registerZSetHandler(sessionId, handler),
      registerStreamHandler: handler => panePresence.registerStreamHandler(sessionId, handler),
      connect: async (request, signal) => (await remote()).connect(sessionId, request, signal),
      disconnect: async (request, signal) => (await remote()).disconnect(sessionId, request, signal),
      connectionStatus: async signal => (await remote()).connectionStatus(sessionId, {}, signal),
      setSelection: (request, signal) => setSelection(sessionId, request, signal),
      listProfiles: async signal => (await remote()).listProfiles(sessionId, {}, signal),
      saveProfile: async (request, signal) => (await remote()).saveProfile(sessionId, request, signal),
      removeProfile: async (request, signal) => (await remote()).removeProfile(sessionId, request, signal),
      selectDatabase: async (request, signal) => (await remote()).selectDatabase(sessionId, request, signal),
      readDatabases: async (request, signal) => (await remote()).readDatabases(sessionId, request, signal),
      scanKeys: async (request, signal) => (await remote()).scanKeys(sessionId, request, signal),
      readString: async (request, signal) => (await remote()).readString(sessionId, request, signal),
      scanHash: async (request, signal) => (await remote()).scanHash(sessionId, request, signal),
      readActionPoint: async (request, signal) => (await remote()).readActionPoint(sessionId, request, signal),
      readList: async (request, signal) => (await remote()).readList(sessionId, request, signal),
      scanSet: async (request, signal) => (await remote()).scanSet(sessionId, request, signal),
      readZSet: async (request, signal) => (await remote()).readZSet(sessionId, request, signal),
      readStream: async (request, signal) => (await remote()).readStream(sessionId, request, signal),
    }),
  }, RedisWorkspace)), 'redis tab body')
  // The on-screen Session exists even while its Redis pane is closed.
  ctx.effect(() => {
    const connection = ctx.get('connection') as ConnectionHandle
    let current: { readonly session: SessionId; readonly generation: number; readonly controller: AbortController } | undefined
    let retry: ReturnType<typeof setTimeout> | undefined
    let attempts = 0
    const update = () => {
      const session = document.visibilityState === 'visible' ? ctx.sidebarRight.mounted.getSnapshot() : undefined
      const generation = connection.generation.getSnapshot()
      if (session === current?.session && generation?.id === current?.generation) return
      if (retry !== undefined) { clearTimeout(retry); retry = undefined }
      current?.controller.abort(); current = undefined; attempts = 0
      if (session === undefined || generation === undefined) return
      const controller = new AbortController()
      current = { session, generation: generation.id, controller }
      const start = () => {
        void consumeUiActions(async signal => (await remote()).openUiChannel(session, {}, signal), controller.signal, (request, signal) => {
          if (request.action.kind === 'confirmSelection') {
            const count = panePresence.count(session)
            return Promise.resolve(signal.aborted || document.visibilityState !== 'visible' || ctx.sidebarRight.mounted.getSnapshot() !== session || count === 0 ? 'stale' : count === 1 ? 'applied' : 'ambiguous')
          }
          if (document.visibilityState !== 'visible') return Promise.resolve('stale')
          if (request.action.kind === 'refresh') return panePresence.refresh(session, { ...request, action: request.action }, signal)
          if (request.action.kind === 'setFormat') return panePresence.setFormat(session, { ...request, action: request.action }, signal)
          if (request.action.kind === 'applyMatch') return panePresence.applyMatch(session, { ...request, action: request.action }, signal)
          if (request.action.kind === 'selectKey') return panePresence.selectKey(session, { ...request, action: request.action }, signal)
          if (request.action.kind === 'selectHashField') return panePresence.selectHashField(session, { ...request, action: request.action }, signal)
          if (request.action.kind === 'selectListIndex') return panePresence.selectListIndex(session, { ...request, action: request.action }, signal)
          if (request.action.kind === 'selectSetMember') return panePresence.selectSetMember(session, { ...request, action: request.action }, signal)
          if (request.action.kind === 'selectZSetMember') return panePresence.selectZSetMember(session, { ...request, action: request.action }, signal)
          if (request.action.kind === 'selectStreamField') return panePresence.selectStreamField(session, { ...request, action: request.action }, signal)
          return showRedisPane(panePresence, session, () => ctx.sidebarRight.mounted.getSnapshot() === session, () => ctx.sidebarRight.openTab('redis'), request.expiresAt, signal)
        }, epochFor(session),
        ).catch(() => { if (!controller.signal.aborted) console.warn('[dsh-redis] UI action channel unavailable') }).then(() => {
          if (controller.signal.aborted) return
          if (attempts >= 3) { const epoch = epochFor(session); epoch.fail(epoch.snapshot().revision); return }
          attempts += 1
          retry = setTimeout(() => { retry = undefined; start() }, attempts * 1000)
        })
      }
      start()
    }
    const unsubscribe = ctx.sidebarRight.mounted.subscribe(update)
    const unsubscribeGeneration = connection.generation.subscribe(update)
    // A background page cannot confirm a visible selection and must not make
    // another browser's active session ambiguous.
    document.addEventListener('visibilitychange', update)
    retryChannel = sessionId => {
      if (ctx.sidebarRight.mounted.getSnapshot() !== sessionId) return
      if (retry !== undefined) { clearTimeout(retry); retry = undefined }
      current?.controller.abort(); current = undefined
      update()
    }
    update()
    return () => { retryChannel = () => undefined; unsubscribe(); unsubscribeGeneration(); document.removeEventListener('visibilitychange', update); if (retry !== undefined) clearTimeout(retry); current?.controller.abort() }
  }, 'redis session UI action channel')
  console.info('[dsh-redis] Native sidebar registered')
}
