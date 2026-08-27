import { useStore } from '@nanostores/react'
import { ChevronDownIcon, ChevronRightIcon, LockIcon, SearchIcon } from 'lucide-react'
import { atom, computed, type ReadableAtom } from 'nanostores'
import { useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { client, type View } from '@/client'
import { FileIcon } from '@/components/files/FileIcon'
import { KindIcon } from '@/components/resources/tree/KindIcon'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import {
  flattenFileTree,
  pipelineSources,
  sourcesToWatch,
  type FileTreeRowVM,
  type SourceFilesView,
} from '@/helpers/fileTree'
import { useTreeNavigation } from '@/hooks/useTreeNavigation'
import { cn } from '@/lib/utils'
import type { ListFilesResponse } from '@/proto/management/v1/source_pb'
import { useParams } from '@/router'
import { setBreadcrumbs, type Crumb } from '@/stores/breadcrumbsStore'
import { $filesExpanded, $filesFilter, toggleFilesExpanded } from '@/stores/filesTreeStore'
import { $selection, selectResource } from '@/stores/selectionStore'

// Subscribes the file listings of a DYNAMIC set of sources: expanding
// a source is what starts its watch, collapsing (plus linger) stops
// it. Hook order stays stable — one combined computed store.
function useFilesViews(refs: string[]): Map<string, SourceFilesView> {
  const refsKey = refs.join('\n')
  const combined = useMemo((): ReadableAtom<View<ListFilesResponse | null>[]> => {
    const list = refsKey === '' ? [] : refsKey.split('\n')
    if (list.length === 0) return atom([])
    return computed(
      list.map((r) => client.stores.files(r)),
      (...views) => views,
    )
  }, [refsKey])
  const views = useStore(combined)
  const map = new Map<string, SourceFilesView>()
  const list = refsKey === '' ? [] : refsKey.split('\n')
  list.forEach((ref, i) => {
    const view = views[i]
    if (view !== undefined) map.set(ref, view)
  })
  return map
}

// The Files panel: pipeline → source → files, so writing starts from
// the pipeline you are thinking about. v1 is browse-only.
export function FileTreePanel() {
  const { t } = useTranslation()
  const tree = useStore(client.stores.tree())
  const expanded = useStore($filesExpanded)
  const filter = useStore($filesFilter)
  const selection = useStore($selection)
  const filterRef = useRef<HTMLInputElement | null>(null)

  const expandedSet = useMemo(() => new Set(expanded), [expanded])
  const watchRefs = useMemo(
    () => sourcesToWatch(tree.data, expandedSet, filter),
    [tree.data, expandedSet, filter],
  )
  const filesBySource = useFilesViews(watchRefs)

  const rows = useMemo(
    () => flattenFileTree(tree.data, expandedSet, filter, filesBySource),
    [tree.data, expandedSet, filter, filesBySource],
  )

  const { ns } = useParams()
  const nav = useTreeNavigation<FileTreeRowVM>({
    rows,
    onToggle: toggleFilesExpanded,
    onPrimary: (row) => {
      if (row.hasChildren) toggleFilesExpanded(row.key)
      if (row.type === 'pipeline' || row.type === 'source') selectResource(row.ref)
    },
    onFocusFilter: () => filterRef.current?.focus(),
  })

  // This panel owns the footer trail while it is the left surface:
  // namespace › pipeline › source › path, following the active row.
  useEffect(() => {
    if (ns === undefined) return
    const crumbs: Crumb[] = [{ id: 'ns', label: ns }]
    const key = nav.activeKey
    if (key !== null) {
      const colon = key.indexOf(':')
      const sourceRef = colon === -1 ? key : key.slice(0, colon)
      const path = colon === -1 ? '' : key.slice(colon + 1)
      // The pipeline the active source (or pipeline itself) belongs to.
      const byPipeline = pipelineSources(tree.data)
      let pipelineRef: string | null = null
      for (const [pipeline, sources] of byPipeline) {
        if (pipeline === key) pipelineRef = pipeline
        else if (sources.includes(sourceRef)) pipelineRef = pipeline
        if (pipelineRef !== null) break
      }
      if (pipelineRef !== null) crumbs.push({ id: pipelineRef, label: pipelineRef })
      if (pipelineRef !== key && sourceRef.includes('/')) {
        crumbs.push({ id: sourceRef, label: sourceRef })
      }
      if (path !== '' && !path.startsWith('@')) {
        const isFile = rows.some((r) => r.key === key && r.type === 'file')
        const parts = path.replace(/\/$/, '').split('/')
        let prefix = ''
        parts.forEach((part, idx) => {
          prefix = prefix === '' ? part : `${prefix}/${part}`
          crumbs.push({
            id: `${sourceRef}:${prefix}`,
            label: part,
            file: isFile && idx === parts.length - 1 ? part : undefined,
          })
        })
      }
    }
    setBreadcrumbs(crumbs)
  }, [ns, nav.activeKey, tree.data, rows])

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 p-2">
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={filterRef}
            value={filter}
            onChange={(e) => $filesFilter.set(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault()
                if (filter !== '') $filesFilter.set('')
                else if (nav.activeKey !== null) nav.focusRow(nav.activeKey)
                else if (rows.length > 0) nav.focusRow(rows[0].key)
              }
            }}
            placeholder={t('graphene.files.filter')}
            aria-label={t('graphene.files.filter')}
            className="h-7 pl-7 font-mono text-xs"
          />
        </div>
      </div>
      <div
        role="tree"
        aria-label={t('graphene.workspace.panels.files')}
        className="min-h-0 flex-1 select-none overflow-y-auto px-1 pb-2"
        onKeyDown={nav.handleKeyDown}
      >
        {!tree.loaded && tree.error === null && (
          <div className="flex justify-center py-6">
            <Spinner className="size-4" />
          </div>
        )}
        {tree.loaded && rows.length === 0 && (
          <p className="px-2 py-4 text-xs text-muted-foreground">
            {filter.trim() !== '' ? t('graphene.files.noMatch') : t('graphene.files.empty')}
          </p>
        )}
        {rows.map((row, index) => (
          <FileTreeRow
            key={row.key}
            row={row}
            isSelected={
              (row.type === 'pipeline' || row.type === 'source') && selection === row.ref
            }
            isActive={index === nav.activeIndex}
            rowRef={nav.registerRow(row.key)}
            onActivate={(r) => {
              nav.setActiveKey(r.key)
              if (r.type === 'pipeline' || r.type === 'source') selectResource(r.ref)
            }}
            onToggle={toggleFilesExpanded}
          />
        ))}
      </div>
    </div>
  )
}

