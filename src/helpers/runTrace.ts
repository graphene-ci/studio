// A run's execution trace, line by line: one row per ACTIVITY INSTANCE
// (grouped by activityId, not by activity-type name), so three
// k8s.entity.declare calls are three rows — net, sub, vm — not one.
// This is the near-per-line account of what the pipeline actually did.

import type { StepStatus } from '@/components/pipelines/PlanGraph'
import type { Event } from '@/proto/management/v1/observe_pb'

const decoder = new TextDecoder()

export interface TraceRow {
  activityId: string
  /** The activity type (server.agent.declare, k8s.entity.declare, …). */
  type: string
  /** A human target pulled from the scheduled input when present
   * (a resource name / agent id) — what the call acts on. */
  target: string
  agent: string
  status: StepStatus
  startMs: number
  endMs: number
  attempt: number
  error: string
}

function classify(kind: string, error: string): StepStatus | null {
  if (error !== '' || kind.includes('failed') || kind.includes('timed-out')) return 'failed'
  if (kind.includes('completed')) return 'completed'
  if (kind.includes('scheduled') || kind.includes('started')) return 'running'
  return null
}

/** Best-effort target from an activity's scheduled input: the first of
 * a few common id-ish fields. Bytes that are not JSON yield nothing. */
function targetFromInput(bytes: Uint8Array): string {
  if (bytes.length === 0) return ''
  try {
    const v: unknown = JSON.parse(decoder.decode(bytes))
    if (v === null || typeof v !== 'object') return ''
    const o = v as Record<string, unknown>
    for (const key of ['name', 'id', 'agentId', 'ref', 'resource', 'kind', 'artifactId']) {
      const hit = o[key]
      if (typeof hit === 'string' && hit !== '') return hit
    }
    return ''
  } catch {
    return ''
  }
}

/** Fold a run's events into per-activity-instance trace rows, ordered
 * by when each was scheduled. Internal workflow-task noise (no
 * activityId) is dropped — this is the domain account, not raw history. */
export function traceRows(events: readonly Event[]): TraceRow[] {
  const byId = new Map<string, TraceRow>()
  for (const e of events) {
    if (e.activityId === '') continue
    const ms = Number(e.timeUnixNano / 1_000_000n)
    let row = byId.get(e.activityId)
    if (row === undefined) {
      row = {
        activityId: e.activityId,
        type: e.subject,
        target: targetFromInput(e.input),
        agent: e.agent,
        status: 'pending',
        startMs: ms,
        endMs: ms,
        attempt: e.attempt,
        error: '',
      }
      byId.set(e.activityId, row)
    }
    if (e.subject !== '') row.type = e.subject
    if (row.target === '') row.target = targetFromInput(e.input)
    if (e.agent !== '') row.agent = e.agent
    if (e.attempt > row.attempt) row.attempt = e.attempt
    if (e.error !== '') row.error = e.error
    if (ms < row.startMs) row.startMs = ms
    if (ms > row.endMs) row.endMs = ms
    const st = classify(e.kind, e.error)
    if (st !== null) row.status = st
  }
  return [...byId.values()].sort(
    (a, b) => a.startMs - b.startMs || a.activityId.localeCompare(b.activityId),
  )
}
