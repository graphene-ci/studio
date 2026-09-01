import { useStore } from '@nanostores/react'
import {
  ArrowDownIcon,
  ArrowUpIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  CopyIcon,
  PauseIcon,
  PlayIcon,
  WaypointsIcon,
} from 'lucide-react'
import { type MouseEvent, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { client } from '@/client'
import { EventsFeed } from '@/components/resources/view/EventsFeed'
import { TONE_TEXT } from '@/components/status/tones'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import {
  type MetricSeries,
  parseJaeger,
  parsePromMatrix,
  type TraceInfo,
} from '@/helpers/telemetry'
import { cn } from '@/lib/utils'
import type { LogRecord } from '@/proto/management/v1/observe_pb'

type ObsTab = 'events' | 'logs' | 'metrics' | 'trace'

// The telemetry half of the record view — dimensions 2–5 behind one
// tab strip: events (the record's own history), logs (a LIVE push
// stream), metrics and traces (backend snapshots on a slow refresh).
// All of it is the central surface — not a workspace panel.
export function ObsPane({ resourceRef }: { resourceRef: string }) {
  const { t } = useTranslation()
  const [tab, setTab] = useState<ObsTab>('events')
  // A log line links to its span: opening a trace from logs both flips
  // the tab and preselects the traceId in the waterfall.
  const [traceFocus, setTraceFocus] = useState<string | null>(null)

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center gap-4 border-b border-border px-3">
        {(['events', 'logs', 'metrics', 'trace'] as const).map((id) => (
          <button
            key={id}
            type="button"
            className={cn(
              'py-1.5 text-xs',
              tab === id
                ? 'border-b-2 border-primary font-semibold text-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
            onClick={() => setTab(id)}
          >
            {t(`graphene.inspector.tab.${id}`)}
          </button>
        ))}
      </div>
      {tab === 'events' && (
        <div className="flex min-h-0 flex-1 flex-col px-3 pt-2 pb-2">
          <EventsFeed resourceRef={resourceRef} />
        </div>
      )}
      {tab === 'logs' && (
        <LogsPane
          resourceRef={resourceRef}
          onOpenTrace={(traceId) => {
            setTraceFocus(traceId)
            setTab('trace')
          }}
        />
      )}
      {tab === 'metrics' && <MetricsPane resourceRef={resourceRef} />}
      {tab === 'trace' && <TracePane resourceRef={resourceRef} focusTraceId={traceFocus} />}
    </div>
  )
}

const SEVERITIES = ['error', 'warn', 'info', 'debug'] as const

function severityBucket(raw: string): (typeof SEVERITIES)[number] | 'other' {
  const s = raw.toLowerCase()
  if (s.startsWith('err') || s.startsWith('fatal')) return 'error'
  if (s.startsWith('warn')) return 'warn'
  if (s.startsWith('info')) return 'info'
  if (s.startsWith('debug') || s.startsWith('trace')) return 'debug'
  return 'other'
}

const SEVERITY_TONE = {
  error: TONE_TEXT.failed,
  warn: TONE_TEXT.warning,
  info: TONE_TEXT.success,
  debug: TONE_TEXT.canceled,
  other: TONE_TEXT.canceled,
} as const

// Facets surfaced as chip rows: only the attribute keys a mature run
// actually stamps. A facet renders only when the loaded records carry
// its key. OR within a facet, AND across facets.
const FACET_KEYS = [
  'contour',
  'graphene.entity',
  'graphene.role',
  'outcome',
  'attempt',
  'agent',
] as const

// Attribute key → locale token (i18next reads '.' as a key separator, so
// the label lookup uses a dot-free alias).
const FACET_LABEL: Record<(typeof FACET_KEYS)[number], string> = {
  contour: 'contour',
  'graphene.entity': 'entity',
  'graphene.role': 'role',
  outcome: 'outcome',
  attempt: 'attempt',
  agent: 'agent',
}

// Attribute keys that are transport noise, not signal: hidden from the
// per-record table. trace_id / span_id surface as the trace affordance.
const NOISE_EXACT = new Set(['service.name', 'trace_id', 'span_id'])
const NOISE_PREFIX = ['telemetry.sdk.', 'scope.']

function isNoiseAttr(key: string): boolean {
  return NOISE_EXACT.has(key) || NOISE_PREFIX.some((p) => key.startsWith(p))
}

function LogsPane({
  resourceRef,
  onOpenTrace,
}: {
  resourceRef: string
  onOpenTrace: (traceId: string) => void
}) {
  const { t, i18n } = useTranslation()
  const snapshot = useStore(client.stores.logs(resourceRef))
  const [filter, setFilter] = useState('')
  const [levels, setLevels] = useState<Set<string>>(new Set())
  // Selected facet values, keyed by attribute key.
  const [facetSel, setFacetSel] = useState<Record<string, Set<string>>>({})
  const [descending, setDescending] = useState(false)
  const [following, setFollowing] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)

  // Facet value sets, scanned from the attributes actually present.
  const facets = useMemo(() => {
    const found = new Map<string, Set<string>>(FACET_KEYS.map((k) => [k, new Set<string>()]))
    for (const record of snapshot.items) {
      for (const key of FACET_KEYS) {
        const value = record.attributes[key]
        if (value !== undefined && value !== '') found.get(key)?.add(value)
      }
    }
    return FACET_KEYS.map((key) => ({ key, values: [...(found.get(key) ?? [])].sort() })).filter(
      (facet) => facet.values.length > 0,
    )
  }, [snapshot.items])

  const rows = useMemo(() => {
    const needle = filter.trim().toLowerCase()
    let out = snapshot.items
    if (levels.size > 0) out = out.filter((r) => levels.has(severityBucket(r.severity)))
    for (const [key, sel] of Object.entries(facetSel)) {
      if (sel.size === 0) continue
      out = out.filter((r) => sel.has(r.attributes[key] ?? ''))
    }
    if (needle !== '') {
      out = out.filter(
        (r) =>
          r.body.toLowerCase().includes(needle) ||
          Object.entries(r.attributes).some(
            ([k, v]) => k.toLowerCase().includes(needle) || v.toLowerCase().includes(needle),
          ),
      )
    }
    return descending ? [...out].reverse() : out
  }, [snapshot.items, filter, levels, facetSel, descending])

  // Follow: keep the tail in view while new lines land. Pausing does not
  // unsubscribe (the store keeps streaming, capped at LOGS_CAP) — it just
  // releases the scroll so history can be read while logs still arrive.
  useEffect(() => {
    if (!following || descending) return
    const el = scrollRef.current
    if (el !== null) el.scrollTop = el.scrollHeight
  }, [following, descending])

  const toggleFacet = (key: string, value: string) =>
    setFacetSel((prev) => {
      const next = new Set(prev[key] ?? [])
      if (next.has(value)) next.delete(value)
      else next.add(value)
      return { ...prev, [key]: next }
    })

  const time = new Intl.DateTimeFormat(i18n.language, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 flex-wrap items-center gap-2 px-3 py-1.5">
        <Input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder={t('graphene.observe.logFilter')}
          className="h-6 w-56 font-mono text-2xs"
        />
        {SEVERITIES.map((level) => (
          <button
            key={level}
            type="button"
            aria-pressed={levels.has(level)}
            className={cn(
              'rounded-sm px-1.5 py-0.5 font-mono text-3xs',
              levels.has(level)
                ? 'bg-accent text-accent-foreground'
                : 'bg-muted text-muted-foreground',
              SEVERITY_TONE[level],
            )}
            onClick={() =>
              setLevels((prev) => {
                const next = new Set(prev)
                if (next.has(level)) next.delete(level)
                else next.add(level)
                return next
              })
            }
          >
            {level}
          </button>
        ))}
        <button
          type="button"
          aria-pressed={descending}
          className={cn(
            'flex items-center gap-1 rounded-sm px-1.5 py-0.5 font-mono text-3xs',
            descending ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground',
          )}
          onClick={() => setDescending((v) => !v)}
          title={t('graphene.observe.newestFirst')}
        >
          {descending ? <ArrowDownIcon className="size-3" /> : <ArrowUpIcon className="size-3" />}
          {descending ? t('graphene.observe.newestFirst') : t('graphene.observe.oldestFirst')}
        </button>
        <button
          type="button"
          aria-pressed={following}
          className={cn(
            'flex items-center gap-1 rounded-sm px-1.5 py-0.5 font-mono text-3xs',
            following ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground',
          )}
          onClick={() => setFollowing((v) => !v)}
          title={following ? t('graphene.observe.pause') : t('graphene.observe.resume')}
        >
          {following ? <PauseIcon className="size-3" /> : <PlayIcon className="size-3" />}
          {following ? t('graphene.observe.live') : t('graphene.observe.paused')}
        </button>
        <span className="grow" />
        {snapshot.dropped > 0 && (
          <span className={cn('font-mono text-3xs', TONE_TEXT.warning)}>
            {t('graphene.observe.dropped', { count: snapshot.dropped })}
          </span>
        )}
        <span className="font-mono text-3xs text-muted-foreground">
          {t('graphene.observe.shown', { shown: rows.length, total: snapshot.items.length })}
        </span>
      </div>
      {facets.length > 0 && (
        <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-t border-border px-3 py-1.5">
          {facets.map((facet) => (
            <div key={facet.key} className="flex flex-wrap items-center gap-1">
              <span className="font-mono text-3xs text-muted-foreground">
                {t(`graphene.observe.facet.${FACET_LABEL[facet.key]}`, { defaultValue: facet.key })}
              </span>
              {facet.values.map((value) => {
                const on = facetSel[facet.key]?.has(value) ?? false
                return (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={on}
                    className={cn(
                      'rounded-sm px-1.5 py-0.5 font-mono text-3xs',
                      on
                        ? 'bg-accent text-accent-foreground'
                        : 'bg-muted text-muted-foreground hover:text-foreground',
                    )}
                    onClick={() => toggleFacet(facet.key, value)}
                  >
                    {value}
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      )}
      {snapshot.error !== null && (
        <p className="px-3 text-2xs text-destructive">{snapshot.error}</p>
      )}
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-3 pb-2">
        {snapshot.items.length === 0 && snapshot.error === null && (
          <div className="flex items-center gap-2 py-3 text-2xs text-muted-foreground">
            <Spinner className="size-3" />
            {t('graphene.observe.logsWaiting')}
          </div>
        )}
        <ul className="flex flex-col font-mono text-2xs leading-5">
          {rows.map((record, index) => {
            const rowKey = `${record.timeUnixNano}-${index}`
            return (
              <LogLine
                key={rowKey}
                record={record}
                time={time}
                isOpen={expanded === rowKey}
                onToggle={() => setExpanded(expanded === rowKey ? null : rowKey)}
                onOpenTrace={onOpenTrace}
              />
            )
          })}
        </ul>
      </div>
    </div>
  )
}

function LogLine({
  record,
  time,
  isOpen,
  onToggle,
  onOpenTrace,
}: {
  record: LogRecord
  time: Intl.DateTimeFormat
  isOpen: boolean
  onToggle: () => void
  onOpenTrace: (traceId: string) => void
}) {
  const bucket = severityBucket(record.severity)
  const lines = record.body.split('\n')
  const multiline = lines.length > 1
  const traceId = record.attributes.trace_id
  const attrs = Object.entries(record.attributes).filter(([key]) => !isNoiseAttr(key))
  return (
    <li className="flex flex-col">
      <div
        className={cn(
          'flex min-w-0 items-baseline gap-2 rounded-sm px-1 hover:bg-surface-hover',
          isOpen && 'bg-muted',
        )}
      >
        <button
          type="button"
          className="flex min-w-0 grow items-baseline gap-2 text-left"
          onClick={onToggle}
        >
          {multiline ? (
            isOpen ? (
              <ChevronDownIcon className="size-3 shrink-0 translate-y-0.5 text-muted-foreground" />
            ) : (
              <ChevronRightIcon className="size-3 shrink-0 translate-y-0.5 text-muted-foreground" />
            )
          ) : (
            <span className="w-3 shrink-0" />
          )}
          <span className="shrink-0 text-muted-foreground">
            {time.format(Number(record.timeUnixNano / 1_000_000n))}
          </span>
          <span className={cn('w-9 shrink-0 uppercase', SEVERITY_TONE[bucket])}>
            {record.severity.slice(0, 3) || '·'}
          </span>
          <span className="min-w-0 truncate">{lines[0]}</span>
          {multiline && <span className="shrink-0 text-muted-foreground">+{lines.length - 1}</span>}
        </button>
        {traceId !== undefined && traceId !== '' && (
          <TraceChip traceId={traceId} onOpen={() => onOpenTrace(traceId)} />
        )}
      </div>
      {isOpen && (
        <div className="mb-1 ml-6 flex flex-col rounded-sm bg-muted p-1.5 text-3xs">
          <pre className="whitespace-pre-wrap">{record.body}</pre>
          {attrs.length > 0 && (
            <table className="mt-1">
              <tbody>
                {attrs.map(([key, value]) => (
                  <tr key={key}>
                    <td className="pr-3 align-top text-muted-foreground">{key}</td>
                    <td className="break-all">{value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </li>
  )
}

/** Trace affordance on a log row: opens the Trace sub-tab and offers a
 * one-click copy of the full trace id (the row shows the short prefix). */
function TraceChip({ traceId, onOpen }: { traceId: string; onOpen: () => void }) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(traceId)
      setCopied(true)
      if (timerRef.current !== null) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard refused (permissions) — nothing to report loudly.
    }
  }

  return (
    <span className="flex shrink-0 items-center gap-0.5 self-center rounded-sm bg-muted px-1 py-0.5 font-mono text-3xs">
      <button
        type="button"
        className="flex items-center gap-0.5 text-muted-foreground hover:text-foreground"
        onClick={onOpen}
        title={t('graphene.observe.trace.open', { id: traceId })}
      >
        <WaypointsIcon className="size-3" />
        {traceId.slice(0, 8)}
      </button>
      <button
        type="button"
        className="text-muted-foreground hover:text-foreground"
        onClick={() => void copy()}
        title={t('graphene.observe.trace.copy')}
      >
        {copied ? (
          <CheckIcon className={cn('size-3', TONE_TEXT.success)} />
        ) : (
          <CopyIcon className="size-3" />
        )}
      </button>
    </span>
  )
}

const CHART_VARS = ['--chart-1', '--chart-2', '--chart-3', '--chart-4', '--chart-5']

type MetricKind = 'counter' | 'gauge' | 'histogram'

// A series is identified only by its meaningful labels: transport noise
// (service.name, telemetry.sdk.*, scope.*) is dropped, and `le` is the
// histogram bucket boundary, not identity. Empty string ⇒ a lone series.
function seriesIdentity(labels: Record<string, string>): string {
  return Object.entries(labels)
    .filter(([k]) => !isNoiseAttr(k) && k !== 'le')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join(' · ')
}

function isCounterShaped(points: [number, number][]): boolean {
  if (points.length < 2) return false
  for (let i = 1; i < points.length; i++) {
    if (points[i][1] < points[i - 1][1] - 1e-9) return false
  }
  return points[points.length - 1][1] > points[0][1] + 1e-9
}

// PromQL carries no type — infer it from the series name, falling back to
// the sample shape. Histogram wins first (buckets / latency names), then
// counter (cumulative), else gauge.
function classifyMetric(name: string, series: MetricSeries[]): MetricKind {
  const n = name.toLowerCase()
  const hasLe = series.some((s) => s.labels.le !== undefined)
  if (hasLe || n.includes('_bucket') || /(\.|_)seconds$|duration|latency/.test(n))
    return 'histogram'
  if (/(_total|\.count|_count|\.start)$/.test(n) || series.every((s) => isCounterShaped(s.points)))
    return 'counter'
  return 'gauge'
}

// Per-interval rate (delta / dt in seconds) from a cumulative series; the
// leading point is dropped since a rate needs two samples.
function rateSeries(points: [number, number][]): [number, number][] {
  const out: [number, number][] = []
  for (let i = 1; i < points.length; i++) {
    const dt = (points[i][0] - points[i - 1][0]) / 1000
    const dv = points[i][1] - points[i - 1][1]
    out.push([points[i][0], dt > 0 ? Math.max(dv, 0) / dt : 0])
  }
  return out
}

const QUANTILES = [0.5, 0.95, 0.99] as const

// p50/p95/p99 from cumulative `le` buckets (last sample of each), linearly
// interpolated within the bracketing bucket. Null when no usable buckets.
function bucketQuantiles(series: MetricSeries[]): number[] | null {
  const buckets = series
    .filter((s) => s.labels.le !== undefined)
    .map((s) => ({
      le: s.labels.le === '+Inf' ? Number.POSITIVE_INFINITY : Number(s.labels.le),
      count: s.points[s.points.length - 1]?.[1] ?? 0,
    }))
    .filter((b) => !Number.isNaN(b.le))
    .sort((a, b) => a.le - b.le)
  if (buckets.length === 0) return null
  const total = buckets[buckets.length - 1].count
  if (total <= 0) return null
  return QUANTILES.map((q) => {
    const rank = q * total
    let prevLe = 0
    let prevCount = 0
    for (const b of buckets) {
      if (b.count >= rank) {
        if (!Number.isFinite(b.le)) return prevLe
        const frac = (rank - prevCount) / Math.max(b.count - prevCount, 1e-9)
        return prevLe + frac * (b.le - prevLe)
      }
      if (Number.isFinite(b.le)) prevLe = b.le
      prevCount = b.count
    }
    return prevLe
  })
}

// Fallback percentiles straight from the observed values (no buckets).
function valueQuantiles(series: MetricSeries[]): number[] {
  const vals = series.flatMap((s) => s.points.map((p) => p[1])).sort((a, b) => a - b)
  if (vals.length === 0) return QUANTILES.map(() => 0)
  return QUANTILES.map((q) => vals[Math.min(vals.length - 1, Math.round(q * (vals.length - 1)))])
}

function fmtNum(v: number): string {
  if (!Number.isFinite(v)) return '∞'
  if (v === 0) return '0'
  const a = Math.abs(v)
  if (a >= 100000 || a < 0.001) return v.toExponential(2)
  return String(Number(v.toPrecision(3)))
}

interface Plot {
  key: string
  label: string
  color: string
  points: [number, number][]
  mode: 'line' | 'bar'
}

function MetricsPane({ resourceRef }: { resourceRef: string }) {
  const { t } = useTranslation()
  const snapshot = useStore(client.stores.metrics(resourceRef))
  const [filter, setFilter] = useState('')

  const series = useMemo(() => parsePromMatrix(snapshot.snapshot), [snapshot.snapshot])
  const groups = useMemo(() => {
    const needle = filter.trim().toLowerCase()
    const byName = new Map<string, typeof series>()
    for (const s of series) {
      if (needle !== '' && !s.name.toLowerCase().includes(needle)) continue
      const bucket = byName.get(s.name)
      if (bucket === undefined) byName.set(s.name, [s])
      else bucket.push(s)
    }
    return [...byName.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [series, filter])

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center gap-2 px-3 py-1.5">
        <Input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder={t('graphene.observe.metricFilter')}
          className="h-6 w-56 font-mono text-2xs"
        />
        <span className="grow" />
        <span className="font-mono text-3xs text-muted-foreground">
          {t('graphene.observe.window1h')}
        </span>
      </div>
      {snapshot.error !== null && (
        <p className="px-3 text-2xs text-destructive">{snapshot.error}</p>
      )}
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-2">
        {snapshot.snapshot === '' && snapshot.error === null && (
          <div className="flex items-center gap-2 py-3 text-2xs text-muted-foreground">
            <Spinner className="size-3" />
            {t('graphene.observe.metricsWaiting')}
          </div>
        )}
        {snapshot.snapshot !== '' && groups.length === 0 && (
          <p className="py-3 text-2xs text-muted-foreground">
            {t('graphene.observe.metricsEmpty')}
          </p>
        )}
        <div className="grid grid-cols-1 gap-3 @2xl:grid-cols-2">
          {groups.map(([name, all]) => (
            <MetricChart key={name} name={name} series={all} />
          ))}
        </div>
      </div>
    </div>
  )
}

// Type badge + optional latency summary, then the plotted body. Gauges
// keep the raw line; counters plot the per-interval rate; histograms show
// p50/p95/p99 over a rate-of-observations chart.
function MetricChart({ name, series }: { name: string; series: MetricSeries[] }) {
  const { t, i18n } = useTranslation()
  const time = useMemo(
    () => new Intl.DateTimeFormat(i18n.language, { hour: '2-digit', minute: '2-digit' }),
    [i18n.language],
  )
  const kind = useMemo(() => classifyMetric(name, series), [name, series])

  const { plots, quantiles, unit } = useMemo(() => {
    const color = (i: number) => `var(${CHART_VARS[i % CHART_VARS.length]})`
    if (kind === 'histogram') {
      const q = bucketQuantiles(series) ?? valueQuantiles(series)
      // Observation rate: prefer the +Inf bucket (total count) if present,
      // else the first series' values as a proxy.
      const total =
        series.find((s) => s.labels.le === '+Inf') ??
        series.find((s) => s.labels.le === undefined) ??
        series[0]
      const rate = total !== undefined ? rateSeries(total.points) : []
      const p: Plot[] =
        rate.length > 0
          ? [
              {
                key: 'rate',
                label: t('graphene.observe.metricRate'),
                color: color(0),
                points: rate,
                mode: 'bar',
              },
            ]
          : []
      return { plots: p, quantiles: q, unit: /(\.|_)seconds$/.test(name) ? 's' : '' }
    }
    if (kind === 'counter') {
      const multi = series.length > 1
      const p: Plot[] = series.map((s, i) => ({
        key: `${seriesIdentity(s.labels)}#${i}`,
        label: seriesIdentity(s.labels),
        color: color(i),
        points: rateSeries(s.points),
        mode: multi ? 'line' : 'bar',
      }))
      return { plots: p, quantiles: null, unit: '' }
    }
    const p: Plot[] = series.map((s, i) => ({
      key: `${seriesIdentity(s.labels)}#${i}`,
      label: seriesIdentity(s.labels),
      color: color(i),
      points: s.points,
      mode: 'line' as const,
    }))
    return { plots: p, quantiles: null, unit: '' }
  }, [kind, series, name, t])

  const typeLabel = t(
    kind === 'histogram'
      ? 'graphene.observe.metricHistogram'
      : kind === 'counter'
        ? 'graphene.observe.metricCounter'
        : 'graphene.observe.metricGauge',
  )

  return (
    <figure className="rounded-md bg-muted p-2">
      <figcaption className="mb-1 flex items-baseline gap-2">
        <span className="min-w-0 truncate font-mono text-2xs">{name}</span>
        <span className="shrink-0 rounded-sm bg-background px-1 py-0.5 font-mono text-3xs text-muted-foreground">
          {typeLabel}
        </span>
      </figcaption>
      {quantiles !== null && (
        <div className="mb-1.5 flex flex-wrap gap-x-4 gap-y-0.5 font-mono text-3xs">
          {(['p50', 'p95', 'p99'] as const).map((label, i) => (
            <span key={label} className="flex items-baseline gap-1">
              <span className="text-muted-foreground">{label}</span>
              <span className="text-foreground">
                {fmtNum(quantiles[i])}
                {unit}
              </span>
            </span>
          ))}
        </div>
      )}
      <ChartBody plots={plots} time={time} unit={unit} />
    </figure>
  )
}

const CHART_H = 40
const CHART_TOP = 3
const CHART_BOT = 4

function ChartBody({
  plots,
  time,
  unit,
}: {
  plots: Plot[]
  time: Intl.DateTimeFormat
  unit: string
}) {
  const { t } = useTranslation()
  const [cursor, setCursor] = useState<number | null>(null)
  const boxRef = useRef<HTMLDivElement | null>(null)

  const dims = useMemo(() => {
    const all = plots.flatMap((p) => p.points)
    if (all.length === 0) return null
    const minT = Math.min(...all.map((p) => p[0]))
    const maxT = Math.max(...all.map((p) => p[0]))
    const minV = Math.min(0, ...all.map((p) => p[1]))
    const maxV = Math.max(...all.map((p) => p[1]))
    return {
      minT,
      maxT,
      minV,
      maxV,
      spanT: Math.max(maxT - minT, 1),
      spanV: Math.max(maxV - minV, 1e-9),
    }
  }, [plots])

  if (dims === null) {
    return (
      <p className="py-2 text-3xs text-muted-foreground">{t('graphene.observe.metricsEmpty')}</p>
    )
  }

  const x = (tp: number) => ((tp - dims.minT) / dims.spanT) * 100
  const y = (v: number) =>
    CHART_TOP + (1 - (v - dims.minV) / dims.spanV) * (CHART_H - CHART_TOP - CHART_BOT)
  const barW = Math.max(0.5, (100 / Math.max(...plots.map((p) => p.points.length), 1)) * 0.7)

  const cursorT = cursor === null ? null : dims.minT + cursor * dims.spanT
  const nearest = (points: [number, number][]) => {
    if (cursorT === null || points.length === 0) return null
    let best = points[0]
    for (const p of points) {
      if (Math.abs(p[0] - cursorT) < Math.abs(best[0] - cursorT)) best = p
    }
    return best
  }

  const onMove = (e: MouseEvent<HTMLDivElement>) => {
    const rect = boxRef.current?.getBoundingClientRect()
    if (rect === undefined || rect.width === 0) return
    setCursor(Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)))
  }

  return (
    <div>
      {/** biome-ignore lint/a11y/noStaticElementInteractions: pointer hover readout over a decorative chart, keyboard path is the value labels below. */}
      <div
        ref={boxRef}
        className="relative"
        onMouseMove={onMove}
        onMouseLeave={() => setCursor(null)}
      >
        <svg
          viewBox={`0 0 100 ${CHART_H}`}
          preserveAspectRatio="none"
          className="h-20 w-full"
          role="img"
          aria-label={plots.map((p) => p.label).join(', ')}
        >
          <title>{plots.map((p) => p.label).join(', ')}</title>
          {plots.map((p) =>
            p.mode === 'bar' ? (
              <g key={p.key}>
                {p.points.map((pt, i) => (
                  <rect
                    // biome-ignore lint/suspicious/noArrayIndexKey: bars index the ordered time grid.
                    key={i}
                    x={(x(pt[0]) - barW / 2).toFixed(2)}
                    y={y(pt[1]).toFixed(2)}
                    width={barW.toFixed(2)}
                    height={Math.max(0, y(dims.minV) - y(pt[1])).toFixed(2)}
                    fill={p.color}
                    opacity={0.85}
                  />
                ))}
              </g>
            ) : (
              <path
                key={p.key}
                d={p.points
                  .map(
                    (pt, i) =>
                      `${i === 0 ? 'M' : 'L'}${x(pt[0]).toFixed(2)},${y(pt[1]).toFixed(2)}`,
                  )
                  .join(' ')}
                fill="none"
                stroke={p.color}
                strokeWidth="1"
                vectorEffect="non-scaling-stroke"
              />
            ),
          )}
          {cursor !== null && (
            <line
              x1={(cursor * 100).toFixed(2)}
              x2={(cursor * 100).toFixed(2)}
              y1={CHART_TOP}
              y2={CHART_H - CHART_BOT}
              stroke="currentColor"
              strokeWidth="0.5"
              vectorEffect="non-scaling-stroke"
              className="text-muted-foreground"
            />
          )}
        </svg>
        <span className="pointer-events-none absolute left-0 top-0 font-mono text-3xs text-muted-foreground">
          {fmtNum(dims.maxV)}
          {unit}
        </span>
      </div>
      <div className="mt-0.5 flex justify-between font-mono text-3xs text-muted-foreground">
        <span>{time.format(dims.minT)}</span>
        {cursorT !== null && <span className="text-foreground">{time.format(cursorT)}</span>}
        <span>{time.format(dims.maxT)}</span>
      </div>
      {(plots.length > 1 || cursor !== null) && (
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 font-mono text-3xs text-muted-foreground">
          {plots.map((p) => {
            const near = nearest(p.points)
            return (
              <span key={p.key} className="flex items-center gap-1">
                <span
                  aria-hidden
                  className="inline-block h-0.5 w-3 shrink-0"
                  style={{ backgroundColor: p.color }}
                />
                {p.label !== '' && <span>{p.label}</span>}
                {near !== null && (
                  <span className="text-foreground">
                    {fmtNum(near[1])}
                    {unit}
                  </span>
                )}
              </span>
            )
          })}
        </div>
      )}
    </div>
  )
}

function TracePane({
  resourceRef,
  focusTraceId,
}: {
  resourceRef: string
  focusTraceId?: string | null
}) {
  const { t, i18n } = useTranslation()
  const snapshot = useStore(client.stores.trace(resourceRef))
  const [selected, setSelected] = useState<string | null>(null)
  const [byDuration, setByDuration] = useState(false)

  // A trace opened from a log line preselects its own traceId; a later
  // focus (another log click) moves the selection again.
  useEffect(() => {
    if (focusTraceId) setSelected(focusTraceId)
  }, [focusTraceId])

  const traces = useMemo(() => {
    const parsed = parseJaeger(snapshot.snapshot)
    return byDuration ? [...parsed].sort((a, b) => b.duration - a.duration) : parsed
  }, [snapshot.snapshot, byDuration])
  const active = traces.find((tr) => tr.traceId === selected) ?? traces[0] ?? null

  const time = new Intl.DateTimeFormat(i18n.language, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })

  return (
    <div className="flex min-h-0 flex-1">
      <div className="flex w-72 shrink-0 flex-col border-r border-border">
        <div className="flex shrink-0 items-center gap-2 px-2 py-1.5">
          <button
            type="button"
            className="rounded-sm bg-muted px-1.5 py-0.5 font-mono text-3xs text-muted-foreground hover:text-foreground"
            onClick={() => setByDuration((v) => !v)}
          >
            {byDuration ? t('graphene.observe.sortDuration') : t('graphene.observe.sortRecent')}
          </button>
        </div>
        {snapshot.error !== null && (
          <p className="px-2 text-2xs text-destructive">{snapshot.error}</p>
        )}
        {snapshot.snapshot === '' && snapshot.error === null && (
          <div className="flex items-center gap-2 px-2 py-3 text-2xs text-muted-foreground">
            <Spinner className="size-3" />
            {t('graphene.observe.traceWaiting')}
          </div>
        )}
        {snapshot.snapshot !== '' && traces.length === 0 && (
          <p className="px-2 py-3 text-2xs text-muted-foreground">
            {t('graphene.observe.traceEmpty')}
          </p>
        )}
        <ul className="min-h-0 flex-1 overflow-y-auto px-1 pb-2">
          {traces.map((trace) => (
            <li key={trace.traceId}>
              <button
                type="button"
                className={cn(
                  'flex w-full min-w-0 flex-col rounded-sm px-1.5 py-1 text-left font-mono text-2xs hover:bg-surface-hover',
                  active?.traceId === trace.traceId && 'bg-accent text-accent-foreground',
                )}
                onClick={() => setSelected(trace.traceId)}
              >
                <span className="flex min-w-0 items-baseline gap-1.5">
                  <span className={cn('min-w-0 truncate', trace.hasError && TONE_TEXT.failed)}>
                    {trace.operation || trace.traceId.slice(0, 12)}
                  </span>
                  <span className="shrink-0 text-muted-foreground">
                    {trace.duration.toFixed(0)}ms
                  </span>
                </span>
                <span className="text-3xs text-muted-foreground">
                  {time.format(trace.start)} · {trace.spanCount}{' '}
                  {t('graphene.observe.spans', { count: trace.spanCount })}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
        {active !== null && <TraceWaterfall trace={active} />}
      </div>
    </div>
  )
}

function TraceWaterfall({ trace }: { trace: TraceInfo }) {
  const depth = new Map<string, number>()
  for (const span of trace.spans) {
    depth.set(span.spanId, span.parentSpanId === null ? 0 : (depth.get(span.parentSpanId) ?? 0) + 1)
  }
  const span0 = trace.start
  const total = Math.max(trace.duration, 1e-9)

  return (
    <ul className="flex flex-col font-mono text-2xs leading-6">
      {trace.spans.map((span) => (
        <li key={span.spanId} className="flex min-w-0 items-center gap-2">
          <span
            className="w-56 shrink-0 truncate"
            style={{ paddingLeft: `calc(${depth.get(span.spanId) ?? 0} * 0.75rem)` }}
            title={`${span.service} · ${span.operation}`}
          >
            {span.operation}
          </span>
          <span className="relative h-2.5 min-w-0 grow rounded-xs bg-muted">
            <span
              className={cn(
                'absolute inset-y-0 rounded-xs',
                span.hasError ? 'bg-destructive' : 'bg-primary',
              )}
              style={{
                left: `${(((span.start - span0) / total) * 100).toFixed(2)}%`,
                width: `${Math.max((span.duration / total) * 100, 0.5).toFixed(2)}%`,
              }}
            />
          </span>
          <span className="w-16 shrink-0 text-right text-muted-foreground">
            {span.duration.toFixed(1)}ms
          </span>
        </li>
      ))}
    </ul>
  )
}
