import { useStore } from '@nanostores/react'
import { SearchIcon } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { client } from '@/client'
import { KindIcon } from '@/components/resources/tree/KindIcon'
import { PhaseText } from '@/components/status/PhaseText'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'
import { openPipelineTab, pipelineTabId, $editorTabs } from '@/stores/editorTabsStore'
import { selectResource } from '@/stores/selectionStore'

// The Pipelines panel — the CI entry point: every pipeline of the
// namespace, live; opening one lands in its HUB tab in the center
// (the resource view stays a separate, generic surface).
export function PipelinesPanel() {
  const { t } = useTranslation()
  const view = useStore(client.stores.listing('kind=pipeline'))
  const { activeId } = useStore($editorTabs)
  const [filter, setFilter] = useState('')

  const rows = useMemo(() => {
    const needle = filter.trim().toLowerCase()
    return [...view.data]
      .filter((r) => needle === '' || r.ref.toLowerCase().includes(needle))
      .sort((a, b) => a.ref.localeCompare(b.ref))
  }, [view.data, filter])

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
          <p className="px-2 py-4 text-xs text-muted-foreground">
            {t('graphene.pipelines.empty')}
          </p>
        )}
        <ul className="flex flex-col">
          {rows.map((pipeline) => {
            const id = pipeline.ref.slice(pipeline.ref.indexOf('/') + 1)
            const isOpen = activeId === pipelineTabId(id)
            return (
              <li key={pipeline.ref}>
                <button
                  type="button"
                  className={cn(
                    'flex h-7 w-full min-w-0 items-center gap-1.5 rounded-sm px-1.5 text-left font-mono text-xs',
                    isOpen ? 'bg-accent text-accent-foreground' : 'hover:bg-surface-hover',
                  )}
                  onClick={() => {
                    selectResource(pipeline.ref)
                    openPipelineTab(id)
                  }}
                >
                  <KindIcon kind="pipeline" className="size-3.5" />
                  <span className="min-w-0 truncate">{id}</span>
                  <span className="grow" />
                  <PhaseText phase={pipeline.phase} className="text-2xs" />
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
