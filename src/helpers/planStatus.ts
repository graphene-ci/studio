// Shared plan-coloring fold: turns ONE run's event stream into a
// per-step status map. The step's subject is the join key; events are
// applied in order so the last classifiable state wins (scheduled →
// running, completed/failed terminal). Both the pipeline Plan and the
// run Plan color the same PlanGraph from this.

import type { StepStatus } from '@/components/pipelines/PlanGraph'
import type { Event } from '@/proto/management/v1/observe_pb'

export function statusFromEvent(event: Event): StepStatus | null {
  if (event.error !== '' || event.kind.includes('failed') || event.kind.includes('timed-out'))
    return 'failed'
  if (event.kind.includes('completed')) return 'completed'
  if (event.kind.includes('scheduled') || event.kind.includes('started')) return 'running'
  return null
}

/** subject → StepStatus, last classifiable event per subject wins. */
export function foldStepStatus(events: readonly Event[]): Map<string, StepStatus> {
  const map = new Map<string, StepStatus>()
  for (const event of events) {
    if (event.subject === '') continue
    const status = statusFromEvent(event)
    if (status !== null) map.set(event.subject, status)
  }
  return map
}
