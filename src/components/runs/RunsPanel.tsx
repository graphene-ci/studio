import { useStore } from '@nanostores/react'
import { SearchIcon } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { client } from '@/client'
import { KindIcon } from '@/components/resources/tree/KindIcon'
import { PhaseBadge } from '@/components/status/PhaseBadge'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { timestampMs } from '@/helpers/describe'
import { cn } from '@/lib/utils'
import { $editorTabs, openResourceTab, resourceTabId } from '@/stores/editorTabsStore'
import { selectResource } from '@/stores/selectionStore'

// The Runs panel — a run is first-class navigation: every run of the
// namespace, live, newest first; opening one lands in its resource tab
// in the center (the one central view, with run sub-tabs: Plan /
// Children). The synthetic graphene.io/pipeline label names its origin.
export function RunsPanel() {
  const { t } = useTranslation()
  const view = useStore(client.stores.listing('kind=run'))
  const { activeId } = useStore($editorTabs)
  const [filter, setFilter] = useState('')

  const rows = useMemo(() => {
    const needle = filter.trim().toLowerCase()
    return [...view.data]
      .filter((r) => needle === '' || r.ref.toLowerCase().includes(needle))
      .sort((a, b) => {
        const byTime = (timestampMs(b.startedAt) ?? 0) - (timestampMs(a.startedAt) ?? 0)
        return byTime !== 0 ? byTime : b.ref.localeCompare(a.ref)
      })
  }, [view.data, filter])

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 p-2">
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder={t('graphene.runs.pipelineFilter')}
            aria-label={t('graphene.runs.pipelineFilter')}
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
          <p className="px-2 py-4 text-xs text-muted-foreground">
            {t('graphene.runs.emptyNoFilters')}
          </p>
        )}
        <ul className="flex flex-col">
          {rows.map((run) => {
            const id = run.ref.slice(run.ref.indexOf('/') + 1)
            const pipeline = run.labels['graphene.io/pipeline'] ?? ''
            const isOpen = activeId === resourceTabId(run.ref)
            return (
              <li key={run.ref}>
                <button
                  type="button"
                  className={cn(
                    'flex h-8 w-full min-w-0 items-center gap-1.5 rounded-sm px-1.5 text-left font-mono text-xs',
                    isOpen ? 'bg-accent text-accent-foreground' : 'hover:bg-surface-hover',
                  )}
                  onClick={() => {
                    selectResource(run.ref)
                    openResourceTab(run.ref)
                  }}
                >
                  <KindIcon kind="run" className="size-3.5" />
                  <span className="flex min-w-0 grow flex-col">
                    <span className="min-w-0 truncate">{id}</span>
                    {pipeline !== '' && (
                      <span className="min-w-0 truncate text-3xs text-muted-foreground">
                        {pipeline}
                      </span>
                    )}
                  </span>
                  <PhaseBadge phase={run.phase} className="shrink-0" />
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
