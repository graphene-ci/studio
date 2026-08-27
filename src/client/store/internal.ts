// InternalStores — the client's source of truth. Only the watch
// runners (durable writers) and explicit verbs write here; the UI
// never reads internal stores — it reads ExternalStores projections.
//
// Domain data is stored AS PROTO OBJECTS (Resource, TreeNode, …) —
// no parallel DTOs. If a shape the UI needs is missing from proto,
// that is a server-contract conversation, not a client-side invention.

import { atom, map, type WritableAtom } from 'nanostores'

import type { Resource, TreeNode } from '@/proto/management/v1/resources_pb'

/** One watched dataset: undefined until the first snapshot lands. */
export interface Snapshot<T> {
  data: T | undefined
  /** Set on a failed refresh; the last good data stays visible. */
  error: string | null
}

const emptySnapshot = <T>(): Snapshot<T> => ({ data: undefined, error: null })

function getOrCreate<T>(
  pool: Map<string, WritableAtom<Snapshot<T>>>,
  key: string,
): WritableAtom<Snapshot<T>> {
  let store = pool.get(key)
  if (store === undefined) {
    store = atom(emptySnapshot<T>())
    pool.set(key, store)
  }
  return store
}

/** Domain data, keyed the same way hub targets are keyed. */
export class DataStores {
  private readonly listingPool = new Map<string, WritableAtom<Snapshot<Resource[]>>>()
  private readonly recordPool = new Map<string, WritableAtom<Snapshot<Resource>>>()
  private readonly treePool = new Map<string, WritableAtom<Snapshot<TreeNode[]>>>()

  listing(key: string): WritableAtom<Snapshot<Resource[]>> {
    return getOrCreate(this.listingPool, key)
  }

  record(key: string): WritableAtom<Snapshot<Resource>> {
    return getOrCreate(this.recordPool, key)
  }

  tree(key: string): WritableAtom<Snapshot<TreeNode[]>> {
    return getOrCreate(this.treePool, key)
  }

  /** Context/namespace switch: the old world is gone. Pools keep the
   * atom identities (external computed stores hold references) but the
   * contents reset to "never loaded". */
  reset(): void {
    for (const pool of [this.listingPool, this.recordPool, this.treePool]) {
      for (const store of pool.values()) store.set(emptySnapshot())
    }
  }
}

export type ConnectionPhase = 'idle' | 'live' | 'degraded'

/** Client-local behavior state — not server domain. */
export class MetaStores {
  /** Aggregate health of the watch plane: live while refreshes land,
   * degraded after a failure (stores keep last good data). */
  readonly connection = atom<ConnectionPhase>('idle')

  /** Per-target error text keyed by hub key; empty string = healthy.
   * Kept as a map store so the status bar can enumerate trouble. */
  readonly targetErrors = map<Record<string, string>>({})

  reportTarget(key: string, error: string | null): void {
    const current = this.targetErrors.get()[key] ?? ''
    const next = error ?? ''
    if (current !== next) this.targetErrors.setKey(key, next)
    this.connection.set(
      Object.values({ ...this.targetErrors.get(), [key]: next }).some((e) => e !== '')
        ? 'degraded'
        : 'live',
    )
  }

  reset(): void {
    this.connection.set('idle')
    this.targetErrors.set({})
  }
}

export class InternalStores {
  readonly data = new DataStores()
  readonly meta = new MetaStores()

  reset(): void {
    this.data.reset()
    this.meta.reset()
  }
}
