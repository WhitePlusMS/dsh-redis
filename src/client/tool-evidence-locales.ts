export const EVIDENCE_NS = 'redis-evidence'
export const evidenceZh = {
  title: 'Redis 读取记录', preparing: '准备读取', running: '读取中', failed: '调用未成功', raw: '原始结果', inspect: '查看调用',
  ttl: 'TTL 只表示采样时的状态，不能证明过去是否设置过过期时间或缺失原因。',
  scan: 'MATCH 过滤名称，SCAN 仍可能遍历当前 DB 的键空间；COUNT 不是硬上限。空页可能还有续读，跨批可能重复。',
  memory: 'SAMPLES 5 是请求参数，实际采样数量和误差未知；单 Key 内存可能包含内部碎片，不是服务器总内存。',
  explicit: '本次按显式目标读取，不证明它是侧栏当前选中项。',
  selected: '本次按读取时已确认的侧栏选择读取，不代表之后的选择。',
  snapshot: '这是调用时的读取记录；多命令或多批读取不构成一致性快照，也不能单独证明历史或趋势。',
}
export const evidenceEn: Record<keyof typeof evidenceZh, string> = {
  title: 'Redis read record', preparing: 'Preparing', running: 'Reading', failed: 'Call unsuccessful', raw: 'Raw result', inspect: 'Inspect call',
  ttl: 'TTL describes the sampled state only. It cannot establish past expiry settings or why a key is missing.',
  scan: 'MATCH filters names; SCAN may still traverse the current DB keyspace. COUNT is a hint. Empty pages can have a continuation; batches may repeat keys.',
  memory: 'SAMPLES 5 is a request parameter; actual sample count and error are unknown. Per-key memory may include internal fragmentation and is not server total memory.',
  explicit: 'This call used an explicit target; it does not establish the current sidebar selection.',
  selected: 'This call used the selection confirmed at read time; it does not establish later selections.',
  snapshot: 'This is a recorded read. Multiple commands or batches are not a consistent snapshot and do not establish history or trends.',
}
declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap { 'redis-evidence': keyof typeof evidenceZh }
}
