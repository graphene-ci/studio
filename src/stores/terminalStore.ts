// UI state of the Terminal panel — app state, not world state.

import { atom } from 'nanostores'

export interface PtySessionMeta {
  /** Tab identity, stable for the tab's life. */
  key: string
  agentRef: string
  /** Tab label: "bare-1", "bare-1 (2)", … */
  title: string
}

export const $ptySessions = atom<PtySessionMeta[]>([])
export const $activePtySession = atom<string | null>(null)

let counter = 1

export function openPtySession(agentRef: string): void {
  const id = agentRef.slice(agentRef.indexOf('/') + 1)
  const nth = $ptySessions.get().filter((s) => s.agentRef === agentRef).length
  const meta: PtySessionMeta = {
    key: `pty-${counter}`,
    agentRef,
    title: nth === 0 ? id : `${id} (${nth + 1})`,
  }
  counter += 1
  $ptySessions.set([...$ptySessions.get(), meta])
  $activePtySession.set(meta.key)
}

export function closePtySession(key: string): void {
  const rest = $ptySessions.get().filter((s) => s.key !== key)
  $ptySessions.set(rest)
  if ($activePtySession.get() === key) {
    $activePtySession.set(rest.length > 0 ? rest[rest.length - 1].key : null)
  }
}
