import { useStore } from '@nanostores/react'
import { ChevronDownIcon, ChevronRightIcon, SearchIcon } from 'lucide-react'
import { atom, computed } from 'nanostores'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { client } from '@/client'
import { KindIcon } from '@/components/resources/tree/KindIcon'
import { PhaseBadge } from '@/components/status/PhaseBadge'
import { PhaseText } from '@/components/status/PhaseText'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { timestampMs } from '@/helpers/describe'
import { cn } from '@/lib/utils'
import type { Resource } from '@/proto/management/v1/resources_pb'
import { $editorTabs, openResourceTab, resourceTabId } from '@/stores/editorTabsStore'
import { selectResource } from '@/stores/selectionStore'

interface RunsView {
  loaded: boolean
  data: readonly Resource[]
}

// Live run listings for a dynamic set of pipelines — subscribing is
// what starts each run watch (dropped when the pipeline collapses).
// One label-filtered `kind=run` listing per pipeline, so a pipeline
// only ever fetches its own runs. The listing (not the subtree) shows
// runs of every status, finished ones included.
function usePipelineRuns(pipelineIds: string[]): ReadonlyMap<string, RunsView> {
  const idsKey = [...pipelineIds].sort().join('\n')
  const combined = useMemo(() => {
    const list = idsKey === '' ? [] : idsKey.split('\n')
    if (list.length === 0) return atom<ReadonlyMap<string, RunsView>>(new Map())
    return computed(
      list.map((id) => client.stores.listing(`kind=run, pipeline=${id}`)),
      (...views) => {
        const map = new Map<string, RunsView>()
        list.forEach((id, i) => {
          const v = views[i]
          map.set(id, { loaded: v.loaded, data: v.data })
        })
        return map
      },
    )
  }, [idsKey])
  return useStore(combined)
}

function sortedRuns(runs: readonly Resource[]): Resource[] {
  return [...runs].sort((a, b) => {
    const byTime = (timestampMs(b.startedAt) ?? 0) - (timestampMs(a.startedAt) ?? 0)
    return byTime !== 0 ? byTime : b.ref.localeCompare(a.ref)
  })
}

// The Pipelines panel — the CI entry point: every pipeline of the
// namespace, live, as a two-level tree. Expanding a pipeline watches
// its runs (label-filtered listing) and lists them as child rows,
// newest first; collapsing releases the watch. Opening a pipeline —
// or a run — lands in its resource tab in the center.
export function PipelinesPanel() {
  const { t } = useTranslation()
  const view = useStore(client.stores.listing('kind=pipeline'))
  const { activeId } = useStore($editorTabs)
  const [filter, setFilter] = useState('')
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set())

  const rows = useMemo(() => {
    const needle = filter.trim().toLowerCase()
    return [...view.data]
      .filter((r) => needle === '' || r.ref.toLowerCase().includes(needle))
      .sort((a, b) => a.ref.localeCompare(b.ref))
  }, [view.data, filter])

  // Only expanded pipelines get a run watch.
  const watchedIds = useMemo(
    () => rows.map((p) => p.ref.slice(p.ref.indexOf('/') + 1)).filter((id) => expanded.has(id)),
    [rows, expanded],
  )
  const runsByPipeline = usePipelineRuns(watchedIds)

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 p-2">
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder={t('graphene.pipeline.panelFilter')}
            aria-label={t('graphene.pipeline.panelFilter')}
            className="h-7 pl-7 font-mono text-xs"
          />
        </div>
      </div>
      <div className="min-h-0 flex-1 select-none overflow-y-auto px-1 pb-2">
        {!view.loaded && view.error === null && (
          <div className="flex justify-center py-6">
            <Spinner className="size-4" />
          </div>
        )}
        {view.loaded && rows.length === 0 && (
          <p className="px-2 py-4 text-xs text-muted-foreground">{t('graphene.pipelines.empty')}</p>
        )}
        <ul className="flex flex-col">
          {rows.map((pipeline) => {
            const id = pipeline.ref.slice(pipeline.ref.indexOf('/') + 1)
            const isOpen = activeId === resourceTabId(pipeline.ref)
            const isExpanded = expanded.has(id)
            const runsView = runsByPipeline.get(id)
            const runs = runsView === undefined ? [] : sortedRuns(runsView.data)
            return (
              <li key={pipeline.ref}>
                {/* Single click toggles the runs (like a folder); double click opens the pipeline — matching the resource tree's group gesture. */}
                <div
                  role="button"
                  tabIndex={0}
                  aria-expanded={isExpanded}
                  className={cn(
                    'flex h-7 min-w-0 cursor-pointer items-center gap-1.5 rounded-sm pr-1.5 font-mono text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    isOpen ? 'bg-accent text-accent-foreground' : 'hover:bg-surface-hover',
                  )}
                  onClick={() => toggle(id)}
                  onDoubleClick={() => {
                    selectResource(pipeline.ref)
                    openResourceTab(pipeline.ref)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      selectResource(pipeline.ref)
                      openResourceTab(pipeline.ref)
                    } else if (e.key === ' ') {
                      e.preventDefault()
                      toggle(id)
                    }
                  }}
                >
                  <span
                    aria-hidden="true"
                    className="flex size-5 shrink-0 items-center justify-center text-muted-foreground"
                  >
                    {isExpanded ? (
                      <ChevronDownIcon className="size-3.5" />
                    ) : (
                      <ChevronRightIcon className="size-3.5" />
                    )}
                  </span>
                  <KindIcon kind="pipeline" className="size-3.5" />
                  <span className="min-w-0 truncate">{id}</span>
                  <span className="grow" />
                  <PhaseText phase={pipeline.phase} className="text-2xs" />
                </div>
                {isExpanded && (
                  <ul className="flex flex-col">
                    {runsView !== undefined && !runsView.loaded && (
                      <li className="flex justify-center py-2">
                        <Spinner className="size-3.5" />
                      </li>
                    )}
                    {runsView?.loaded && runs.length === 0 && (
                      <li className="py-1 pl-8 text-2xs text-muted-foreground">
                        {t('graphene.pipeline.noRuns')}
                      </li>
                    )}
                    {runs.map((run) => {
                      const runId = run.ref.slice(run.ref.indexOf('/') + 1)
                      const shortId = runId.startsWith('pipeline-')
                        ? runId.slice('pipeline-'.length)
                        : runId
                      const runOpen = activeId === resourceTabId(run.ref)
                      return (
                        <li key={run.ref}>
                          <button
                            type="button"
                            className={cn(
                              'flex h-7 w-full min-w-0 items-center gap-1.5 rounded-sm py-0 pr-1.5 pl-8 text-left font-mono text-xs',
                              runOpen
                                ? 'bg-accent text-accent-foreground'
                                : 'hover:bg-surface-hover',
                            )}
                            onClick={() => {
                              selectResource(run.ref)
                              openResourceTab(run.ref)
                            }}
                          >
                            <KindIcon kind="run" className="size-3.5" />
                            <span className="min-w-0 truncate">{shortId}</span>
                            <span className="grow" />
                            <PhaseBadge phase={run.phase} className="shrink-0" />
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
