// Pure parsing of the telemetry backends' snapshot JSON: PromQL range
// matrix (metrics) and Jaeger search (traces). Raw in, view-models
// out — rendering and localization stay in components.

export interface MetricSeries {
  /** Metric name (__name__) or the label set when unnamed. */
  name: string
  /** Label pairs minus __name__, for the legend. */
  labels: Record<string, string>
  /** [unix ms, value] points, time-ascending. */
  points: [number, number][]
}

/** Parses a Prometheus range-query response (matrix). */
export function parsePromMatrix(json: string): MetricSeries[] {
  try {
    const parsed: unknown = JSON.parse(json)
    if (parsed === null || typeof parsed !== 'object') return []
    const data = (parsed as { data?: { result?: unknown } }).data
    const result = data?.result
    if (!Array.isArray(result)) return []
    return result
      .filter((r): r is Record<string, unknown> => typeof r === 'object' && r !== null)
      .map((r) => {
        const metric = (r.metric ?? {}) as Record<string, string>
        const { __name__, ...labels } = metric
        const values = Array.isArray(r.values) ? r.values : []
        const points: [number, number][] = values
          .filter((v): v is [number | string, string] => Array.isArray(v) && v.length === 2)
          .map((v) => [Number(v[0]) * 1000, Number.parseFloat(String(v[1]))] as [number, number])
          .filter((p) => Number.isFinite(p[1]))
        return {
          name: __name__ ?? Object.entries(labels).map(([k, v]) => `${k}=${v}`).join(','),
          labels,
          points,
        }
      })
      .filter((s) => s.points.length > 0)
  } catch {
    return []
  }
}

export interface TraceSpan {
  spanId: string
  parentSpanId: string | null
  operation: string
  service: string
  /** unix ms. */
  start: number
  /** ms. */
  duration: number
  hasError: boolean
  tags: Record<string, string>
}

export interface TraceInfo {
  traceId: string
  /** Root operation (earliest span). */
  operation: string
  start: number
  duration: number
  spanCount: number
  hasError: boolean
  spans: TraceSpan[]
}

/** Parses Jaeger search JSON ({data: [trace…]}). */
export function parseJaeger(json: string): TraceInfo[] {
  try {
    const parsed: unknown = JSON.parse(json)
    if (parsed === null || typeof parsed !== 'object') return []
    const data = (parsed as { data?: unknown }).data
    if (!Array.isArray(data)) return []
    return data
      .filter((t): t is Record<string, unknown> => typeof t === 'object' && t !== null)
      .map((t) => {
        const processes = (t.processes ?? {}) as Record<string, { serviceName?: string }>
        const spansRaw = Array.isArray(t.spans) ? t.spans : []
        const spans: TraceSpan[] = spansRaw
          .filter((s): s is Record<string, unknown> => typeof s === 'object' && s !== null)
          .map((s) => {
            const tagsRaw = Array.isArray(s.tags) ? s.tags : []
            const tags: Record<string, string> = {}
            for (const tag of tagsRaw) {
              if (typeof tag === 'object' && tag !== null && 'key' in tag) {
                tags[String((tag as { key: unknown }).key)] = String(
                  (tag as { value?: unknown }).value ?? '',
                )
              }
            }
            const refs = Array.isArray(s.references) ? s.references : []
            const parent = refs.find(
              (r): r is { refType?: string; spanID?: string } =>
                typeof r === 'object' && r !== null && (r as { refType?: string }).refType === 'CHILD_OF',
            )
            return {
              spanId: String(s.spanID ?? ''),
              parentSpanId: parent?.spanID ?? null,
              operation: String(s.operationName ?? ''),
              service: processes[String(s.processID ?? '')]?.serviceName ?? '',
              start: Number(s.startTime ?? 0) / 1000,
              duration: Number(s.duration ?? 0) / 1000,
              hasError: tags.error === 'true' || tags['otel.status_code'] === 'ERROR',
              tags,
            }
          })
          .sort((a, b) => a.start - b.start)
        const start = spans[0]?.start ?? 0
        const end = Math.max(...spans.map((s) => s.start + s.duration), start)
        return {
          traceId: String(t.traceID ?? ''),
          operation: spans[0]?.operation ?? '',
          start,
          duration: end - start,
          spanCount: spans.length,
          hasError: spans.some((s) => s.hasError),
          spans,
        }
      })
      .filter((t) => t.traceId !== '' && t.spans.length > 0)
      .sort((a, b) => b.start - a.start)
  } catch {
    return []
  }
}