interface FileTreeRowProps {
  row: FileTreeRowVM
  isSelected: boolean
  isActive: boolean
  rowRef: (el: HTMLElement | null) => void
  onActivate: (row: FileTreeRowVM) => void
  onToggle: (key: string, open?: boolean) => void
}

function FileTreeRow({ row, isSelected, isActive, rowRef, onActivate, onToggle }: FileTreeRowProps) {
  const { t } = useTranslation()

  if (row.type === 'note') {
    return (
      <div
        className="flex h-6 items-center gap-2 pr-2 font-mono text-2xs text-muted-foreground"
        style={{ paddingLeft: `calc(${row.depth} * var(--tree-indent) + var(--tree-pad))` }}
      >
        {row.note === 'loading' ? (
          <>
            <Spinner className="size-3" />
            {t('graphene.files.loading')}
          </>
        ) : (
          <span className="text-destructive">{t('graphene.files.error')}</span>
        )}
      </div>
    )
  }

  return (
    // Keys live on the role=tree container (shared navigation hook).
    // biome-ignore lint/a11y/useKeyWithClickEvents: keys live on the role=tree container.
    <div
      ref={rowRef}
      role="treeitem"
      aria-level={row.depth + 1}
      aria-selected={isSelected || undefined}
      aria-expanded={row.hasChildren ? row.isExpanded : undefined}
      tabIndex={isActive ? 0 : -1}
      className={cn(
        'flex h-6 min-w-0 cursor-pointer items-center gap-1 rounded-sm pr-2 font-mono text-xs outline-none',
        'focus-visible:ring-2 focus-visible:ring-ring',
        isSelected ? 'bg-accent text-accent-foreground' : 'hover:bg-surface-hover',
      )}
      style={{ paddingLeft: `calc(${row.depth} * var(--tree-indent) + var(--tree-pad))` }}
      onClick={() => onActivate(row)}
      onDoubleClick={() => {
        if (row.hasChildren) onToggle(row.key)
      }}
    >
      {row.hasChildren ? (
        <button
          type="button"
          tabIndex={-1}
          aria-hidden="true"
          className="flex size-4 shrink-0 items-center justify-center text-muted-foreground"
          onClick={(e) => {
            e.stopPropagation()
            onToggle(row.key)
          }}
        >
          {row.isExpanded ? (
            <ChevronDownIcon className="size-3.5" />
          ) : (
            <ChevronRightIcon className="size-3.5" />
          )}
        </button>
      ) : (
        <span className="size-4 shrink-0" />
      )}
      {row.type === 'pipeline' && (
        <>
          <KindIcon kind="pipeline" />
          <span className="flex min-w-0 grow items-baseline">
            <span className="text-muted-foreground">pipeline/</span>
            <span className="truncate">{row.id}</span>
          </span>
        </>
      )}
      {row.type === 'source' && (
        <>
          <KindIcon kind={row.kind} />
          <span className="flex min-w-0 grow items-baseline">
            <span className="text-muted-foreground">{row.kind}/</span>
            <span className="truncate">{row.id}</span>
          </span>
          {row.readOnly && (
            <LockIcon
              className="size-3 shrink-0 text-muted-foreground"
              aria-label={t('graphene.files.readOnly')}
            />
          )}
        </>
      )}
      {row.type === 'dir' && (
        <>
          <FileIcon />
          <span className="min-w-0 grow truncate">{row.name}</span>
        </>
      )}
      {row.type === 'file' && (
        <>
          <FileIcon name={row.name} />
          <span className="min-w-0 grow truncate">{row.name}</span>
          <span className="shrink-0 text-2xs text-muted-foreground">{humanSize(row.size)}</span>
        </>
      )}
    </div>
  )
}

function humanSize(size: number): string {
  if (size < 1024) return `${size}B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)}K`
  return `${(size / (1024 * 1024)).toFixed(1)}M`
}
