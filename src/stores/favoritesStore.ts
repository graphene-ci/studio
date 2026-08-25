import { persistentAtom } from '@nanostores/persistent'

// Favorites are LOCAL to this browser: graphene has no per-user
// identity on the server (tokens are roles), so "my favorites" can
// only honestly live here. Keyed by full ref ("run/x").
export const $favorites = persistentAtom<Record<string, true>>(
  'graphene.favorites',
  {},
  {
    encode: JSON.stringify,
    decode: (raw) => {
      try {
        const parsed: unknown = JSON.parse(raw)
        if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
        return parsed as Record<string, true>
      } catch {
        return {}
      }
    },
  },
)

export function toggleFavorite(ref: string) {
  const next = { ...$favorites.get() }
  if (ref in next) {
    delete next[ref]
  } else {
    next[ref] = true
  }
  $favorites.set(next)
}
