// Shared agent roster of the Terminal surfaces: the live listing plus
// a live record watch per agent (the visibility listing carries no
// record STATE — agentConnected lives in describe).

import { useStore } from '@nanostores/react'
import { atom, computed, type ReadableAtom } from 'nanostores'
import { useMemo } from 'react'

import { client, type View } from '@/client'
import { agentInfo, type AgentInfo } from '@/helpers/agentState'
import type { Resource } from '@/proto/management/v1/resources_pb'

function useAgentRecords(refs: string[]): Map<string, View<Resource | null>> {
  const refsKey = refs.join('\n')
  const combined = useMemo((): ReadableAtom<View<Resource | null>[]> => {
    const list = refsKey === '' ? [] : refsKey.split('\n')
    if (list.length === 0) return atom([])
    return computed(
      list.map((r) => client.stores.record(r)),
      (...views) => views,
    )
  }, [refsKey])
  const views = useStore(combined)
  const map = new Map<string, View<Resource | null>>()
  const list = refsKey === '' ? [] : refsKey.split('\n')
  list.forEach((ref, i) => {
    const view = views[i]
    if (view !== undefined) map.set(ref, view)
  })
  return map
}

export interface AgentRoster {
  agents: AgentInfo[]
  loaded: boolean
  error: string | null
}

export function useAgents(): AgentRoster {
  const view = useStore(client.stores.listing('kind=agent'))
  const refs = useMemo(
    () => view.data.map((r) => r.ref).sort((a, b) => a.localeCompare(b)),
    [view.data],
  )
  const records = useAgentRecords(refs)
  const agents = refs.map((ref) => {
    const record = records.get(ref)?.data
    // Until describe lands the row shows the listing's face, offline.
    return record != null
      ? agentInfo(record)
      : {
          ref,
          id: ref.slice(ref.indexOf('/') + 1),
          connected: false,
          addresses: [],
          phase: '',
          connectedAt: 0,
          capabilities: [],
          facts: null,
        }
  })
  return { agents, loaded: view.loaded, error: view.error }
}
