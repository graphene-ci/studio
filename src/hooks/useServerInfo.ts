import { useStore } from '@nanostores/react'
import { useEffect, useState } from 'react'

import { $api } from '@/stores/apiStore'

export interface ServerInfo {
  version: string
  components: { name: string; ok: boolean; detail: string }[]
}

/** ServerInfo polled every 60s — the rail footer and status bar share it. */
export function useServerInfo(): ServerInfo | null {
  const api = useStore($api)
  const [info, setInfo] = useState<ServerInfo | null>(null)

  useEffect(() => {
    const tick = async () => {
      try {
        const resp = await api.namespaces.serverInfo({})
        setInfo({
          version: resp.version,
          components: resp.components.map((c) => ({
            name: c.name,
            ok: c.ok,
            detail: c.detail,
          })),
        })
      } catch {
        setInfo(null)
      }
    }
    void tick()
    const timer = setInterval(() => void tick(), 60_000)
    return () => clearInterval(timer)
  }, [api])

  return info
}
