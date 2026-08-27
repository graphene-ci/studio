// Target factories — the durable writers. Each factory returns a hub
// runner that keeps one internal store fresh: fetch a full snapshot on
// the ctl `-w` cadence, write it into InternalStores, report health.
// Equal snapshots are dropped before the store so unchanged data never
// re-renders anything.

import { equals } from '@bufbuild/protobuf'

import type { Api } from '@/lib/api'
import {
  ResourceSchema,
  TreeNodeSchema,
  type Resource,
  type TreeNode,
} from '@/proto/management/v1/resources_pb'

import type { InternalStores, Snapshot } from '../store/internal'
import { pollTarget, type TargetHandle } from './hub'

export interface TargetDeps {
  api: () => Api
  internal: InternalStores
}

function messageFor(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

function sameResources(a: Resource[] | undefined, b: Resource[]): boolean {
  if (a === undefined || a.length !== b.length) return false
  return a.every((r, i) => equals(ResourceSchema, r, b[i]))
}

function sameTrees(a: TreeNode[] | undefined, b: TreeNode[]): boolean {
  if (a === undefined || a.length !== b.length) return false
  return a.every((n, i) => equals(TreeNodeSchema, n, b[i]))
}

/** Applies a refresh outcome to a snapshot atom: success replaces data
 * (if changed), failure keeps last good data and records the error. */
function apply<T>(
  store: { get(): Snapshot<T>; set(next: Snapshot<T>): void },
  next: T | null,
  error: string | null,
  same: (prev: T | undefined, next: T) => boolean,
): void {
  const prev = store.get()
  if (next !== null && !same(prev.data, next)) {
    store.set({ data: next, error: null })
    return
  }
  if (prev.error !== error) store.set({ ...prev, error })
}

export function listingTarget(deps: TargetDeps, key: string, query: string): TargetHandle {
  const store = deps.internal.data.listing(key)
  return pollTarget(async () => {
    try {
      const reply = await deps.api().resources.list({ query })
      apply(store, reply.resources, null, sameResources)
      deps.internal.meta.reportTarget(key, null)
    } catch (err) {
      apply(store, null, messageFor(err), sameResources)
      deps.internal.meta.reportTarget(key, messageFor(err))
    }
  })
}

export function recordTarget(deps: TargetDeps, key: string, ref: string): TargetHandle {
  const store = deps.internal.data.record(key)
  return pollTarget(async () => {
    try {
      const reply = await deps.api().resources.get({ ref })
      const resource = reply.resource
      if (resource === undefined) {
        apply(store, null, 'not found', (a, b) => equals(ResourceSchema, a ?? b, b))
        deps.internal.meta.reportTarget(key, null)
        return
      }
      apply(store, resource, null, (a, b) => a !== undefined && equals(ResourceSchema, a, b))
      deps.internal.meta.reportTarget(key, null)
    } catch (err) {
      apply(store, null, messageFor(err), () => true)
      deps.internal.meta.reportTarget(key, messageFor(err))
    }
  })
}

export function treeTarget(deps: TargetDeps, key: string, owner = ''): TargetHandle {
  const store = deps.internal.data.tree(key)
  return pollTarget(async () => {
    try {
      const reply = await deps.api().resources.tree({ owner })
      apply(store, reply.roots, null, sameTrees)
      deps.internal.meta.reportTarget(key, null)
    } catch (err) {
      apply(store, null, messageFor(err), sameTrees)
      deps.internal.meta.reportTarget(key, messageFor(err))
    }
  })
}
