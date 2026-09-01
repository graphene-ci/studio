import { useStore } from '@nanostores/react'
import { DownloadIcon, ExternalLinkIcon, PlayIcon, RefreshCwIcon, Trash2Icon } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { client } from '@/client'
import { LivePlan } from '@/components/pipelines/LivePlan'
import { PlanGraph } from '@/components/pipelines/PlanGraph'
import { RevisionsList } from '@/components/pipelines/RevisionsList'
import { RunsFeed } from '@/components/pipelines/RunsFeed'
import { StartRunForm } from '@/components/pipelines/StartRunForm'
import { KindIcon } from '@/components/resources/tree/KindIcon'
import type { SubTabDef } from '@/components/resources/view/subTabs'
import { PhaseBadge } from '@/components/status/PhaseBadge'
import { PhaseText } from '@/components/status/PhaseText'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { timestampMs } from '@/helpers/describe'
import { saveBytes } from '@/helpers/download'
import { pipelineManifest } from '@/helpers/pipelineManifest'
import type { Resource } from '@/proto/management/v1/resources_pb'
import { openResourceTab } from '@/stores/editorTabsStore'
import { notify } from '@/stores/notificationsStore'

const pipelineIdOf = (record: Resource) => record.ref.slice(record.ref.indexOf('/') + 1)

// A pipeline as a project console: the plan (with live coloring from a
// run), the run feed and launch, the revisions, and the delivery
// surround (source / triggers / stand). Overview keeps spec/state.

/** The active-revision / image line shown atop the pipeline Overview. */
export function PipelineOverviewHeader({ record }: { record: Resource }) {
  const { t } = useTranslation()
  const manifest = pipelineManifest(record)
  if (manifest === null || (manifest.activeRevisionId === '' && manifest.image === '')) return null
  return (
    <div className="flex flex-wrap items-center gap-3 font-mono text-2xs text-muted-foreground">
      {manifest.activeRevisionId !== '' && (
        <span>
          {t('graphene.pipeline.activeRevision')}:{' '}
          <span className="text-foreground">{manifest.activeRevisionId}</span>
        </span>
      )}
      {manifest.image !== '' && <span className="min-w-0 truncate">{manifest.image}</span>}
    </div>
  )
}

// ── Plan ──────────────────────────────────────────────────────────

