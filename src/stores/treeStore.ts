// UI state of the resource tree — app state, not world state (the
// world lives in the client). Expansion survives restarts.

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

/** Refs whose children are shown. Kept as an array for JSON. */
export const $treeExpanded = persistentAtom<string[]>('graphene.tree.expanded', [], {
  encode: JSON.stringify,
  decode: decodeExpanded,
})

export function toggleTreeExpanded(ref: string, open?: boolean): void {
  const current = $treeExpanded.get()
  const has = current.includes(ref)
  const next = open ?? !has
  if (next === has) return
  $treeExpanded.set(next ? [...current, ref] : current.filter((r) => r !== ref))
}

/** Client-side tree filter: substring over refs (kind/id). */
export const $treeFilter = atom<string>('')
