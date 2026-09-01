import { useStore } from '@nanostores/react'
import { ArrowDownIcon, ArrowUpIcon, ChevronDownIcon, ChevronRightIcon } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { stringify as stringifyYaml } from 'yaml'

import { client } from '@/client'
import { CodeEditor } from '@/components/CodeEditor'
import { SeverityIcon } from '@/components/status/SeverityIcon'
import { type StatusTone, TONE_TEXT } from '@/components/status/tones'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { yamlLanguage } from '@/helpers/editorLanguage'
import { cn } from '@/lib/utils'
import type { Event } from '@/proto/management/v1/observe_pb'
import type { NotificationSeverity } from '@/stores/notificationsStore'

const decoder = new TextDecoder()

function severityOf(event: Event): NotificationSeverity {
  const kind = event.kind
  if (kind.includes('failed') || event.error !== '') return 'error'
  if (kind.includes('completed') || kind.includes('started')) return 'success'
  if (kind.includes('retry') || kind.includes('timed-out')) return 'warning'
  return 'info'
}

// Severity → the pinned status tone: the row's icon, kind tint, left
// border and subtle wash all read from the one map, so a failure is
// scannable at a glance.
const SEVERITY_TONE: Record<NotificationSeverity, StatusTone> = {
  info: 'canceled',
  success: 'success',
  warning: 'warning',
  error: 'failed',
}

const TONE_BORDER: Record<StatusTone, string> = {
  success: 'border-l-status-success',
  pending: 'border-l-status-pending',
  warning: 'border-l-status-warning',
  failed: 'border-l-status-failed',
  canceled: 'border-l-status-canceled',
}

const TONE_WASH: Record<StatusTone, string> = {
  success: 'bg-status-success-bg',
  pending: 'bg-status-pending-bg',
  warning: 'bg-status-warning-bg',
  failed: 'bg-status-failed-bg',
  canceled: 'bg-status-canceled-bg',
}

const SEVERITIES: NotificationSeverity[] = ['error', 'warning', 'success', 'info']

// A payload reads as YAML — an object folds into keyed lines instead of
// a wall of braces; non-JSON bytes pass through verbatim.
function payloadText(bytes: Uint8Array): string {
  if (bytes.length === 0) return ''
  const raw = decoder.decode(bytes)
  try {
    return stringifyYaml(JSON.parse(raw)).trimEnd()
  } catch {
    return raw
  }
}

