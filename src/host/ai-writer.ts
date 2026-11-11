import type { DatabaseTarget } from '../domain.ts'
import { RedisConnections } from './connection-service.ts'
import { RedisWriteHistory, type RedisWriteRecord } from './write-history.ts'
import { RedisWriteProposals, type RedisWriteProposal } from './write-proposals.ts'
import type { RedisReplaceRequest, RedisSampleRequest } from './redis-write-transaction.ts'

export interface RedisWriteInput {
  readonly type: 'string' | 'hash'
  readonly keyBase64: string
  readonly fieldBase64: string | null
  readonly afterBase64: string
}

function bytes(value: string): Buffer {
  if (value.length > Math.ceil(4096 / 3) * 4) throw new Error('Redis 写入数据超过限制。')
  const result = Buffer.from(value, 'base64')
  if (result.length > 4096 || result.toString('base64') !== value) throw new Error('Redis 写入数据不是规范 Base64。')
  return result
}

/** Host-only coordinator; callers supply the trusted live DSH turn check. */
export class RedisAiWriter {
  private readonly proposals = new RedisWriteProposals()
  private readonly history = new RedisWriteHistory()
  constructor(private readonly connections: RedisConnections) {}

  enable(sessionId: string, target: DatabaseTarget): void {
    this.connections.assertTarget(sessionId, target)
    this.proposals.enable(sessionId, target)
  }
  disable(sessionId: string): void { this.proposals.disable(sessionId) }
  isEnabled(sessionId: string, target: DatabaseTarget): boolean {
    try { this.connections.assertTarget(sessionId, target); return this.proposals.isEnabled(sessionId, target) } catch { return false }
  }
  endTurn(sessionId: string, turnId: string): void { this.proposals.endTurn(sessionId, turnId) }
  status(sessionId: string, id: string): RedisWriteRecord | null { return this.history.get(sessionId, id) }

  async prepare(sessionId: string, target: DatabaseTarget, turnId: string, currentTurn: () => boolean, input: RedisWriteInput, signal: AbortSignal): Promise<RedisWriteProposal> {
    const key = bytes(input.keyBase64), after = bytes(input.afterBase64)
    if (input.type !== 'string' && input.type !== 'hash' || (input.type === 'string' ? input.fieldBase64 !== null : input.fieldBase64 === null)) throw new Error('Redis 写入目标类型无效。')
    const field = input.fieldBase64 === null ? null : bytes(input.fieldBase64)
    if (!currentTurn() || !this.isEnabled(sessionId, target)) throw new Error('Redis 写入未启用或对话已变化。')
    const token = this.proposals.beginTurn(sessionId, turnId)
    const validate = () => {
      if (!currentTurn() || !this.proposals.isCurrent(sessionId, turnId, token, target)) throw new Error('Redis 写入对话或启用状态已变化。')
    }
    const sample: RedisSampleRequest = field === null ? { type: 'string', key } : { type: 'hash', key, field }
    const before = await this.connections.sampleExisting(sessionId, target, sample, signal, validate)
    validate()
    const view = this.connections.status(sessionId)
    if (view.target === null) throw new Error('Redis 连接不可用。')
    return this.proposals.issue(sessionId, turnId, token, { target, host: view.target.host, port: view.target.port, type: input.type, keyTtl: 'none', fieldTtl: field === null ? null : 'none', keyBase64: key.toString('base64'), fieldBase64: field?.toString('base64') ?? null, beforeBase64: before.toString('base64'), afterBase64: after.toString('base64') })
  }

  async execute(sessionId: string, turnId: string, currentTurn: () => boolean, requested: RedisWriteProposal, signal: AbortSignal): Promise<RedisWriteRecord> {
    if (!currentTurn() || !this.isEnabled(sessionId, requested.target)) throw new Error('Redis 写入未启用或对话已变化。')
    const token = this.proposals.beginTurn(sessionId, turnId)
    const consumed = this.proposals.consume(sessionId, turnId, requested)
    if (consumed === null) throw new Error('Redis 写入提案已变化、过期或已使用。')
    const proposal = consumed.proposal
    const record = this.history.start(sessionId, proposal.id, proposal.target, { type: proposal.type, keyBase64: proposal.keyBase64, fieldBase64: proposal.fieldBase64 })
    const key = bytes(proposal.keyBase64), before = bytes(proposal.beforeBase64), after = bytes(proposal.afterBase64)
    const request: RedisReplaceRequest = proposal.type === 'string' ? { type: 'string', key, before, after } : { type: 'hash', key, field: bytes(proposal.fieldBase64!), before, after }
    const validate = () => { if (!currentTurn() || !this.proposals.isCurrent(sessionId, turnId, token, proposal.target) || !consumed.isCurrent()) throw new Error('Redis 写入提案已过期或对话已变化。') }
    let sampledAt: string | undefined
    const result = await this.connections.replaceExisting(sessionId, proposal.target, request, signal, validate, record.submitted, value => { sampledAt = value })
    record.finish(result, sampledAt)
    const stored = this.history.get(sessionId, proposal.id)
    if (stored === null) throw new Error('Redis 操作记录不可用，请检查目标当前状态。')
    return stored
  }

  dispose(): void { this.proposals.dispose(); this.history.dispose() }
}
