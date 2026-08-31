// Pure helpers for the record view: raw JSON bytes → readable YAML,
// proto timestamps → ms.

import { stringify } from 'yaml'

import type { Resource } from '@/proto/management/v1/resources_pb'

const decoder = new TextDecoder()

/** Renders spec/state bytes (JSON) as YAML; falls back to raw text.
 * Empty bytes — empty string. */
export function bytesAsYaml(bytes: Uint8Array): string {
  if (bytes.length === 0) return ''
  const raw = decoder.decode(bytes)
  try {
    const parsed: unknown = JSON.parse(raw)
    if (parsed === null || (typeof parsed === 'object' && Object.keys(parsed).length === 0)) {
      return ''
    }
    return stringify(parsed).trimEnd()
  } catch {
    return raw
  }
}

/** Visibility timestamps → unix ms; null — unset. */
export function timestampMs(ts: Resource['startedAt']): number | null {
  if (ts === undefined) return null
  return Number(ts.seconds) * 1000 + Math.floor(ts.nanos / 1_000_000)
}
