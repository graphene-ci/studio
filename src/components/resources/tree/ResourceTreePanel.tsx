import { useStore } from '@nanostores/react'
import { SearchIcon } from 'lucide-react'
import { atom, computed } from 'nanostores'
import { useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { client } from '@/client'
import { TreeRow } from '@/components/resources/tree/TreeRow'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import {
  findAncestry,
  flattenTree,
  type SourceFilesView,
  type TreeRowVM,
} from '@/helpers/resourceTree'
import { useTreeNavigation } from '@/hooks/useTreeNavigation'
import type { TreeNode } from '@/proto/management/v1/resources_pb'
import { useParams } from '@/router'
import { setBreadcrumbs } from '@/stores/breadcrumbsStore'
import { openFileTab, openResourceTab } from '@/stores/editorTabsStore'
import { $selection, selectResource } from '@/stores/selectionStore'
import { $treeExpanded, $treeFilter, toggleTreeExpanded } from '@/stores/treeStore'

/** Every gitsource ref in the ownership tree (files live under it). */
function collectGitsourceRefs(roots: TreeNode[]): string[] {
  const out: string[] = []
  const walk = (nodes: TreeNode[]) => {
    for (const node of nodes) {
      if (node.resource?.kind === 'gitsource' && node.resource.ref !== '') {
        out.push(node.resource.ref)
      }
      walk(node.children)
    }
  }
  walk(roots)
  return out
}

// Live file listings for a dynamic set of gitsources — subscribing is
// what starts each ListFiles watch (dropped when the source collapses).
function useSourceFiles(refs: string[]): ReadonlyMap<string, SourceFilesView> {
  const refsKey = [...refs].sort().join('\n')
  const combined = useMemo(() => {
    const list = refsKey === '' ? [] : refsKey.split('\n')
    if (list.length === 0) return atom<ReadonlyMap<string, SourceFilesView>>(new Map())
    return computed(
      list.map((ref) => client.stores.files(ref)),
      (...views) => {
        const map = new Map<string, SourceFilesView>()
        list.forEach((ref, i) => {
          const v = views[i]
          map.set(ref, { loaded: v.loaded, error: v.error, data: v.data })
        })
        return map
      },
    )
  }, [refsKey])
  return useStore(combined)
}

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
  // Watch the file listing of every EXPANDED gitsource (only those —
  // collapsing a source releases its watch).
  const watchedSources = useMemo(
    () => collectGitsourceRefs(view.data).filter((ref) => expandedSet.has(ref)),
    [view.data, expandedSet],
  )
  const filesBySource = useSourceFiles(watchedSources)
  const rows = useMemo(
    () => flattenTree(view.data, expandedSet, filter, filesBySource),
    [view.data, expandedSet, filter, filesBySource],
  )

  // Gestures: single click/Space — select + expand; double click or
  // Enter — open the record in the center.
  const nav = useTreeNavigation<TreeRowVM>({
    rows,
    onToggle: toggleTreeExpanded,
    onPrimary: (row) => {
      switch (row.type) {
        case 'record':
          selectResource(row.ref)
          openResourceTab(row.ref)
          break
        case 'file':
          openFileTab({ sourceRef: row.sourceRef, path: row.path, name: row.name, readOnly: true })
          break
        default:
          toggleTreeExpanded(row.key)
      }
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
              switch (r.type) {
                case 'record':
                  selectResource(r.ref)
                  if (r.hasChildren) toggleTreeExpanded(r.key)
                  break
                case 'file':
                  openFileTab({
                    sourceRef: r.sourceRef,
                    path: r.path,
                    name: r.name,
                    readOnly: true,
                  })
                  break
                case 'note':
                  break
                default:
                  toggleTreeExpanded(r.key)
              }
            }}
            onToggle={toggleTreeExpanded}
            onOpen={openResourceTab}
          />
        ))}
      </div>
    </div>
  )
}