function PlanTab({ record }: { record: Resource }) {
  const { t } = useTranslation()
  const manifest = pipelineManifest(record)
  const steps = manifest?.steps ?? []
  const pipelineId = pipelineIdOf(record)
  const view = useStore(client.stores.listing(`kind=run, pipeline=${pipelineId}`))
  const [selected, setSelected] = useState<string | null>(null)

  const runs = useMemo(
    () =>
      [...view.data].sort(
        (a, b) => (timestampMs(b.startedAt) ?? 0) - (timestampMs(a.startedAt) ?? 0),
      ),
    [view.data],
  )
  const activeRef =
    selected !== null && runs.some((r) => r.ref === selected) ? selected : (runs[0]?.ref ?? null)

  return (
    <section className="flex flex-col gap-2 px-4 py-3">
      <div className="flex items-center gap-2">
        <h3 className="text-2xs font-semibold tracking-wide text-muted-foreground uppercase">
          {t('graphene.pipeline.plan')}
        </h3>
        <span className="grow" />
        {runs.length > 0 && activeRef !== null && (
          <label className="flex items-center gap-1.5 font-mono text-2xs text-muted-foreground">
            {t('graphene.pipeline.selectRun')}
            <select
              value={activeRef}
              onChange={(e) => setSelected(e.target.value)}
              className="h-6 rounded-sm bg-muted px-1.5 font-mono text-2xs text-foreground"
            >
              {runs.map((run) => (
                <option key={run.ref} value={run.ref}>
                  {run.ref.slice(run.ref.indexOf('/') + 1)} · {run.phase}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      {activeRef === null ? (
        <PlanGraph steps={steps} />
      ) : (
        <LivePlan steps={steps} runRef={activeRef} />
      )}
    </section>
  )
}

// ── Runs ──────────────────────────────────────────────────────────

function RunsTab({ record }: { record: Resource }) {
  const { t } = useTranslation()
  const manifest = pipelineManifest(record)
  const pipelineId = pipelineIdOf(record)
  const [launching, setLaunching] = useState(false)

  return (
    <div className="flex flex-col gap-3 px-4 py-3">
      {launching ? (
        <StartRunForm
          pipelineId={pipelineId}
          paramsFields={manifest?.paramsFields ?? []}
          draftRevisionId={null}
          onDone={() => setLaunching(false)}
        />
      ) : (
        <div>
          <Button size="sm" onClick={() => setLaunching(true)}>
            <PlayIcon />
            {t('graphene.pipeline.start')}
          </Button>
        </div>
      )}
      <RunsFeed pipelineId={pipelineId} />
    </div>
  )
}

// ── Revisions ─────────────────────────────────────────────────────

function RevisionsTab({ record }: { record: Resource }) {
  const manifest = pipelineManifest(record)
  const pipelineId = pipelineIdOf(record)
  const [draft, setDraft] = useState<string | null>(null)

  return (
    <div className="flex flex-col gap-3 px-4 py-3">
      {draft !== null && (
        <StartRunForm
          pipelineId={pipelineId}
          paramsFields={manifest?.paramsFields ?? []}
          draftRevisionId={draft}
          onDone={() => setDraft(null)}
        />
      )}
      <RevisionsList
        pipelineId={pipelineId}
        activeRevisionId={manifest?.activeRevisionId ?? ''}
        onDraftRun={(revisionId) => setDraft(revisionId)}
      />
    </div>
  )
}

// ── Delivery ──────────────────────────────────────────────────────

function DeliveryRow({
  resource,
  onSync,
  syncing,
  onDownload,
  downloading,
}: {
  resource: Resource
  onSync?: () => void
  syncing?: boolean
  onDownload?: () => void
  downloading?: boolean
}) {
  const { t } = useTranslation()
  return (
    <li className="flex min-w-0 items-center gap-2 rounded-sm px-1.5 py-1 hover:bg-surface-hover">
      <KindIcon kind={resource.kind} className="size-3.5 shrink-0" />
      <button
        type="button"
        className="flex min-w-0 grow items-center gap-2 text-left font-mono text-xs"
        onClick={() => openResourceTab(resource.ref)}
      >
        <span className="min-w-0 truncate">{resource.ref}</span>
        <PhaseText phase={resource.phase} className="shrink-0 text-2xs" />
      </button>
      {onDownload !== undefined && (
        <Button
          variant="ghost"
          size="icon-sm"
          disabled={downloading}
          aria-label={t('graphene.download.download')}
          title={t('graphene.download.download')}
          onClick={onDownload}
        >
          {downloading ? <Spinner /> : <DownloadIcon />}
        </Button>
      )}
      {onSync !== undefined && (
        <Button
          variant="ghost"
          size="icon-sm"
          disabled={syncing}
          aria-label={t('graphene.pipeline.sync')}
          title={t('graphene.pipeline.sync')}
          onClick={onSync}
        >
          {syncing ? <Spinner /> : <RefreshCwIcon />}
        </Button>
      )}
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={t('graphene.pipeline.openRecord')}
        title={t('graphene.pipeline.openRecord')}
        onClick={() => openResourceTab(resource.ref)}
      >
        <ExternalLinkIcon />
      </Button>
    </li>
  )
}

function DeliverySection({
  labelKey,
  resources,
  onSync,
  syncing,
  onDownload,
  downloading,
}: {
  labelKey: string
  resources: Resource[]
  onSync?: (ref: string) => void
  syncing?: string | null
  onDownload?: (ref: string) => void
  downloading?: string | null
}) {
  const { t } = useTranslation()
  if (resources.length === 0) return null
  return (
    <section className="flex flex-col gap-1.5">
      <h3 className="text-2xs font-semibold tracking-wide text-muted-foreground uppercase">
        {t(labelKey)}
      </h3>
      <ul className="flex flex-col">
        {resources.map((resource) => (
          <DeliveryRow
            key={resource.ref}
            resource={resource}
            onSync={onSync === undefined ? undefined : () => onSync(resource.ref)}
            syncing={syncing === resource.ref}
            onDownload={onDownload === undefined ? undefined : () => onDownload(resource.ref)}
            downloading={downloading === resource.ref}
          />
        ))}
      </ul>
    </section>
  )
}

function DeliveryTab({ record }: { record: Resource }) {
  const { t } = useTranslation()
  const subtree = useStore(client.stores.tree(record.ref))
  const [syncing, setSyncing] = useState<string | null>(null)
  const [downloading, setDownloading] = useState<string | null>(null)

  const children = subtree.data
    .map((node) => node.resource)
    .filter((r): r is Resource => r !== undefined)
  const sources = children.filter((r) => r.kind === 'gitsource')
  const triggers = children.filter((r) => r.kind === 'trigger')
  const stands = children.filter((r) => r.kind === 'stand')
  const empty = sources.length === 0 && triggers.length === 0 && stands.length === 0

  const sync = async (sourceRef: string) => {
    setSyncing(sourceRef)
    try {
      await client.resource(sourceRef).invoke('sync')
      notify({ severity: 'success', title: t('graphene.pipeline.syncSent', { ref: sourceRef }) })
    } catch (err) {
      notify({
        severity: 'error',
        title: t('graphene.pipeline.syncFailed', { ref: sourceRef }),
        body: err instanceof Error ? err.message : String(err),
      })
    } finally {
      setSyncing(null)
    }
  }

  const download = async (sourceRef: string) => {
    setDownloading(sourceRef)
    try {
      const bytes = await client.sources.download(sourceRef)
      const name = `${sourceRef.slice(sourceRef.lastIndexOf('/') + 1)}.tgz`
      saveBytes(name, bytes)
      notify({ severity: 'success', title: t('graphene.download.downloaded', { name }) })
    } catch (err) {
      notify({
        severity: 'error',
        title: t('graphene.download.downloadFailed'),
        body: err instanceof Error ? err.message : String(err),
      })
    } finally {
      setDownloading(null)
    }
  }

  return (
    <div className="flex flex-col gap-4 px-4 py-3">
      {!subtree.loaded && subtree.error === null && (
        <div className="flex justify-center py-6">
          <Spinner className="size-4" />
        </div>
      )}
      {subtree.loaded && empty && (
        <p className="text-xs text-muted-foreground">{t('graphene.pipeline.noDelivery')}</p>
      )}
      <DeliverySection
        labelKey="graphene.pipeline.sourceSection"
        resources={sources}
        onSync={(ref) => void sync(ref)}
        syncing={syncing}
        onDownload={(ref) => void download(ref)}
        downloading={downloading}
      />
      <DeliverySection labelKey="graphene.pipeline.triggersSection" resources={triggers} />
      <DeliverySection labelKey="graphene.pipeline.standSection" resources={stands} />
    </div>
  )
}

// ── Stand ─────────────────────────────────────────────────────────

// One resource parked on the stand, as a card: kind icon, ref, phase,
// the run/keep markers, and the actions at hand — open it, or release
// it (delete) from the stand.
function StandCard({ resource }: { resource: Resource }) {
  const { t } = useTranslation()
  const [releasing, setReleasing] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const marks = Object.entries(resource.labels).filter(([k]) => k.startsWith('graphene.io/'))
  const isArtifact = resource.kind === 'artifact'

  const download = async () => {
    setDownloading(true)
    try {
      const bytes = await client.resource(resource.ref).download()
      const name = `${resource.ref.slice(resource.ref.lastIndexOf('/') + 1)}.tgz`
      saveBytes(name, bytes)
      notify({ severity: 'success', title: t('graphene.download.downloaded', { name }) })
    } catch (err) {
      notify({
        severity: 'error',
        title: t('graphene.download.downloadFailed'),
        body: err instanceof Error ? err.message : String(err),
      })
    } finally {
      setDownloading(false)
    }
  }

  const release = async () => {
    setReleasing(true)
    try {
      await client.resource(resource.ref).delete()
      notify({
        severity: 'success',
        title: t('graphene.pipeline.standReleased', { ref: resource.ref }),
      })
    } catch (err) {
      notify({
        severity: 'error',
        title: t('graphene.pipeline.standReleaseFailed', { ref: resource.ref }),
        body: err instanceof Error ? err.message : String(err),
      })
    } finally {
      setReleasing(false)
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border bg-surface p-3">
      <button
        type="button"
        className="flex min-w-0 items-center gap-2 text-left"
        onClick={() => openResourceTab(resource.ref)}
      >
        <KindIcon kind={resource.kind} className="size-4 shrink-0" />
        <span className="min-w-0 truncate font-mono text-xs font-medium">{resource.ref}</span>
        <span className="grow" />
        <PhaseBadge phase={resource.phase} className="shrink-0" />
      </button>
      {marks.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {marks.map(([k, v]) => (
            <span
              key={k}
              className="rounded-sm bg-muted px-1 py-0.5 font-mono text-3xs text-muted-foreground"
            >
              {k.slice('graphene.io/'.length)}={v}
            </span>
          ))}
        </div>
      )}
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => openResourceTab(resource.ref)}>
          <ExternalLinkIcon />
          {t('graphene.pipeline.openRecord')}
        </Button>
        {isArtifact && (
          <Button
            variant="outline"
            size="sm"
            disabled={downloading}
            onClick={() => void download()}
          >
            {downloading ? <Spinner /> : <DownloadIcon />}
            {t('graphene.download.download')}
          </Button>
        )}
        <span className="grow" />
        <Button variant="ghost" size="sm" disabled={releasing} onClick={() => void release()}>
          {releasing ? <Spinner /> : <Trash2Icon />}
          {t('graphene.pipeline.standRelease')}
        </Button>
      </div>
    </div>
  )
}

function StandTab({ record }: { record: Resource }) {
  const { t } = useTranslation()
  const pipelineId = record.ref.slice(record.ref.indexOf('/') + 1)
  const standRef = `stand/${pipelineId}`
  const subtree = useStore(client.stores.tree(standRef))
  const held = subtree.data
    .map((node) => node.resource)
    .filter((r): r is Resource => r !== undefined)

  return (
    <div className="flex flex-col gap-3 px-4 py-3">
      <div className="flex items-center gap-2">
        <h3 className="text-2xs font-semibold tracking-wide text-muted-foreground uppercase">
          {t('graphene.pipeline.standSection')}
        </h3>
        <span className="grow truncate font-mono text-2xs text-muted-foreground">{standRef}</span>
      </div>
      {!subtree.loaded && subtree.error === null && (
        <div className="flex justify-center py-6">
          <Spinner className="size-4" />
        </div>
      )}
      {subtree.loaded && held.length === 0 && (
        <p className="text-xs text-muted-foreground">{t('graphene.pipeline.standEmpty')}</p>
      )}
      {held.length > 0 && (
        <div className="grid grid-cols-1 gap-3 @xl:grid-cols-2 @3xl:grid-cols-3">
          {held.map((r) => (
            <StandCard key={r.ref} resource={r} />
          ))}
        </div>
      )}
    </div>
  )
}

export const pipelineSubTabs: SubTabDef[] = [
  { id: 'plan', labelKey: 'graphene.pipeline.plan', Body: PlanTab },
  { id: 'runs', labelKey: 'graphene.nav.runs', Body: RunsTab },
  { id: 'revisions', labelKey: 'graphene.pipeline.revisions', Body: RevisionsTab },
  { id: 'stand', labelKey: 'graphene.pipeline.standSection', Body: StandTab },
  { id: 'delivery', labelKey: 'graphene.pipeline.delivery', Body: DeliveryTab },
]
