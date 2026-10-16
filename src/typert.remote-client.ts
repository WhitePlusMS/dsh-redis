import type { OverviewReadRequest, OverviewReadResult } from './domain.ts'
import type { SessionBrowsingState } from './domain.ts'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { RemoteResult, TypertRemoteContribution } from '@deepseek-ai/dsh-typert-protocol'
import type { EmptyRequest, RedisHostStatus, ConnectionRequest, ConnectionTarget, ConnectionView, ConnectionTestResult } from './domain.ts'
import type { SaveProfileRequest, ProfileId, ProfileCollection, ImportProfilesRequest } from './domain.ts'
import type { DatabaseTarget, ScanKeysRequest, ScanKeysResult } from './domain.ts'
import type { StringReadRequest, StringReadResult } from './domain.ts'
import type { ScanHashRequest, ScanHashResult } from './domain.ts'
import type { ListReadRequest, ListReadResult } from './domain.ts'
import type { ScanSetRequest, ScanSetResult } from './domain.ts'
import type { ZSetReadRequest, ZSetReadResult } from './domain.ts'
import type { StreamReadRequest, StreamReadResult } from './domain.ts'
import type { JsonReadRequest, JsonReadResult } from './domain.ts'
import type { GeoReadRequest, GeoReadResult, HllReadRequest, HllReadResult } from './domain.ts'
import type { TimeSeriesReadRequest, TimeSeriesReadResult } from './domain.ts'
import type { BloomReadRequest, BloomReadResult } from './domain.ts'
import { redisDescriptors, TYPERT_PACKAGE } from './typert.shared.ts'

