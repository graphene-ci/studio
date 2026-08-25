import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ListIcon,
  NetworkIcon,
  RefreshCwIcon,
  XIcon,
} from 'lucide-react'
import { Fragment, useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  ExpandChevron,
  RESOURCE_COLSPAN,
  RESOURCE_TD,
  ResourceTailCells,
} from '@/components/resources/ResourceRows'
import { ResourceInspector } from '@/components/resources/ResourceInspector'
import { SelectorInput } from '@/components/SelectorInput'
import { ColumnHeader, TextFilter } from '@/components/runs/ColumnHeader'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import {
  PAGE_SIZES,
  POLL_OPTIONS_MS,
  eqOf,
  formatTerms,
  parseTableParams,
  tableParamsToSearch,
  tryParseQ,
  withEq,
  type TableUrlState,
} from '@/helpers/runsFilters'
import type { SelectorTerm } from '@/helpers/selector'
import { useResourcesQuery, type ResourceTreeNode } from '@/hooks/useResourcesQuery'
import { cn } from '@/lib/utils'
import { useSearchParams } from '@/router'

const DEFAULT_Q = ''

const TH_CLASS =
  'sticky top-0 z-10 bg-card px-3 py-2 text-left text-xs font-medium text-muted-foreground'

function EmptyRow({ loading }: { loading: boolean }) {
  const { t } = useTranslation()
  return (
    <tr>
      <td colSpan={RESOURCE_COLSPAN} className="h-32 px-3 text-center align-middle">
        <span className="inline-flex items-center gap-2 font-mono text-xs text-muted-foreground">
          {loading ? (
            <>
              <Spinner className="size-3.5" />
              {t('graphene.resources.loading')}
            </>
          ) : (
            t('graphene.resources.empty')
          )}
        </span>
      </td>
    </tr>
  )
}

interface RowsProps {
  now: Date
  expandedRef: string | null
  onExpand: (ref: string) => void
}

function TreeRows({
  node,
  depth,
  now,
  expandedRef,
  onExpand,
}: RowsProps & { node: ResourceTreeNode; depth: number }) {
  const { t } = useTranslation()
  const [collapsed, setCollapsed] = useState(false)
  const r = node.resource

  return (
    <>
      <tr
        className="group/row cursor-pointer"
        onClick={(event) => {
          const target = event.target as HTMLElement
          if (target.closest('button, a, input') !== null) return
          onExpand(r.ref)
        }}
      >
        <td className={RESOURCE_TD} style={{ paddingLeft: `${12 + depth * 20}px` }}>
          <span className="flex items-center gap-1">
            {node.children.length > 0 ? (
              <ExpandChevron
                expanded={!collapsed}
                onToggle={() => setCollapsed((c) => !c)}
                label={t('graphene.resources.toggleChildren', { ref: r.ref })}
              />
            ) : (
              <span className="size-4" aria-hidden />
            )}
            <span className="font-mono text-xs">{r.ref}</span>
          </span>
        </td>
        <ResourceTailCells r={r} now={now} />
      </tr>
      {!collapsed &&
        node.children.map((child) => (
          <TreeRows
            key={child.resource.ref}
            node={child}
            depth={depth + 1}
            now={now}
            expandedRef={expandedRef}
            onExpand={onExpand}
          />
        ))}
    </>
  )
}

