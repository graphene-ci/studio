import { useStore } from '@nanostores/react'
import { RotateCcwIcon, XCircleIcon } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { client } from '@/client'
import { KindIcon } from '@/components/resources/tree/KindIcon'
import type { SubTabDef } from '@/components/resources/view/subTabs'
import { PhaseBadge } from '@/components/status/PhaseBadge'
import { PhaseText } from '@/components/status/PhaseText'
import { TONE_TEXT } from '@/components/status/tones'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { timestampMs } from '@/helpers/describe'
import { traceRows } from '@/helpers/runTrace'
import { cn } from '@/lib/utils'
import type { Resource, TreeNode } from '@/proto/management/v1/resources_pb'
import { openResourceTab } from '@/stores/editorTabsStore'
import { notify } from '@/stores/notificationsStore'

// A run as its own subject: its plan built from the run's OWN events
// (real names, real order — the manifest skeleton is placeholder-only),
// and the owned subtree (agents/artifacts) as navigable links.

const decoder = new TextDecoder()

/** The pipeline this run belongs to, from the synthetic label. */
const pipelineOf = (record: Resource) => record.labels['graphene.io/pipeline'] ?? ''

// ── Spec / state parsing ──────────────────────────────────────────

/** The recorded `runSpec` — what this run was fired with. */
interface RunSpec {
  pipeline: string
  params: unknown
  image: string
}

function runSpecOf(record: Resource): RunSpec | null {
  try {
    const parsed: unknown = JSON.parse(decoder.decode(record.spec))
    if (parsed === null || typeof parsed !== 'object') return null
    const o = parsed as Record<string, unknown>
    return {
      pipeline: typeof o.pipeline === 'string' ? o.pipeline : '',
      params: o.params ?? {},
      image: typeof o.image === 'string' ? o.image : '',
    }
  } catch {
    return null
  }
}

/** The recorded `runState` — the terminal result or error, when set. */
function runStateOf(record: Resource): { result: unknown; error: string } {
  try {
    const parsed: unknown = JSON.parse(decoder.decode(record.state))
    if (parsed === null || typeof parsed !== 'object') return { result: null, error: '' }
    const o = parsed as Record<string, unknown>
    return { result: o.result ?? null, error: typeof o.error === 'string' ? o.error : '' }
  } catch {
    return { result: null, error: '' }
  }
}

function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s`
  if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`
}

// STUCK_MS: an activity RUNNING longer than this is flagged — a "0s
// running" step that in truth has hung for hours was invisible before.
const STUCK_MS = 5 * 60 * 1000

/** A ticking clock, alive only while `active` — so a running step's
 * duration grows on screen instead of freezing at its start time. */
function useNow(active: boolean, everyMs = 1000): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return
    setNow(Date.now())
    const id = setInterval(() => setNow(Date.now()), everyMs)
    return () => clearInterval(id)
  }, [active, everyMs])
  return now
}

// ── Overview header ───────────────────────────────────────────────

/** The run's status line atop the Overview: phase, timing, outcome,
 * and a Rerun that re-fires the same pipeline with the same params. */
