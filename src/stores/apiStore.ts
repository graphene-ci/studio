import { computed } from 'nanostores'

import { makeApi } from '@/lib/api'
import { baseUrlFor } from '@/lib/serverUrl'
import { $contexts, $currentContext } from '@/stores/contextsStore'

// One client set per current context; token/namespace read per request.
export const $api = computed([$contexts, $currentContext], (contexts, name) => {
  const ctx = contexts[name]
  return makeApi(baseUrlFor(ctx?.server ?? '', ctx?.insecure ?? false), () => {
    const live = $contexts.get()[$currentContext.get()]
    return { token: live?.token ?? '', namespace: live?.namespace ?? '' }
  })
})
