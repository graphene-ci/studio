import { Fragment, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { YamlView } from '@/components/YamlView'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import type { Event as RunEvent } from '@/proto/management/v1/observe_pb'
import { cn } from '@/lib/utils'

function parseBytes(raw: Uint8Array): unknown {
  if (raw.length === 0) return null
  try {
    return JSON.parse(new TextDecoder().decode(raw))
  } catch {
    return null
  }
}

const kindTone = (kind: string): string => {
  if (kind.endsWith('-failed')) return 'text-status-failed'
  if (kind.endsWith('-completed')) return 'text-status-success'
  if (kind.endsWith('-scheduled') || kind.endsWith('-started')) return 'text-status-running'
  if (kind.startsWith('internal-')) return 'text-muted-foreground'
  return 'text-foreground'
}

interface EventsViewProps {
  events: RunEvent[]
  streaming: boolean
  error: string | null
}

// The run's own history, translated — every event drills down to its
// input/result/raw payloads.
export function EventsView({ events, streaming, error }: EventsViewProps) {
  const { t } = useTranslation()
  const [openId, setOpenId] = useState<bigint | null>(null)

  return (
    <div className="scrollbar-stable flex min-h-0 grow flex-col overflow-auto rounded-md bg-card">
      {error !== null && <div className="p-3 font-mono text-xs text-status-failed">{error}</div>}
      <table className="w-full table-auto border-separate border-spacing-0 text-sm">
        <thead>
          <tr>
            {['time', 'kind', 'subject', 'agent', 'attempt', 'detail'].map((col) => (
              <th
                key={col}
                className="sticky top-0 z-10 bg-card px-3 py-1.5 text-left text-2xs font-medium tracking-wider text-muted-foreground uppercase"
              >
                {t(`graphene.run.events.${col}`)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {events.map((event) => {
            const at = new Date(Number(event.timeUnixNano / 1_000_000n))
            const open = openId === event.eventId
            return (
              <Fragment key={String(event.eventId)}>
                <tr
                  className={cn('group/row cursor-pointer', open && 'bg-accent')}
                  onClick={() => setOpenId(open ? null : event.eventId)}
                >
                  <td className="px-3 py-1.5 align-middle font-mono text-2xs whitespace-nowrap text-muted-foreground group-hover/row:bg-surface-hover">
                    {at.toLocaleTimeString()}
                  </td>
                  <td
                    className={cn(
                      'px-3 py-1.5 align-middle font-mono text-xs group-hover/row:bg-surface-hover',
                      kindTone(event.kind),
                    )}
                  >
                    {event.kind}
                  </td>
                  <td className="px-3 py-1.5 align-middle font-mono text-xs group-hover/row:bg-surface-hover">
                    {event.subject}
                  </td>
                  <td className="px-3 py-1.5 align-middle font-mono text-2xs text-muted-foreground group-hover/row:bg-surface-hover">
                    {event.agent}
                  </td>
                  <td className="px-3 py-1.5 align-middle font-mono text-2xs text-muted-foreground group-hover/row:bg-surface-hover">
                    {event.attempt > 1 ? `#${event.attempt}` : ''}
                  </td>
                  <td className="px-3 py-1.5 align-middle group-hover/row:bg-surface-hover">
                    {event.error !== '' ? (
                      <span className="font-mono text-2xs text-status-failed">{event.error}</span>
                    ) : (
                      event.status !== '' && (
                        <Badge variant="secondary" className="text-2xs">
                          {event.status}
                        </Badge>
                      )
                    )}
                  </td>
                </tr>
                {open && (
                  <tr>
                    <td colSpan={6} className="bg-muted px-4 py-3">
                      <div className="grid gap-3 lg:grid-cols-2">
                        {(
                          [
                            ['input', parseBytes(event.input)],
                            ['result', parseBytes(event.result)],
                          ] as const
                        ).map(
                          ([name, value]) =>
                            value !== null && (
                              <div key={name} className="flex min-w-0 flex-col gap-1">
                                <span className="text-2xs tracking-wide text-muted-foreground uppercase">
                                  {t(`graphene.run.events.${name}`)}
                                </span>
                                <YamlView value={value} className="max-h-56" />
                              </div>
                            ),
                        )}
                        <div className="flex min-w-0 flex-col gap-1 lg:col-span-2">
                          <span className="text-2xs tracking-wide text-muted-foreground uppercase">
                            {t('graphene.run.events.raw')}
                          </span>
                          <YamlView value={parseBytes(event.raw)} className="max-h-56" />
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            )
          })}
          {events.length === 0 && (
            <tr>
              <td colSpan={6} className="h-24 text-center align-middle">
                <span className="inline-flex items-center gap-2 font-mono text-xs text-muted-foreground">
                  {streaming ? (
                    <>
                      <Spinner className="size-3.5" />
                      {t('graphene.run.events.waiting')}
                    </>
                  ) : (
                    t('graphene.run.events.empty')
                  )}
                </span>
              </td>
            </tr>
          )}
        </tbody>
      </table>
      {streaming && events.length > 0 && (
        <div className="flex items-center gap-2 p-2 font-mono text-2xs text-muted-foreground">
          <Spinner className="size-3" />
          {t('graphene.run.events.following')}
        </div>
      )}
    </div>
  )
}
