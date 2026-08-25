import { useStore } from '@nanostores/react'
import {
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  RefreshCwIcon,
  StarIcon,
  XIcon,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { SelectorInput } from '@/components/SelectorInput'
import { RunsTable, type RunsFilterView } from '@/components/runs/RunsTable'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Spinner } from '@/components/ui/spinner'
import {
  PAGE_SIZES,
  POLL_OPTIONS_MS,
  formatQ,
  parseTableParams,
  pipelineOf,
  startedOf,
  statusesOf,
  tableParamsToSearch,
  tryParseQ,
  withPipeline,
  withStarted,
  withStatuses,
  type TableUrlState,
} from '@/helpers/runsFilters'
import type { SelectorTerm } from '@/helpers/selector'
import { useRunsQuery } from '@/hooks/useRunsQuery'
import { cn } from '@/lib/utils'
import { useNavigate, useSearchParams } from '@/router'
import { $api } from '@/stores/apiStore'

interface RunsPanelProps {
  // The panel's default selector — "kind=run" on the Runs page, a
  // pipeline-pinned one on a pipeline's page.
  defaultQ: string
  title?: string
}

// The full runs surface (toolbar with the selector language, table
// with column filters, cursor pagination) — reused wherever a run
// listing lives. All state stays in the URL.
export function RunsPanel({ defaultQ, title }: RunsPanelProps) {
  const { t } = useTranslation()
  const [searchParams, setSearchParams] = useSearchParams()
  const state = useMemo(() => parseTableParams(searchParams, defaultQ), [searchParams, defaultQ])
  const parsed = useMemo(() => tryParseQ(state.q), [state.q])
  const [openFilterColumnId, setOpenFilterColumnId] = useState<string | null>(null)

  const patch = useCallback(
    (p: Partial<TableUrlState>) => {
      setSearchParams(tableParamsToSearch({ ...state, ...p }, defaultQ), { replace: true })
    },
    [state, setSearchParams, defaultQ],
  )

  const patchTerms = useCallback(
    (edit: (terms: SelectorTerm[]) => SelectorTerm[]) => {
      if (parsed.terms === null) return
      patch({ q: formatQ(edit(parsed.terms), 'run') })
    },
    [parsed, patch],
  )

  const query = useRunsQuery(
    parsed.terms === null ? null : state.q,
    state.size,
    state.pollMs,
    openFilterColumnId !== null,
  )

  // "owns" column: one batched CountOwned per page of rows.
  const api = useStore($api)
  const [ownsCounts, setOwnsCounts] = useState<Record<string, number>>({})
  const pageRefs = useMemo(() => query.runs.map((r) => r.ref).join(','), [query.runs])
  useEffect(() => {
    if (pageRefs === '') return
    void (async () => {
      try {
        const resp = await api.resources.countOwned({ owners: pageRefs.split(',') })
        const counts: Record<string, number> = {}
        for (const [owner, count] of Object.entries(resp.counts)) {
          counts[owner] = Number(count)
        }
        setOwnsCounts(counts)
      } catch {
        // The column just stays empty.
      }
    })()
  }, [api, pageRefs])

  const navigate = useNavigate()

  const terms = parsed.terms ?? []
  const filters: RunsFilterView = {
    statuses: statusesOf(terms),
    pipeline: pipelineOf(terms),
    started: startedOf(terms),
    favoritesOnly: state.favoritesOnly,
    onStatuses: (statuses) => patchTerms((ts) => withStatuses(ts, statuses)),
    onPipeline: (pipeline) => patchTerms((ts) => withPipeline(ts, pipeline)),
    onStarted: (window) => patchTerms((ts) => withStarted(ts, window)),
  }
  const hasActiveFilters = terms.some((term) => term.field !== 'kind')

  const onFilterOpenChange = useCallback((columnId: string, open: boolean) => {
    setOpenFilterColumnId((current) => (open ? columnId : current === columnId ? null : current))
  }, [])

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex items-center gap-2.5">
        <span className="text-sm font-semibold">{title ?? t('graphene.nav.runs')}</span>
        <span className="font-mono text-2xs text-muted-foreground tabular-nums">
          {t('graphene.runs.shown', { count: query.runs.length })} ·{' '}
          {t('graphene.runs.page', { page: query.pageIndex + 1 })}
        </span>
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
        <button
          type="button"
          aria-pressed={state.favoritesOnly}
          aria-label={t('graphene.runs.favorites')}
          className={cn(
            'flex size-6 items-center justify-center rounded-sm',
            state.favoritesOnly
              ? 'text-status-warning'
              : 'text-muted-foreground hover:text-foreground',
          )}
          onClick={() => patch({ favoritesOnly: !state.favoritesOnly })}
        >
          <StarIcon className={cn('size-3.5', state.favoritesOnly && 'fill-current')} />
        </button>
        <SelectorInput
          value={state.q}
          committedError={parsed.error}
          onCommit={(q) => patch({ q })}
        />
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t('graphene.runs.clearFilters')}
          className={cn(!hasActiveFilters && 'invisible')}
          onClick={() => patch({ q: defaultQ })}
        >
          <XIcon />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t('graphene.runs.refresh')}
          disabled={query.refreshing}
          onClick={query.refresh}
        >
          <RefreshCwIcon className={cn('size-3', query.refreshing && 'animate-spin')} />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex h-6 items-center gap-1 rounded-sm px-1.5 font-mono text-2xs text-muted-foreground hover:text-foreground"
            >
              {state.pollMs === 0
                ? t('graphene.runs.pollOff')
                : t('graphene.runs.auto', { s: state.pollMs / 1000 })}
              <ChevronDownIcon className="size-3" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuRadioGroup
              value={String(state.pollMs)}
              onValueChange={(v) => patch({ pollMs: Number(v) })}
            >
              {POLL_OPTIONS_MS.map((ms) => (
                <DropdownMenuRadioItem key={ms} value={String(ms)} className="font-mono text-xs">
                  {ms === 0 ? t('graphene.runs.pollOff') : `${ms / 1000}s`}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {query.error !== null && (
        <div className="rounded-md bg-status-failed-bg p-3 font-mono text-xs text-status-failed">
          {query.error}
        </div>
      )}

      <RunsTable
        runs={query.runs}
        loading={query.loading}
        hasActiveFilters={hasActiveFilters}
        filters={filters}
        openFilterColumnId={openFilterColumnId}
        onFilterOpenChange={onFilterOpenChange}
        ownsCounts={ownsCounts}
        selectedId={null}
        onSelect={(run) => navigate(`/runs/${run.id}`)}
      />

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
    </div>
  )
}
