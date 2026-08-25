import { useStore } from '@nanostores/react'
import { XIcon } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { CopyButton } from '@/components/CopyButton'
import { YamlView } from '@/components/YamlView'
import { EventsView } from '@/components/runs/EventsView'
import { LogsView } from '@/components/runs/LogsView'
import { TriggerChip } from '@/components/runs/TriggerChip'
import { PhaseBadge } from '@/components/status/PhaseBadge'
import { RunStatusBadge } from '@/components/status/RunStatusBadge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { formatDuration } from '@/helpers/runVM'
import { useRunDetail } from '@/hooks/useRunDetail'
import { useServerStream } from '@/hooks/useServerStream'
import { cn } from '@/lib/utils'
import { Link, useParams, useSearchParams } from '@/router'
import { $api } from '@/stores/apiStore'

const TABS = ['overview', 'events', 'logs', 'result', 'trace', 'metrics'] as const
type Tab = (typeof TABS)[number]

const RUNNING = 'Running'

interface OwnedNode {
  ref: string
  phase: string
  depth: number
}

export function RunDetailPage() {
  const { t } = useTranslation()
  const { runId = '' } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const api = useStore($api)

  const rawTab = searchParams.get('tab') ?? 'overview'
  const tab: Tab = (TABS as readonly string[]).includes(rawTab) ? (rawTab as Tab) : 'overview'
  const setTab = (next: Tab) => {
    const sp = new URLSearchParams(searchParams)
    if (next === 'overview') {
      sp.delete('tab')
    } else {
      sp.set('tab', next)
    }
    setSearchParams(sp, { replace: true })
  }

  const detail = useRunDetail(runId)
  const status = detail.liveStatus ?? detail.run?.status ?? ''
  const running = status === RUNNING
  const ref = `run/${runId}`

  // Events and logs stream while the tab is open; follow while running.
  const events = useServerStream(tab === 'events' ? `${ref}:${running}` : null, (signal) =>
    api.observe.events({ ref, follow: running }, { signal }),
  )
  const logs = useServerStream(tab === 'logs' ? `${ref}:${running}` : null, (signal) =>
    api.observe.logs({ ref, follow: running }, { signal }),
  )

  const [result, setResult] = useState<unknown>(undefined)
  const [resultError, setResultError] = useState<string | null>(null)
  useEffect(() => {
    if (tab !== 'result' || result !== undefined || resultError !== null) return
    void (async () => {
      try {
        const resp = await api.runs.runResult({ runId })
        try {
          setResult(JSON.parse(new TextDecoder().decode(resp.result)))
        } catch {
          setResult(null)
        }
      } catch (err) {
        setResultError(err instanceof Error ? err.message : String(err))
      }
    })()
  }, [tab, api, runId, result, resultError])

  const [aux, setAux] = useState<Record<string, unknown>>({})
  useEffect(() => {
    if (tab !== 'trace' && tab !== 'metrics') return
    if (tab in aux) return
    void (async () => {
      try {
        const raw =
          tab === 'trace'
            ? (await api.observe.trace({ ref })).trace
            : (await api.observe.metrics({ ref })).series
        let parsed: unknown = null
        try {
          parsed = JSON.parse(new TextDecoder().decode(raw))
        } catch {
          parsed = null
        }
        setAux((a) => ({ ...a, [tab]: parsed }))
      } catch (err) {
        setAux((a) => ({
          ...a,
          [tab]: { error: err instanceof Error ? err.message : String(err) },
        }))
      }
    })()
  }, [tab, api, ref, aux])

  const [owned, setOwned] = useState<OwnedNode[] | null>(null)
  useEffect(() => {
    if (tab !== 'overview' || owned !== null) return
    void (async () => {
      try {
        const resp = await api.resources.tree({ owner: ref })
        const flat: OwnedNode[] = []
        const walk = (nodes: typeof resp.roots, depth: number) => {
          for (const node of nodes) {
            if (node.resource !== undefined) {
              flat.push({ ref: node.resource.ref, phase: node.resource.phase, depth })
            }
            walk(node.children, depth + 1)
          }
        }
        walk(resp.roots, 0)
        setOwned(flat)
      } catch {
        setOwned([])
      }
    })()
  }, [tab, api, ref, owned])

  const [cancelling, setCancelling] = useState(false)
  const cancelRun = async () => {
    setCancelling(true)
    try {
      await api.runs.cancelRun({ runId })
      detail.reload()
    } finally {
      setCancelling(false)
    }
  }

  const durationMs = useMemo(() => {
    const run = detail.run
    if (run === null || run.startedAt === null) return null
    return run.durationMs ?? (running ? Date.now() - run.startedAt.getTime() : null)
  }, [detail.run, running])

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2.5 p-3">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-mono text-sm font-semibold">{ref}</h1>
        <CopyButton value={ref} label={ref} />
        {status !== '' && <RunStatusBadge status={status} />}
        {detail.run !== null && (
          <>
            <Link
              to={`/pipelines/${detail.run.pipeline}`}
              className="font-mono text-xs text-primary"
            >
              {detail.run.pipeline}
            </Link>
            <TriggerChip trigger={detail.run.trigger} />
            {detail.run.startedAt !== null && (
              <span
                className="font-mono text-xs text-muted-foreground"
                title={detail.run.startedAt.toLocaleString()}
              >
                {detail.run.startedAt.toLocaleTimeString()}
                {durationMs !== null && ` · ${formatDuration(durationMs)}`}
              </span>
            )}
          </>
        )}
        <span className="grow" />
        {running && (
          <Button
            variant="outline"
            size="sm"
            disabled={cancelling}
            onClick={() => void cancelRun()}
          >
            {cancelling ? <Spinner /> : <XIcon />}
            {t('graphene.run.cancel')}
          </Button>
        )}
      </div>

      {detail.error === 'not_found' ? (
        <div className="rounded-md bg-card p-4 font-mono text-xs text-muted-foreground">
          {t('graphene.run.notFound', { id: runId })}
        </div>
      ) : detail.error !== null ? (
        <div className="rounded-md bg-status-failed-bg p-3 font-mono text-xs text-status-failed">
          {detail.error}
        </div>
      ) : null}

      <div className="flex gap-1 text-xs">
        {TABS.map((id) => (
          <button
            key={id}
            type="button"
            aria-pressed={tab === id}
            className={cn(
              'rounded-sm px-2.5 py-1',
              tab === id
                ? 'bg-accent text-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
            onClick={() => setTab(id)}
          >
            {t(`graphene.run.tab.${id}`)}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="flex min-h-0 flex-wrap gap-3 overflow-auto">
          <div className="flex min-w-72 flex-col gap-3 rounded-md bg-card p-4">
            <div className="grid grid-cols-[92px_1fr] gap-x-3 gap-y-1.5 text-xs">
              <span className="text-muted-foreground">{t('graphene.runs.colStatus')}</span>
              <span>{status !== '' && <RunStatusBadge status={status} />}</span>
              <span className="text-muted-foreground">{t('graphene.runs.colTrigger')}</span>
              <TriggerChip trigger={detail.run?.trigger ?? ''} />
              <span className="text-muted-foreground">{t('graphene.runs.colStarted')}</span>
              <span className="font-mono">{detail.run?.startedAt?.toLocaleString() ?? '—'}</span>
              <span className="text-muted-foreground">{t('graphene.runs.colDuration')}</span>
              <span className="font-mono">
                {durationMs !== null ? formatDuration(durationMs) : '—'}
              </span>
              {detail.run !== null && Object.keys(detail.run.labels).length > 0 && (
                <>
                  <span className="text-muted-foreground">{t('graphene.runs.colLabels')}</span>
                  <span className="flex flex-wrap gap-1">
                    {Object.entries(detail.run.labels).map(([k, v]) => (
                      <Badge key={k} variant="outline" className="font-mono text-2xs">
                        {k}={v}
                      </Badge>
                    ))}
                  </span>
                </>
              )}
            </div>
          </div>
          <div className="flex min-w-72 grow flex-col gap-1.5 rounded-md bg-card p-4">
            <span className="text-2xs tracking-wide text-muted-foreground uppercase">
              {t('graphene.inspector.ownsLive')}
            </span>
            {owned === null ? (
              <Spinner className="size-4 text-muted-foreground" />
            ) : owned.length === 0 ? (
              <span className="font-mono text-xs text-muted-foreground">—</span>
            ) : (
              <div className="flex flex-col">
                {owned.map((node) => (
                  <span
                    key={node.ref}
                    className="flex items-center gap-2 py-0.5 font-mono text-xs"
                    style={{ paddingLeft: `${node.depth * 14}px` }}
                  >
                    {node.ref}
                    <PhaseBadge phase={node.phase} />
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'events' && (
        <EventsView
          events={events.items}
          streaming={events.status === 'open'}
          error={events.error}
        />
      )}
      {tab === 'logs' && (
        <LogsView records={logs.items} streaming={logs.status === 'open'} error={logs.error} />
      )}
      {tab === 'result' &&
        (resultError !== null ? (
          <div className="rounded-md bg-card p-4 font-mono text-xs text-muted-foreground">
            {resultError}
          </div>
        ) : result === undefined ? (
          <Spinner className="size-4 text-muted-foreground" />
        ) : (
          <YamlView value={result} className="min-h-0 flex-1" />
        ))}
      {(tab === 'trace' || tab === 'metrics') &&
        (tab in aux ? (
          <YamlView value={aux[tab]} className="min-h-0 flex-1" />
        ) : (
          <Spinner className="size-4 text-muted-foreground" />
        ))}
    </div>
  )
}
