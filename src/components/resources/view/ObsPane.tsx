import { useStore } from '@nanostores/react'
import { ArrowDownIcon, ArrowUpIcon, PauseIcon, PlayIcon } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { client } from '@/client'
import { TONE_TEXT } from '@/components/status/tones'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { parseJaeger, parsePromMatrix, type TraceInfo } from '@/helpers/telemetry'
import { cn } from '@/lib/utils'
import type { LogRecord } from '@/proto/management/v1/observe_pb'

type ObsTab = 'logs' | 'metrics' | 'trace'

// The telemetry half of the record view (dimensions 3–5): logs are a
// LIVE push stream; metrics and traces render the backend snapshots
// (PromQL matrix / Jaeger JSON) on a slow refresh. All of it is the
// central surface — not a workspace panel.
export function ObsPane({ resourceRef }: { resourceRef: string }) {
  const { t } = useTranslation()
  const [tab, setTab] = useState<ObsTab>('logs')

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center gap-4 border-b border-border px-3">
        {(['logs', 'metrics', 'trace'] as const).map((id) => (
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
            {t(`graphene.inspector.tab.${id === 'logs' ? 'logs' : id === 'metrics' ? 'metrics' : 'trace'}`)}
          </button>
        ))}
      </div>
      {tab === 'logs' && <LogsPane resourceRef={resourceRef} />}
      {tab === 'metrics' && <MetricsPane resourceRef={resourceRef} />}
      {tab === 'trace' && <TracePane resourceRef={resourceRef} />}
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

function LogsPane({ resourceRef }: { resourceRef: string }) {
  const { t, i18n } = useTranslation()
  const snapshot = useStore(client.stores.logs(resourceRef))
  const [filter, setFilter] = useState('')
  const [levels, setLevels] = useState<Set<string>>(new Set())
  const [descending, setDescending] = useState(false)
  const [following, setFollowing] = useState(true)
  const [expanded, setExpanded] = useState<number | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)

  const rows = useMemo(() => {
    const needle = filter.trim().toLowerCase()
    let out = snapshot.items
    if (levels.size > 0) out = out.filter((r) => levels.has(severityBucket(r.severity)))
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
  }, [snapshot.items, filter, levels, descending])

  // Follow: keep the tail in view while new lines land.
  useEffect(() => {
    if (!following || descending) return
    const el = scrollRef.current
    if (el !== null) el.scrollTop = el.scrollHeight
  }, [following, descending])

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
              levels.has(level) ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground',
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
          className="flex items-center gap-1 rounded-sm bg-muted px-1.5 py-0.5 font-mono text-3xs text-muted-foreground hover:text-foreground"
          onClick={() => setDescending((v) => !v)}
          title={t('graphene.observe.sortToggle')}
        >
          {descending ? <ArrowDownIcon className="size-3" /> : <ArrowUpIcon className="size-3" />}
          {t('graphene.observe.time')}
        </button>
        <button
          type="button"
          aria-pressed={following}
          className={cn(
            'flex items-center gap-1 rounded-sm px-1.5 py-0.5 font-mono text-3xs',
            following ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground',
          )}
          onClick={() => setFollowing((v) => !v)}
        >
          {following ? <PauseIcon className="size-3" /> : <PlayIcon className="size-3" />}
          {t('graphene.observe.follow')}
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
          {rows.map((record, index) => (
            <LogLine
              // biome-ignore lint/suspicious/noArrayIndexKey: a log line has no identity beyond position in the capped feed.
              key={`${record.timeUnixNano}-${index}`}
              record={record}
              time={time}
              isOpen={expanded === index}
              onToggle={() => setExpanded(expanded === index ? null : index)}
            />
          ))}
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
}: {
  record: LogRecord
  time: Intl.DateTimeFormat
  isOpen: boolean
  onToggle: () => void
}) {
  const bucket = severityBucket(record.severity)
  const attrs = Object.entries(record.attributes)
  return (
    <li className="flex flex-col">
      <button
        type="button"
        className={cn(
          'flex min-w-0 items-baseline gap-2 rounded-sm px-1 text-left hover:bg-surface-hover',
          isOpen && 'bg-muted',
        )}
        onClick={onToggle}
      >
        <span className="shrink-0 text-muted-foreground">
          {time.format(Number(record.timeUnixNano / 1_000_000n))}
        </span>
        <span className={cn('w-9 shrink-0 uppercase', SEVERITY_TONE[bucket])}>
          {record.severity.slice(0, 3) || '·'}
        </span>
        <span className="min-w-0 truncate">{record.body}</span>
      </button>
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

const CHART_VARS = ['--chart-1', '--chart-2', '--chart-3', '--chart-4', '--chart-5']

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
      {snapshot.error !== null && <p className="px-3 text-2xs text-destructive">{snapshot.error}</p>}
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-2">
        {snapshot.snapshot === '' && snapshot.error === null && (
          <div className="flex items-center gap-2 py-3 text-2xs text-muted-foreground">
            <Spinner className="size-3" />
            {t('graphene.observe.metricsWaiting')}
          </div>
        )}
        {snapshot.snapshot !== '' && groups.length === 0 && (
          <p className="py-3 text-2xs text-muted-foreground">{t('graphene.observe.metricsEmpty')}</p>
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

function MetricChart({
  name,
  series,
}: {
  name: string
  series: ReturnType<typeof parsePromMatrix>
}) {
  const allPoints = series.flatMap((s) => s.points)
  const minT = Math.min(...allPoints.map((p) => p[0]))
  const maxT = Math.max(...allPoints.map((p) => p[0]))
  const minV = Math.min(...allPoints.map((p) => p[1]), 0)
  const maxV = Math.max(...allPoints.map((p) => p[1]))
  const spanT = Math.max(maxT - minT, 1)
  const spanV = Math.max(maxV - minV, 1e-9)

  const path = (points: [number, number][]) =>
    points
      .map(
        ([tp, v], i) =>
          `${i === 0 ? 'M' : 'L'}${(((tp - minT) / spanT) * 100).toFixed(2)},${(
            36 -
            ((v - minV) / spanV) * 32
          ).toFixed(2)}`,
      )
      .join(' ')

  return (
    <figure className="rounded-md bg-muted p-2">
      <figcaption className="mb-1 truncate font-mono text-2xs">{name}</figcaption>
      <svg viewBox="0 0 100 38" preserveAspectRatio="none" className="h-20 w-full" role="img" aria-label={name}>
        {series.map((s, i) => (
          <path
            // biome-ignore lint/suspicious/noArrayIndexKey: series identity is the ordered label set slot.
            key={`${s.name}-${i}`}
            d={path(s.points)}
            fill="none"
            stroke={`var(${CHART_VARS[i % CHART_VARS.length]})`}
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>
      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 font-mono text-3xs text-muted-foreground">
        <span>
          {maxV.toPrecision(3)} … {minV.toPrecision(3)}
        </span>
        {series.length > 1 &&
          series.slice(0, 5).map((s, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: legend rows mirror the series slots above.
            <span key={`${s.name}-l${i}`} className="flex items-center gap-1">
              <span
                aria-hidden
                className="inline-block h-0.5 w-3"
                style={{ backgroundColor: `var(${CHART_VARS[i % CHART_VARS.length]})` }}
              />
              {Object.entries(s.labels)
                .map(([k, v]) => `${k}=${v}`)
                .join(',') || '·'}
            </span>
          ))}
      </div>
    </figure>
  )
}

function TracePane({ resourceRef }: { resourceRef: string }) {
  const { t, i18n } = useTranslation()
  const snapshot = useStore(client.stores.trace(resourceRef))
  const [selected, setSelected] = useState<string | null>(null)
  const [byDuration, setByDuration] = useState(false)

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
        {snapshot.error !== null && <p className="px-2 text-2xs text-destructive">{snapshot.error}</p>}
        {snapshot.snapshot === '' && snapshot.error === null && (
          <div className="flex items-center gap-2 px-2 py-3 text-2xs text-muted-foreground">
            <Spinner className="size-3" />
            {t('graphene.observe.traceWaiting')}
          </div>
        )}
        {snapshot.snapshot !== '' && traces.length === 0 && (
          <p className="px-2 py-3 text-2xs text-muted-foreground">{t('graphene.observe.traceEmpty')}</p>
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
                  <span className="shrink-0 text-muted-foreground">{trace.duration.toFixed(0)}ms</span>
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
