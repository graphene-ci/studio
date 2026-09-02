import { useStore } from '@nanostores/react'
import { NetworkIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'
import { $editorTabs, openTopologyTab, TOPOLOGY_TAB_ID } from '@/stores/editorTabsStore'

// The Topology panel — a single entry into the namespace data-flow
// graph (one central tab per namespace). Mirrors the Pipelines panel:
// the left surface launches the central view.
export function TopologyPanel() {
  const { t } = useTranslation()
  const { activeId } = useStore($editorTabs)
  const isOpen = activeId === TOPOLOGY_TAB_ID

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-1 py-2">
        <button
          type="button"
          className={cn(
            'flex h-7 w-full min-w-0 items-center gap-1.5 rounded-sm px-2 text-left font-mono text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring',
            isOpen ? 'bg-accent text-accent-foreground' : 'hover:bg-surface-hover',
          )}
          onClick={() => openTopologyTab()}
        >
          <NetworkIcon className="size-3.5 shrink-0" />
          <span className="min-w-0 truncate">{t('graphene.topology.graph')}</span>
        </button>
      </div>
      <p className="shrink-0 border-t border-border px-3 py-2 text-2xs text-muted-foreground">
        {t('graphene.topology.declared')}
      </p>
    </div>
  )
}
