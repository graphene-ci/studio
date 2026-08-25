import { useStore } from '@nanostores/react'
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from '@tanstack/react-table'
import { StarIcon } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { ChecklistFilter, ColumnHeader, TextFilter } from '@/components/runs/ColumnHeader'
import { TriggerChip } from '@/components/runs/TriggerChip'
import { RunStatusBadge } from '@/components/status/RunStatusBadge'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import { RUN_STATUSES, STARTED_WINDOWS } from '@/helpers/runsFilters'
import { formatRelative } from '@/helpers/relativeTime'
import { formatDuration, type RunVM } from '@/helpers/runVM'
import { cn } from '@/lib/utils'
import { $favorites, toggleFavorite } from '@/stores/favoritesStore'

const COLUMN_WIDTHS: Record<string, string> = {
  favorite: '3%',
  id: '14%',
  pipeline: '15%',
  trigger: '13%',
  status: '15%',
  started: '9%',
  duration: '8%',
  owns: '5%',
  labels: '18%',
}

// Grouped header bands (stroppy-ref): RUN | EXECUTION | OWNERSHIP.
const HEADER_GROUPS = [
  { key: 'run', span: 4 },
  { key: 'execution', span: 3 },
  { key: 'ownership', span: 2 },
] as const

// Column-filter view: values extracted from the q-selector terms plus
// setters that rewrite them (the language stays the source of truth).
export interface RunsFilterView {
  statuses: string[]
  pipeline: string
  started: string
  favoritesOnly: boolean
  onStatuses: (statuses: string[]) => void
  onPipeline: (pipeline: string) => void
  onStarted: (window: string) => void
}

interface RunsTableProps {
  runs: RunVM[]
  loading: boolean
  hasActiveFilters: boolean
  filters: RunsFilterView
  openFilterColumnId: string | null
  onFilterOpenChange: (columnId: string, open: boolean) => void
  ownsCounts: Record<string, number>
  selectedId: string | null
  onSelect: (run: RunVM) => void
}

