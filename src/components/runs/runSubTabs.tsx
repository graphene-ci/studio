import { useStore } from '@nanostores/react'
import { useTranslation } from 'react-i18next'

import { client } from '@/client'
import { LivePlan } from '@/components/pipelines/LivePlan'
import { PlanGraph } from '@/components/pipelines/PlanGraph'
import { OwnsSection } from '@/components/resources/view/OwnsSection'
import type { SubTabDef } from '@/components/resources/view/subTabs'
import { Spinner } from '@/components/ui/spinner'
import { pipelineManifest } from '@/helpers/pipelineManifest'
import type { Resource } from '@/proto/management/v1/resources_pb'

// A run as its own subject: the pipeline's plan colored by THIS run's
// events (no run picker — the run IS the run), and the owned subtree
// (agents/artifacts) as navigable links.

/** The pipeline this run belongs to, from the synthetic label. */
const pipelineOf = (record: Resource) => record.labels['graphene.io/pipeline'] ?? ''

// ── Plan ──────────────────────────────────────────────────────────

function RunPlanTab({ record }: { record: Resource }) {
  const { t } = useTranslation()
  const pipelineId = pipelineOf(record)
  const view = useStore(client.stores.record(`pipeline/${pipelineId}`))
  const pipeline = view.data
  const steps = pipeline === null ? [] : (pipelineManifest(pipeline)?.steps ?? [])

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
      {pipelineId === '' ? (
        <p className="text-xs text-muted-foreground">{t('graphene.pipeline.noPlan')}</p>
      ) : !view.loaded && view.error === null ? (
        <div className="flex justify-center py-6">
          <Spinner className="size-4" />
        </div>
      ) : steps.length === 0 ? (
        <PlanGraph steps={steps} />
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
