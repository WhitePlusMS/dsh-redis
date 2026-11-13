import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime from '@deepseek-ai/dsh-tools'
import * as NativeToolExecutor from '@deepseek-ai/dsh-tool-executor-native'
import { ToolCallId } from '@deepseek-ai/dsh-llm'

export async function installNativeTools(ctx) {
  await ctx.plugin(SystemPrompt)
  await ctx.plugin(ToolRuntime)
  await ctx.plugin(NativeToolExecutor)
}

/** Run one model-shaped call with the same native batch entry used by the Agent. */
export async function executeTool(tools, { callId, name, arguments: args, agent, signal, log }) {
  const { results } = await tools.execute({
    calls: [{ type: 'tool-call', id: ToolCallId(callId), name, arguments: JSON.stringify(args) }],
    signal,
    ...(agent === undefined ? {} : { agent }),
    ...(log === undefined ? {} : { log }),
  })
  if (results.length !== 1) throw new Error('Expected one DSH tool result')
  return results[0].result
}
