// Pure parsing of the PIPELINE record state: the manifest (plan graph,
// params/result schemas) and the active revision. Server truth in,
// view-models out.

import type { Resource } from '@/proto/management/v1/resources_pb'

import { parseSchemaFields, type SchemaField } from './kindSchema'

export interface PlanStep {
  /** declare | activity | transfer | unknown */
  op: string
  subject: string
  agent: string
  note: string
  deps: string[]
}

export interface PipelineManifest {
  activeRevisionId: string
  image: string
  digest: string
  paramsFields: SchemaField[]
  resultFields: SchemaField[]
  activities: string[]
  steps: PlanStep[]
}

const decoder = new TextDecoder()

export function pipelineManifest(record: Resource): PipelineManifest | null {
  let state: Record<string, unknown>
  try {
    const parsed: unknown = JSON.parse(decoder.decode(record.state))
    if (parsed === null || typeof parsed !== 'object') return null
    state = parsed as Record<string, unknown>
  } catch {
    return null
  }
  const manifest = (state.manifest ?? {}) as Record<string, unknown>
  const graph = (manifest.graph ?? {}) as Record<string, unknown>
  const stepsRaw = Array.isArray(graph.steps) ? graph.steps : []
  return {
    activeRevisionId: typeof state.revisionId === 'string' ? state.revisionId : '',
    image: typeof state.image === 'string' ? state.image : '',
    digest: typeof state.digest === 'string' ? state.digest : '',
    paramsFields: parseSchemaFields(manifest.paramsSchema),
    resultFields: parseSchemaFields(manifest.resultSchema),
    activities: Array.isArray(manifest.activities)
      ? manifest.activities.filter((a): a is string => typeof a === 'string')
      : [],
    steps: stepsRaw
      .filter((s): s is Record<string, unknown> => typeof s === 'object' && s !== null)
      .map((s) => ({
        op: typeof s.op === 'string' ? s.op : 'unknown',
        subject: typeof s.subject === 'string' ? s.subject : '',
        agent: typeof s.agent === 'string' ? s.agent : '',
        note: typeof s.note === 'string' ? s.note : '',
        deps: Array.isArray(s.deps) ? s.deps.filter((d): d is string => typeof d === 'string') : [],
      }))
      .filter((s) => s.subject !== ''),
  }
}

/** Layers the plan by dependencies (topological columns). */
export function planLevels(steps: PlanStep[]): PlanStep[][] {
  const level = new Map<string, number>()
  const levelOf = (step: PlanStep, seen: Set<string>): number => {
    const cached = level.get(step.subject)
    if (cached !== undefined) return cached
    if (seen.has(step.subject)) return 0
    seen.add(step.subject)
    let max = -1
    for (const dep of step.deps) {
      const depStep = steps.find((s) => s.subject === dep)
      if (depStep !== undefined) max = Math.max(max, levelOf(depStep, seen))
    }
    const result = max + 1
    level.set(step.subject, result)
    return result
  }
  const out: PlanStep[][] = []
  for (const step of steps) {
    const l = levelOf(step, new Set())
    while (out.length <= l) out.push([])
    out[l].push(step)
  }
  return out
}
