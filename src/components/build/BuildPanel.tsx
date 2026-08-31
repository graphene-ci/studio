import { useStore } from '@nanostores/react'
import { HammerIcon, RotateCcwIcon } from 'lucide-react'
import { atom, computed, type ReadableAtom } from 'nanostores'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { client, type View } from '@/client'
import { KindIcon } from '@/components/resources/tree/KindIcon'
import { PhaseText } from '@/components/status/PhaseText'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { pipelineActiveRevision } from '@/helpers/recordState'
import { cn } from '@/lib/utils'
import type { Resource, TreeNode } from '@/proto/management/v1/resources_pb'

/** Lists the gitsource refs under every pipeline root (ownership
 * order) — the build context grouping. */
function pipelineSources(roots: TreeNode[]): Map<string, string[]> {
  const out = new Map<string, string[]>()
  for (const node of roots) {
    if (node.resource?.kind !== 'pipeline') continue
    const refs = node.children
      .filter((c) => c.resource?.kind === 'gitsource')
      .map((c) => c.resource?.ref ?? '')
      .filter((r) => r !== '')
      .sort((a, b) => a.localeCompare(b))
    out.set(node.resource.ref, refs)
  }
  return out
}
import { $editorTabs } from '@/stores/editorTabsStore'
import { notify } from '@/stores/notificationsStore'
import { $selection } from '@/stores/selectionStore'

// One record view with a stable hook count even when the ref is null.
function useMaybeRecord(ref: string | null): View<Resource | null> | null {
  const store = useMemo(
    (): ReadableAtom<View<Resource | null> | null> =>
      ref === null ? atom(null) : client.stores.record(ref),
    [ref],
  )
  return useStore(store)
}

// Materialization views for a dynamic set of sources.
function useMaterializations(refs: string[]) {
  const refsKey = refs.join('\n')
  const combined = useMemo(() => {
    const list = refsKey === '' ? [] : refsKey.split('\n')
    if (list.length === 0) return atom([])
    return computed(
      list.map((r) => client.stores.materialization(r)),
      (...views) => views,
    )
  }, [refsKey])
  return useStore(combined)
}

// The Build panel (JB Run-style): the generations→revision→activation
// chain of ONE pipeline. Context follows the active editor tab (its
// source's pipeline), the selector overrides by hand.
export function BuildPanel() {
  const { t } = useTranslation()
  const tree = useStore(client.stores.tree())
  const tabs = useStore($editorTabs)
  const selection = useStore($selection)
  const [manual, setManual] = useState<string | null>(null)

  const byPipeline = useMemo(() => pipelineSources(tree.data), [tree.data])
  const pipelineRefs = useMemo(() => [...byPipeline.keys()].sort(), [byPipeline])

  // Auto context: active file tab's source → its pipeline; else the
  // tree selection's pipeline ancestor; else the first pipeline.
  const auto = useMemo(() => {
    const activeTab = tabs.tabs.find((tab) => tab.id === tabs.activeId)
    const wanted: string[] = []
    if (activeTab !== undefined && activeTab.type === 'file') wanted.push(activeTab.sourceRef)
    if (selection !== null) wanted.push(selection)
    for (const [pipelineRef, sources] of byPipeline) {
      for (const target of wanted) {
        if (pipelineRef === target || sources.includes(target)) return pipelineRef
      }
    }
    return pipelineRefs[0] ?? null
  }, [tabs, selection, byPipeline, pipelineRefs])

  const pipelineRef = manual !== null && byPipeline.has(manual) ? manual : auto
  const pipelineView = useMaybeRecord(pipelineRef)
  const activeRevision = pipelineView?.data != null ? pipelineActiveRevision(pipelineView.data) : ''

  const pipelineNode = useMemo(
    (): TreeNode | null => tree.data.find((n) => n.resource?.ref === pipelineRef) ?? null,
    [tree.data, pipelineRef],
  )
  const sources = useMemo(
    () =>
      (pipelineNode?.children ?? []).filter((c) => c.resource?.kind === 'gitsource'),
    [pipelineNode],
  )
  const revisions = useMemo(
    () => (pipelineNode?.children ?? []).filter((c) => c.resource?.kind === 'revision'),
    [pipelineNode],
  )

  const sourceRefs = useMemo(
    () => sources.map((s) => s.resource?.ref ?? '').filter((r) => r !== ''),
    [sources],
  )
  const materializations = useMaterializations(sourceRefs)

  if (pipelineRef === null) {
    return (
      <p className="px-3 py-4 text-xs text-muted-foreground">{t('graphene.build.noPipelines')}</p>
    )
  }

  const pipelineId = pipelineRef.slice(pipelineRef.indexOf('/') + 1)

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto p-2">
      {/* context selector */}
      <Select
        value={pipelineRef}
        onValueChange={(value) => setManual(value === auto ? null : value)}
      >
        <SelectTrigger className="h-7 w-full font-mono text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {pipelineRefs.map((ref) => (
            <SelectItem key={ref} value={ref} className="font-mono text-xs">
              {ref}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* sources + build */}
      <section className="flex flex-col gap-1.5">
        <h3 className="px-1 text-3xs font-semibold tracking-wide text-muted-foreground uppercase">
          {t('graphene.build.sources')}
        </h3>
        {sources.map((node, i) => {
          const resource = node.resource
          if (resource === undefined) return null
          const vm = materializations[i] ?? null
          return (
            <SourceBuildRow
              key={resource.ref}
              resource={resource}
              pipelineId={pipelineId}
              materialization={vm}
            />
          )
        })}
        {sources.length === 0 && (
          <p className="px-1 text-2xs text-muted-foreground">{t('graphene.build.noSources')}</p>
        )}
      </section>

      {/* revisions */}
      <section className="flex flex-col gap-1.5">
        <h3 className="px-1 text-3xs font-semibold tracking-wide text-muted-foreground uppercase">
          {t('graphene.build.revisions')}
        </h3>
        {revisions.map((node) => {
          const resource = node.resource
          if (resource === undefined) return null
          const recordId = resource.ref.slice(resource.ref.indexOf('/') + 1)
          // The record id is "{pipelineId}.{revisionId}"; commands and
          // the pipeline's state speak in the BARE revision id.
          const id = recordId.startsWith(`${pipelineId}.`)
            ? recordId.slice(pipelineId.length + 1)
            : recordId
          const isActive = id === activeRevision
          return (
            <div
              key={resource.ref}
              className={cn(
                'flex items-center gap-2 rounded-md px-2 py-1.5',
                isActive ? 'bg-accent' : 'bg-muted',
              )}
            >
              <KindIcon kind="revision" />
              <span className="min-w-0 grow truncate font-mono text-xs">{id}</span>
              {isActive ? (
                <span className="shrink-0 rounded-sm bg-card px-1.5 font-mono text-3xs font-semibold text-primary">
                  {t('graphene.build.active')}
                </span>
              ) : (
                <ActivateButton pipelineId={pipelineId} revisionId={id} />
              )}
              <PhaseText phase={resource.phase} className="shrink-0 text-2xs" />
            </div>
          )
        })}
        {revisions.length === 0 && (
          <p className="px-1 text-2xs text-muted-foreground">{t('graphene.build.noRevisions')}</p>
        )}
      </section>
    </div>
  )
}

