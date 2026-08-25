import { timestampDate } from '@bufbuild/protobuf/wkt'

import type { Resource } from '@/proto/management/v1/resources_pb'

// ResourceVM flattens an entity-record row.
export interface ResourceVM {
  ref: string
  kind: string
  id: string
  phase: string
  owner: string
  labels: Record<string, string>
  pendingCommands: number
  markedForDeletion: boolean
  startedAt: Date | null
}

export function resourceVMFromResource(r: Resource): ResourceVM {
  const labels: Record<string, string> = {}
  for (const [k, v] of Object.entries(r.labels)) {
    if (!k.startsWith('graphene.io/')) labels[k] = v
  }
  const slash = r.ref.indexOf('/')
  return {
    ref: r.ref,
    kind: slash > 0 ? r.ref.slice(0, slash) : r.kind,
    id: slash > 0 ? r.ref.slice(slash + 1) : r.ref,
    phase: r.phase,
    owner: r.owner,
    labels,
    pendingCommands: r.pendingCommands,
    markedForDeletion: r.markedForDeletion,
    startedAt: r.startedAt ? timestampDate(r.startedAt) : null,
  }
}
