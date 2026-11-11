import type { DatabasesReadRequest, DatabasesReadResult } from './domain.ts'
import type { AiBudgetResume, AiBudgetStatus } from './domain.ts'
import type { RedisWriteModeRequest, RedisWriteModeStatus } from './domain.ts'
import type { RedisWriteLookupRequest, RedisWriteLookupResult } from './domain.ts'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { RemoteResult, RemoteStreamHandle, TypertRemoteContribution } from '@deepseek-ai/dsh-typert-protocol'
import type { UiChannelInput, UiChannelMessage } from './domain.ts'
import type { EmptyRequest, RedisHostStatus, ConnectionRequest, ConnectionTarget, ConnectionView } from './domain.ts'
import type { SaveProfileRequest, ProfileId, ProfileCollection } from './domain.ts'
import type { DatabaseTarget, ScanKeysRequest, ScanKeysResult } from './domain.ts'
import type { StringReadRequest, StringReadResult } from './domain.ts'
import type { ActionPointReadRequest, ActionPointReadResult, ScanHashRequest, ScanHashResult } from './domain.ts'
import type { ListReadRequest, ListReadResult } from './domain.ts'
import type { ScanSetRequest, ScanSetResult } from './domain.ts'
import type { ZSetReadRequest, ZSetReadResult } from './domain.ts'
import type { StreamReadRequest, StreamReadResult } from './domain.ts'
import { redisDescriptors, TYPERT_PACKAGE } from './typert.shared.ts'

