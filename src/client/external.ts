// ExternalStores — the ONLY read surface the UI has. Pure nanostores
// projections over InternalStores: no RPC, no effects in getters.
// Liveness is automatic: subscribing to a projection acquires its hub
// target (list+watch), the last unsubscriber releases it. Views carry
// RAW data + classification — localization happens in the app.

import { computed, onMount, type ReadableAtom } from 'nanostores'

import type { Resource, TreeNode } from '@/proto/management/v1/resources_pb'

import { listKey, normalizeQuery, recordKey, treeKey } from './keys'
import type { ConnectionPhase, InternalStores, Snapshot } from './store/internal'
import type { TargetFactory, WatchHub } from './watch/hub'

/** A watched dataset as the UI sees it: last good data + health. */
export interface View<T> {
  data: T
  /** False until the first snapshot ever landed. */
  loaded: boolean
  /** Refresh trouble; data stays the last good snapshot. */
  error: string | null
}

interface ExternalDeps {
  internal: InternalStores
  hub: WatchHub
  targets: {
    listing(key: string, query: string): TargetFactory
    record(key: string, ref: string): TargetFactory
    tree(key: string): TargetFactory
  }
}

/** Wraps a projection so its subscribers drive the hub target. */
function watched<T>(store: ReadableAtom<T>, hub: WatchHub, key: string, factory: TargetFactory) {
  onMount(store, () => {
    hub.acquire(key, factory)
    return () => hub.release(key)
  })
  return store
}

function project<T, D>(snap: Snapshot<T>, empty: D, pick: (data: T) => D): View<D> {
  return {
    data: snap.data === undefined ? empty : pick(snap.data),
    loaded: snap.data !== undefined,
    error: snap.error,
  }
}

export class ExternalStores {
  private readonly listings = new Map<string, ReadableAtom<View<Resource[]>>>()
  private readonly records = new Map<string, ReadableAtom<View<Resource | null>>>()
  private treeStore: ReadableAtom<View<TreeNode[]>> | null = null

  private readonly deps: ExternalDeps

  constructor(deps: ExternalDeps) {
    this.deps = deps
  }

  /** Live listing for a selector-language query: list + watch. */
  listing(query: string): ReadableAtom<View<Resource[]>> {
    const key = listKey(query)
    let store = this.listings.get(key)
    if (store === undefined) {
      const source = this.deps.internal.data.listing(key)
      store = watched(
        computed(source, (snap) => project(snap, [] as Resource[], (rows) => rows)),
        this.deps.hub,
        key,
        this.deps.targets.listing(key, normalizeQuery(query)),
      )
      this.listings.set(key, store)
    }
    return store
  }

  /** Live single record by ref ("kind/id"). */
  record(ref: string): ReadableAtom<View<Resource | null>> {
    const key = recordKey(ref)
    let store = this.records.get(key)
    if (store === undefined) {
      const source = this.deps.internal.data.record(key)
      store = watched(
        computed(source, (snap) => project(snap, null as Resource | null, (r) => r)),
        this.deps.hub,
        key,
        this.deps.targets.record(key, ref),
      )
      this.records.set(key, store)
    }
    return store
  }

  /** Live ownership tree of the current namespace. */
  tree(): ReadableAtom<View<TreeNode[]>> {
    if (this.treeStore === null) {
      const key = treeKey()
      const source = this.deps.internal.data.tree(key)
      this.treeStore = watched(
        computed(source, (snap) => project(snap, [] as TreeNode[], (roots) => roots)),
        this.deps.hub,
        key,
        this.deps.targets.tree(key),
      )
    }
    return this.treeStore
  }

  /** Watch-plane health for the status bar. */
  connection(): ReadableAtom<ConnectionPhase> {
    return this.deps.internal.meta.connection
  }
}
