import { persistentAtom } from '@nanostores/persistent'

import type { ContextMap, GrapheneContext } from '@/helpers/contexts'

function decodeContexts(raw: string): ContextMap {
  try {
    const parsed: unknown = JSON.parse(raw)
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    return parsed as ContextMap
  } catch {
    return {}
  }
}

export const $contexts = persistentAtom<ContextMap>(
  'graphene.contexts',
  {},
  { encode: JSON.stringify, decode: decodeContexts },
)

// Name of the current context; "" = none picked yet.
export const $currentContext = persistentAtom<string>('graphene.currentContext', '')

export function upsertContext(name: string, ctx: GrapheneContext) {
  $contexts.set({ ...$contexts.get(), [name]: ctx })
}

export function removeContext(name: string) {
  const next = { ...$contexts.get() }
  delete next[name]
  $contexts.set(next)
  if ($currentContext.get() === name) $currentContext.set('')
}

export function currentContext(): GrapheneContext | null {
  return $contexts.get()[$currentContext.get()] ?? null
}
