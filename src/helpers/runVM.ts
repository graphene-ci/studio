import { timestampDate } from '@bufbuild/protobuf/wkt'

import type { Resource } from '@/proto/management/v1/resources_pb'

// RunVM is the flat view-model of one run row — proto types stay out
// of components.
export interface RunVM {
  id: string
  ref: string
  pipeline: string
  status: string
  // What started the run: "manual" or "<kind>:<name>"; '' on runs
  // started before the trigger label existed.
  trigger: string
  // User labels only — graphene.io/* system labels are split off.
  labels: Record<string, string>
  startedAt: Date | null
  finishedAt: Date | null
  durationMs: number | null
}

export const PIPELINE_LABEL = 'graphene.io/pipeline'
export const TRIGGER_LABEL = 'graphene.io/trigger'

export function runVMFromResource(r: Resource): RunVM {
  const labels: Record<string, string> = {}
  for (const [k, v] of Object.entries(r.labels)) {
    if (!k.startsWith('graphene.io/')) labels[k] = v
  }
  const startedAt = r.startedAt ? timestampDate(r.startedAt) : null
  const finishedAt = r.finishedAt ? timestampDate(r.finishedAt) : null
  return {
    id: r.ref.replace(/^run\//, ''),
    ref: r.ref,
    pipeline: r.labels[PIPELINE_LABEL] ?? '',
    trigger: r.labels[TRIGGER_LABEL] ?? '',
    status: r.phase,
    labels,
    startedAt,
    finishedAt,
    durationMs:
      startedAt !== null && finishedAt !== null ? finishedAt.getTime() - startedAt.getTime() : null,
  }
}

/** Formats a duration for a table cell: 4m32s / 1h05m / 12s. */
export function formatDuration(ms: number): string {
  const s = Math.round(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m${String(s % 60).padStart(2, '0')}s`
  const h = Math.floor(m / 60)
  return `${h}h${String(m % 60).padStart(2, '0')}m`
}
