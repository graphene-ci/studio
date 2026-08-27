// The footer breadcrumbs — the controlled "where the user is" trail.
// Surfaces SET it (namespace, selected record, opened file, …); the
// footer only renders. App state, not world state.

import { atom } from 'nanostores'

export interface Crumb {
  id: string
  label: string
  /** File name — the footer renders its file-type icon. */
  file?: string
}

export const $breadcrumbs = atom<Crumb[]>([])

export function setBreadcrumbs(crumbs: Crumb[]): void {
  $breadcrumbs.set(crumbs)
}
