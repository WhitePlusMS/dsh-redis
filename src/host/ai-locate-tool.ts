import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { MAX_KEY_BYTES, MAX_SCAN_KEYS, type UiAction } from '../domain.ts'
import { isStreamId } from '../stream-id.ts'
import { connectionErrorMessages } from '../connection-errors.ts'
import { hashFieldReadRequestSchema, listReadRequestSchema, setMemberReadRequestSchema, stringReadRequestSchema } from '../typert.shared.ts'
import { ConnectionFailure } from './connection-service.ts'
import { byteIdentity } from './byte-identity.ts'
import type { RedisAiReader } from './ai-reader.ts'
import type { UiActionCoordinator } from './ui-action-coordinator.ts'

/** Reject lone UTF-16 surrogates instead of silently encoding replacement bytes. */
function textIdentity(value: string): string {
  const bytes = Buffer.from(value, 'utf8')
  if (bytes.toString('utf8') !== value) throw new Error('文本包含无法无损编码的字符，请使用规范 Base64 身份。')
  return bytes.toString('base64')
}

/** Locate only an explicitly supplied key in the current trusted session. */
export function registerRedisLocateTool(ctx: Context, reader: RedisAiReader, actions: UiActionCoordinator<UiAction>): void {
  ctx.tools.register(defineTool({
    name: 'redis_viewer_locate_stream_field',
    description: '仅在用户明确要求定位当前 Stream Key 的消息字段对时使用。id 是完整消息 ID，fieldIndex 是整条消息中从 0 开始的字段对位置，而非同名字段出现次数。按 ID 精确 XRANGE 只读采样，不推进消费组；确认字段身份后界面再采样，消息可能发生变化。只有界面确认后返回 applied。',
    parameters: { id: { type: 'string', required: true }, fieldIndex: { type: 'integer', required: true } },
    output: { schema: { type: 'json' }, render: (_args: unknown, value: unknown) => [{ type: 'text', text: JSON.stringify(value) }] },
    timeoutMs: 15000,
    async execute(args, exec) {
      exec.signal.throwIfAborted()
      if (exec.agent === undefined) throw new Error('Redis 工具调用缺少有效的 DSH 对话身份。')
      if (Object.keys(args).some(key => key !== 'id' && key !== 'fieldIndex')) throw new Error('Redis 工具包含不支持的参数。')
      if (!isStreamId(args.id) || args.id === '0-0' || !Number.isSafeInteger(args.fieldIndex) || args.fieldIndex < 0 || args.fieldIndex >= MAX_SCAN_KEYS) throw new Error('消息 ID 或字段位置无效。')
      const session = exec.agent.session.id
      return reader.withBudget(session, exec.signal, async () => {
        const prepared = await reader.prepareStreamField(session, args.id, args.fieldIndex, exec.signal).catch((error: unknown) => {
          if (error instanceof ConnectionFailure && error.code === 'stale') return null
          throw error
        })
        if (prepared === null) return { outcome: 'stale', message: '连接或界面选择已变化，请重试。' }
        const sample = prepared.sample
        if (sample.state !== 'value') {
          const message = sample.error !== null ? connectionErrorMessages[sample.error].zh : sample.state === 'missing' ? '采样时该 Key 不存在或已过期。' : sample.state === 'selection-missing' ? '采样时该消息或字段位置不存在。' : '采样时 Key 类型或消息已变化。'
          return { outcome: sample.state, error: sample.error, sampledAt: sample.sampledAt, message }
        }
        const field = sample.message?.fields[args.fieldIndex]?.field
        if (field === undefined) throw new Error('采样消息缺少目标字段。')
        const outcome = await actions.dispatch(session, { kind: 'selectStreamField', keyBase64: prepared.keyBase64, id: args.id, fieldIndex: args.fieldIndex, fieldBase64: field.base64 }, prepared.target, prepared.revision, prepared.currentKey, exec.signal)
        return { outcome, id: args.id, fieldIndex: args.fieldIndex, field: { label: field.label, byteLength: field.byteLength }, sampledAt: sample.sampledAt, message: outcome === 'applied' ? '已确认当前 Redis 面板定位该消息字段；消息可能在两次采样间变化。' : outcome === 'unknown' ? '界面动作已进入准备阶段，但最终结果未知，请检查当前面板。' : '未能确认消息字段定位，请检查当前面板后重试。' }
      })
    },
  }))
  ctx.tools.register(defineTool({
    name: 'redis_viewer_locate_zset_member',
    description: '仅在用户明确要求定位 ZSet 成员时使用。目标是当前面板已选中的 ZSet Key；member 文本或 memberBase64 规范二进制身份二选一，空成员合法。使用 ZSCORE 精确只读采样，不扫描；返回的 score 和 sampledAt 属于工具预采样，面板另行采样，分数和时间可能不同；只有界面确认后返回 applied。',
    parameters: { member: { type: 'string' }, memberBase64: { type: 'string' } },
    output: { schema: { type: 'json' }, render: (_args: unknown, value: unknown) => [{ type: 'text', text: JSON.stringify(value) }] },
    timeoutMs: 15000,
    async execute(args, exec) {
      exec.signal.throwIfAborted()
      if (exec.agent === undefined) throw new Error('Redis 工具调用缺少有效的 DSH 对话身份。')
      if (Object.keys(args).some(key => key !== 'member' && key !== 'memberBase64')) throw new Error('Redis 工具包含不支持的参数。')
      if ((args.member === undefined) === (args.memberBase64 === undefined)) throw new Error('必须提供 member 或 memberBase64 中的一个。')
      if (args.member !== undefined && Buffer.byteLength(args.member, 'utf8') > MAX_KEY_BYTES) throw new Error('成员超过允许的字节数。')
      const session = exec.agent.session.id
      return reader.withBudget(session, exec.signal, async () => {
        const request = setMemberReadRequestSchema.parse({ target: reader.currentTarget(session), keyBase64: '', memberBase64: args.member === undefined ? args.memberBase64 : textIdentity(args.member) })
        const prepared = await reader.prepareZSetMember(session, request.memberBase64, exec.signal).catch((error: unknown) => {
          if (error instanceof ConnectionFailure && error.code === 'stale') return null
          throw error
        })
        if (prepared === null) return { outcome: 'stale', message: '连接或界面选择已变化，请重试。' }
        const sample = prepared.sample
        if (sample.state !== 'value') {
          const message = sample.error !== null ? connectionErrorMessages[sample.error].zh : sample.state === 'missing' ? '采样时该 Key 不存在或已过期。' : sample.state === 'selection-missing' ? '采样时该 ZSet 成员不存在。' : '采样时 Key 类型已变化，不能定位 ZSet 成员。'
          return { outcome: sample.state, error: sample.error, sampledAt: sample.sampledAt, message }
        }
        const member = byteIdentity(Buffer.from(request.memberBase64, 'base64'))
        const outcome = await actions.dispatch(session, { kind: 'selectZSetMember', keyBase64: prepared.keyBase64, member }, prepared.target, prepared.revision, prepared.currentKey, exec.signal)
        return { outcome, member: { label: member.label, byteLength: member.byteLength }, score: sample.score, sampledAt: sample.sampledAt, sampleNote: 'score 和 sampledAt 属于工具预采样；面板单独再次采样，分数和时间可能不同。', message: outcome === 'applied' ? '已确认当前 Redis 面板定位该成员。' : outcome === 'unknown' ? '界面动作已进入准备阶段，但最终结果未知，请检查当前面板。' : '未能确认成员定位，请检查当前面板后重试。' }
      })
    },
  }))
  ctx.tools.register(defineTool({
    name: 'redis_viewer_locate_set_member',
    description: '仅在用户明确要求定位 Set 成员时使用。目标是当前面板已选中的 Set Key，不跨 Key；member 为文本或 memberBase64 为规范二进制身份，二者只能提供一个，空成员合法。使用精确 SISMEMBER 采样，不扫描、不修改数据；Key 和成员组合过大时请求可能超限并明确报告 oversize；只有界面确认后才返回 applied，成员存在性仅代表采样时结果。',
    parameters: { member: { type: 'string' }, memberBase64: { type: 'string' } },
    output: { schema: { type: 'json' }, render: (_args: unknown, value: unknown) => [{ type: 'text', text: JSON.stringify(value) }] },
    timeoutMs: 15000,
    async execute(args, exec) {
      exec.signal.throwIfAborted()
      if (exec.agent === undefined) throw new Error('Redis 工具调用缺少有效的 DSH 对话身份。')
      if (Object.keys(args).some(key => key !== 'member' && key !== 'memberBase64')) throw new Error('Redis 工具包含不支持的参数。')
      if ((args.member === undefined) === (args.memberBase64 === undefined)) throw new Error('必须提供 member 或 memberBase64 中的一个。')
      if (args.member !== undefined && Buffer.byteLength(args.member, 'utf8') > MAX_KEY_BYTES) throw new Error('成员超过允许的字节数。')
      const session = exec.agent.session.id
      return reader.withBudget(session, exec.signal, async () => {
        const request = setMemberReadRequestSchema.parse({ target: reader.currentTarget(session), keyBase64: '', memberBase64: args.member === undefined ? args.memberBase64 : textIdentity(args.member) })
        const prepared = await reader.prepareSetMember(session, request.memberBase64, exec.signal).catch((error: unknown) => {
          if (error instanceof ConnectionFailure && error.code === 'stale') return null
          throw error
        })
        if (prepared === null) return { outcome: 'stale', message: '连接或界面选择已变化，请重试。' }
        const sample = prepared.sample
        if (sample.state !== 'value') {
          const message = sample.error !== null ? connectionErrorMessages[sample.error].zh : sample.state === 'missing' ? '采样时该 Key 不存在或已过期。' : sample.state === 'selection-missing' ? '采样时该 Set 成员不存在。' : '采样时 Key 类型已变化，不能定位 Set 成员。'
          return { outcome: sample.state, error: sample.error, sampledAt: sample.sampledAt, message }
        }
        const member = byteIdentity(Buffer.from(request.memberBase64, 'base64'))
        const outcome = await actions.dispatch(session, { kind: 'selectSetMember', keyBase64: prepared.keyBase64, member }, prepared.target, prepared.revision, prepared.currentKey, exec.signal)
        return { outcome, member: { label: member.label, byteLength: member.byteLength }, sampledAt: sample.sampledAt, message: outcome === 'applied' ? '已确认当前 Redis 面板定位该成员，存在性仅代表采样时结果。' : outcome === 'unknown' ? '界面动作已进入准备阶段，但最终结果未知，请检查当前面板。' : '未能确认成员定位，请检查当前面板后重试。' }
      })
    },
  }))
  ctx.tools.register(defineTool({
    name: 'redis_viewer_locate_key',
    description: '仅在用户明确要求定位 Key 时使用：在当前对话已连接的 Redis 和唯一可见面板中定位指定 Key。key 为文本，keyBase64 为精确二进制身份，两者只能提供一个；空 Key 合法。只做一次 TYPE 定点检查，不扫描全库、不修改数据。仅界面确认后返回 applied；不存在、权限不足或界面变化分别报告。极长 Key 即使定位成功，后续状态或值读取可能因完整身份超过单次结果预算而被拒绝。',
    parameters: { key: { type: 'string' }, keyBase64: { type: 'string' } },
    output: { schema: { type: 'json' }, render: (_args: unknown, value: unknown) => [{ type: 'text', text: JSON.stringify(value) }] },
    timeoutMs: 15000,
    async execute(args, exec) {
      exec.signal.throwIfAborted()
      if (exec.agent === undefined) throw new Error('Redis 工具调用缺少有效的 DSH 对话身份。')
      if (Object.keys(args).some(key => key !== 'key' && key !== 'keyBase64')) throw new Error('Redis 工具包含不支持的参数。')
      if ((args.key === undefined) === (args.keyBase64 === undefined)) throw new Error('必须提供 key 或 keyBase64 中的一个。')
      if (args.key !== undefined && Buffer.byteLength(args.key, 'utf8') > MAX_KEY_BYTES) throw new Error('Key 超过允许的字节数。')
      const session = exec.agent.session.id
      return reader.withBudget(session, exec.signal, async () => {
        const target = reader.currentTarget(session), revision = actions.selectionRevision(session)
        if (revision === null) return { outcome: 'stale', message: '请在当前对话打开唯一 Redis 面板并等待选择同步。' }
        const request = stringReadRequestSchema.parse({ target, keyBase64: args.key === undefined ? args.keyBase64 : textIdentity(args.key), offset: '0', count: 1 })
        const validate = () => { if (actions.selectionRevision(session) !== revision) throw new ConnectionFailure('stale') }
        const probe = await reader.probeKey(session, target, request.keyBase64, exec.signal, validate)
        exec.signal.throwIfAborted()
        if (probe.state === 'missing') return { outcome: 'missing', sampledAt: probe.sampledAt, message: '采样时该 Key 不存在或已过期。' }
        if (probe.state === 'failed') return { outcome: 'failed', error: probe.error, sampledAt: probe.sampledAt, message: probe.error === null ? 'Key 检查失败。' : connectionErrorMessages[probe.error].zh }
        if (actions.selectionRevision(session) !== revision || !reader.isCurrentTarget(session, target)) return { outcome: 'stale', message: '连接或界面选择已变化，请重试。' }
        const key = byteIdentity(Buffer.from(request.keyBase64, 'base64'))
        const outcome = await actions.dispatch(session, { kind: 'selectKey', key }, target, revision, () => reader.isCurrentTarget(session, target), exec.signal)
        return { outcome, key: { label: key.label, byteLength: key.byteLength }, sampledAt: probe.sampledAt, message: outcome === 'applied' ? '已确认当前 Redis 面板定位该 Key。' : outcome === 'unknown' ? '界面动作已进入准备阶段，但最终结果未知，请检查当前面板。' : '未能确认界面定位，请检查当前面板后重试。' }
      })
    },
  }))
  ctx.tools.register(defineTool({
    name: 'redis_viewer_locate_list_index',
    description: '仅在用户明确要求定位 List 下标时使用。目标是当前面板已选中的 List Key；index 是非负十进制整数文本，零为第一个位置，最大为 Redis 有符号 64 位整数。只读取该位置，不扫描、不修改数据；并发插入或删除会改变下标对应的元素，位置仅代表采样时结果，不能声称业务元素身份不变。只有界面确认后才返回 applied。',
    parameters: { index: { type: 'string', required: true } },
    output: { schema: { type: 'json' }, render: (_args: unknown, value: unknown) => [{ type: 'text', text: JSON.stringify(value) }] },
    timeoutMs: 15000,
    async execute(args, exec) {
      exec.signal.throwIfAborted()
      if (exec.agent === undefined) throw new Error('Redis 工具调用缺少有效的 DSH 对话身份。')
      if (Object.keys(args).some(key => key !== 'index')) throw new Error('Redis 工具包含不支持的参数。')
      const session = exec.agent.session.id
      return reader.withBudget(session, exec.signal, async () => {
        const request = listReadRequestSchema.parse({ target: reader.currentTarget(session), keyBase64: '', offset: args.index, count: 1 })
        const prepared = await reader.prepareListIndex(session, request.offset, exec.signal).catch((error: unknown) => {
          if (error instanceof ConnectionFailure && error.code === 'stale') return null
          throw error
        })
        if (prepared === null) return { outcome: 'stale', message: '连接或界面选择已变化，请重试。' }
        const sample = prepared.sample
        if (sample.state !== 'value') {
          const message = sample.error !== null ? connectionErrorMessages[sample.error].zh : sample.state === 'missing' ? '采样时该 Key 不存在或已过期。' : sample.state === 'selection-missing' ? '采样时该 List 下标不存在。' : '采样时 Key 类型或 List 内容已变化，请重试。'
          return { outcome: sample.state, error: sample.error, sampledAt: sample.sampledAt, message }
        }
        const outcome = await actions.dispatch(session, { kind: 'selectListIndex', keyBase64: prepared.keyBase64, index: request.offset }, prepared.target, prepared.revision, prepared.currentKey, exec.signal)
        return { outcome, index: request.offset, sampledAt: sample.sampledAt, message: outcome === 'applied' ? '已确认当前 Redis 面板定位该下标；List 并发变化时该位置可能指向其他元素。' : outcome === 'unknown' ? '界面动作已进入准备阶段，但最终结果未知，请检查当前面板。' : '未能确认下标定位，请检查当前面板后重试。' }
      })
    },
  }))
  ctx.tools.register(defineTool({
    name: 'redis_viewer_locate_hash_field',
    description: '仅在用户明确要求定位 Hash 字段时使用。目标是当前面板已选中的 Hash Key，不跨 Key；field 为文本或 fieldBase64 为规范二进制身份，二者只能提供一个，空字段合法。使用精确 HGET 采样，不扫描、不修改数据；Key 和字段组合过大时请求可能超限并明确报告 oversize；只有界面确认后才返回 applied。',
    parameters: { field: { type: 'string' }, fieldBase64: { type: 'string' } },
    output: { schema: { type: 'json' }, render: (_args: unknown, value: unknown) => [{ type: 'text', text: JSON.stringify(value) }] },
    timeoutMs: 15000,
    async execute(args, exec) {
      exec.signal.throwIfAborted()
      if (exec.agent === undefined) throw new Error('Redis 工具调用缺少有效的 DSH 对话身份。')
      if (Object.keys(args).some(key => key !== 'field' && key !== 'fieldBase64')) throw new Error('Redis 工具包含不支持的参数。')
      if ((args.field === undefined) === (args.fieldBase64 === undefined)) throw new Error('必须提供 field 或 fieldBase64 中的一个。')
      if (args.field !== undefined && Buffer.byteLength(args.field, 'utf8') > MAX_KEY_BYTES) throw new Error('字段超过允许的字节数。')
      const session = exec.agent.session.id
      return reader.withBudget(session, exec.signal, async () => {
        const request = hashFieldReadRequestSchema.parse({ target: reader.currentTarget(session), keyBase64: '', fieldBase64: args.field === undefined ? args.fieldBase64 : textIdentity(args.field) })
        const prepared = await reader.prepareHashField(session, request.fieldBase64, exec.signal).catch((error: unknown) => {
          if (error instanceof ConnectionFailure && error.code === 'stale') return null
          throw error
        })
        if (prepared === null) return { outcome: 'stale', message: '连接或界面选择已变化，请重试。' }
        const sample = prepared.sample
        if (sample.state !== 'value') {
          const message = sample.error !== null ? connectionErrorMessages[sample.error].zh : sample.state === 'missing' ? '采样时该 Key 不存在或已过期。' : sample.state === 'selection-missing' ? '采样时该 Hash 字段不存在。' : '采样时 Key 的类型已变化，不能定位 Hash 字段。'
          return { outcome: sample.state, error: sample.error, sampledAt: sample.sampledAt, message }
        }
        const field = byteIdentity(Buffer.from(request.fieldBase64, 'base64'))
        const outcome = await actions.dispatch(session, { kind: 'selectHashField', keyBase64: prepared.keyBase64, field }, prepared.target, prepared.revision, prepared.currentKey, exec.signal)
        return { outcome, field: { label: field.label, byteLength: field.byteLength }, sampledAt: sample.sampledAt, message: outcome === 'applied' ? '已确认当前 Redis 面板定位该字段。' : outcome === 'unknown' ? '界面动作已进入准备阶段，但最终结果未知，请检查当前面板。' : '未能确认字段定位，请检查当前面板后重试。' }
      })
    },
  }))
}
