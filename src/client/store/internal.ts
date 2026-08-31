// InternalStores — the client's source of truth. Only the watch
// runners (durable writers) and explicit verbs write here; the UI
// never reads internal stores — it reads ExternalStores projections.
//
// Domain data is stored AS PROTO OBJECTS (Resource, TreeNode, …) —
// no parallel DTOs. If a shape the UI needs is missing from proto,
// that is a server-contract conversation, not a client-side invention.

import { atom, map, type WritableAtom } from 'nanostores'

import type { Resource, TreeNode } from '@/proto/management/v1/resources_pb'
import type { ServerInfoResponse } from '@/proto/management/v1/namespaces_pb'
import type { ListFilesResponse } from '@/proto/management/v1/source_pb'

import {
  emptyEvents,
  emptyLogs,
  emptyRaw,
  type EventsSnapshot,
  type LogsSnapshot,
  type RawSnapshot,
} from '../watch/observe'

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
  private readonly filesPool = new Map<string, WritableAtom<Snapshot<ListFilesResponse>>>()
  /** Door heartbeat: ServerInfo — version + component health. */
  readonly server = atom<Snapshot<ServerInfoResponse>>(emptySnapshot())
  // Observe dimensions, keyed by hub key.
  private readonly eventsPool = new Map<string, WritableAtom<EventsSnapshot>>()
  private readonly logsPool = new Map<string, WritableAtom<LogsSnapshot>>()
  private readonly metricsPool = new Map<string, WritableAtom<RawSnapshot>>()
  private readonly tracesPool = new Map<string, WritableAtom<RawSnapshot>>()

  listing(key: string): WritableAtom<Snapshot<Resource[]>> {
    return getOrCreate(this.listingPool, key)
  }

  record(key: string): WritableAtom<Snapshot<Resource>> {
    return getOrCreate(this.recordPool, key)
  }

  tree(key: string): WritableAtom<Snapshot<TreeNode[]>> {
    return getOrCreate(this.treePool, key)
  }

  files(key: string): WritableAtom<Snapshot<ListFilesResponse>> {
    return getOrCreate(this.filesPool, key)
  }

  events(key: string): WritableAtom<EventsSnapshot> {
    let store = this.eventsPool.get(key)
    if (store === undefined) {
      store = atom(emptyEvents())
      this.eventsPool.set(key, store)
    }
    return store
  }

  logs(key: string): WritableAtom<LogsSnapshot> {
    let store = this.logsPool.get(key)
    if (store === undefined) {
      store = atom(emptyLogs())
      this.logsPool.set(key, store)
    }
    return store
  }

  metrics(key: string): WritableAtom<RawSnapshot> {
    let store = this.metricsPool.get(key)
    if (store === undefined) {
      store = atom(emptyRaw())
      this.metricsPool.set(key, store)
    }
    return store
  }

  traces(key: string): WritableAtom<RawSnapshot> {
    let store = this.tracesPool.get(key)
    if (store === undefined) {
      store = atom(emptyRaw())
      this.tracesPool.set(key, store)
    }
    return store
  }

  /** Context/namespace switch: the old world is gone. Pools keep the
   * atom identities (external computed stores hold references) but the
   * contents reset to "never loaded". */
  reset(): void {
    for (const store of [
      ...this.listingPool.values(),
      ...this.recordPool.values(),
      ...this.treePool.values(),
    ]) {
      store.set(emptySnapshot())
    }
    for (const store of this.filesPool.values()) store.set(emptySnapshot())
    for (const store of this.eventsPool.values()) store.set(emptyEvents())
    for (const store of this.logsPool.values()) store.set(emptyLogs())
    for (const store of this.metricsPool.values()) store.set(emptyRaw())
    for (const store of this.tracesPool.values()) store.set(emptyRaw())
    this.server.set(emptySnapshot())
  }
}

export type ConnectionPhase = 'idle' | 'live' | 'degraded'

/** One source build (Materialize stream) as the client tracks it.
 * The server owns the real work — the revision record lands even if
 * this client dies; this is just the live view of the stream. */
export interface MaterializationVM {
  running: boolean
  stage: string
  /** Recent lines, oldest first, capped. */
  log: string[]
  error: string | null
  revisionId: string | null
}

/** Client-local behavior state — not server domain. */
export class MetaStores {
  /** Aggregate health of the watch plane: live while refreshes land,
   * degraded after a failure (stores keep last good data). */
  readonly connection = atom<ConnectionPhase>('idle')

  /** Per-target error text keyed by hub key; empty string = healthy.
   * Kept as a map store so the status bar can enumerate trouble. */
  readonly targetErrors = map<Record<string, string>>({})

  /** Live materializations keyed by source ref. */
  readonly materializations = map<Record<string, MaterializationVM>>({})

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
    this.materializations.set({})
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
