import { format } from 'node:util'

/** Render each captured argument list like a Node console call. */
export function renderLogs(calls: readonly (readonly unknown[])[]): string {
  return calls.map(args => format(args[0], ...args.slice(1))).join('\n')
}