export interface RedisViewerRemote {
  readOverview: (agentId: SessionId, request: OverviewReadRequest, signal?: AbortSignal) => Promise<RemoteResult<OverviewReadResult>>
  loadBrowsingState: (agentId: SessionId, request: EmptyRequest, signal?: AbortSignal) => Promise<RemoteResult<SessionBrowsingState>>
  saveBrowsingState: (agentId: SessionId, request: SessionBrowsingState, signal?: AbortSignal) => Promise<RemoteResult<SessionBrowsingState>>
  readBloom: (agentId: SessionId, request: BloomReadRequest, signal?: AbortSignal) => Promise<RemoteResult<BloomReadResult>>
  readTimeSeries: (agentId: SessionId, request: TimeSeriesReadRequest, signal?: AbortSignal) => Promise<RemoteResult<TimeSeriesReadResult>>
  readHll: (agentId: SessionId, request: HllReadRequest, signal?: AbortSignal) => Promise<RemoteResult<HllReadResult>>
  readGeo: (agentId: SessionId, request: GeoReadRequest, signal?: AbortSignal) => Promise<RemoteResult<GeoReadResult>>
  readJson: (agentId: SessionId, request: JsonReadRequest, signal?: AbortSignal) => Promise<RemoteResult<JsonReadResult>>
  readStream: (agentId: SessionId, request: StreamReadRequest, signal?: AbortSignal) => Promise<RemoteResult<StreamReadResult>>
  readZSet: (agentId: SessionId, request: ZSetReadRequest, signal?: AbortSignal) => Promise<RemoteResult<ZSetReadResult>>
  scanSet: (agentId: SessionId, request: ScanSetRequest, signal?: AbortSignal) => Promise<RemoteResult<ScanSetResult>>
  readList: (agentId: SessionId, request: ListReadRequest, signal?: AbortSignal) => Promise<RemoteResult<ListReadResult>>
  scanHash: (agentId: SessionId, request: ScanHashRequest, signal?: AbortSignal) => Promise<RemoteResult<ScanHashResult>>
  readString: (agentId: SessionId, request: StringReadRequest, signal?: AbortSignal) => Promise<RemoteResult<StringReadResult>>
  selectDatabase: (agentId: SessionId, request: DatabaseTarget, signal?: AbortSignal) => Promise<RemoteResult<ConnectionView>>
  scanKeys: (agentId: SessionId, request: ScanKeysRequest, signal?: AbortSignal) => Promise<RemoteResult<ScanKeysResult>>
  importProfiles: (agentId: SessionId, request: ImportProfilesRequest, signal?: AbortSignal) => Promise<RemoteResult<ProfileCollection>>
  listProfiles: (agentId: SessionId, request: EmptyRequest, signal?: AbortSignal) => Promise<RemoteResult<ProfileCollection>>
  saveProfile: (agentId: SessionId, request: SaveProfileRequest, signal?: AbortSignal) => Promise<RemoteResult<ProfileCollection>>
  removeProfile: (agentId: SessionId, request: ProfileId, signal?: AbortSignal) => Promise<RemoteResult<ProfileCollection>>
  testConnection: (agentId: SessionId, request: ConnectionRequest, signal?: AbortSignal) => Promise<RemoteResult<ConnectionTestResult>>
  connect: (agentId: SessionId, request: ConnectionRequest, signal?: AbortSignal) => Promise<RemoteResult<ConnectionView>>
  disconnect: (agentId: SessionId, request: ConnectionTarget, signal?: AbortSignal) => Promise<RemoteResult<ConnectionView>>
  connectionStatus: (agentId: SessionId, request: EmptyRequest, signal?: AbortSignal) => Promise<RemoteResult<ConnectionView>>
  status: (agentId: SessionId, request: EmptyRequest, signal?: AbortSignal) => Promise<RemoteResult<RedisHostStatus>>
}
declare module '@deepseek-ai/dsh-typert-protocol' {
  interface TypertRemoteMap {
    'redisViewer/readOverview': RedisViewerRemote['readOverview']
    'redisViewer/loadBrowsingState': RedisViewerRemote['loadBrowsingState']
    'redisViewer/saveBrowsingState': RedisViewerRemote['saveBrowsingState']
    'redisViewer/readBloom': RedisViewerRemote['readBloom']
    'redisViewer/readTimeSeries': RedisViewerRemote['readTimeSeries']
    'redisViewer/readHll': RedisViewerRemote['readHll']
    'redisViewer/readGeo': RedisViewerRemote['readGeo']
    'redisViewer/readJson': RedisViewerRemote['readJson']
    'redisViewer/readStream': RedisViewerRemote['readStream']
    'redisViewer/readZSet': RedisViewerRemote['readZSet']
    'redisViewer/scanSet': RedisViewerRemote['scanSet']
    'redisViewer/readList': RedisViewerRemote['readList']
    'redisViewer/scanHash': RedisViewerRemote['scanHash']
    'redisViewer/readString': RedisViewerRemote['readString']
    'redisViewer/selectDatabase': RedisViewerRemote['selectDatabase']
    'redisViewer/scanKeys': RedisViewerRemote['scanKeys']
    'redisViewer/importProfiles': RedisViewerRemote['importProfiles']
    'redisViewer/listProfiles': RedisViewerRemote['listProfiles']
    'redisViewer/saveProfile': RedisViewerRemote['saveProfile']
    'redisViewer/removeProfile': RedisViewerRemote['removeProfile']
    'redisViewer/status': RedisViewerRemote['status']
    'redisViewer/testConnection': RedisViewerRemote['testConnection']
    'redisViewer/connect': RedisViewerRemote['connect']
    'redisViewer/disconnect': RedisViewerRemote['disconnect']
    'redisViewer/connectionStatus': RedisViewerRemote['connectionStatus']
  }
  interface TypertRemoteNamespaceMap { redisViewer: RedisViewerRemote }
  interface TypertRemoteScopeMap {
    'agent:redisViewer/readOverview': (request: OverviewReadRequest, signal?: AbortSignal) => Promise<RemoteResult<OverviewReadResult>>
    'agent:redisViewer/loadBrowsingState': (request: EmptyRequest, signal?: AbortSignal) => Promise<RemoteResult<SessionBrowsingState>>
    'agent:redisViewer/saveBrowsingState': (request: SessionBrowsingState, signal?: AbortSignal) => Promise<RemoteResult<SessionBrowsingState>>
    'agent:redisViewer/readBloom': (request: BloomReadRequest, signal?: AbortSignal) => Promise<RemoteResult<BloomReadResult>>
    'agent:redisViewer/readTimeSeries': (request: TimeSeriesReadRequest, signal?: AbortSignal) => Promise<RemoteResult<TimeSeriesReadResult>>
    'agent:redisViewer/readHll': (request: HllReadRequest, signal?: AbortSignal) => Promise<RemoteResult<HllReadResult>>
    'agent:redisViewer/readGeo': (request: GeoReadRequest, signal?: AbortSignal) => Promise<RemoteResult<GeoReadResult>>
    'agent:redisViewer/readJson': (request: JsonReadRequest, signal?: AbortSignal) => Promise<RemoteResult<JsonReadResult>>
    'agent:redisViewer/readStream': (request: StreamReadRequest, signal?: AbortSignal) => Promise<RemoteResult<StreamReadResult>>
    'agent:redisViewer/readZSet': (request: ZSetReadRequest, signal?: AbortSignal) => Promise<RemoteResult<ZSetReadResult>>
    'agent:redisViewer/scanSet': (request: ScanSetRequest, signal?: AbortSignal) => Promise<RemoteResult<ScanSetResult>>
    'agent:redisViewer/readList': (request: ListReadRequest, signal?: AbortSignal) => Promise<RemoteResult<ListReadResult>>
    'agent:redisViewer/scanHash': (request: ScanHashRequest, signal?: AbortSignal) => Promise<RemoteResult<ScanHashResult>>
    'agent:redisViewer/readString': (request: StringReadRequest, signal?: AbortSignal) => Promise<RemoteResult<StringReadResult>>
    'agent:redisViewer/selectDatabase': (request: DatabaseTarget, signal?: AbortSignal) => Promise<RemoteResult<ConnectionView>>
    'agent:redisViewer/scanKeys': (request: ScanKeysRequest, signal?: AbortSignal) => Promise<RemoteResult<ScanKeysResult>>
    'agent:redisViewer/importProfiles': (request: ImportProfilesRequest, signal?: AbortSignal) => Promise<RemoteResult<ProfileCollection>>
    'agent:redisViewer/listProfiles': (request: EmptyRequest, signal?: AbortSignal) => Promise<RemoteResult<ProfileCollection>>
    'agent:redisViewer/saveProfile': (request: SaveProfileRequest, signal?: AbortSignal) => Promise<RemoteResult<ProfileCollection>>
    'agent:redisViewer/removeProfile': (request: ProfileId, signal?: AbortSignal) => Promise<RemoteResult<ProfileCollection>>
    'agent:redisViewer/status': (request: EmptyRequest, signal?: AbortSignal) => Promise<RemoteResult<RedisHostStatus>>
    'agent:redisViewer/testConnection': (request: ConnectionRequest, signal?: AbortSignal) => Promise<RemoteResult<ConnectionTestResult>>
    'agent:redisViewer/connect': (request: ConnectionRequest, signal?: AbortSignal) => Promise<RemoteResult<ConnectionView>>
    'agent:redisViewer/disconnect': (request: ConnectionTarget, signal?: AbortSignal) => Promise<RemoteResult<ConnectionView>>
    'agent:redisViewer/connectionStatus': (request: EmptyRequest, signal?: AbortSignal) => Promise<RemoteResult<ConnectionView>>
  }
}
export const TYPERT_REMOTE: TypertRemoteContribution = { package: TYPERT_PACKAGE, descriptors: redisDescriptors }
export default TYPERT_REMOTE
