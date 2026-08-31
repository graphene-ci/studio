import { useStore } from '@nanostores/react'
import { ChevronDownIcon, ChevronRightIcon, PlayIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { client } from '@/client'
import { PlanGraph } from '@/components/pipelines/PlanGraph'
import { RevisionsList } from '@/components/pipelines/RevisionsList'
import { RunsFeed } from '@/components/pipelines/RunsFeed'
import { StartRunForm } from '@/components/pipelines/StartRunForm'
import { ActionsPane } from '@/components/resources/view/ActionsPane'
import { EventsFeed } from '@/components/resources/view/EventsFeed'
import { ObsPane } from '@/components/resources/view/ObsPane'
import { ResourceHeader, StatePane } from '@/components/resources/view/ResourceView'
import { StatusBanner } from '@/components/status/StatusBanner'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { pipelineManifest } from '@/helpers/pipelineManifest'
import { findAncestry } from '@/helpers/resourceTree'
import { useParams } from '@/router'
import { setBreadcrumbs } from '@/stores/breadcrumbsStore'
import type { PipelineTab } from '@/stores/editorTabsStore'

// The PIPELINE HUB — the CI face of a pipeline record: the plan graph
// of the active revision, the live run feed, revisions with
// activate/rollback/draft-run, and a launch form from the manifest's
// own params schema. The generic record surface (spec/state) stays a
// fold below; commands and the event feed keep the right column.
export function PipelineHubView({ tab }: { tab: PipelineTab }) {
  const { t } = useTranslation()
  const ref = `pipeline/${tab.pipelineId}`
  const view = useStore(client.stores.record(ref))
  const tree = useStore(client.stores.tree())
  const { ns } = useParams()
  const [launch, setLaunch] = useState<{ draftRevisionId: string | null } | null>(null)
  const [showRecord, setShowRecord] = useState(false)
  const record = view.data

  useEffect(() => {
    if (ns === undefined) return
    const chain = findAncestry(tree.data, ref) ?? [ref]
    setBreadcrumbs([{ id: 'ns', label: ns }, ...chain.map((r) => ({ id: r, label: r }))])
  }, [ns, ref, tree.data])

  if (record === null && view.error !== null) {
    return (
      <p className="px-4 py-6 text-xs text-destructive">{t('graphene.resources.detailFailed')}</p>
    )
  }
  if (record === null) {
    return (
      <div className="flex justify-center py-10">
        <Spinner className="size-5" />
      </div>
    )
  }

  const manifest = pipelineManifest(record)
  const pipelineId = record.ref.slice(record.ref.indexOf('/') + 1)

  return (
    <div className="flex h-full min-h-0 flex-col">
      <ResourceHeader record={record} />
      {view.error !== null && (
        <StatusBanner tone="warning" className="shrink-0">
          {t('graphene.resourceView.stale', { error: view.error })}
        </StatusBanner>
      )}
      <div className="grid min-h-0 flex-[3] grid-cols-[minmax(0,1fr)_20rem] gap-4 px-4 pt-2 pb-3">
        {/* CI column. */}
        <div className="flex min-h-0 flex-col gap-4 overflow-y-auto pr-1">
          {manifest !== null && (
            <div className="flex flex-wrap items-center gap-3 font-mono text-2xs text-muted-foreground">
              {manifest.activeRevisionId !== '' && (
                <span>
                  {t('graphene.pipeline.activeRevision')}:{' '}
                  <span className="text-foreground">{manifest.activeRevisionId}</span>
                </span>
              )}
              {manifest.image !== '' && <span className="min-w-0 truncate">{manifest.image}</span>}
            </div>
          )}

          <section className="flex flex-col gap-1.5">
            <h3 className="text-2xs font-semibold tracking-wide text-muted-foreground uppercase">
              {t('graphene.pipeline.plan')}
            </h3>
            <PlanGraph steps={manifest?.steps ?? []} />
          </section>

          <RunsFeed pipelineId={pipelineId} />

          <RevisionsList
            pipelineId={pipelineId}
            activeRevisionId={manifest?.activeRevisionId ?? ''}
            onDraftRun={(revisionId) => setLaunch({ draftRevisionId: revisionId })}
          />

          {/* The generic record surface, folded. */}
          <section className="flex flex-col gap-1.5">
            <button
              type="button"
              className="flex items-center gap-1 text-2xs font-semibold tracking-wide text-muted-foreground uppercase hover:text-foreground"
              aria-expanded={showRecord}
              onClick={() => setShowRecord((v) => !v)}
            >
              {showRecord ? (
                <ChevronDownIcon className="size-3" />
              ) : (
                <ChevronRightIcon className="size-3" />
              )}
              {t('graphene.pipeline.record')}
            </button>
            {showRecord && <StatePane record={record} />}
          </section>
        </div>

        {/* Action column. */}
        <div className="flex min-h-0 flex-col gap-3 overflow-y-auto">
          {launch === null ? (
            <Button size="sm" onClick={() => setLaunch({ draftRevisionId: null })}>
              <PlayIcon />
              {t('graphene.pipeline.start')}
            </Button>
          ) : (
            <StartRunForm
              pipelineId={pipelineId}
              paramsFields={manifest?.paramsFields ?? []}
              draftRevisionId={launch.draftRevisionId}
              onDone={() => setLaunch(null)}
            />
          )}
          <ActionsPane record={record} />
          <EventsFeed resourceRef={record.ref} />
        </div>
      </div>
      <div className="min-h-0 flex-[2] border-t border-border">
        <ObsPane resourceRef={record.ref} />
      </div>
    </div>
  )
}
