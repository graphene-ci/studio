import { useStore } from '@nanostores/react'
import { ChevronDownIcon, ChevronRightIcon } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { client } from '@/client'
import { SeverityIcon } from '@/components/status/SeverityIcon'
import { Spinner } from '@/components/ui/spinner'
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

function payloadText(bytes: Uint8Array): string {
  if (bytes.length === 0) return ''
  const raw = decoder.decode(bytes)
  try {
    return JSON.stringify(JSON.parse(raw), null, 2)
  } catch {
    return raw
  }
}

// Dimension 2 — the record's own workflow history (the plane of
// truth), live: the follow stream pushes new events, reconnects
// resume from the last event id. Newest at the bottom, autoscrolled.
export function EventsFeed({ resourceRef }: { resourceRef: string }) {
  const { t, i18n } = useTranslation()
  const snapshot = useStore(client.stores.events(resourceRef))
  const [expanded, setExpanded] = useState<number | null>(null)

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
      {snapshot.error !== null && (
        <p className="text-2xs text-destructive">{snapshot.error}</p>
      )}
      {snapshot.items.length === 0 && snapshot.error === null && (
        <div className="flex items-center gap-2 py-2 text-2xs text-muted-foreground">
          <Spinner className="size-3" />
          {t('graphene.observe.eventsWaiting')}
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <ul className="flex flex-col">
          {snapshot.items.map((event) => {
            const id = Number(event.eventId)
            const isOpen = expanded === id
            const input = payloadText(event.input)
            const result = payloadText(event.result)
            return (
              <li key={id} className="flex flex-col">
                <button
                  type="button"
                  className={cn(
                    'flex min-w-0 items-start gap-1.5 rounded-sm px-1 py-0.5 text-left font-mono text-2xs hover:bg-surface-hover',
                    isOpen && 'bg-muted',
                  )}
                  onClick={() => setExpanded(isOpen ? null : id)}
                >
                  {isOpen ? (
                    <ChevronDownIcon className="mt-0.5 size-3 shrink-0 text-muted-foreground" />
                  ) : (
                    <ChevronRightIcon className="mt-0.5 size-3 shrink-0 text-muted-foreground" />
                  )}
                  <SeverityIcon severity={severityOf(event)} className="mt-0.5 size-3" />
                  <span className="flex min-w-0 grow flex-col">
                    <span className="flex min-w-0 items-baseline gap-1.5">
                      <span className="truncate">{event.kind}</span>
                      {event.attempt > 1 && (
                        <span className="shrink-0 text-muted-foreground">#{event.attempt}</span>
                      )}
                    </span>
                    {event.subject !== '' && (
                      <span className="truncate text-muted-foreground">{event.subject}</span>
                    )}
                    {event.error !== '' && (
                      <span className="truncate text-destructive">{event.error}</span>
                    )}
                  </span>
                  <span className="shrink-0 text-3xs text-muted-foreground">
                    {time.format(Number(event.timeUnixNano / 1_000_000n))}
                  </span>
                </button>
                {isOpen && (
                  <div className="mb-1 ml-6 flex flex-col gap-1 rounded-sm bg-muted p-1.5 font-mono text-3xs">
                    {event.agent !== '' && (
                      <span className="text-muted-foreground">agent: {event.agent}</span>
                    )}
                    {input !== '' && (
                      <details>
                        <summary className="cursor-pointer text-muted-foreground">input</summary>
                        <pre className="overflow-x-auto whitespace-pre-wrap">{input}</pre>
                      </details>
                    )}
                    {result !== '' && (
                      <details>
                        <summary className="cursor-pointer text-muted-foreground">result</summary>
                        <pre className="overflow-x-auto whitespace-pre-wrap">{result}</pre>
                      </details>
                    )}
                    <details>
                      <summary className="cursor-pointer text-muted-foreground">raw</summary>
                      <pre className="overflow-x-auto whitespace-pre-wrap">
                        {payloadText(event.raw)}
                      </pre>
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
