import { useStore } from '@nanostores/react'
import { useCallback, useEffect, useRef, useState } from 'react'

import { pipelineVMFromResource, type PipelineVM, type RunCounts } from '@/helpers/pipelineVM'
import { $api } from '@/stores/apiStore'

export interface PipelinesQueryState {
  pipelines: PipelineVM[]
  // Per-pipeline run counts grouped by status, filled after the list.
  counts: Record<string, RunCounts>
  loading: boolean
  refreshing: boolean
  error: string | null
}

/** Pipelines listing + a Count(group by status) per row — the counts
 * arrive as a second wave without blocking the table. */
export function usePipelinesQuery(selector: string | null, pollMs: number, paused: boolean) {
  const api = useStore($api)
  const [state, setState] = useState<PipelinesQueryState>({
    pipelines: [],
    counts: {},
    loading: true,
    refreshing: false,
    error: null,
  })
  const seqRef = useRef(0)

  const fetchAll = useCallback(async () => {
    if (selector === null) return
    const seq = ++seqRef.current
    // First load blanks; everything after refreshes in place.

    setState((s) => ({ ...s, refreshing: true }))
    try {
      const resp = await api.resources.list({ query: selector })
      if (seq !== seqRef.current) return
      const pipelines = resp.resources.map(pipelineVMFromResource)
      setState((s) => ({
        ...s,
        pipelines,
        loading: false,
        refreshing: false,
        error: null,
      }))
      const entries = await Promise.all(
        pipelines.map(async (p) => {
          try {
            const count = await api.resources.count({
              query: `kind=run, pipeline=${p.id}`,
              groupByStatus: true,
            })
            const byStatus: RunCounts = {}
            for (const g of count.groups) byStatus[g.status] = Number(g.count)
            return [p.id, byStatus] as const
          } catch {
            return [p.id, {}] as const
          }
        }),
      )
      if (seq !== seqRef.current) return
      setState((s) => ({ ...s, counts: Object.fromEntries(entries) }))
    } catch (err) {
      if (seq !== seqRef.current) return
      setState((s) => ({
        ...s,
        loading: false,
        refreshing: false,
        error: err instanceof Error ? err.message : String(err),
      }))
    }
  }, [api, selector])

  useEffect(() => {
    void fetchAll()
  }, [fetchAll])

  useEffect(() => {
    if (pollMs <= 0 || paused) return
    const timer = setInterval(() => void fetchAll(), pollMs)
    return () => clearInterval(timer)
  }, [pollMs, paused, fetchAll])

  const refresh = useCallback(() => void fetchAll(), [fetchAll])
  return { ...state, refresh }
}
