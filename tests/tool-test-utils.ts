import type { Agent } from '@deepseek-ai/dsh-agent'
import { ToolCallId } from '@deepseek-ai/dsh-llm'
import type { ToolsService, ToolExecutionResult } from '@deepseek-ai/dsh-tools'

/** Execute one model-shaped call with the official native batch executor. */
export async function executeTool(tools: ToolsService, input: { callId: string; name: string; arguments: unknown; agent?: Agent; signal: AbortSignal }): Promise<ToolExecutionResult> {
  const batch = await tools.execute({
    calls: [{ type: 'tool-call', id: ToolCallId(input.callId), name: input.name, arguments: JSON.stringify(input.arguments) }],
    signal: input.signal,
    ...(input.agent === undefined ? {} : { agent: input.agent }),
  })
  const result = batch.results[0]
  if (result === undefined) throw new Error('DSH executor returned no tool result')
  return result.result
}
