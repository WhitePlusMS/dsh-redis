/** Chinese answers are projections of one recorded result, not model assertions.
 * Values remain JSON/plain text: never execute content or parse JSON.GET numbers.
 */
function object(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {}
}
function text(value: unknown): string | null { return typeof value === 'string' ? value : null }
function identity(value: unknown): string {
  const data = object(value), label = text(data.label)
  // Display labels can be shortened or hexadecimal previews; preserve the full
  // identity for those cases instead of treating a preview as the actual key.
  return label !== null && !label.endsWith('…') && !label.startsWith('0x') ? label : `Base64 ${JSON.stringify(data.base64 ?? value)}`
}

export interface RedisAnswerSection {
  readonly callId: string
  readonly tool: string
  readonly paragraphs: readonly string[]
  readonly values: readonly { readonly label: string; readonly text: string }[]
}

/** Link only actual continuation pages. Equal conditions alone do not identify
 * one iteration: a restarted query must not be added to its predecessor.
 */
export function summarizeRedisFilters(records: readonly { readonly callId: string; readonly inputCursor: string | null | undefined; readonly result: Record<string, unknown> }[]) {
  const names = ['checked', 'matched', 'different', 'missingField', 'missingKey', 'notHash', 'typeChanged', 'failed'] as const
  type Summary = { binding: string; first: boolean; pages: number; counts: Record<typeof names[number], number>; matches: Map<string, unknown>; callId: string; ended: boolean }
  const pending = new Map<string, Summary>(), groups: Summary[] = []
  for (const record of records) {
    const data = record.result, counts = object(data.counts), condition = object(data.condition)
    if (record.inputCursor === undefined || data.state !== 'page' || typeof data.pattern !== 'string' || typeof condition.field !== 'string' || typeof condition.equals !== 'string' || !Array.isArray(data.matches) || !names.every(name => Number.isSafeInteger(counts[name]) && Number(counts[name]) >= 0)) continue
    const binding = JSON.stringify([data.pattern, condition.field, condition.equals])
    let group = record.inputCursor === null ? undefined : pending.get(record.inputCursor)
    if (group?.binding !== binding) group = undefined
    if (record.inputCursor !== null) pending.delete(record.inputCursor)
    if (group === undefined) {
      group = { binding, first: record.inputCursor === null, pages: 0, counts: { checked: 0, matched: 0, different: 0, missingField: 0, missingKey: 0, notHash: 0, typeChanged: 0, failed: 0 }, matches: new Map(), callId: record.callId, ended: false }
      groups.push(group)
    }
    group.pages++; group.callId = record.callId; group.ended = data.scanComplete === true && data.cursor === null
    for (const name of names) group.counts[name] += Number(counts[name])
    for (const match of data.matches) { const key = object(match); if (typeof key.base64 === 'string') group.matches.set(key.base64, match) }
    if (typeof data.cursor === 'string') pending.set(data.cursor, group)
  }
  return new Map(groups.map(group => [group.callId, {
    paragraphs: [`${group.first && group.ended ? '本次迭代' : '本轮已记录的连续批次'}汇总：${group.pages} 批，累计检查 ${group.counts.checked} 次，匹配 ${group.counts.matched} 次，匹配 Key 去重后 ${group.matches.size} 个；非 Hash ${group.counts.notHash} 次，缺字段 ${group.counts.missingField} 次，读取失败 ${group.counts.failed} 次。`, '累计计数包含跨批重复检查；去重名称仅代表实际返回的匹配，SCAN 不是一致性快照。'],
    values: [{ label: '累计分类计数（检查次数）', text: JSON.stringify(group.counts, null, 2) }, { label: '已返回匹配 Key（去重）', text: JSON.stringify([...group.matches.values()], null, 2) }],
  }]))
}

/** Validate persisted display data before rendering; Redis strings stay escaped text. */
export function parseRedisAnswer(raw: string): readonly RedisAnswerSection[] | null {
  if (raw.length > 65536) return null
  let parsed: unknown
  try { parsed = JSON.parse(raw) } catch { return null }
  const data = object(parsed)
  if (data.readOnly !== true || data.state !== 'answered' || !Array.isArray(data.answers) || data.answers.length < 1 || data.answers.length > 32) return null
  const answers: RedisAnswerSection[] = []
  for (const entry of data.answers) {
    const item = object(entry)
    if (typeof item.callId !== 'string' || typeof item.tool !== 'string' || !Array.isArray(item.paragraphs) || !item.paragraphs.every((value: unknown): value is string => typeof value === 'string') || !Array.isArray(item.values)) return null
    const values: { label: string; text: string }[] = []
    for (const rawValue of item.values) {
      const value = object(rawValue)
      if (typeof value.label !== 'string' || typeof value.text !== 'string') return null
      values.push({ label: value.label, text: value.text })
    }
    answers.push({ callId: item.callId, tool: item.tool, paragraphs: item.paragraphs, values })
  }
  return answers
}

