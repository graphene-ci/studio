// The app's one GrapheneClient. UI imports `client` from here — and
// nothing else out of src/client/: internals (hub, targets, stores)
// are not a public surface.

import { computed } from 'nanostores'

import { $api } from '@/stores/apiStore'
import { $contexts, $currentContext } from '@/stores/contextsStore'

import { GrapheneClient } from './client'

// World identity: same server + namespace = same world. Token changes
// alone do not reset anything — auth is read per request.
const $worldId = computed([$contexts, $currentContext], (contexts, name) => {
  const ctx = contexts[name]
  return ctx === undefined ? '' : `${ctx.server}|${ctx.namespace}|${ctx.insecure}`
})

export const client = new GrapheneClient({
  api: () => $api.get(),
  subscribeWorld: (onSwitch) => {
    let last = $worldId.get()
    return $worldId.subscribe((id) => {
      if (id === last) return
      last = id
      onSwitch()
    })
  },
})

export type { View } from './external'
