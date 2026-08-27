// UI state of the Files panel tree — app state, not world state.

import { persistentAtom } from '@nanostores/persistent'
import { atom } from 'nanostores'

function decodeExpanded(raw: string): string[] {
  try {
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : []
  } catch {
    return []
  }
}

/** Expanded keys: pipeline refs, source refs, "source:dir/" paths. */
export const $filesExpanded = persistentAtom<string[]>('graphene.files.expanded', [], {
  encode: JSON.stringify,
  decode: decodeExpanded,
})

export function toggleFilesExpanded(key: string, open?: boolean): void {
  const current = $filesExpanded.get()
  const has = current.includes(key)
  const next = open ?? !has
  if (next === has) return
  $filesExpanded.set(next ? [...current, key] : current.filter((k) => k !== key))
}

export const $filesFilter = atom<string>('')