// Dimension 2 — the record's own workflow history (the plane of
// truth), live: the follow stream pushes new events, reconnects
// resume from the last event id. Newest at the bottom, autoscrolled;
// a filter row narrows by text or severity and can flip the order.
export function EventsFeed({ resourceRef }: { resourceRef: string }) {
  const { t, i18n } = useTranslation()
  const snapshot = useStore(client.stores.events(resourceRef))
  const [expanded, setExpanded] = useState<number | null>(null)
  const [filter, setFilter] = useState('')
  const [severities, setSeverities] = useState<Set<NotificationSeverity>>(new Set())
  const [descending, setDescending] = useState(false)
  const scrollRef = useRef<HTMLDivElement | null>(null)

  const rows = useMemo(() => {
    const needle = filter.trim().toLowerCase()
    let out = snapshot.items
    if (severities.size > 0) out = out.filter((e) => severities.has(severityOf(e)))
    if (needle !== '') {
      out = out.filter(
        (e) =>
          e.kind.toLowerCase().includes(needle) ||
          e.subject.toLowerCase().includes(needle) ||
          e.agent.toLowerCase().includes(needle) ||
          e.error.toLowerCase().includes(needle),
      )
    }
    return descending ? [...out].reverse() : out
  }, [snapshot.items, filter, severities, descending])

  // Follow the tail while new events land — unless the order is flipped
  // to newest-first, where the tail is already at the top.
  useEffect(() => {
    if (descending) return
    const el = scrollRef.current
    if (el !== null) el.scrollTop = el.scrollHeight
  }, [descending])

  const time = new Intl.DateTimeFormat(i18n.language, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })

  return (
    <section className="flex min-h-0 flex-1 flex-col gap-1.5">
      <h3 className="flex items-center gap-2 text-2xs font-semibold tracking-wide text-muted-foreground uppercase">
        {t('graphene.inspector.tab.events')}
        {snapshot.error === null && snapshot.items.length > 0 && (
          <span className="rounded-sm bg-muted px-1 font-mono text-3xs normal-case">live</span>
        )}
      </h3>
      {snapshot.items.length > 0 && (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder={t('graphene.observe.eventFilter')}
            className="h-6 w-56 font-mono text-2xs"
          />
          {SEVERITIES.map((severity) => (
            <button
              key={severity}
              type="button"
              aria-pressed={severities.has(severity)}
              className={cn(
                'rounded-sm px-1.5 py-0.5 font-mono text-3xs',
                severities.has(severity)
                  ? 'bg-accent text-accent-foreground'
                  : 'bg-muted text-muted-foreground',
                TONE_TEXT[SEVERITY_TONE[severity]],
              )}
              onClick={() =>
                setSeverities((prev) => {
                  const next = new Set(prev)
                  if (next.has(severity)) next.delete(severity)
                  else next.add(severity)
                  return next
                })
              }
            >
              {severity}
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
          <span className="grow" />
          <span className="font-mono text-3xs text-muted-foreground">
            {t('graphene.observe.shown', { shown: rows.length, total: snapshot.items.length })}
          </span>
        </div>
      )}
      {snapshot.error !== null && <p className="text-2xs text-destructive">{snapshot.error}</p>}
      {snapshot.items.length === 0 && snapshot.error === null && (
        <div className="flex items-center gap-2 py-2 text-2xs text-muted-foreground">
          <Spinner className="size-3" />
          {t('graphene.observe.eventsWaiting')}
        </div>
      )}
      {snapshot.items.length > 0 && rows.length === 0 && (
        <p className="py-2 text-2xs text-muted-foreground">{t('graphene.observe.eventsEmpty')}</p>
      )}
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
        <ul className="flex flex-col gap-px">
          {rows.map((event) => {
            const id = Number(event.eventId)
            const isOpen = expanded === id
            const input = payloadText(event.input)
            const result = payloadText(event.result)
            const tone = SEVERITY_TONE[severityOf(event)]
            return (
              <li key={id} className="flex flex-col">
                <button
                  type="button"
                  className={cn(
                    'flex min-w-0 items-center gap-2 rounded-sm border-l-2 py-0.5 pr-1 pl-1.5 text-left font-mono text-2xs',
                    TONE_BORDER[tone],
                    isOpen ? 'bg-muted' : cn(TONE_WASH[tone], 'hover:bg-surface-hover'),
                  )}
                  onClick={() => setExpanded(isOpen ? null : id)}
                >
                  {isOpen ? (
                    <ChevronDownIcon className="size-3 shrink-0 text-muted-foreground" />
                  ) : (
                    <ChevronRightIcon className="size-3 shrink-0 text-muted-foreground" />
                  )}
                  <span className="w-14 shrink-0 text-3xs text-muted-foreground tabular-nums">
                    {time.format(Number(event.timeUnixNano / 1_000_000n))}
                  </span>
                  <SeverityIcon severity={severityOf(event)} className="size-3" />
                  <span
                    className={cn(
                      'flex w-36 shrink-0 items-baseline gap-1 truncate',
                      TONE_TEXT[tone],
                    )}
                  >
                    <span className="truncate">{event.kind}</span>
                    {event.attempt > 1 && (
                      <span className="shrink-0 text-muted-foreground">#{event.attempt}</span>
                    )}
                  </span>
                  <span className="w-24 shrink-0 truncate text-muted-foreground">
                    {event.agent}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-muted-foreground">
                    {event.subject}
                  </span>
                  {event.error !== '' && (
                    <span className="min-w-0 flex-1 truncate text-destructive">{event.error}</span>
                  )}
                </button>
                {isOpen && (
                  <div className="mb-1 ml-6 flex flex-col gap-1 rounded-sm bg-muted p-1.5 font-mono text-3xs">
                    {event.agent !== '' && (
                      <span className="text-muted-foreground">agent: {event.agent}</span>
                    )}
                    {input !== '' && (
                      <details>
                        <summary className="cursor-pointer text-muted-foreground">input</summary>
                        <CodeEditor
                          value={input}
                          onChange={() => {}}
                          readOnly
                          autoHeight
                          language={yamlLanguage()}
                        />
                      </details>
                    )}
                    {result !== '' && (
                      <details>
                        <summary className="cursor-pointer text-muted-foreground">result</summary>
                        <CodeEditor
                          value={result}
                          onChange={() => {}}
                          readOnly
                          autoHeight
                          language={yamlLanguage()}
                        />
                      </details>
                    )}
                    <details>
                      <summary className="cursor-pointer text-muted-foreground">raw</summary>
                      <CodeEditor
                        value={payloadText(event.raw)}
                        onChange={() => {}}
                        readOnly
                        autoHeight
                        language={yamlLanguage()}
                      />
                    </details>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}