export function describeRedisResult(tool: string, data: Record<string, unknown>) {
  if (data.kind === 'ui-receipt') {
    const receipt = object(data.receipt), connection = object(data.connection), endpoint = object(connection.target)
    return {
      paragraphs: [typeof endpoint.host === 'string' ? `操作发起时的连接目标：${JSON.stringify(endpoint.host)}:${String(endpoint.port)}；DB ${String(connection.db)}。` : '操作发起时尚未连接 Redis。', text(receipt.message) ?? '界面操作结果见回执。', ...(tool === 'redis_viewer_show' && receipt.outcome === 'applied' ? ['打开已连接面板可能自动加载 DB 与 Key 名称；此回执不证明没有发生名称扫描。'] : []), '此处记录界面动作回执，不把它当作当前 Redis 值、连接状态或故障根因的采样。'],
      values: [{ label: '界面回执', text: JSON.stringify(receipt, null, 2) }],
    }
  }
  const value = object(data.value), metadata = object(data.metadata ?? value.metadata), connection = object(data.connection)
  const state = text(data.state ?? value.state), type = text(data.type ?? value.type ?? metadata.type)
  const paragraphs: string[] = [], values: { label: string; text: string }[] = []
  const add = (label: string, content: unknown) => { if (content !== undefined) values.push({ label, text: JSON.stringify(content, null, 2) }) }
  const target = data.key === undefined ? (data.source === 'selection' ? '读取时的侧栏选择' : '本次查询') : `Key ${identity(data.key)}`
  const time = text(data.sampledAt ?? value.sampledAt)
  const endpoint = object(connection.target)
  paragraphs.push(`${typeof endpoint.host === 'string' ? `${JSON.stringify(endpoint.host)}:${String(endpoint.port)}；` : ''}${data.scope === 'server' ? '服务器范围' : `DB ${String(connection.db)}`}；${time === null ? '采样时间见各项记录' : `采样时间 ${time}`}。`)
  if (data.source === 'explicit') paragraphs.push('按明确指定的目标读取。')
  if (data.source === 'selection') paragraphs.push('按读取时确认的侧栏选择读取；之后的选择变化不改变这份记录。')
  const failure = text(data.errorMessage)
  if (data.key !== undefined && !['redis_viewer_value', 'redis_viewer_key_metadata', 'redis_viewer_memory'].includes(tool)) paragraphs.push(`查询目标：${target}。`)
  if (tool === 'redis_viewer_geo') {
    if (data.member !== undefined) paragraphs.push(`成员：${identity(data.member)}。`)
    if (data.other !== undefined && data.other !== null) paragraphs.push(`另一成员：${identity(data.other)}。`)
  }
  for (const [key, label] of [['path', 'JSONPath'], ['from', '起始时间（毫秒）'], ['to', '结束时间（毫秒）'], ['offset', '起始位置'], ['count', '请求数量'], ['unit', '单位'], ['section', '概况类别']] as const) add(label, data[key])
  for (const [key, label] of [['offset', '值的起始位置'], ['pattern', '值的名称条件'], ['start', '起始消息 ID'], ['end', '结束消息 ID'], ['direction', '读取方向']] as const) add(label, value[key])
  if (failure !== null) paragraphs.push(failure)
  if (state === 'missing') paragraphs.push(`${target} 在采样时不存在；这次读取不能判断缺失原因。`)
  else if (state === 'selection-missing') paragraphs.push(`${target} 中指定的字段或成员在采样时不存在。`)
  else if (state === 'changed' || state === 'failed' || state === 'unsupported' || state === 'unavailable') paragraphs.push(`${target} 未取得可用结果（${state}）。`)
  else if (tool === 'redis_viewer_keys') {
    paragraphs.push(`按名称条件 ${JSON.stringify(data.pattern)} 查找，本批返回 ${Array.isArray(data.keys) ? data.keys.length : 0} 个候选。`)
    add('候选 Key', data.keys)
  } else if (tool === 'redis_viewer_filter_hash') {
    const counts = object(data.counts)
    paragraphs.push(`本批检查 ${String(counts.checked)} 个候选，匹配 ${String(counts.matched)} 个；仅代表本批检查结果。`)
    paragraphs.push(`名称条件：${JSON.stringify(data.pattern)}。`)
    add('筛选条件', data.condition); add('匹配 Key', data.matches); add('检查结果', data.counts); add('读取错误', data.errors)
  } else if (tool === 'redis_viewer_key_metadata') {
    paragraphs.push(`${target} 的类型为 ${type ?? '未知'}。本次只读取元信息，没有读取值。`)
  } else if (tool === 'redis_viewer_value') {
    paragraphs.push(`${target}${type === null ? '' : `（${type}）`}的本次读取结果如下。`)
    if (data.field !== undefined) paragraphs.push(`指定字段：${identity(data.field)}。`)
    if (data.member !== undefined) paragraphs.push(`指定成员：${identity(data.member)}${state === 'value' ? '，采样时存在' : ''}。`)
    if (value.text !== undefined) add(value.text === null ? '二进制值（Base64）' : '值', value.text === null ? value.base64 : value.text)
    if (value.cell !== undefined) add('选定值', value.cell)
    for (const [key, label] of [['entries', '条目'], ['members', '成员'], ['messages', '消息']] as const) add(label, value[key])
    if (value.score !== null) add('分数', value.score)
    add('选择记录', object(data.selected).selection)
  } else if (tool === 'redis_viewer_memory') {
    paragraphs.push(`${target} 的 MEMORY USAGE 结果为 ${String(data.bytes)} 字节。SAMPLES ${String(data.requestedSamples)} 是请求参数，实际采样数和误差未知；结果包含 Key、值的分配和管理开销，可能包含内部碎片，不是服务器总内存。`)
  } else if (tool === 'redis_viewer_compare_strings') {
    const comparison: Record<string, string> = { equal: '两次读取的值相同。', different: '两次读取的值不同。', undetermined: '已读前缀相同，但存在截断，无法判定完整值是否相同。', unavailable: '未取得足够的有效数据，无法比较。' }
    paragraphs.push(comparison[String(data.comparison)] ?? '比较结果未知。'); add('左侧采样', data.left); add('右侧采样', data.right)
  } else {
    const labels: Record<string, string> = { fields: '概况字段', entries: '慢日志', clients: '连接明细', groups: '消费组', samples: '时间序列样本', coordinates: '坐标', distance: '距离', bits: '位值', missing: '未返回字段' }
    for (const [key, label] of Object.entries(labels)) add(label, data[key])
    if (typeof data.matchesJson === 'string') values.push({ label: 'JSONPath 结果（原文）', text: data.matchesJson })
    if (tool === 'redis_viewer_stream_groups') paragraphs.push('pending 是已投递但未确认的消息数；lag 是尚未投递的消息数，null 表示未知，不能据此判断积压原因。')
    if (tool === 'redis_viewer_slowlog') paragraphs.push('慢日志记录服务器执行耗时，不含网络耗时；空结果不能证明没有慢查询。')
    if (tool === 'redis_viewer_geo') paragraphs.push('ZSet 类型本身不能证明数据是 GEO 索引；距离为近似值。')
    if (tool === 'redis_viewer_status' || tool === 'redis_viewer_select_db') { add('连接', data.connection); add('当前选择', data.currentSelection); add('选择同步状态', data.selectionSync) }
  }
  const ttl = text(data.ttlMs ?? metadata.ttlMs)
  if (ttl === '-1') paragraphs.push('采样时没有设置过期时间；不能据此判断过去是否设置过，或将来是否会过期。')
  else if (ttl !== null && /^\d+$/u.test(ttl)) paragraphs.push(`采样时剩余过期时间为 ${ttl} 毫秒。`)
  if (type === 'zset' && value.mode === 'range') {
    paragraphs.push(value.nextOffset === null ? '本次排名读取已到达末尾；这不是 SCAN 扫描。' : '本次只读取指定排名范围，后续排名可按下一偏移继续读取。')
  } else if (data.scanComplete !== undefined || value.scanComplete !== undefined) {
    const ended = (data.scanComplete ?? value.scanComplete) === true
    // Stream uses XRANGE/XREVRANGE pagination, not the SCAN command family.
    paragraphs.push(type === 'stream'
      ? ended ? '指定消息范围的分页读取已结束；不代表整个 Stream，跨批读取不是一致性快照。' : '指定消息范围尚未读完，当前结果只包含已返回的消息。'
      : ended ? '本次扫描迭代已结束，但 SCAN 不是一致性快照，跨批可能重复。' : '扫描尚未结束，当前结果不是完整匹配集合。')
  }
  if (data.complete === false || value.complete === false || object(value.cell).complete === false) paragraphs.push('本次仅返回部分数据，不能把它当作完整值或完整列表。')
  if (tool === 'redis_viewer_keys' || tool === 'redis_viewer_filter_hash') paragraphs.push('MATCH 按 Key 名称匹配；SCAN 仍可能遍历当前 DB 的键空间，COUNT 只是工作量提示。')
  for (const [key, label] of [['cursor', '续读令牌'], ['nextOffset', '下一偏移'], ['nextFrom', '下一时间范围']] as const) {
    const continuation = data[key] ?? value[key]
    if (continuation !== undefined && continuation !== null) add(label, continuation)
  }
  if (typeof data.coverage === 'string') paragraphs.push(data.coverage)
  if (tool !== 'redis_viewer_status' && tool !== 'redis_viewer_select_db') paragraphs.push('以上是本次采样事实；多命令或多批读取不是一致性快照，不能单独证明历史、变化趋势或故障原因。')
  return { paragraphs, values }
}
