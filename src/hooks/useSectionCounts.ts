import { useStore } from '@nanostores/react'
import { useEffect, useState } from 'react'

import { $api } from '@/stores/apiStore'

export interface SectionCounts {
  pipelines: number | null
  runningRuns: number | null
  resources: number | null
}

/** Live counts for the nav rail, refreshed every 30s. */
export function useSectionCounts(enabled: boolean): SectionCounts {
  const api = useStore($api)
  const [counts, setCounts] = useState<SectionCounts>({
    pipelines: null,
    runningRuns: null,
    resources: null,
  })

  useEffect(() => {
    if (!enabled) return
    const tick = async () => {
      const count = async (query: string) => {
        try {
          const resp =
            query === '' ? await api.resources.count({}) : await api.resources.count({ query })
          return Number(resp.total)
        } catch {
          return null
        }
      }
      const [pipelines, runningRuns, resources] = await Promise.all([
        count('kind=pipeline'),
        count('kind=run, phase=Running'),
        count(''),
      ])
      setCounts({ pipelines, runningRuns, resources })
    }
    void tick()
    const timer = setInterval(() => void tick(), 30_000)
    return () => clearInterval(timer)
  }, [api, enabled])

  return counts
}