export function RunsTable({
  runs,
  loading,
  hasActiveFilters,
  filters,
  openFilterColumnId,
  onFilterOpenChange,
  ownsCounts,
  selectedId,
  onSelect,
}: RunsTableProps) {
  const { t } = useTranslation()
  const favorites = useStore($favorites)
  const now = new Date()

  // Favorites partition the CURRENT page: starred rows first.
  const rows = useMemo(() => {
    const visible = filters.favoritesOnly ? runs.filter((r) => r.ref in favorites) : runs
    return [...visible].sort((a, b) => Number(b.ref in favorites) - Number(a.ref in favorites))
  }, [runs, favorites, filters.favoritesOnly])

  const headerProps = useMemo(
    () => ({ openColumnId: openFilterColumnId, onOpenChange: onFilterOpenChange }),
    [openFilterColumnId, onFilterOpenChange],
  )

  const columns = useMemo<ColumnDef<RunVM>[]>(
    () => [
      {
        id: 'favorite',
        header: () => <span className="block w-4" aria-hidden />,
        cell: ({ row }) => {
          const starred = row.original.ref in favorites
          return (
            <button
              type="button"
              aria-label={t('graphene.runs.toggleFavorite')}
              aria-pressed={starred}
              className="flex size-5 items-center justify-center"
              onClick={() => toggleFavorite(row.original.ref)}
            >
              <StarIcon
                className={cn(
                  'size-3',
                  starred
                    ? 'fill-status-warning text-status-warning'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              />
            </button>
          )
        },
      },
      {
        id: 'id',
        header: () => <ColumnHeader label={t('graphene.runs.colRun')} {...headerProps} />,
        cell: ({ row }) => <span className="font-mono text-xs">{row.original.id}</span>,
      },
      {
        id: 'pipeline',
        header: () => (
          <ColumnHeader
            label={t('graphene.runs.colPipeline')}
            columnId="pipeline"
            filterActive={filters.pipeline !== ''}
            {...headerProps}
          >
            <TextFilter
              value={filters.pipeline}
              placeholder={t('graphene.runs.pipelineFilter')}
              onCommit={filters.onPipeline}
            />
          </ColumnHeader>
        ),
        cell: ({ row }) => <span className="text-xs">{row.original.pipeline}</span>,
      },
      {
        id: 'trigger',
        header: () => <ColumnHeader label={t('graphene.runs.colTrigger')} {...headerProps} />,
        cell: ({ row }) => <TriggerChip trigger={row.original.trigger} />,
      },
      {
        id: 'status',
        header: () => (
          <ColumnHeader
            label={t('graphene.runs.colStatus')}
            columnId="status"
            filterActive={filters.statuses.length > 0}
            {...headerProps}
          >
            <ChecklistFilter
              options={RUN_STATUSES}
              selected={filters.statuses}
              onChange={filters.onStatuses}
            />
          </ColumnHeader>
        ),
        cell: ({ row }) => <RunStatusBadge status={row.original.status} />,
      },
      {
        id: 'started',
        header: () => (
          <ColumnHeader
            label={t('graphene.runs.colStarted')}
            columnId="started"
            filterActive={filters.started !== ''}
            {...headerProps}
          >
            <ChecklistFilter
              options={STARTED_WINDOWS}
              selected={filters.started === '' ? [] : [filters.started]}
              onChange={(picked) => filters.onStarted(picked.at(-1) ?? '')}
            />
          </ColumnHeader>
        ),
        cell: ({ row }) =>
          row.original.startedAt && (
            <span
              className="text-xs text-muted-foreground"
              title={row.original.startedAt.toLocaleString()}
            >
              {t('graphene.runs.ago', {
                time: formatRelative(row.original.startedAt, now),
              })}
            </span>
          ),
      },
      {
        id: 'duration',
        header: () => <ColumnHeader label={t('graphene.runs.colDuration')} {...headerProps} />,
        cell: ({ row }) => {
          const { durationMs, startedAt, status } = row.original
          const live =
            durationMs ??
            (status === 'Running' && startedAt ? now.getTime() - startedAt.getTime() : null)
          return (
            live !== null && (
              <span className="font-mono text-xs text-muted-foreground">
                {formatDuration(live)}
              </span>
            )
          )
        },
      },
      {
        id: 'owns',
        header: () => <ColumnHeader label={t('graphene.runs.colOwns')} {...headerProps} />,
        cell: ({ row }) => {
          const count = ownsCounts[row.original.ref]
          return count !== undefined && count > 0 ? (
            <span className="font-mono text-xs text-status-running">{count}</span>
          ) : (
            <span className="font-mono text-xs text-muted-foreground">
              {count === undefined ? '' : '0'}
            </span>
          )
        },
      },
      {
        id: 'labels',
        header: () => <ColumnHeader label={t('graphene.runs.colLabels')} {...headerProps} />,
        cell: ({ row }) => (
          <span className="flex flex-wrap gap-1">
            {Object.entries(row.original.labels).map(([k, v]) => (
              <Badge key={k} variant="outline" className="font-mono text-2xs">
                {k}={v}
              </Badge>
            ))}
          </span>
        ),
      },
    ],
    [t, favorites, now, filters, headerProps, ownsCounts],
  )

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row.id,
    manualFiltering: true,
    manualPagination: true,
  })

  return (
    // Internal scroll: the header sticks to this region's top while
    // the body scrolls inside it — the page itself stays put.
    <div className="scrollbar-stable min-h-0 flex-1 overflow-auto rounded-md bg-card">
      <table className="w-full table-auto border-separate border-spacing-0 text-sm">
        <colgroup>
          {table.getVisibleLeafColumns().map((column) => (
            <col key={column.id} style={{ width: COLUMN_WIDTHS[column.id] }} />
          ))}
        </colgroup>
        <thead>
          <tr>
            {HEADER_GROUPS.map((group) => (
              <th
                key={group.key}
                colSpan={group.span}
                className="sticky top-0 z-10 bg-card px-3 pt-2 pb-0.5 text-left text-2xs font-medium tracking-wider text-muted-foreground uppercase"
              >
                {t(`graphene.runs.group.${group.key}`)}
              </th>
            ))}
          </tr>
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id}>
              {hg.headers.map((header) => (
                <th
                  key={header.id}
                  className="sticky top-6 z-10 bg-card px-3 py-1.5 text-left text-xs font-medium text-muted-foreground"
                >
                  {flexRender(header.column.columnDef.header, header.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.length > 0 ? (
            table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                className="group/row cursor-pointer"
                aria-selected={selectedId === row.original.id}
                onClick={(event) => {
                  const target = event.target as HTMLElement
                  if (target.closest('button, a, input') !== null) return
                  onSelect(row.original)
                }}
              >
                {row.getVisibleCells().map((cell) => (
                  <td
                    key={cell.id}
                    className={cn(
                      'px-3 py-1.5 align-middle transition-colors group-hover/row:bg-surface-hover',
                      selectedId === row.original.id && 'bg-accent',
                    )}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td
                colSpan={table.getVisibleLeafColumns().length}
                className="h-32 px-3 text-center align-middle"
              >
                <span className="inline-flex items-center gap-2 font-mono text-xs text-muted-foreground">
                  {loading ? (
                    <>
                      <Spinner className="size-3.5" />
                      {t('graphene.runs.loading')}
                    </>
                  ) : hasActiveFilters ? (
                    t('graphene.runs.empty')
                  ) : (
                    t('graphene.runs.emptyNoFilters')
                  )}
                </span>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
