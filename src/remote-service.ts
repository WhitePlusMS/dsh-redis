import type {} from '@deepseek-ai/dsh-session'
import type {} from '@deepseek-ai/dsh-app-boot'
import { RedisConnections } from './host/connection-service.ts'
import { RedisProfiles } from './host/profile-store.ts'
import { RedisKeys } from './host/key-reader.ts'
import { RedisStrings } from './host/string-reader.ts'
import { RedisHashes } from './host/hash-reader.ts'
import { RedisLists } from './host/list-reader.ts'
import { RedisSets } from './host/set-reader.ts'
import { RedisZSets } from './host/zset-reader.ts'
import type { ZSetReadRequest, ZSetReadResult } from './domain.ts'
import { RedisStreams } from './host/stream-reader.ts'
import { RedisJson } from './host/json-reader.ts'
import { RedisGeo } from './host/geo-reader.ts'
import { RedisTimeSeries } from './host/timeseries-reader.ts'
import type { TimeSeriesReadRequest, TimeSeriesReadResult } from './domain.ts'
import { RedisHll } from './host/hll-reader.ts'
import type { GeoReadRequest, GeoReadResult, HllReadRequest, HllReadResult } from './domain.ts'
import type { JsonReadRequest, JsonReadResult } from './domain.ts'
import type { StreamReadRequest, StreamReadResult } from './domain.ts'
import type { ScanSetRequest, ScanSetResult } from './domain.ts'
import type { ListReadRequest, ListReadResult } from './domain.ts'
import type { ScanHashRequest, ScanHashResult } from './domain.ts'
import type { StringReadRequest, StringReadResult } from './domain.ts'
import type { DatabaseTarget, ScanKeysRequest, ScanKeysResult } from './domain.ts'
import type { SaveProfileRequest, ProfileId, ProfileCollection } from './domain.ts'
import type { ConnectionRequest, ConnectionTarget, ConnectionTestResult, ConnectionView } from './domain.ts'
import type { Context } from '@deepseek-ai/cordis'
import type { Agent } from '@deepseek-ai/dsh-agent'
import { TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import { DSH_VERSION, PROTOCOL_VERSION, type EmptyRequest, type RedisHostStatus } from './domain.ts'

/** Typert supplies the trusted Agent; clients cannot select an arbitrary owner. */
export class RedisRemoteService extends TypertRemoteService {
  private readonly connections = new RedisConnections()
  private readonly keys = new RedisKeys(this.connections)
  private readonly strings = new RedisStrings(this.connections)
  private readonly hashes = new RedisHashes(this.connections)
  private readonly lists = new RedisLists(this.connections)
  private readonly sets = new RedisSets(this.connections)
  private readonly zsets = new RedisZSets(this.connections)
  private readonly streams = new RedisStreams(this.connections)
  private readonly json = new RedisJson(this.connections)
  private readonly geo = new RedisGeo(this.connections)
  private readonly hll = new RedisHll(this.connections)
  private readonly timeseries = new RedisTimeSeries(this.connections)
  private readonly profiles: RedisProfiles
  constructor(ctx: Context) {
    super(ctx, 'redisViewer')
    this.profiles = new RedisProfiles(ctx.profileContext.dir)
    ctx.effect(() => () => { this.keys.dispose(); this.hashes.dispose(); this.sets.dispose(); this.zsets.dispose(); this.streams.dispose(); this.timeseries.dispose(); this.connections.dispose() }, 'redis connections')
    ctx.on('session/disposed', session => { this.keys.disposeSession(session.id); this.hashes.disposeSession(session.id); this.sets.disposeSession(session.id); this.zsets.disposeSession(session.id); this.streams.disposeSession(session.id); this.timeseries.disposeSession(session.id); this.connections.disposeSession(session.id) })
  }
  async testConnection(_agent: Agent, request: ConnectionRequest, signal: AbortSignal): Promise<ConnectionTestResult> {
    return this.connections.test(request, signal)
  }
  async connect(agent: Agent, request: ConnectionRequest, signal: AbortSignal): Promise<ConnectionView> {
    signal.throwIfAborted()
    this.keys.disposeSession(agent.session.id)
    this.hashes.disposeSession(agent.session.id)
    this.sets.disposeSession(agent.session.id)
    this.zsets.disposeSession(agent.session.id)
    this.timeseries.disposeSession(agent.session.id); this.streams.disposeSession(agent.session.id)
    return this.connections.connect(agent.session.id, request, signal)
  }
  async disconnect(agent: Agent, request: ConnectionTarget, signal: AbortSignal): Promise<ConnectionView> {
    signal.throwIfAborted()
    const view = this.connections.disconnect(agent.session.id, request)
    if (view.state === 'disconnected') { this.keys.disposeSession(agent.session.id); this.hashes.disposeSession(agent.session.id); this.sets.disposeSession(agent.session.id); this.zsets.disposeSession(agent.session.id); this.timeseries.disposeSession(agent.session.id); this.streams.disposeSession(agent.session.id) }
    return view
  }
  async selectDatabase(agent: Agent, request: DatabaseTarget, signal: AbortSignal): Promise<ConnectionView> {
    signal.throwIfAborted()
    return this.connections.selectDatabase(agent.session.id, request, signal)
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
  async readJson(agent: Agent, request: JsonReadRequest, signal: AbortSignal): Promise<JsonReadResult> {
    return this.json.read(agent.session.id, request, signal)
  }
  async readTimeSeries(agent: Agent, request: TimeSeriesReadRequest, signal: AbortSignal): Promise<TimeSeriesReadResult> {
    return this.timeseries.read(agent.session.id, request, signal)
  }
  async readHll(agent: Agent, request: HllReadRequest, signal: AbortSignal): Promise<HllReadResult> {
    return this.hll.read(agent.session.id, request, signal)
  }
  async readGeo(agent: Agent, request: GeoReadRequest, signal: AbortSignal): Promise<GeoReadResult> {
    return this.geo.read(agent.session.id, request, signal)
  }
  async connectionStatus(agent: Agent, _request: EmptyRequest, signal: AbortSignal): Promise<ConnectionView> {
    signal.throwIfAborted()
    return this.connections.status(agent.session.id)
  }
  async listProfiles(_agent: Agent, _request: EmptyRequest, signal: AbortSignal): Promise<ProfileCollection> { return this.profiles.list(signal) }
  async saveProfile(_agent: Agent, request: SaveProfileRequest, signal: AbortSignal): Promise<ProfileCollection> { return this.profiles.save(request, signal) }
  async removeProfile(_agent: Agent, request: ProfileId, signal: AbortSignal): Promise<ProfileCollection> { return this.profiles.remove(request, signal) }

  async status(_agent: Agent, _request: EmptyRequest, signal: AbortSignal): Promise<RedisHostStatus> {
    signal.throwIfAborted()
    return { state: 'ready', readOnly: true, hostVersion: DSH_VERSION, protocolVersion: PROTOCOL_VERSION }
  }
}
