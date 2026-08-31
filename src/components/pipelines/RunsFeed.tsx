import { useStore } from '@nanostores/react'
import { XIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { client } from '@/client'
import { PhaseText } from '@/components/status/PhaseText'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { timestampMs } from '@/helpers/describe'
import { notify } from '@/stores/notificationsStore'
import { openResourceTab } from '@/stores/editorTabsStore'

// The pipeline's run feed: a live listing of every run this pipeline
// arbitrates (the synthetic graphene.io/pipeline label), newest
// first. Running rows tick their duration locally.
export function RunsFeed({ pipelineId }: { pipelineId: string }) {
  const { t, i18n } = useTranslation()
  const view = useStore(client.stores.listing(`kind=run label.graphene.io/pipeline=${pipelineId}`))

  // A 1s pulse so running durations tick without server chatter.
  const [, setPulse] = useState(0)
  useEffect(() => {
    const timer = setInterval(() => setPulse((v) => v + 1), 1000)
    return () => clearInterval(timer)
  }, [])

  const rows = [...view.data].sort(
    (a, b) => (timestampMs(b.startedAt) ?? 0) - (timestampMs(a.startedAt) ?? 0),
  )
  const time = new Intl.DateTimeFormat(i18n.language, { dateStyle: 'short', timeStyle: 'medium' })

  const cancel = async (runId: string) => {
    try {
      await client.runs.cancel(runId)
      notify({ severity: 'info', title: t('graphene.pipeline.cancelSent', { runId }) })
    } catch (err) {
      notify({
        severity: 'error',
        title: t('graphene.pipeline.cancelFailed', { runId }),
        body: err instanceof Error ? err.message : String(err),
      })
    }
  }

  return (
    <section className="flex flex-col gap-1.5">
      <h3 className="flex items-center gap-2 text-2xs font-semibold tracking-wide text-muted-foreground uppercase">
        {t('graphene.nav.runs')}
        {view.loaded && (
          <span className="font-mono text-3xs normal-case">{rows.length}</span>
        )}
      </h3>
      {!view.loaded && view.error === null && (
        <div className="flex justify-center py-3">
          <Spinner className="size-4" />
        </div>
      )}
      {view.loaded && rows.length === 0 && (
        <p className="text-xs text-muted-foreground">{t('graphene.runs.emptyNoFilters')}</p>
      )}
      <ul className="flex flex-col">
        {rows.map((run) => {
          const runId = run.ref.slice(run.ref.indexOf('/') + 1)
          const started = timestampMs(run.startedAt)
          const finished = timestampMs(run.finishedAt)
          const running = finished === null
          const durationMs =
            started === null ? null : (finished ?? Date.now()) - started
          const trigger = run.labels['graphene.io/trigger'] ?? ''
          return (
            <li key={run.ref} className="group flex min-w-0 items-center gap-2">
              <button
                type="button"
                className="flex h-7 min-w-0 grow items-center gap-2 rounded-sm px-1.5 text-left font-mono text-xs hover:bg-surface-hover"
                onClick={() => openResourceTab(run.ref)}
              >
                <PhaseText phase={run.phase} className="w-20 shrink-0 text-2xs" />
                <span className="min-w-0 truncate">{runId}</span>
                {trigger !== '' && (
                  <span className="shrink-0 rounded-sm bg-muted px-1 text-3xs text-muted-foreground">
                    {trigger}
                  </span>
                )}
                <span className="grow" />
                {durationMs !== null && (
                  <span className="shrink-0 text-2xs text-muted-foreground">
                    {formatDuration(durationMs)}
                  </span>
                )}
                {started !== null && (
                  <span className="shrink-0 text-3xs text-muted-foreground">
                    {time.format(started)}
                  </span>
                )}
              </button>
              {running && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="opacity-0 group-hover:opacity-100"
                  aria-label={t('graphene.runs.cancel', { id: runId })}
                  onClick={() => void cancel(runId)}
                >
                  <XIcon />
                </Button>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s`
  if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`
}
