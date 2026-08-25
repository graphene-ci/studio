import type { Resource } from '@/proto/management/v1/resources_pb'

// PipelineVM flattens a pipeline record row. State carries the last
// published manifest's essentials (typed by pipelineflow on the server).
export interface PipelineVM {
  id: string
  ref: string
  phase: string
  image: string
  concurrency: string
}

export function pipelineVMFromResource(r: Resource): PipelineVM {
  let image = ''
  let concurrency = ''
  try {
    const state: unknown = JSON.parse(new TextDecoder().decode(r.state))
    if (state !== null && typeof state === 'object') {
      const rec = state as Record<string, unknown>
      image = typeof rec.image === 'string' ? rec.image : ''
      concurrency = typeof rec.concurrency === 'string' ? rec.concurrency : ''
    }
  } catch {
    // Listing rows may omit state — the columns just stay empty.
  }
  return {
    id: r.ref.replace(/^pipeline\//, ''),
    ref: r.ref,
    phase: r.phase,
    image,
    concurrency,
  }
}

// Statuses worth a counter chip on the pipelines table.
export const COUNTED_STATUSES = ['Running', 'Completed', 'Failed'] as const

export type RunCounts = Partial<Record<string, number>>

// --- Pipeline detail (from Resources.Get) ---

/** Splits "registry:port/path/name:tag" for the identity line. */
export interface ImageRef {
  registry: string
  name: string
  tag: string
}

export function parseImageRef(image: string): ImageRef {
  const lastColon = image.lastIndexOf(':')
  const lastSlash = image.lastIndexOf('/')
  const hasTag = lastColon > lastSlash
  const bare = hasTag ? image.slice(0, lastColon) : image
  const tag = hasTag ? image.slice(lastColon + 1) : ''
  const firstSlash = bare.indexOf('/')
  // A registry host contains a dot or a port; a bare name does not.
  const head = firstSlash > 0 ? bare.slice(0, firstSlash) : ''
  const isRegistry = head.includes('.') || head.includes(':') || head === 'localhost'
  return {
    registry: isRegistry ? head : '',
    name: isRegistry ? bare.slice(firstSlash + 1) : bare,
    tag,
  }
}

/** Trims a long dotted kind to its telling tail: "…v1alpha1.Instance". */
export function shortKind(kind: string): string {
  const parts = kind.split('.')
  if (parts.length <= 3) return kind
  return `…${parts.slice(-2).join('.')}`
}

export interface PipelineTriggerVM {
  kind: string
  name: string
  spec: string
}

export interface PipelineDetailVM {
  id: string
  phase: string
  image: string
  concurrency: string
  digest: string
  activities: string[]
  kinds: string[]
  triggers: PipelineTriggerVM[]
  // Raw manifest JSON for the collapsible view; null when the record
  // has no published manifest yet.
  manifest: unknown
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : ''
}

function strs(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
}

export function pipelineDetailFromResource(r: Resource): PipelineDetailVM {
  const detail: PipelineDetailVM = {
    id: r.ref.replace(/^pipeline\//, ''),
    phase: r.phase,
    image: '',
    concurrency: '',
    digest: '',
    activities: [],
    kinds: [],
    triggers: [],
    manifest: null,
  }
  try {
    const state: unknown = JSON.parse(new TextDecoder().decode(r.state))
    if (state === null || typeof state !== 'object') return detail
    const rec = state as Record<string, unknown>
    detail.image = str(rec.image)
    detail.concurrency = str(rec.concurrency)
    detail.digest = str(rec.digest)
    const manifest = rec.manifest
    if (manifest !== null && typeof manifest === 'object') {
      const m = manifest as Record<string, unknown>
      detail.manifest = manifest
      detail.activities = strs(m.activities)
      detail.kinds = strs(m.kinds)
      if (Array.isArray(m.triggers)) {
        for (const raw of m.triggers) {
          if (raw !== null && typeof raw === 'object') {
            const tr = raw as Record<string, unknown>
            detail.triggers.push({ kind: str(tr.kind), name: str(tr.name), spec: str(tr.spec) })
          }
        }
      }
    }
  } catch {
    // No parsable state — the header shows what visibility knew.
  }
  return detail
}
