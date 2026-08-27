// The workspace-wide selection: which record the surfaces talk about.
// The tree writes it; inspector/canvas read it (wired in later steps).

import { atom } from 'nanostores'

/** Selected record ref ("kind/id"); null — nothing selected. */
export const $selection = atom<string | null>(null)

export function selectResource(ref: string | null): void {
  $selection.set(ref)
}
