// Pure readers over record state JSON (typed by whoever defined the
// kind — these mirror the server flows named in the comments).

import type { Resource } from '@/proto/management/v1/resources_pb'

const decoder = new TextDecoder()

function parseState(record: Resource): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(decoder.decode(record.state))
    return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

/** pipelineflow.State: the active revision id ('' — none). */
export function pipelineActiveRevision(record: Resource): string {
  const state = parseState(record)
  return typeof state.revisionId === 'string' ? state.revisionId : ''
}

export interface SourceGeneration {
  generation: number
  files: number
  at: string
}

/** sourceflow.ManagedState: current generation + recent history
 * (newest last on the wire; returned newest FIRST for display). */
export function sourceGenerations(record: Resource): {
  generation: number
  history: SourceGeneration[]
} {
  const state = parseState(record)
  const generation = typeof state.generation === 'number' ? state.generation : 0
  const history = Array.isArray(state.history)
    ? state.history
        .filter(
          (g): g is { generation: number; files: number; at: string } =>
            typeof g === 'object' && g !== null && 'generation' in g,
        )
        .map((g) => ({
          generation: Number(g.generation),
          files: Number(g.files ?? 0),
          at: typeof g.at === 'string' ? g.at : '',
        }))
        .reverse()
    : []
  return { generation, history }
}
