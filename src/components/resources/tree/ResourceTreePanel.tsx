import { useStore } from '@nanostores/react'
import { SearchIcon } from 'lucide-react'
import { useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { client } from '@/client'
import { TreeRow } from '@/components/resources/tree/TreeRow'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { findAncestry, flattenTree, type TreeRowVM } from '@/helpers/resourceTree'
import { useTreeNavigation } from '@/hooks/useTreeNavigation'
import { useParams } from '@/router'
import { setBreadcrumbs } from '@/stores/breadcrumbsStore'
import { $selection, selectResource } from '@/stores/selectionStore'
import { $treeExpanded, $treeFilter, toggleTreeExpanded } from '@/stores/treeStore'

// The left-panel resource tree: kind groups at every level (roots are
// kind groups; a group opens into records; a record opens into the
// kind groups of its children). Live by subscription — rendering the
// panel IS what starts the watch. Keyboard: shared tree navigation
// (useTreeNavigation), "/" focuses the filter, Esc returns.
export function ResourceTreePanel() {
  const { t } = useTranslation()
  const view = useStore(client.stores.tree())
  const expanded = useStore($treeExpanded)
  const filter = useStore($treeFilter)
  const selection = useStore($selection)
  const filterRef = useRef<HTMLInputElement | null>(null)
  const { ns } = useParams()

  // This panel owns the footer trail while it is the left surface:
  // namespace › the ownership chain down to the selected record.
  useEffect(() => {
    if (ns === undefined) return
    const chain = selection === null ? null : findAncestry(view.data, selection)
    setBreadcrumbs([
      { id: 'ns', label: ns },
      ...(chain ?? (selection === null ? [] : [selection])).map((ref) => ({
        id: ref,
        label: ref,
      })),
    ])
  }, [ns, selection, view.data])

  const expandedSet = useMemo(() => new Set(expanded), [expanded])
  const rows = useMemo(
    () => flattenTree(view.data, expandedSet, filter),
    [view.data, expandedSet, filter],
  )

  const nav = useTreeNavigation<TreeRowVM>({
    rows,
    onToggle: toggleTreeExpanded,
    onPrimary: (row) => {
      if (row.type === 'group') toggleTreeExpanded(row.key)
      else selectResource(row.ref)
    },
    onFocusFilter: () => filterRef.current?.focus(),
  })

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 p-2">
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={filterRef}
            value={filter}
            onChange={(e) => $treeFilter.set(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault()
                if (filter !== '') $treeFilter.set('')
                else if (nav.activeKey !== null) nav.focusRow(nav.activeKey)
                else if (rows.length > 0) nav.focusRow(rows[0].key)
              }
            }}
            placeholder={t('graphene.resources.treeFilter')}
            aria-label={t('graphene.resources.treeFilter')}
            className="h-7 pl-7 font-mono text-xs"
          />
        </div>
      </div>
      <div
        role="tree"
        aria-label={t('graphene.workspace.panels.resources')}
        className="min-h-0 flex-1 select-none overflow-y-auto px-1 pb-2"
        onKeyDown={nav.handleKeyDown}
      >
        {!view.loaded && view.error === null && (
          <div className="flex justify-center py-6">
            <Spinner className="size-4" />
          </div>
        )}
        {view.error !== null && !view.loaded && (
          <p className="px-2 py-4 text-xs text-destructive">{t('graphene.resources.treeError')}</p>
        )}
        {view.loaded && rows.length === 0 && (
          <p className="px-2 py-4 text-xs text-muted-foreground">
            {filter.trim() !== ''
              ? t('graphene.resources.treeNoMatch')
              : t('graphene.resources.empty')}
          </p>
        )}
        {rows.map((row, index) => (
          <TreeRow
            key={row.key}
            row={row}
            isSelected={row.type === 'record' && selection === row.ref}
            isActive={index === nav.activeIndex}
            rowRef={nav.registerRow(row.key)}
            onActivate={(r) => {
              nav.setActiveKey(r.key)
              if (r.type === 'record') selectResource(r.ref)
            }}
            onToggle={toggleTreeExpanded}
          />
        ))}
      </div>
    </div>
  )
}