function SourceBuildRow({
  resource,
  pipelineId,
  materialization,
}: {
  resource: Resource
  pipelineId: string
  materialization: {
    running: boolean
    stage: string
    log: string[]
    error: string | null
    revisionId: string | null
  } | null
}) {
  const { t } = useTranslation()
  const logRef = useRef<HTMLDivElement | null>(null)

  // Build log follows its tail.
  useEffect(() => {
    const el = logRef.current
    if (el !== null) el.scrollTop = el.scrollHeight
  })

  return (
    <div className="flex flex-col gap-1 rounded-md bg-muted p-2">
      <div className="flex items-center gap-2">
        <KindIcon kind={resource.kind} />
        <span className="min-w-0 grow truncate font-mono text-xs">{resource.ref}</span>
        <Button
          size="sm"
          className="h-6 shrink-0 px-2 text-2xs"
          disabled={materialization?.running === true}
          onClick={() => client.pipelines.materialize(pipelineId, resource.ref)}
        >
          {materialization?.running === true ? (
            <Spinner className="size-3" />
          ) : (
            <HammerIcon className="size-3" />
          )}
          {t('graphene.build.materialize')}
        </Button>
      </div>
      {materialization !== null && (
        <>
          <div className="flex items-center gap-2 font-mono text-3xs text-muted-foreground">
            {['upload', 'runtime', 'build', 'describe', 'publish', 'done'].map((stage) => (
              <span
                key={stage}
                className={cn(stage === materialization.stage && 'font-semibold text-foreground')}
              >
                {stage}
              </span>
            ))}
          </div>
          {materialization.log.length > 0 && (
            <div
              ref={logRef}
              className="max-h-40 overflow-y-auto rounded-sm bg-background p-1.5 font-mono text-3xs leading-4 whitespace-pre-wrap"
            >
              {materialization.log.join('\n')}
            </div>
          )}
          {materialization.error !== null && (
            <p className="text-2xs text-destructive">{materialization.error}</p>
          )}
          {materialization.revisionId !== null && (
            <p className="font-mono text-2xs text-muted-foreground">
              {t('graphene.build.builtRevision', { id: materialization.revisionId })}
            </p>
          )}
        </>
      )}
    </div>
  )
}

function ActivateButton({ pipelineId, revisionId }: { pipelineId: string; revisionId: string }) {
  const { t } = useTranslation()
  const [busy, setBusy] = useState(false)
  return (
    <Button
      variant="outline"
      size="sm"
      className="h-5 shrink-0 px-2 text-3xs"
      disabled={busy}
      onClick={() => {
        setBusy(true)
        client.pipelines
          .activate(pipelineId, revisionId)
          .then(() =>
            notify({
              severity: 'success',
              title: t('graphene.build.activated', { id: revisionId, pipeline: pipelineId }),
            }),
          )
          .catch(() =>
            notify({
              severity: 'error',
              title: t('graphene.build.activateFailed', { id: revisionId }),
            }),
          )
          .finally(() => setBusy(false))
      }}
    >
      <RotateCcwIcon className="size-2.5" />
      {t('graphene.build.activate')}
    </Button>
  )
}

