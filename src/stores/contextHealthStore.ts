import { atom } from 'nanostores'

import { $contexts } from '@/stores/contextsStore'
import { LoginError, verifyContext } from '@/stores/sessionStore'

// Ephemeral per-context health, filled by checks — never persisted:
// a stand's availability is a fact about NOW.
export type ContextHealthState =
  // Token verified, server answered Whoami.
  | 'ok'
  // Server answered but there is no saved token to verify.
  | 'reachable'
  // Server answered and REJECTED the saved token.
  | 'invalid_token'
  | 'unreachable'

export interface ContextHealth {
  // Last known result; undefined until the first check completes, so a
  // background re-check never blanks an already-shown status.
  state?: ContextHealthState
  // Role reported by Whoami when state is 'ok'.
  role: string
  checking: boolean
}

export type HealthMap = Record<string, ContextHealth>

export const $contextHealth = atom<HealthMap>({})

function patchHealth(name: string, patch: Partial<ContextHealth>) {
  const prev = $contextHealth.get()[name] ?? { role: '', checking: false }
  $contextHealth.set({ ...$contextHealth.get(), [name]: { ...prev, ...patch } })
}

/** Probes one context: Whoami with its saved token (or an empty one —
 * an Unauthenticated answer still proves the server is alive). */
export async function checkContext(name: string): Promise<void> {
  const ctx = $contexts.get()[name]
  if (ctx === undefined) return
  if ($contextHealth.get()[name]?.checking) return
  patchHealth(name, { checking: true })
  try {
    const session = await verifyContext(ctx, ctx.token)
    patchHealth(name, { state: 'ok', role: session.role, checking: false })
  } catch (err) {
    const invalid = err instanceof LoginError && err.reason === 'invalid_token'
    patchHealth(name, {
      state: invalid ? (ctx.token === '' ? 'reachable' : 'invalid_token') : 'unreachable',
      role: '',
      checking: false,
    })
  }
}

export async function checkAllContexts(): Promise<void> {
  await Promise.all(Object.keys($contexts.get()).map((name) => checkContext(name)))
}

/** Background polling; called once from the composition root.
 * isActive gates each tick (e.g. tab visibility) — the store itself
 * never touches the DOM. */
export function startHealthPolling(intervalMs: number, isActive: () => boolean): () => void {
  const tick = () => {
    if (!isActive()) return
    if (Object.keys($contexts.get()).length === 0) return
    void checkAllContexts()
  }
  tick()
  const timer = setInterval(tick, intervalMs)
  return () => clearInterval(timer)
}