export interface RedisViewerRemote {
  writeLookup: (agentId: SessionId, request: RedisWriteLookupRequest, signal?: AbortSignal) => Promise<RemoteResult<RedisWriteLookupResult>>
  writeModeStatus: (agentId: SessionId, request: EmptyRequest, signal?: AbortSignal) => Promise<RemoteResult<RedisWriteModeStatus>>
  setWriteMode: (agentId: SessionId, request: RedisWriteModeRequest, signal?: AbortSignal) => Promise<RemoteResult<RedisWriteModeStatus>>
  openUiChannel: (agentId: SessionId, request: EmptyRequest, signal?: AbortSignal) => RemoteStreamHandle<UiChannelMessage, UiChannelInput>
  aiBudgetStatus: (agentId: SessionId, request: EmptyRequest, signal?: AbortSignal) => Promise<RemoteResult<AiBudgetStatus>>
  resumeAiBudget: (agentId: SessionId, request: EmptyRequest, signal?: AbortSignal) => Promise<RemoteResult<AiBudgetResume>>
  readDatabases: (agentId: SessionId, request: DatabasesReadRequest, signal?: AbortSignal) => Promise<RemoteResult<DatabasesReadResult>>
  readStream: (agentId: SessionId, request: StreamReadRequest, signal?: AbortSignal) => Promise<RemoteResult<StreamReadResult>>
  readZSet: (agentId: SessionId, request: ZSetReadRequest, signal?: AbortSignal) => Promise<RemoteResult<ZSetReadResult>>
  scanSet: (agentId: SessionId, request: ScanSetRequest, signal?: AbortSignal) => Promise<RemoteResult<ScanSetResult>>
  readList: (agentId: SessionId, request: ListReadRequest, signal?: AbortSignal) => Promise<RemoteResult<ListReadResult>>
  scanHash: (agentId: SessionId, request: ScanHashRequest, signal?: AbortSignal) => Promise<RemoteResult<ScanHashResult>>
  readActionPoint: (agentId: SessionId, request: ActionPointReadRequest, signal?: AbortSignal) => Promise<RemoteResult<ActionPointReadResult>>
  readString: (agentId: SessionId, request: StringReadRequest, signal?: AbortSignal) => Promise<RemoteResult<StringReadResult>>
  selectDatabase: (agentId: SessionId, request: DatabaseTarget, signal?: AbortSignal) => Promise<RemoteResult<ConnectionView>>
  scanKeys: (agentId: SessionId, request: ScanKeysRequest, signal?: AbortSignal) => Promise<RemoteResult<ScanKeysResult>>
  listProfiles: (agentId: SessionId, request: EmptyRequest, signal?: AbortSignal) => Promise<RemoteResult<ProfileCollection>>
  saveProfile: (agentId: SessionId, request: SaveProfileRequest, signal?: AbortSignal) => Promise<RemoteResult<ProfileCollection>>
  removeProfile: (agentId: SessionId, request: ProfileId, signal?: AbortSignal) => Promise<RemoteResult<ProfileCollection>>
  connect: (agentId: SessionId, request: ConnectionRequest, signal?: AbortSignal) => Promise<RemoteResult<ConnectionView>>
  disconnect: (agentId: SessionId, request: ConnectionTarget, signal?: AbortSignal) => Promise<RemoteResult<ConnectionView>>
  connectionStatus: (agentId: SessionId, request: EmptyRequest, signal?: AbortSignal) => Promise<RemoteResult<ConnectionView>>
  status: (agentId: SessionId, request: EmptyRequest, signal?: AbortSignal) => Promise<RemoteResult<RedisHostStatus>>
}
declare module '@deepseek-ai/dsh-typert-protocol' {
  interface TypertRemoteMap {
    'redisViewer/writeLookup': RedisViewerRemote['writeLookup']
    'redisViewer/writeModeStatus': RedisViewerRemote['writeModeStatus']
    'redisViewer/setWriteMode': RedisViewerRemote['setWriteMode']
    'redisViewer/openUiChannel': RedisViewerRemote['openUiChannel']
    'redisViewer/aiBudgetStatus': RedisViewerRemote['aiBudgetStatus']
    'redisViewer/resumeAiBudget': RedisViewerRemote['resumeAiBudget']
    'redisViewer/readDatabases': RedisViewerRemote['readDatabases']
    'redisViewer/readStream': RedisViewerRemote['readStream']
    'redisViewer/readZSet': RedisViewerRemote['readZSet']
    'redisViewer/scanSet': RedisViewerRemote['scanSet']
    'redisViewer/readList': RedisViewerRemote['readList']
    'redisViewer/scanHash': RedisViewerRemote['scanHash']
    'redisViewer/readActionPoint': RedisViewerRemote['readActionPoint']
    'redisViewer/readString': RedisViewerRemote['readString']
    'redisViewer/selectDatabase': RedisViewerRemote['selectDatabase']
    'redisViewer/scanKeys': RedisViewerRemote['scanKeys']
    'redisViewer/listProfiles': RedisViewerRemote['listProfiles']
    'redisViewer/saveProfile': RedisViewerRemote['saveProfile']
    'redisViewer/removeProfile': RedisViewerRemote['removeProfile']
    'redisViewer/status': RedisViewerRemote['status']
    'redisViewer/connect': RedisViewerRemote['connect']
    'redisViewer/disconnect': RedisViewerRemote['disconnect']
    'redisViewer/connectionStatus': RedisViewerRemote['connectionStatus']
  }
  interface TypertRemoteNamespaceMap { redisViewer: RedisViewerRemote }
  interface TypertRemoteScopeMap {
    'agent:redisViewer/writeLookup': (request: RedisWriteLookupRequest, signal?: AbortSignal) => Promise<RemoteResult<RedisWriteLookupResult>>
    'agent:redisViewer/writeModeStatus': (request: EmptyRequest, signal?: AbortSignal) => Promise<RemoteResult<RedisWriteModeStatus>>
    'agent:redisViewer/setWriteMode': (request: RedisWriteModeRequest, signal?: AbortSignal) => Promise<RemoteResult<RedisWriteModeStatus>>
    'agent:redisViewer/openUiChannel': (request: EmptyRequest, signal?: AbortSignal) => RemoteStreamHandle<UiChannelMessage, UiChannelInput>
    'agent:redisViewer/aiBudgetStatus': (request: EmptyRequest, signal?: AbortSignal) => Promise<RemoteResult<AiBudgetStatus>>
    'agent:redisViewer/resumeAiBudget': (request: EmptyRequest, signal?: AbortSignal) => Promise<RemoteResult<AiBudgetResume>>
    'agent:redisViewer/readDatabases': (request: DatabasesReadRequest, signal?: AbortSignal) => Promise<RemoteResult<DatabasesReadResult>>
    'agent:redisViewer/readStream': (request: StreamReadRequest, signal?: AbortSignal) => Promise<RemoteResult<StreamReadResult>>
    'agent:redisViewer/readZSet': (request: ZSetReadRequest, signal?: AbortSignal) => Promise<RemoteResult<ZSetReadResult>>
    'agent:redisViewer/scanSet': (request: ScanSetRequest, signal?: AbortSignal) => Promise<RemoteResult<ScanSetResult>>
    'agent:redisViewer/readList': (request: ListReadRequest, signal?: AbortSignal) => Promise<RemoteResult<ListReadResult>>
    'agent:redisViewer/scanHash': (request: ScanHashRequest, signal?: AbortSignal) => Promise<RemoteResult<ScanHashResult>>
    'agent:redisViewer/readActionPoint': (request: ActionPointReadRequest, signal?: AbortSignal) => Promise<RemoteResult<ActionPointReadResult>>
    'agent:redisViewer/readString': (request: StringReadRequest, signal?: AbortSignal) => Promise<RemoteResult<StringReadResult>>
    'agent:redisViewer/selectDatabase': (request: DatabaseTarget, signal?: AbortSignal) => Promise<RemoteResult<ConnectionView>>
    'agent:redisViewer/scanKeys': (request: ScanKeysRequest, signal?: AbortSignal) => Promise<RemoteResult<ScanKeysResult>>
    'agent:redisViewer/listProfiles': (request: EmptyRequest, signal?: AbortSignal) => Promise<RemoteResult<ProfileCollection>>
    'agent:redisViewer/saveProfile': (request: SaveProfileRequest, signal?: AbortSignal) => Promise<RemoteResult<ProfileCollection>>
    'agent:redisViewer/removeProfile': (request: ProfileId, signal?: AbortSignal) => Promise<RemoteResult<ProfileCollection>>
    'agent:redisViewer/status': (request: EmptyRequest, signal?: AbortSignal) => Promise<RemoteResult<RedisHostStatus>>
    'agent:redisViewer/connect': (request: ConnectionRequest, signal?: AbortSignal) => Promise<RemoteResult<ConnectionView>>
    'agent:redisViewer/disconnect': (request: ConnectionTarget, signal?: AbortSignal) => Promise<RemoteResult<ConnectionView>>
    'agent:redisViewer/connectionStatus': (request: EmptyRequest, signal?: AbortSignal) => Promise<RemoteResult<ConnectionView>>
  }
}
export const TYPERT_REMOTE: TypertRemoteContribution = { package: TYPERT_PACKAGE, descriptors: redisDescriptors }
export default TYPERT_REMOTE
