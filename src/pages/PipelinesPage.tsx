import { RefreshCwIcon, XIcon } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { SelectorInput } from '@/components/SelectorInput'
import { ColumnHeader, TextFilter } from '@/components/runs/ColumnHeader'
import { RunStatusBadge } from '@/components/status/RunStatusBadge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { COUNTED_STATUSES, type PipelineVM, type RunCounts } from '@/helpers/pipelineVM'
import {
  POLL_OPTIONS_MS,
  formatQ,
  idPrefixOf,
  parseTableParams,
  tableParamsToSearch,
  tryParseQ,
  withIdPrefix,
  type TableUrlState,
} from '@/helpers/runsFilters'
import type { SelectorTerm } from '@/helpers/selector'
import { usePipelinesQuery } from '@/hooks/usePipelinesQuery'
import { cn } from '@/lib/utils'
import { useNavigate, useSearchParams } from '@/router'

const DEFAULT_Q = 'kind=pipeline'

const statusTone: Record<string, string> = {
  Running: 'text-status-running',
  Completed: 'text-status-success',
  Failed: 'text-status-failed',
}

function CountChips({ counts }: { counts: RunCounts | undefined }) {
  if (counts === undefined) return <Spinner className="size-3 text-muted-foreground" />
  const shown = COUNTED_STATUSES.filter((s) => (counts[s] ?? 0) > 0)
  if (shown.length === 0) {
    return <span className="font-mono text-2xs text-muted-foreground">—</span>
  }
  return (
    <span className="flex gap-1">
      {shown.map((status) => (
        <Badge
          key={status}
          variant="secondary"
          className={`font-mono text-2xs tabular-nums ${statusTone[status]}`}
        >
          {counts[status]} {status}
        </Badge>
      ))}
    </span>
  )
}

export function PipelinesPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const state = useMemo(() => parseTableParams(searchParams, DEFAULT_Q), [searchParams])
  const parsed = useMemo(() => tryParseQ(state.q), [state.q])
  const [openFilterColumnId, setOpenFilterColumnId] = useState<string | null>(null)

  const patch = useCallback(
    (p: Partial<TableUrlState>) => {
      setSearchParams(tableParamsToSearch({ ...state, ...p }, DEFAULT_Q), { replace: true })
    },
    [state, setSearchParams],
  )
  const patchTerms = useCallback(
    (edit: (terms: SelectorTerm[]) => SelectorTerm[]) => {
      if (parsed.terms === null) return
      patch({ q: formatQ(edit(parsed.terms), 'pipeline') })
    },
    [parsed, patch],
  )

  const query = usePipelinesQuery(
    parsed.terms === null ? null : state.q,
    state.pollMs,
    openFilterColumnId !== null,
  )
  const terms = parsed.terms ?? []
  const idPrefix = idPrefixOf(terms)
  const hasActiveFilters = terms.some((term) => term.field !== 'kind')

  const onFilterOpenChange = useCallback((columnId: string, open: boolean) => {
    setOpenFilterColumnId((current) => (open ? columnId : current === columnId ? null : current))
  }, [])

  const toDetail = (p: PipelineVM) => navigate(`/pipelines/${p.id}`)

  const headerProps = { openColumnId: openFilterColumnId, onOpenChange: onFilterOpenChange }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2.5 p-3">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-sm font-semibold">{t('graphene.nav.pipelines')}</h1>
        <SelectorInput
          value={state.q}
          committedError={parsed.error}
          onCommit={(q) => patch({ q })}
        />
        <Button
          variant="outline"
          size="sm"
          className={cn(!hasActiveFilters && 'invisible')}
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

      <div className="scrollbar-stable min-h-0 flex-1 overflow-auto rounded-md bg-card">
        <table className="w-full table-auto border-separate border-spacing-0 text-sm">
          <thead>
            <tr>
              <th className="sticky top-0 z-10 bg-card px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                <ColumnHeader
                  label={t('graphene.pipelines.colPipeline')}
                  columnId="id"
                  filterActive={idPrefix !== ''}
                  {...headerProps}
                >
                  <TextFilter
                    value={idPrefix}
                    placeholder={t('graphene.pipelines.idFilter')}
                    onCommit={(prefix) => patchTerms((ts) => withIdPrefix(ts, prefix))}
                  />
                </ColumnHeader>
              </th>
              <th className="sticky top-0 z-10 bg-card px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                <ColumnHeader label={t('graphene.pipelines.colImage')} {...headerProps} />
              </th>
              <th className="sticky top-0 z-10 bg-card px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                <ColumnHeader label={t('graphene.pipelines.colConcurrency')} {...headerProps} />
              </th>
              <th className="sticky top-0 z-10 bg-card px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                <ColumnHeader label={t('graphene.pipelines.colRuns')} {...headerProps} />
              </th>
            </tr>
          </thead>
          <tbody>
            {query.pipelines.length > 0 ? (
              query.pipelines.map((p) => (
                <tr
                  key={p.ref}
                  className="group/row cursor-pointer"
                  onClick={(event) => {
                    const target = event.target as HTMLElement
                    if (target.closest('button, a, input') !== null) return
                    toDetail(p)
                  }}
                >
                  <td className="px-3 py-1.5 align-middle transition-colors group-hover/row:bg-surface-hover">
                    <span className="flex items-center gap-2">
                      <span className="font-mono text-xs">{p.id}</span>
                      {p.phase !== '' && p.phase !== 'ready' && <RunStatusBadge status={p.phase} />}
                    </span>
                  </td>
                  <td className="px-3 py-1.5 align-middle transition-colors group-hover/row:bg-surface-hover">
                    <span className="font-mono text-xs text-muted-foreground">{p.image}</span>
                  </td>
                  <td className="px-3 py-1.5 align-middle transition-colors group-hover/row:bg-surface-hover">
                    <span className="text-xs text-muted-foreground">
                      {p.concurrency || 'queue'}
                    </span>
                  </td>
                  <td className="px-3 py-1.5 align-middle transition-colors group-hover/row:bg-surface-hover">
                    <CountChips counts={query.counts[p.id]} />
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="h-32 px-3 text-center align-middle">
                  <span className="inline-flex items-center gap-2 font-mono text-xs text-muted-foreground">
                    {query.loading ? (
                      <>
                        <Spinner className="size-3.5" />
                        {t('graphene.pipelines.loading')}
                      </>
                    ) : (
                      t('graphene.pipelines.empty')
                    )}
                  </span>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
