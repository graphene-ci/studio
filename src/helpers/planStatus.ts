// Shared plan-coloring fold: turns ONE run's event stream into a
// per-step status map. The step's subject is the join key; events are
// applied in order so the last classifiable state wins (scheduled →
// running, completed/failed terminal). Both the pipeline Plan and the
// run Plan color the same PlanGraph from this.

import type { StepStatus } from '@/components/pipelines/PlanGraph'
import type { PlanStep } from '@/helpers/pipelineManifest'
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

/** subject → {start, end} in ms, from the first and last event of
 * that subject — the step's wall-clock span for a run timeline. */
export function stepTimings(events: readonly Event[]): Map<string, { start: number; end: number }> {
  const map = new Map<string, { start: number; end: number }>()
  for (const event of events) {
    if (event.subject === '') continue
    const ms = Number(event.timeUnixNano / 1_000_000n)
    const span = map.get(event.subject)
    if (span === undefined) map.set(event.subject, { start: ms, end: ms })
    else {
      if (ms < span.start) span.start = ms
      if (ms > span.end) span.end = ms
    }
  }
  return map
}

/** The op of a subject, from its ref prefix first (real names —
 * agent/… declare, artifact/… transfer), else the event kind. */
function opFromEvent(subject: string, kind: string): string {
  if (subject.startsWith('agent/')) return 'declare'
  if (subject.startsWith('artifact/')) return 'transfer'
  if (kind.includes('declare')) return 'declare'
  if (kind.includes('transfer')) return 'transfer'
  return 'activity'
}

/** Derives plan steps from ONE run's OWN events — the graph of what
 * actually happened, with real names. Each distinct subject becomes a
 * node in first-appearance order; deps are a linear time chain (each
 * step follows the previous). Server streams events chronologically,
 * so iteration order is arrival = first-appearance order. */
export function stepsFromEvents(events: readonly Event[]): PlanStep[] {
  const order: string[] = []
  const info = new Map<string, { op: string; agent: string }>()
  for (const event of events) {
    if (event.subject === '') continue
    const seen = info.get(event.subject)
    if (seen === undefined) {
      order.push(event.subject)
      info.set(event.subject, { op: opFromEvent(event.subject, event.kind), agent: event.agent })
    } else if (seen.agent === '' && event.agent !== '') {
      seen.agent = event.agent
    }
  }
  return order.map((subject, i) => ({
    op: info.get(subject)?.op ?? 'unknown',
    subject,
    agent: info.get(subject)?.agent ?? '',
    note: '',
    deps: i === 0 ? [] : [order[i - 1]],
  }))
}