export function RunOverviewHeader({ record }: { record: Resource }) {
  const { t, i18n } = useTranslation()
  const [rerunning, setRerunning] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const spec = runSpecOf(record)
  const outcome = runStateOf(record)
  const runId = record.ref.slice(record.ref.indexOf('/') + 1)
  const isRunning =
    record.phase === 'WORKFLOW_EXECUTION_STATUS_RUNNING' || record.phase === 'Running'

  const started = timestampMs(record.startedAt)
  const finished = timestampMs(record.finishedAt)
  // A live clock while the run has not finished — the elapsed time
  // ticks instead of freezing at the last render.
  const now = useNow(isRunning && finished === null)
  const durationMs = started === null ? null : (finished ?? now) - started
  const time = new Intl.DateTimeFormat(i18n.language, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })

  const cancel = async () => {
    setCancelling(true)
    try {
      await client.runs.cancel(runId)
      notify({ severity: 'success', title: t('graphene.run.cancelSent', { runId }) })
    } catch (err) {
      notify({
        severity: 'error',
        title: t('graphene.run.cancelFailed'),
        body: err instanceof Error ? err.message : String(err),
      })
    } finally {
      setCancelling(false)
    }
  }

  const rerun = async () => {
    if (spec === null || spec.pipeline === '') return
    setRerunning(true)
    try {
      const reply = await client.runs.start(spec.pipeline, JSON.stringify(spec.params ?? {}), {
        image: spec.image === '' ? undefined : spec.image,
      })
      const id = reply.workflowId.startsWith('run/')
        ? reply.workflowId.slice('run/'.length)
        : reply.workflowId
      notify({ severity: 'success', title: t('graphene.pipeline.started', { runId: id }) })
      if (id !== '') openResourceTab(`run/${id}`)
    } catch (err) {
      notify({
        severity: 'error',
        title: t('graphene.run.rerunFailed'),
        body: err instanceof Error ? err.message : String(err),
      })
    } finally {
      setRerunning(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <PhaseBadge phase={record.phase} />
        {started !== null && (
          <span className="font-mono text-2xs text-muted-foreground">
            {time.format(started)}
            {finished !== null && ` → ${time.format(finished)}`}
          </span>
        )}
        {durationMs !== null && (
          <span className="font-mono text-2xs text-muted-foreground">
            {t('graphene.run.duration')}: {formatDuration(durationMs)}
          </span>
        )}
        <span className="grow" />
        {isRunning && (
          <Button size="sm" variant="outline" disabled={cancelling} onClick={() => void cancel()}>
            {cancelling ? <Spinner /> : <XCircleIcon />}
            {t('graphene.run.cancel')}
          </Button>
        )}
        <Button
          size="sm"
          variant="outline"
          disabled={rerunning || spec === null || spec.pipeline === ''}
          onClick={() => void rerun()}
        >
          {rerunning ? <Spinner /> : <RotateCcwIcon />}
          {t('graphene.run.rerun')}
        </Button>
      </div>
      {outcome.error !== '' ? (
        <p className="font-mono text-2xs break-words text-destructive">{outcome.error}</p>
      ) : (
        outcome.result !== null && (
          <p className="min-w-0 truncate font-mono text-2xs text-muted-foreground">
            {t('graphene.run.result')}: {JSON.stringify(outcome.result)}
          </p>
        )
      )}
    </div>
  )
}

// ── Plan ──────────────────────────────────────────────────────────

// A run's plan is its EXECUTION TRACE — one line per activity instance
// (grouped by activityId, not by type name), so every net/sub/vm
// declare, every install, every transfer is its own row: a near-per-
// line account of what the pipeline actually did, top to bottom. The
// pipeline's manifest Plan keeps the DAG (declared shape); a run shows
// what happened.
const STEP_TONE = {
  running: 'warning',
  completed: 'success',
  failed: 'failed',
  pending: 'canceled',
} as const

function RunPlanTab({ record }: { record: Resource }) {
  const { t, i18n } = useTranslation()
  const pipelineId = pipelineOf(record)
  const events = useStore(client.stores.events(record.ref))
  const rows = useMemo(() => traceRows(events.items), [events.items])
  const [open, setOpen] = useState<string | null>(null)
  // A running step has no terminal event, so endMs sits at its start —
  // its duration would read 0s forever. Tick a live clock while any
  // step runs so an open step's elapsed time grows and a hang shows.
  const anyRunning = rows.some((r) => r.status === 'running')
  const now = useNow(anyRunning)
  const clock = new Intl.DateTimeFormat(i18n.language, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })

  return (
    <section className="flex flex-col gap-2 px-4 py-3">
      <div className="flex items-center gap-2">
        <h3 className="text-2xs font-semibold tracking-wide text-muted-foreground uppercase">
          {t('graphene.pipeline.plan')}
        </h3>
        {pipelineId !== '' && (
          <span className="grow truncate font-mono text-2xs text-muted-foreground">
            pipeline/{pipelineId}
          </span>
        )}
        {rows.length > 0 && (
          <span className="shrink-0 font-mono text-3xs text-muted-foreground">
            {rows.length} {t('graphene.run.steps')}
          </span>
        )}
      </div>
      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t('graphene.run.noSteps')}</p>
      ) : (
        <ol className="flex flex-col">
          {rows.map((row, i) => {
            const tone = STEP_TONE[row.status]
            // Live elapsed for a running step (now − start); frozen span
            // for a finished one. A running step past STUCK_MS is flagged
            // so a silent hang is visible without opening the events.
            const elapsedMs =
              row.status === 'running'
                ? Math.max(now - row.startMs, 0)
                : Math.max(row.endMs - row.startMs, 0)
            const dur = formatDuration(elapsedMs)
            const stuck = row.status === 'running' && elapsedMs > STUCK_MS
            const isOpen = open === row.activityId
            const rowEvents = isOpen
              ? events.items.filter((e) => e.activityId === row.activityId)
              : []
            return (
              <li key={row.activityId} className="flex gap-2">
                {/* Rail: a status dot with a connector line to the next row. */}
                <div className="flex flex-col items-center">
                  <span
                    className={cn(
                      'mt-1.5 size-2.5 shrink-0 rounded-full border-2 bg-background',
                      row.status === 'running' ? 'animate-pulse' : '',
                    )}
                    style={{ borderColor: `var(--status-${stuck ? 'failed' : tone})` }}
                  />
                  {i < rows.length - 1 && <span className="w-px grow bg-border" />}
                </div>
                <div className="min-w-0 flex-1 pb-1.5">
                  <button
                    type="button"
                    className="flex w-full min-w-0 items-center gap-2 rounded-sm px-1 py-0.5 text-left hover:bg-surface-hover"
                    onClick={() => setOpen(isOpen ? null : row.activityId)}
                  >
                    <span className="shrink-0 font-mono text-3xs text-muted-foreground tabular-nums">
                      {clock.format(row.startMs)}
                    </span>
                    <span className="min-w-0 truncate font-mono text-xs">{row.type}</span>
                    {row.target !== '' && (
                      <span className="min-w-0 shrink truncate font-mono text-2xs text-muted-foreground">
                        {row.target}
                      </span>
                    )}
                    {row.agent !== '' && (
                      <span className="shrink-0 rounded-sm bg-muted px-1 font-mono text-3xs text-muted-foreground">
                        {row.agent}
                      </span>
                    )}
                    {row.attempt > 1 && (
                      <span className="shrink-0 font-mono text-3xs text-status-warning">
                        #{row.attempt}
                      </span>
                    )}
                    <span className="grow" />
                    {stuck && (
                      <span className="shrink-0 rounded-sm bg-status-failed/15 px-1 font-mono text-3xs text-status-failed">
                        {t('graphene.run.stuck')}
                      </span>
                    )}
                    <span
                      className={cn(
                        'shrink-0 font-mono text-3xs tabular-nums',
                        stuck ? 'text-status-failed' : 'text-muted-foreground',
                      )}
                    >
                      {dur}
                    </span>
                    <span
                      className={cn(
                        'shrink-0 font-mono text-3xs',
                        stuck ? 'text-status-failed' : TONE_TEXT[tone],
                      )}
                    >
                      {row.status}
                    </span>
                  </button>
                  {row.error !== '' && (
                    <p className="ml-1 truncate font-mono text-3xs text-destructive">{row.error}</p>
                  )}
                  {isOpen && (
                    <ul className="mt-0.5 ml-1 flex flex-col gap-0.5 border-l border-border pl-2">
                      {rowEvents.map((e) => (
                        <li
                          key={String(e.eventId)}
                          className="flex min-w-0 items-baseline gap-2 font-mono text-3xs text-muted-foreground"
                        >
                          <span className="shrink-0 tabular-nums">
                            {clock.format(Number(e.timeUnixNano / 1_000_000n))}
                          </span>
                          <span className="truncate">{e.kind}</span>
                          {e.error !== '' && (
                            <span className="min-w-0 truncate text-destructive">{e.error}</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}

// ── Children ──────────────────────────────────────────────────────

// The run's owned resources as the FULL tree — crossplane nests
// Network → Subnet → Instance, and a flat one-level list hides that.
function ChildNodes({ nodes, depth }: { nodes: readonly TreeNode[]; depth: number }) {
  return (
    <ul className="flex flex-col">
      {nodes.map((node) => {
        const r = node.resource
        if (r === undefined) return null
        return (
          <li key={r.ref}>
            <button
              type="button"
              className="flex h-6 w-full min-w-0 items-center gap-1.5 rounded-sm text-left font-mono text-xs hover:bg-surface-hover"
              style={{ paddingLeft: `calc(${depth} * 1rem + 0.375rem)` }}
              onClick={() => openResourceTab(r.ref)}
            >
              <KindIcon kind={r.kind} className="size-3.5 shrink-0" />
              <span className="min-w-0 truncate">{r.ref}</span>
              <span className="grow" />
              <PhaseText phase={r.phase} className="shrink-0 text-2xs" />
            </button>
            {node.children.length > 0 && <ChildNodes nodes={node.children} depth={depth + 1} />}
          </li>
        )
      })}
    </ul>
  )
}

function RunChildrenTab({ record }: { record: Resource }) {
  const { t } = useTranslation()
  const subtree = useStore(client.stores.tree(record.ref))

  return (
    <div className="flex flex-col gap-3 px-4 py-3">
      {!subtree.loaded && subtree.error === null && (
        <div className="flex justify-center py-6">
          <Spinner className="size-4" />
        </div>
      )}
      {subtree.loaded && subtree.data.length === 0 && (
        <p className="text-xs text-muted-foreground">{t('graphene.pipeline.noChildren')}</p>
      )}
      {subtree.data.length > 0 && <ChildNodes nodes={subtree.data} depth={0} />}
    </div>
  )
}

export const runSubTabs: SubTabDef[] = [
  { id: 'plan', labelKey: 'graphene.pipeline.plan', Body: RunPlanTab },
  { id: 'children', labelKey: 'graphene.pipeline.children', Body: RunChildrenTab },
]
