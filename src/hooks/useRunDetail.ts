import { useStore } from '@nanostores/react'
import { useEffect, useState } from 'react'

import { runVMFromResource, type RunVM } from '@/helpers/runVM'
import { $api } from '@/stores/apiStore'

export interface RunDetailState {
  run: RunVM | null
  // Live status from WatchRun — ahead of the listing row.
  liveStatus: string | null
  error: string | null
}

/** One run's identity + a live status stream until it turns terminal. */
export function useRunDetail(runId: string): RunDetailState & { reload: () => void } {
  const api = useStore($api)
  const [run, setRun] = useState<RunVM | null>(null)
  const [liveStatus, setLiveStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [epoch, setEpoch] = useState(0)

  useEffect(() => {
    void epoch
    let cancelled = false
    void (async () => {
      try {
        const resp = await api.resources.list({ query: `kind=run, id=${runId}` })
        if (cancelled) return
        const first = resp.resources[0]
        if (first === undefined) {
          setError('not_found')
          return
        }
        setRun(runVMFromResource(first))
        setError(null)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [api, runId, epoch])

  useEffect(() => {
    const controller = new AbortController()
    void (async () => {
      try {
        for await (const event of api.runs.watchRun({ runId }, { signal: controller.signal })) {
          setLiveStatus(event.status)
        }
        // Terminal — refresh the row for finishedAt/duration.
        if (!controller.signal.aborted) setEpoch((e) => e + 1)
      } catch {
        // Watch is best-effort; the meta row still answers.
      }
    })()
    return () => controller.abort()
  }, [api, runId])

  return { run, liveStatus, error, reload: () => setEpoch((e) => e + 1) }
}
