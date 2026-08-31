// ExternalStores — the ONLY read surface the UI has. Pure nanostores
// projections over InternalStores: no RPC, no effects in getters.
// Liveness is automatic: subscribing to a projection acquires its hub
// target (list+watch), the last unsubscriber releases it. Views carry
// RAW data + classification — localization happens in the app.

import { computed, onMount, type ReadableAtom } from 'nanostores'

import type { Resource, TreeNode } from '@/proto/management/v1/resources_pb'
import type { ServerInfoResponse } from '@/proto/management/v1/namespaces_pb'
import type { ListFilesResponse } from '@/proto/management/v1/source_pb'

import {
  eventsKey,
  filesKey,
  listKey,
  logsKey,
  metricsKey,
  namespacesKey,
  normalizeQuery,
  recordKey,
  serverKey,
  tracesKey,
  treeKey,
} from './keys'
import type { EventsSnapshot, LogsSnapshot, RawSnapshot } from './watch/observe'
import type { ConnectionPhase, InternalStores, MaterializationVM, Snapshot } from './store/internal'
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
    tree(key: string, owner?: string): TargetFactory
    namespaces(key: string): TargetFactory
    files(key: string, sourceRef: string): TargetFactory
    server(key: string): TargetFactory
    events(key: string, ref: string): TargetFactory
    logs(key: string, ref: string): TargetFactory
    metrics(key: string, ref: string): TargetFactory
    traces(key: string, ref: string): TargetFactory
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
  private readonly treeStores = new Map<string, ReadableAtom<View<TreeNode[]>>>()
  private namespacesStore: ReadableAtom<View<Resource[]>> | null = null
  private readonly filesStores = new Map<string, ReadableAtom<View<ListFilesResponse | null>>>()
  private serverStore: ReadableAtom<View<ServerInfoResponse | null>> | null = null

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

  /** Live ownership tree: the whole namespace (default) or the
   * subtree under one owner ref — how a record's children are read
   * (a run's own tree included). */
  tree(owner = ''): ReadableAtom<View<TreeNode[]>> {
    const key = treeKey(owner)
    let store = this.treeStores.get(key)
    if (store === undefined) {
      const source = this.deps.internal.data.tree(key)
      store = watched(
        computed(source, (snap) => project(snap, [] as TreeNode[], (roots) => roots)),
        this.deps.hub,
        key,
        this.deps.targets.tree(key, owner),
      )
      this.treeStores.set(key, store)
    }
    return store
  }

  /** Live namespace dictionary: `namespace/<name>` records from
   * graphene-system. Raw records — the name is the record id. */
  namespaces(): ReadableAtom<View<Resource[]>> {
    if (this.namespacesStore === null) {
      const key = namespacesKey()
      const source = this.deps.internal.data.listing(key)
      this.namespacesStore = watched(
        computed(source, (snap) => project(snap, [] as Resource[], (rows) => rows)),
        this.deps.hub,
        key,
        this.deps.targets.namespaces(key),
      )
    }
    return this.namespacesStore
  }

  /** Live file listing of a gitsource record: paths + sizes +
   * treeDigest, raw from the server. */
  files(sourceRef: string): ReadableAtom<View<ListFilesResponse | null>> {
    const key = filesKey(sourceRef)
    let store = this.filesStores.get(key)
    if (store === undefined) {
      const source = this.deps.internal.data.files(key)
      store = watched(
        computed(source, (snap) => project(snap, null as ListFilesResponse | null, (r) => r)),
        this.deps.hub,
        key,
        this.deps.targets.files(key, sourceRef),
      )
      this.filesStores.set(key, store)
    }
    return store
  }

  /** Door heartbeat: ServerInfo (version + component health), polled
   * while anything shows it. error !== null → the door is down. */
  server(): ReadableAtom<View<ServerInfoResponse | null>> {
    if (this.serverStore === null) {
      const key = serverKey()
      const source = this.deps.internal.data.server
      this.serverStore = watched(
        computed(source, (snap) => project(snap, null as ServerInfoResponse | null, (r) => r)),
        this.deps.hub,
        key,
        this.deps.targets.server(key),
      )
    }
    return this.serverStore
  }

  private readonly materializationStores = new Map<string, ReadableAtom<MaterializationVM | null>>()

  /** Live view of a source build; null — never started here. */
  materialization(sourceRef: string): ReadableAtom<MaterializationVM | null> {
    let store = this.materializationStores.get(sourceRef)
    if (store === undefined) {
      store = computed(this.deps.internal.meta.materializations, (all) => all[sourceRef] ?? null)
      this.materializationStores.set(sourceRef, store)
    }
    return store
  }

  private readonly observeStores = new Map<string, ReadableAtom<unknown>>()

  private observe<T>(key: string, source: ReadableAtom<T>, factory: TargetFactory) {
    let store = this.observeStores.get(key) as ReadableAtom<T> | undefined
    if (store === undefined) {
      store = watched(source, this.deps.hub, key, factory)
      this.observeStores.set(key, store)
    }
    return store
  }

  /** Dimension 2 — the record's own history, live (follow stream,
   * cursor-resumed reconnect). */
  events(ref: string): ReadableAtom<EventsSnapshot> {
    const key = eventsKey(ref)
    return this.observe(key, this.deps.internal.data.events(key), this.deps.targets.events(key, ref))
  }

  /** Dimension 3 — log records, live push; dropped is counted. */
  logs(ref: string): ReadableAtom<LogsSnapshot> {
    const key = logsKey(ref)
    return this.observe(key, this.deps.internal.data.logs(key), this.deps.targets.logs(key, ref))
  }

  /** Dimension 4 — PromQL range snapshot (backend JSON), slow poll. */
  metrics(ref: string): ReadableAtom<RawSnapshot> {
    const key = metricsKey(ref)
    return this.observe(
      key,
      this.deps.internal.data.metrics(key),
      this.deps.targets.metrics(key, ref),
    )
  }

  /** Dimension 5 — Jaeger snapshot (backend JSON), slow poll. */
  trace(ref: string): ReadableAtom<RawSnapshot> {
    const key = tracesKey(ref)
    return this.observe(key, this.deps.internal.data.traces(key), this.deps.targets.traces(key, ref))
  }

  /** Watch-plane health for the status bar. */
  connection(): ReadableAtom<ConnectionPhase> {
    return this.deps.internal.meta.connection
  }
}
