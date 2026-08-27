// Pure helpers over namespace records (kind "namespace").

import type { Resource } from '@/proto/management/v1/resources_pb'

export interface NamespaceInfo {
  name: string
  description: string
  /** 0 — installation default. */
  retentionDays: number
  phase: string
  /** The installation refuses to delete this record — server's word. */
  protected: boolean
}

const decoder = new TextDecoder()

/** Reads a namespace record into a display shape. Spec mirrors
 * nsflow.Spec: {retentionDays, description}. */
export function namespaceInfo(record: Resource): NamespaceInfo {
  let description = ''
  let retentionDays = 0
  try {
    const spec: unknown = JSON.parse(decoder.decode(record.spec))
    if (spec !== null && typeof spec === 'object') {
      if ('description' in spec && typeof spec.description === 'string') {
        description = spec.description
      }
      if ('retentionDays' in spec && typeof spec.retentionDays === 'number') {
        retentionDays = spec.retentionDays
      }
    }
  } catch {
    // An unreadable spec renders as an empty description.
  }
  return {
    name: record.ref.slice(record.ref.indexOf('/') + 1),
    description,
    retentionDays,
    phase: record.phase,
    protected: record.protected,
  }
}
