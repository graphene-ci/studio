// Pure view-model builder for the resource tree: TreeNode[] (proto)
// → flat render-ready rows. At EVERY level records are folded into
// kind groups (collapsed by default): roots are kind groups; a group
// opens into its records; a record opens into the kind groups of its
// children. Flat output keeps virtualization and keyboard navigation
// trivial — the UI never walks the tree itself.

import type { TreeNode } from '@/proto/management/v1/resources_pb'

export interface GroupRowVM {
  type: 'group'
  /** Expansion identity: "<parent ref or ''>::<kind>". */
  key: string
  kind: string
  count: number
  depth: number
  hasChildren: boolean
  isExpanded: boolean
}

export interface RecordRowVM {
  type: 'record'
  /** Same as ref — one identity field across both row shapes. */
  key: string
  ref: string
  kind: string
  id: string
  phase: string
  depth: number
  hasChildren: boolean
  isExpanded: boolean
  pendingCommands: number
  markedForDeletion: boolean
}

export type TreeRowVM = GroupRowVM | RecordRowVM

export function groupKey(parentRef: string, kind: string): string {
  return `${parentRef}::${kind}`
}

/** Refs from a root down to the given ref (inclusive); null — not in
 * the tree (yet). */
export function findAncestry(roots: TreeNode[], ref: string): string[] | null {
  for (const node of roots) {
    const own = node.resource?.ref ?? ''
    if (own === ref) return [own]
    const deeper = findAncestry(node.children, ref)
    if (deeper !== null) return [own, ...deeper]
  }
  return null
}

function recordRow(node: TreeNode, depth: number, isExpanded: boolean): RecordRowVM | null {
  const resource = node.resource
  if (resource === undefined) return null
  const slash = resource.ref.indexOf('/')
  return {
    type: 'record',
    key: resource.ref,
    ref: resource.ref,
    kind: slash === -1 ? resource.kind : resource.ref.slice(0, slash),
    id: slash === -1 ? resource.ref : resource.ref.slice(slash + 1),
    phase: resource.phase,
    depth,
    hasChildren: node.children.length > 0,
    isExpanded,
    pendingCommands: resource.pendingCommands,
    markedForDeletion: resource.markedForDeletion,
  }
}

/** Flattens the visible tree. With a filter, a node stays when its
 * ref matches or any descendant matches; groups and ancestors of
 * matches render force-expanded so results are always revealed. */
export function flattenTree(
  roots: TreeNode[],
  expanded: ReadonlySet<string>,
  filter: string,
): TreeRowVM[] {
  const needle = filter.trim().toLowerCase()

  // One level: fold nodes into kind groups, recurse into records.
  const collect = (
    nodes: TreeNode[],
    depth: number,
    parentRef: string,
    into: TreeRowVM[],
  ): boolean => {
    const byKind = new Map<string, TreeNode[]>()
    for (const node of nodes) {
      const kind = node.resource?.kind ?? ''
      const bucket = byKind.get(kind)
      if (bucket === undefined) byKind.set(kind, [node])
      else bucket.push(node)
    }

    let anyMatch = false
    for (const kind of [...byKind.keys()].sort((a, b) => a.localeCompare(b))) {
      const bucket = byKind.get(kind) ?? []
      const key = groupKey(parentRef, kind)

      // Records of the group (and their subtrees) first — a group
      // containing a match renders force-expanded.
      const memberRows: TreeRowVM[] = []
      let groupMatch = false
      for (const node of [...bucket].sort((a, b) =>
        (a.resource?.ref ?? '').localeCompare(b.resource?.ref ?? ''),
      )) {
        const ref = node.resource?.ref ?? ''
        const selfMatch = needle === '' || ref.toLowerCase().includes(needle)

        const childRows: TreeRowVM[] = []
        const childMatch =
          node.children.length > 0 ? collect(node.children, depth + 2, ref, childRows) : false

        if (needle !== '' && !selfMatch && !childMatch) continue
        groupMatch = true

        const isExpanded =
          node.children.length > 0 && (needle !== '' ? childMatch : expanded.has(ref))
        const row = recordRow(node, depth + 1, isExpanded)
        if (row === null) continue
        memberRows.push(row)
        if (isExpanded) memberRows.push(...childRows)
      }

      if (needle !== '' && !groupMatch) continue
      anyMatch = true

      const isExpanded = needle !== '' ? true : expanded.has(key)
      into.push({
        type: 'group',
        key,
        kind,
        count: bucket.length,
        depth,
        hasChildren: bucket.length > 0,
        isExpanded,
      })
      if (isExpanded) into.push(...memberRows)
    }
    return anyMatch
  }

  const rows: TreeRowVM[] = []
  collect(roots, 0, '', rows)
  return rows
}