export function ResourcesPage() {
  const { t } = useTranslation()
  const [searchParams, setSearchParams] = useSearchParams()
  const state = useMemo(() => parseTableParams(searchParams, DEFAULT_Q), [searchParams])
  // The ownership TREE is the default lens on resources.
  const view = searchParams.get('view') === 'table' ? 'table' : 'tree'
  const parsed = useMemo(
    () =>
      state.q.trim() === '' ? { terms: [] as SelectorTerm[], error: null } : tryParseQ(state.q),
    [state.q],
  )
  const [openFilterColumnId, setOpenFilterColumnId] = useState<string | null>(null)
  const [expandedRef, setExpandedRef] = useState<string | null>(null)
  const now = useMemo(() => new Date(), [])

  const patch = useCallback(
    (p: Partial<TableUrlState>, nextView?: 'table' | 'tree') => {
      const sp = tableParamsToSearch({ ...state, ...p }, DEFAULT_Q)
      if ((nextView ?? view) === 'table') sp.set('view', 'table')
      setSearchParams(sp, { replace: true })
    },
    [state, view, setSearchParams],
  )
  const patchTerms = useCallback(
    (edit: (terms: SelectorTerm[]) => SelectorTerm[]) => {
      if (parsed.terms === null) return
      patch({ q: formatTerms(edit(parsed.terms)) })
    },
    [parsed, patch],
  )

  const query = useResourcesQuery(
    view,
    parsed.terms === null ? null : state.q.trim(),
    state.size,
    state.pollMs,
    openFilterColumnId !== null,
  )
  const terms = parsed.terms ?? []
  const hasActiveFilters = terms.length > 0

  const onFilterOpenChange = useCallback((columnId: string, open: boolean) => {
    setOpenFilterColumnId((current) => (open ? columnId : current === columnId ? null : current))
  }, [])
  const onExpand = useCallback(
    (ref: string) => setExpandedRef((current) => (current === ref ? null : ref)),
    [],
  )
  const headerProps = { openColumnId: openFilterColumnId, onOpenChange: onFilterOpenChange }

  const textColumn = (columnId: 'kind' | 'phase' | 'owner', label: string) =>
    view === 'table' ? (
      <ColumnHeader
        label={label}
        columnId={columnId}
        filterActive={eqOf(terms, columnId) !== ''}
        {...headerProps}
      >
        <TextFilter
          value={eqOf(terms, columnId)}
          placeholder={t(`graphene.resources.${columnId}Filter`)}
          onCommit={(value) => patchTerms((ts) => withEq(ts, columnId, value))}
        />
      </ColumnHeader>
    ) : (
      <ColumnHeader label={label} {...headerProps} />
    )

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2.5 p-3">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-sm font-semibold">{t('graphene.nav.resources')}</h1>
        <span className="flex rounded-md bg-muted p-0.5">
          {(['tree', 'table'] as const).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={view === v}
              className={cn(
                'flex h-6 items-center gap-1 rounded-sm px-2 text-xs',
                view === v ? 'bg-card text-foreground' : 'text-muted-foreground',
              )}
              onClick={() => patch({}, v)}
            >
              {v === 'table' ? <ListIcon className="size-3" /> : <NetworkIcon className="size-3" />}
              {t(`graphene.resources.view.${v}`)}
            </button>
          ))}
        </span>
        {view === 'table' && (
          <SelectorInput
            value={state.q}
            committedError={parsed.error}
            onCommit={(q) => patch({ q })}
            allowEmpty
          />
        )}
        <Button
          variant="outline"
          size="sm"
          className={cn((view !== 'table' || !hasActiveFilters) && 'invisible')}
          onClick={() => patch({ q: DEFAULT_Q })}
        >
          <XIcon />
          {t('graphene.runs.clearFilters')}
        </Button>
        <span
          className={cn(
            'flex items-center gap-1 font-mono text-2xs text-primary',
            !query.refreshing && 'invisible',
          )}
        >
          <Spinner className="size-3" />
          {t('graphene.runs.updating')}
        </span>
        <span className="grow" />
        <span className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="icon-sm"
            aria-label={t('graphene.runs.refresh')}
            disabled={query.refreshing}
            onClick={query.refresh}
          >
            <RefreshCwIcon className={cn('size-3', query.refreshing && 'animate-spin')} />
          </Button>
          <span className="flex gap-0.5">
            {POLL_OPTIONS_MS.map((ms) => (
              <button
                key={ms}
                type="button"
                className={cn(
                  'flex h-6 items-center rounded-sm px-1.5 font-mono text-2xs',
                  state.pollMs === ms
                    ? 'bg-accent text-primary'
                    : 'text-muted-foreground hover:text-foreground',
                )}
                onClick={() => patch({ pollMs: ms })}
              >
                {ms === 0 ? t('graphene.runs.pollOff') : `${ms / 1000}s`}
              </button>
            ))}
          </span>
        </span>
      </div>

      {query.error !== null && (
        <div className="rounded-md bg-status-failed-bg p-3 font-mono text-xs text-status-failed">
          {query.error}
        </div>
      )}

      <div className="flex min-h-0 flex-1 gap-3">
        <div className="scrollbar-stable min-h-0 flex-1 overflow-auto rounded-md bg-card">
          <table className="w-full table-auto border-separate border-spacing-0 text-sm">
            <thead>
              <tr>
                <th className={TH_CLASS}>
                  <ColumnHeader label={t('graphene.resources.colRef')} {...headerProps} />
                </th>
                <th className={TH_CLASS}>{textColumn('kind', t('graphene.resources.colKind'))}</th>
                <th className={TH_CLASS}>
                  {textColumn('phase', t('graphene.resources.colPhase'))}
                </th>
                <th className={TH_CLASS}>
                  {textColumn('owner', t('graphene.resources.colOwner'))}
                </th>
                <th className={TH_CLASS}>
                  <ColumnHeader label={t('graphene.runs.colLabels')} {...headerProps} />
                </th>
                <th className={TH_CLASS}>
                  <ColumnHeader label={t('graphene.runs.colStarted')} {...headerProps} />
                </th>
              </tr>
            </thead>
            <tbody>
              {view === 'tree' ? (
                query.roots.length > 0 ? (
                  query.roots.map((node) => (
                    <TreeRows
                      key={node.resource.ref}
                      node={node}
                      depth={0}
                      now={now}
                      expandedRef={expandedRef}
                      onExpand={onExpand}
                    />
                  ))
                ) : (
                  <EmptyRow loading={query.loading} />
                )
              ) : query.resources.length > 0 ? (
                query.resources.map((r) => (
                  <Fragment key={r.ref}>
                    <tr
                      className="group/row cursor-pointer"
                      onClick={(event) => {
                        const target = event.target as HTMLElement
                        if (target.closest('button, a, input') !== null) return
                        onExpand(r.ref)
                      }}
                    >
                      <td className={RESOURCE_TD}>
                        <span className="font-mono text-xs">{r.ref}</span>
                      </td>
                      <ResourceTailCells r={r} now={now} />
                    </tr>
                  </Fragment>
                ))
              ) : (
                <EmptyRow loading={query.loading} />
              )}
            </tbody>
          </table>
        </div>
        {expandedRef !== null && (
          <ResourceInspector refId={expandedRef} onClose={() => setExpandedRef(null)} />
        )}
      </div>

      {view === 'table' && (
        <div className="mt-auto flex items-center justify-between">
          <span className="flex items-center gap-2">
            <span className="font-mono text-2xs text-muted-foreground">
              {t('graphene.runs.rows')}
            </span>
            <span className="flex gap-0.5">
              {PAGE_SIZES.map((size) => (
                <button
                  key={size}
                  type="button"
                  className={cn(
                    'rounded-sm px-2 py-0.5 font-mono text-2xs',
                    state.size === size
                      ? 'bg-accent text-foreground'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                  onClick={() => patch({ size })}
                >
                  {size}
                </button>
              ))}
            </span>
          </span>
          <span className="flex items-center gap-1">
            <span className="px-2 font-mono text-2xs text-muted-foreground tabular-nums">
              {t('graphene.runs.page', { page: query.pageIndex + 1 })}
            </span>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t('graphene.runs.prevPage')}
              disabled={!query.hasPrev}
              onClick={query.goPrev}
            >
              <ChevronLeftIcon />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t('graphene.runs.nextPage')}
              disabled={!query.hasNext}
              onClick={query.goNext}
            >
              <ChevronRightIcon />
            </Button>
          </span>
        </div>
      )}
    </div>
  )
}
