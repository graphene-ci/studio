import { useStore } from '@nanostores/react'
import { RotateCcwIcon } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { client } from '@/client'
import { LivePlan } from '@/components/pipelines/LivePlan'
import { OwnsSection } from '@/components/resources/view/OwnsSection'
import type { SubTabDef } from '@/components/resources/view/subTabs'
import { PhaseBadge } from '@/components/status/PhaseBadge'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { timestampMs } from '@/helpers/describe'
import { stepsFromEvents } from '@/helpers/planStatus'
import type { Resource } from '@/proto/management/v1/resources_pb'
import { openResourceTab } from '@/stores/editorTabsStore'
import { notify } from '@/stores/notificationsStore'

// A run as its own subject: its plan built from the run's OWN events
// (real names, real order — the manifest skeleton is placeholder-only),
// and the owned subtree (agents/artifacts) as navigable links.

const decoder = new TextDecoder()

/** The pipeline this run belongs to, from the synthetic label. */
const pipelineOf = (record: Resource) => record.labels['graphene.io/pipeline'] ?? ''

// ── Spec / state parsing ──────────────────────────────────────────

/** The recorded `runSpec` — what this run was fired with. */
interface RunSpec {
  pipeline: string
  params: unknown
  image: string
}

function runSpecOf(record: Resource): RunSpec | null {
  try {
    const parsed: unknown = JSON.parse(decoder.decode(record.spec))
    if (parsed === null || typeof parsed !== 'object') return null
    const o = parsed as Record<string, unknown>
    return {
      pipeline: typeof o.pipeline === 'string' ? o.pipeline : '',
      params: o.params ?? {},
      image: typeof o.image === 'string' ? o.image : '',
    }
  } catch {
    return null
  }
}

/** The recorded `runState` — the terminal result or error, when set. */
function runStateOf(record: Resource): { result: unknown; error: string } {
  try {
    const parsed: unknown = JSON.parse(decoder.decode(record.state))
    if (parsed === null || typeof parsed !== 'object') return { result: null, error: '' }
    const o = parsed as Record<string, unknown>
    return { result: o.result ?? null, error: typeof o.error === 'string' ? o.error : '' }
  } catch {
    return { result: null, error: '' }
  }
}

function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s`
  if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`
}

// ── Overview header ───────────────────────────────────────────────

/** The run's status line atop the Overview: phase, timing, outcome,
 * and a Rerun that re-fires the same pipeline with the same params. */
export function RunOverviewHeader({ record }: { record: Resource }) {
  const { t, i18n } = useTranslation()
  const [rerunning, setRerunning] = useState(false)
  const spec = runSpecOf(record)
  const outcome = runStateOf(record)

  const started = timestampMs(record.startedAt)
  const finished = timestampMs(record.finishedAt)
  const durationMs = started === null ? null : (finished ?? Date.now()) - started
  const time = new Intl.DateTimeFormat(i18n.language, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })

  const rerun = async () => {
    if (spec === null || spec.pipeline === '') return
    setRerunning(true)
    try {
      const reply = await client.runs.start(spec.pipeline, JSON.stringify(spec.params ?? {}), {
        image: spec.image === '' ? undefined : spec.image,
      })
      const id = reply.workflowId.startsWith('run/')
        ? reply.workflowId.slice('run/'.length)
        : reply.workflowId
      notify({ severity: 'success', title: t('graphene.pipeline.started', { runId: id }) })
      if (id !== '') openResourceTab(`run/${id}`)
    } catch (err) {
      notify({
        severity: 'error',
        title: t('graphene.run.rerunFailed'),
        body: err instanceof Error ? err.message : String(err),
      })
    } finally {
      setRerunning(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <PhaseBadge phase={record.phase} />
        {started !== null && (
          <span className="font-mono text-2xs text-muted-foreground">
            {time.format(started)}
            {finished !== null && ` → ${time.format(finished)}`}
          </span>
        )}
        {durationMs !== null && (
          <span className="font-mono text-2xs text-muted-foreground">
            {t('graphene.run.duration')}: {formatDuration(durationMs)}
          </span>
        )}
        <span className="grow" />
        <Button
          size="sm"
          variant="outline"
          disabled={rerunning || spec === null || spec.pipeline === ''}
          onClick={() => void rerun()}
        >
          {rerunning ? <Spinner /> : <RotateCcwIcon />}
          {t('graphene.run.rerun')}
        </Button>
      </div>
      {outcome.error !== '' ? (
        <p className="font-mono text-2xs break-words text-destructive">{outcome.error}</p>
      ) : (
        outcome.result !== null && (
          <p className="min-w-0 truncate font-mono text-2xs text-muted-foreground">
            {t('graphene.run.result')}: {JSON.stringify(outcome.result)}
          </p>
        )
      )}
    </div>
  )
}

// ── Plan ──────────────────────────────────────────────────────────

function RunPlanTab({ record }: { record: Resource }) {
  const { t } = useTranslation()
  const pipelineId = pipelineOf(record)
  const events = useStore(client.stores.events(record.ref))
  const steps = useMemo(() => stepsFromEvents(events.items), [events.items])

  return (
    <section className="flex flex-col gap-2 px-4 py-3">
      <div className="flex items-center gap-2">
        <h3 className="text-2xs font-semibold tracking-wide text-muted-foreground uppercase">
          {t('graphene.pipeline.plan')}
        </h3>
        {pipelineId !== '' && (
          <span className="grow truncate font-mono text-2xs text-muted-foreground">
            pipeline/{pipelineId}
          </span>
        )}
      </div>
      {steps.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t('graphene.run.noSteps')}</p>
      ) : (
        <LivePlan steps={steps} runRef={record.ref} />
      )}
    </section>
  )
}

// ── Children ──────────────────────────────────────────────────────

function RunChildrenTab({ record }: { record: Resource }) {
  const { t } = useTranslation()
  const subtree = useStore(client.stores.tree(record.ref))

  return (
    <div className="flex flex-col gap-3 px-4 py-3">
      {!subtree.loaded && subtree.error === null && (
        <div className="flex justify-center py-6">
          <Spinner className="size-4" />
        </div>
      )}
      {subtree.loaded && subtree.data.length === 0 && (
        <p className="text-xs text-muted-foreground">{t('graphene.pipeline.noChildren')}</p>
      )}
      <OwnsSection ownerRef={record.ref} />
    </div>
  )
}

export const runSubTabs: SubTabDef[] = [
  { id: 'plan', labelKey: 'graphene.pipeline.plan', Body: RunPlanTab },
  { id: 'children', labelKey: 'graphene.pipeline.children', Body: RunChildrenTab },
]
