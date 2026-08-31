// Observe targets — dimensions 2–5 of a record. Events and logs are
// TRUE streams (follow: the server pushes; reconnect resumes from the
// cursor). Metrics and traces take the snapshot chunk on a slow poll:
// their live halves arrive as OTLP protobuf, which needs an OTel
// decoder — a later step; the snapshot is complete history.

import type { Event, LogRecord } from '@/proto/management/v1/observe_pb'

import type { InternalStores } from '../store/internal'
import { pollTarget, streamTarget, type TargetHandle } from './hub'
import type { TargetDeps } from './targets'

const EVENTS_CAP = 500
const LOGS_CAP = 2_000
/** Stream writes are BATCHED: history replay arrives as hundreds of
 * messages in one burst — one store.set per message would re-render
 * the whole view per event. */
const FLUSH_MS = 150

function messageFor(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

/** Collects stream items and flushes them into the store on a short
 * timer; flush() is also called on stream end/error. */
function batcher<T>(flushInto: (batch: T[]) => void) {
  let buffer: T[] = []
  let timer: ReturnType<typeof setTimeout> | null = null
  const flush = () => {
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
    if (buffer.length === 0) return
    const batch = buffer
    buffer = []
    flushInto(batch)
  }
  return {
    push(item: T) {
      buffer.push(item)
      if (timer === null) timer = setTimeout(flush, FLUSH_MS)
    },
    flush,
  }
}

export function eventsTarget(deps: TargetDeps, key: string, ref: string): TargetHandle {
  const store = deps.internal.data.events(key)
  return streamTarget(async (signal) => {
    const cursor = store.get().lastEventId
    const events = batcher<Event>((batch) => {
      const current = store.get()
      store.set({
        items: [...current.items, ...batch].slice(-EVENTS_CAP),
        lastEventId: Number(batch[batch.length - 1].eventId),
        error: null,
      })
      deps.internal.meta.reportTarget(key, null)
    })
    try {
      const stream = deps.api().observe.events(
        { ref, follow: true, afterEventId: BigInt(cursor) },
        { signal },
      )
      for await (const event of stream) {
        events.push(event)
      }
      events.flush()
    } catch (err) {
      events.flush()
      if (signal.aborted) return
      const current = store.get()
      store.set({ ...current, error: messageFor(err) })
      deps.internal.meta.reportTarget(key, messageFor(err))
      throw err
    }
  })
}

export function logsTarget(deps: TargetDeps, key: string, ref: string): TargetHandle {
  const store = deps.internal.data.logs(key)
  return streamTarget(async (signal) => {
    const since = store.get().lastUnixNano
    let droppedDelta = 0
    const logs = batcher<LogRecord>((batch) => {
      const current = store.get()
      store.set({
        items: [...current.items, ...batch].slice(-LOGS_CAP),
        lastUnixNano: Number(batch[batch.length - 1].timeUnixNano),
        dropped: current.dropped + droppedDelta,
        error: null,
      })
      droppedDelta = 0
      deps.internal.meta.reportTarget(key, null)
    })
    try {
      const stream = deps.api().observe.logs(
        { ref, follow: true, sinceUnixNano: BigInt(since) },
        { signal },
      )
      for await (const chunk of stream) {
        if (chunk.chunk.case === 'record') logs.push(chunk.chunk.value)
        else if (chunk.chunk.case === 'dropped') droppedDelta += Number(chunk.chunk.value)
      }
      logs.flush()
    } catch (err) {
      logs.flush()
      if (signal.aborted) return
      const current = store.get()
      store.set({ ...current, error: messageFor(err) })
      deps.internal.meta.reportTarget(key, messageFor(err))
      throw err
    }
  })
}

/** Metrics snapshot (PromQL range JSON), refreshed every 10s. */
export function metricsTarget(deps: TargetDeps, key: string, ref: string): TargetHandle {
  const store = deps.internal.data.metrics(key)
  return pollTarget(async () => {
    const end = Date.now()
    const start = end - 60 * 60 * 1000
    try {
      const stream = deps.api().observe.metrics({
        ref,
        follow: false,
        startUnixNano: BigInt(start) * 1_000_000n,
        endUnixNano: BigInt(end) * 1_000_000n,
      })
      for await (const chunk of stream) {
        if (chunk.chunk.case === 'snapshot') {
          store.set({ snapshot: new TextDecoder().decode(chunk.chunk.value), error: null })
        }
      }
      deps.internal.meta.reportTarget(key, null)
    } catch (err) {
      store.set({ ...store.get(), error: messageFor(err) })
      deps.internal.meta.reportTarget(key, messageFor(err))
    }
  }, 10_000)
}

/** Trace snapshot (Jaeger JSON), refreshed every 10s. */
export function traceTarget(deps: TargetDeps, key: string, ref: string): TargetHandle {
  const store = deps.internal.data.traces(key)
  return pollTarget(async () => {
    try {
      const stream = deps.api().observe.trace({ ref, follow: false })
      for await (const chunk of stream) {
        if (chunk.chunk.case === 'snapshot') {
          store.set({ snapshot: new TextDecoder().decode(chunk.chunk.value), error: null })
        }
      }
      deps.internal.meta.reportTarget(key, null)
    } catch (err) {
      store.set({ ...store.get(), error: messageFor(err) })
      deps.internal.meta.reportTarget(key, messageFor(err))
    }
  }, 10_000)
}

export interface EventsSnapshot {
  items: Event[]
  lastEventId: number
  error: string | null
}

export interface LogsSnapshot {
  items: LogRecord[]
  lastUnixNano: number
  dropped: number
  error: string | null
}

export interface RawSnapshot {
  /** Backend JSON (PromQL matrix / Jaeger); '' — never loaded. */
  snapshot: string
  error: string | null
}

export const emptyEvents = (): EventsSnapshot => ({ items: [], lastEventId: 0, error: null })
export const emptyLogs = (): LogsSnapshot => ({
  items: [],
  lastUnixNano: 0,
  dropped: 0,
  error: null,
})
export const emptyRaw = (): RawSnapshot => ({ snapshot: '', error: null })

export type ObserveInternal = Pick<InternalStores['data'], 'events' | 'logs' | 'metrics' | 'traces'>
