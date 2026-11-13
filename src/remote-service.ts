import { selectionForAction } from './ui-action-selection.ts'
import { RedisDatabases } from './host/database-reader.ts'
import { UiActionCoordinator } from './host/ui-action-coordinator.ts'
import { openUiActionChannel } from './host/ui-action-channel.ts'
import type { UiAction, UiChannelInput, UiChannelMessage } from './domain.ts'
import type { RemoteStream } from '@deepseek-ai/dsh-typert-protocol'
import { RedisAiReader } from './host/ai-reader.ts'
import { RedisAiWriter } from './host/ai-writer.ts'
import type { AiBudgetResume, AiBudgetStatus, DatabasesReadRequest, DatabasesReadResult } from './domain.ts'
import type { RedisWriteModeRequest, RedisWriteModeStatus } from './domain.ts'
import type { RedisWriteLookupRequest, RedisWriteLookupResult } from './domain.ts'
import type {} from '@deepseek-ai/dsh-session'
import type {} from '@deepseek-ai/dsh-app-boot'
import { ConnectionFailure, RedisConnections } from './host/connection-service.ts'
import { RedisProfiles } from './host/profile-store.ts'
import { RedisKeys } from './host/key-reader.ts'
import { RedisStrings } from './host/string-reader.ts'
import { RedisHashes } from './host/hash-reader.ts'
import { RedisSelectedReader } from './host/selected-reader.ts'
import { RedisLists } from './host/list-reader.ts'
import { RedisSets } from './host/set-reader.ts'
import { RedisZSets } from './host/zset-reader.ts'
import type { ZSetReadRequest, ZSetReadResult } from './domain.ts'
import { RedisStreams } from './host/stream-reader.ts'
import type { StreamReadRequest, StreamReadResult } from './domain.ts'
import type { ScanSetRequest, ScanSetResult } from './domain.ts'
import type { ListReadRequest, ListReadResult } from './domain.ts'
import type { ScanHashRequest, ScanHashResult } from './domain.ts'
import type { ActionPointReadRequest, ActionPointReadResult } from './domain.ts'
import type { StringReadRequest, StringReadResult } from './domain.ts'
import type { DatabaseTarget, ScanKeysRequest, ScanKeysResult } from './domain.ts'
import type { SaveProfileRequest, ProfileId, ProfileCollection, SavedConnection } from './domain.ts'
import type { ConnectionRequest, ConnectionTarget, ConnectionView } from './domain.ts'
import type { Context } from '@deepseek-ai/cordis'
import type { Agent } from '@deepseek-ai/dsh-agent'
import { TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import { DSH_BASELINE, PROTOCOL_VERSION, MAX_SCAN_JSON_BYTES, type EmptyRequest, type RedisHostStatus } from './domain.ts'

/** Typert supplies the trusted Agent; clients cannot select an arbitrary owner. */
export class RedisRemoteService extends TypertRemoteService {
  readonly uiActions = new UiActionCoordinator<UiAction>()
  private readonly connections = new RedisConnections()
  readonly writer = new RedisAiWriter(this.connections)
  readonly ai = new RedisAiReader(this.connections, sessionId => this.uiActions.invalidateSession(sessionId), async (sessionId, target, expected, signal) => {
    const revision = this.uiActions.selectionRevision(sessionId)
    if (revision === null || (expected !== null && revision !== expected)) throw new Error('侧栏选择正在变化或界面不可用，请在当前对话打开唯一 Redis 面板并重试。')
    const current = () => this.uiActions.selectionRevision(sessionId) === revision
    const outcome = await this.uiActions.dispatch(sessionId, { kind: 'confirmSelection' }, target, revision, current, signal, 3000)
    if (outcome !== 'applied' || !current()) throw new Error('侧栏选择已变化或界面不可用，请重新选择后重试。')
    return revision
  }, (sessionId, revision) => { const current = this.uiActions.selectionRevision(sessionId); return current !== null && (revision === null || current === revision) }, sessionId => this.resetTarget(sessionId))
  private readonly databases = new RedisDatabases(this.connections)
  private readonly keys = new RedisKeys(this.connections)
  private readonly strings = new RedisStrings(this.connections)
  private readonly hashes = new RedisHashes(this.connections)
  private readonly lists = new RedisLists(this.connections)
  private readonly sets = new RedisSets(this.connections)
  private readonly zsets = new RedisZSets(this.connections)
  private readonly streams = new RedisStreams(this.connections)
  private readonly scanReaders = [this.keys, this.hashes, this.sets, this.zsets, this.streams]
  private readonly profiles: RedisProfiles
  constructor(ctx: Context) {
    super(ctx, 'redisViewer')
    this.profiles = new RedisProfiles(ctx.profileContext.dir)
    ctx.effect(() => () => { this.writer.dispose(); this.uiActions.dispose(); this.ai.dispose(); for (const reader of this.scanReaders) reader.dispose(); this.connections.dispose(); }, 'redis connections')
    ctx.on('session/disposed', session => { this.writer.disable(session.id); this.uiActions.disposeSession(session.id); this.ai.disposeSession(session.id); this.disposeScans(session.id); this.connections.disposeSession(session.id); })
  }
  private disposeScans(sessionId: string): void {
    for (const reader of this.scanReaders) reader.disposeSession(sessionId)
  }
  /** Every target exchange retires writes, selection and all old cursors together. */
  private resetTarget(sessionId: string): void {
    this.writer.disable(sessionId)
    this.ai.clearTarget(sessionId)
    this.disposeScans(sessionId)
  }
  /** The Gateway supplies both the trusted Agent and this stream's uplink. */
  async *openUiChannel(agent: Agent, _request: EmptyRequest, signal: AbortSignal): RemoteStream<UiChannelMessage, UiChannelInput> {
    signal.throwIfAborted()
    const invocation = this.ctx.invocation
    if (invocation === undefined) throw new Error('界面动作通道缺少有效调用上下文。')
    yield* openUiActionChannel(this.uiActions, agent.session.id, signal, invocation.uplink<UiChannelInput>(), (request, source) => source === 'action' ? this.ai.commitSelection(agent.session.id, request) : this.ai.setSelection(agent.session.id, request))
  }
  async connect(agent: Agent, request: ConnectionRequest, signal: AbortSignal): Promise<ConnectionView> {
    signal.throwIfAborted()
    this.resetTarget(agent.session.id)
    return this.connections.connect(agent.session.id, request, signal)
  }
  async disconnect(agent: Agent, request: ConnectionTarget, signal: AbortSignal): Promise<ConnectionView> {
    signal.throwIfAborted()
    const view = this.connections.disconnect(agent.session.id, request)
    if (view.state === 'disconnected') this.resetTarget(agent.session.id)
    return view
  }
  async selectDatabase(agent: Agent, request: DatabaseTarget, signal: AbortSignal): Promise<ConnectionView> {
    signal.throwIfAborted()
    const view = await this.connections.selectDatabase(agent.session.id, request, signal, () => this.resetTarget(agent.session.id))
    // An obsolete response must not clear selection state for a newer connection.
    if (!this.connections.isCurrentView(agent.session.id, view)) return { ...this.connections.status(agent.session.id), error: 'stale' }
    return view
  }
  async scanKeys(agent: Agent, request: ScanKeysRequest, signal: AbortSignal): Promise<ScanKeysResult> {
    return this.keys.scan(agent.session.id, request, signal)
  }
  async readString(agent: Agent, request: StringReadRequest, signal: AbortSignal): Promise<StringReadResult> {
    return this.strings.read(agent.session.id, request, signal)
  }
  async scanHash(agent: Agent, request: ScanHashRequest, signal: AbortSignal): Promise<ScanHashResult> {
    return this.hashes.scan(agent.session.id, request, signal)
  }
  async readActionPoint(agent: Agent, request: ActionPointReadRequest, signal: AbortSignal): Promise<ActionPointReadResult> {
    const sessionId = agent.session.id, action = this.uiActions.activeRequest(sessionId, request.requestId)
    const failed = (error: 'stale' | 'cancelled' | 'oversize'): ActionPointReadResult => ({ state: 'failed', error, cell: null, score: null, streamMessage: null, sampledAt: new Date().toISOString() })
    const stale = () => failed('stale')
    if (signal.aborted) return failed('cancelled')
    if (action === null || action.target === null) return stale()
    const selection = selectionForAction(action.action)
    if (selection === null || selection.item === null) return stale()
    const { keyBase64, item } = selection
    if (!this.uiActions.claimPoint(sessionId, action)) return stale()
    const validate = () => { if (this.uiActions.activeRequest(sessionId, request.requestId) !== action) throw new ConnectionFailure('stale') }
    const reader = new RedisSelectedReader(this.connections)
    const stream = item.kind === 'stream' ? await reader.readStream(sessionId, action.target, keyBase64, item.id, item.fieldIndex, item.fieldBase64, signal, validate) : null
    const sample = stream === null ? await reader.read(sessionId, action.target, keyBase64, item, signal, validate) : stream.selected
    if (signal.aborted) return failed('cancelled')
    try { validate() } catch { return stale() }
    const state = sample.state === 'value' || sample.state === 'selection-missing' || sample.state === 'missing' || sample.state === 'failed' ? sample.state : 'changed'
    const result: ActionPointReadResult = { state, error: state === 'failed' ? sample.error : null, cell: state === 'value' ? sample.cell : null, score: state === 'value' ? sample.score : null, streamMessage: state === 'value' ? stream?.message ?? null : null, sampledAt: sample.sampledAt }
    if (Buffer.byteLength(JSON.stringify(result)) > MAX_SCAN_JSON_BYTES) return failed('oversize')
    if (state === 'value' && !this.uiActions.markPointSucceeded(sessionId, action)) return stale()
    return result
  }
  async readList(agent: Agent, request: ListReadRequest, signal: AbortSignal): Promise<ListReadResult> {
    return this.lists.read(agent.session.id, request, signal)
  }
  async scanSet(agent: Agent, request: ScanSetRequest, signal: AbortSignal): Promise<ScanSetResult> {
    return this.sets.scan(agent.session.id, request, signal)
  }
  async readZSet(agent: Agent, request: ZSetReadRequest, signal: AbortSignal): Promise<ZSetReadResult> {
    return this.zsets.read(agent.session.id, request, signal)
  }
  async readStream(agent: Agent, request: StreamReadRequest, signal: AbortSignal): Promise<StreamReadResult> {
    return this.streams.read(agent.session.id, request, signal)
  }
  async readDatabases(agent: Agent, request: DatabasesReadRequest, signal: AbortSignal): Promise<DatabasesReadResult> { return this.databases.read(agent.session.id, request, signal) }
  async aiBudgetStatus(agent: Agent, _request: EmptyRequest, signal: AbortSignal): Promise<AiBudgetStatus> { signal.throwIfAborted(); return this.ai.budgetStatus(agent.session.id) }
  async resumeAiBudget(agent: Agent, _request: EmptyRequest, signal: AbortSignal): Promise<AiBudgetResume> { signal.throwIfAborted(); return this.ai.resumeBudget(agent.session.id) }
  async connectionStatus(agent: Agent, _request: EmptyRequest, signal: AbortSignal): Promise<ConnectionView> {
    signal.throwIfAborted()
    return this.connections.status(agent.session.id)
  }
  async writeModeStatus(agent: Agent, _request: EmptyRequest, signal: AbortSignal): Promise<RedisWriteModeStatus> {
    signal.throwIfAborted()
    const connection = this.connections.status(agent.session.id)
    const enabled = connection.state === 'connected' && connection.id !== null && this.writer.isEnabled(agent.session.id, { id: connection.id, generation: connection.generation, db: connection.db })
    return { connection, enabled }
  }
  async setWriteMode(agent: Agent, request: RedisWriteModeRequest, signal: AbortSignal): Promise<RedisWriteModeStatus> {
    signal.throwIfAborted()
    this.connections.assertTarget(agent.session.id, request.target)
    if (request.enabled) this.writer.enable(agent.session.id, request.target)
    else this.writer.disable(agent.session.id)
    return this.writeModeStatus(agent, {}, signal)
  }
  async writeLookup(agent: Agent, request: RedisWriteLookupRequest, signal: AbortSignal): Promise<RedisWriteLookupResult> {
    signal.throwIfAborted()
    return { record: this.writer.status(agent.session.id, request.id) }
  }
  async listProfiles(_agent: Agent, _request: EmptyRequest, signal: AbortSignal): Promise<ProfileCollection> { return this.profiles.list(signal) }
  /** Saved profiles contain no password; authentication failures require the local form. */
  connectSavedProfile(agent: Agent, profile: SavedConnection, signal: AbortSignal, isCurrent: () => boolean) {
    const sessionId = agent.session.id
    return this.connections.connectProfileCandidate(sessionId, profile, '', signal, this.profiles, () => {
      if (!isCurrent()) throw new ConnectionFailure('stale')
      this.resetTarget(sessionId)
    })
  }
  async saveProfile(_agent: Agent, request: SaveProfileRequest, signal: AbortSignal): Promise<ProfileCollection> { return this.profiles.save(request, signal) }
  async removeProfile(_agent: Agent, request: ProfileId, signal: AbortSignal): Promise<ProfileCollection> { return this.profiles.remove(request, signal) }

  async status(_agent: Agent, _request: EmptyRequest, signal: AbortSignal): Promise<RedisHostStatus> {
    signal.throwIfAborted()
    return { state: 'ready', sidebarReadOnly: true, aiWriteAvailable: true, dshBaseline: DSH_BASELINE, protocolVersion: PROTOCOL_VERSION }
  }
}
