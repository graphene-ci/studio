import { ArrowDownToLineIcon } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import type { LogRecord } from '@/proto/management/v1/observe_pb'
import { cn } from '@/lib/utils'

const severityTone = (severity: string): string => {
  const s = severity.toUpperCase()
  if (s.startsWith('ERR') || s.startsWith('FATAL')) return 'text-status-failed'
  if (s.startsWith('WARN')) return 'text-status-warning'
  if (s.startsWith('DEBUG') || s.startsWith('TRACE')) return 'text-muted-foreground'
  return 'text-status-running'
}

interface LogsViewProps {
  records: LogRecord[]
  streaming: boolean
  error: string | null
}

// Terminal-style log pane: severity colors, client text filter,
// follow-tail that disengages when the user scrolls up.
export function LogsView({ records, streaming, error }: LogsViewProps) {
  const { t } = useTranslation()
  const [filter, setFilter] = useState('')
  const [follow, setFollow] = useState(true)
  const scrollRef = useRef<HTMLDivElement>(null)

  const visible = useMemo(() => {
    if (filter.trim() === '') return records
    const needle = filter.toLowerCase()
    return records.filter((r) => r.body.toLowerCase().includes(needle))
  }, [records, filter])

  useEffect(() => {
    void visible
    if (!follow) return
    const el = scrollRef.current
    if (el !== null) el.scrollTop = el.scrollHeight
  }, [visible, follow])

  return (
    <div className="flex min-h-0 grow flex-col gap-2">
      <div className="flex items-center gap-2">
        <Input
          value={filter}
          placeholder={t('graphene.run.logs.filter')}
          className="h-7 w-64 font-mono text-xs"
          onChange={(event) => setFilter(event.target.value)}
        />
        <span className="font-mono text-2xs text-muted-foreground tabular-nums">
          {t('graphene.run.logs.lines', { count: visible.length })}
        </span>
        <span className="grow" />
        <button
          type="button"
          aria-pressed={follow}
          className={cn(
            'flex items-center gap-1 rounded-sm px-1.5 py-0.5 font-mono text-2xs',
            follow ? 'bg-accent text-primary' : 'text-muted-foreground hover:text-foreground',
          )}
          onClick={() => setFollow((f) => !f)}
        >
          <ArrowDownToLineIcon className="size-3" />
          {t('graphene.run.logs.follow')}
        </button>
      </div>
      {error !== null && (
        <div className="rounded-md bg-status-failed-bg p-2 font-mono text-xs text-status-failed">
          {error}
        </div>
      )}
      <div
        ref={scrollRef}
        className="scrollbar-stable min-h-0 grow overflow-auto rounded-md bg-card p-3"
        onScroll={(event) => {
          const el = event.currentTarget
          const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 24
          if (!atBottom && follow) setFollow(false)
        }}
      >
        {visible.length === 0 ? (
          <span className="inline-flex items-center gap-2 font-mono text-xs text-muted-foreground">
            {streaming ? (
              <>
                <Spinner className="size-3.5" />
                {t('graphene.run.logs.waiting')}
              </>
            ) : (
              t('graphene.run.logs.empty')
            )}
          </span>
        ) : (
          visible.map((record) => {
            const at = new Date(Number(record.timeUnixNano / 1_000_000n))
            return (
              <div
                key={`${record.timeUnixNano}:${record.severity}:${record.body}`}
                className="flex gap-2 font-mono text-2xs leading-relaxed"
              >
                <span className="shrink-0 text-muted-foreground">{at.toLocaleTimeString()}</span>
                <span className={cn('w-12 shrink-0', severityTone(record.severity))}>
                  {record.severity.toUpperCase().slice(0, 5)}
                </span>
                <span className="break-all whitespace-pre-wrap">{record.body}</span>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
