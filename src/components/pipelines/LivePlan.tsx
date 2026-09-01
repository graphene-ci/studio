import { useStore } from '@nanostores/react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { client } from '@/client'
import { PlanGraph } from '@/components/pipelines/PlanGraph'
import { SeverityIcon } from '@/components/status/SeverityIcon'
import type { PlanStep } from '@/helpers/pipelineManifest'
import { foldStepStatus } from '@/helpers/planStatus'

/** Colors the plan from ONE run's live event stream: a step's subject
 * is the join key; chronological events overwrite so the last state
 * wins (scheduled → running, completed/failed terminal). Clicking a
 * step filters its events into an inline log. Shared by the pipeline
 * Plan (run picker on top) and the run Plan (the run IS the subject). */
export function LivePlan({ steps, runRef }: { steps: PlanStep[]; runRef: string }) {
  const { t, i18n } = useTranslation()
  const events = useStore(client.stores.events(runRef))
  const [focus, setFocus] = useState<string | null>(null)

  const statusMap = useMemo(() => foldStepStatus(events.items), [events.items])

  const focused = useMemo(
    () => (focus === null ? [] : events.items.filter((e) => e.subject === focus)),
    [events.items, focus],
  )
  const time = new Intl.DateTimeFormat(i18n.language, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })

  return (
    <div className="flex flex-col gap-2">
      <PlanGraph
        steps={steps}
        statusOf={(step) => statusMap.get(step.subject) ?? null}
        onStepClick={(step) => setFocus((prev) => (prev === step.subject ? null : step.subject))}
      />
      {focus !== null && (
        <div className="flex flex-col gap-1 rounded-md bg-muted p-2">
          <div className="flex items-center gap-2 font-mono text-2xs">
            <span className="min-w-0 truncate">{focus}</span>
            <span className="grow" />
            <button
              type="button"
              className="text-2xs text-muted-foreground hover:text-foreground"
              onClick={() => setFocus(null)}
            >
              {t('graphene.contexts.cancel')}
            </button>
          </div>
          {focused.length === 0 ? (
            <p className="text-3xs text-muted-foreground">{t('graphene.pipeline.stepNoEvents')}</p>
          ) : (
            <ul className="flex flex-col font-mono text-3xs">
              {focused.map((event) => (
                <li key={Number(event.eventId)} className="flex min-w-0 items-baseline gap-1.5">
                  <SeverityIcon
                    severity={
                      event.error !== '' || event.kind.includes('failed') ? 'error' : 'info'
                    }
                    className="size-3 self-center"
                  />
                  <span className="min-w-0 truncate">{event.kind}</span>
                  {event.error !== '' && (
                    <span className="min-w-0 truncate text-destructive">{event.error}</span>
                  )}
                  <span className="grow" />
                  <span className="shrink-0 text-muted-foreground">
                    {time.format(Number(event.timeUnixNano / 1_000_000n))}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
