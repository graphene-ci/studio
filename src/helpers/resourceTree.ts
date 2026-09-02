// Pure view-model builder for the resource tree: TreeNode[] (proto)
// → flat render-ready rows. At EVERY level records are folded into
// kind groups (collapsed by default): roots are kind groups; a group
// opens into its records; a record opens into the kind groups of its
// children. Flat output keeps virtualization and keyboard navigation
// trivial — the UI never walks the tree itself.

import { timestampMs } from '@/helpers/describe'
import type { TreeNode } from '@/proto/management/v1/resources_pb'
import type { ListFilesResponse } from '@/proto/management/v1/source_pb'

/** A gitsource is a READ-ONLY checkout: in the tree its "children"
 * are the files it lists, not owned records. */
const SOURCE_KIND = 'gitsource'

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
  /** Wall-clock of a run (ms); null on records that carry no timing. */
  startedMs: number | null
  finishedMs: number | null
}

/** A folder inside an expanded gitsource (derived from flat paths). */
export interface DirRowVM {
  type: 'dir'
  /** "<sourceRef>:<prefix>/" — expansion identity. */
  key: string
  name: string
  depth: number
  hasChildren: boolean
  isExpanded: boolean
}

/** A file inside an expanded gitsource — opens a read-only tab. */
export interface FileRowVM {
  type: 'file'
  /** "<sourceRef>:<path>". */
  key: string
  sourceRef: string
  path: string
  name: string
  size: number
  depth: number
  hasChildren: false
  isExpanded: false
}

/** Placeholder under an expanded gitsource: listing loading/failed/empty. */
export interface NoteRowVM {
  type: 'note'
  note: 'loading' | 'error' | 'empty'
  key: string
  depth: number
  hasChildren: false
  isExpanded: false
}

export type TreeRowVM = GroupRowVM | RecordRowVM | DirRowVM | FileRowVM | NoteRowVM

/** A gitsource's file listing as the tree needs it (a projection of
 * the client's files View). */
export interface SourceFilesView {
  loaded: boolean
  error: string | null
  data: ListFilesResponse | null
}

export function groupKey(parentRef: string, kind: string): string {
  return `${parentRef}::${kind}`
}

interface DirNode {
  dirs: Map<string, DirNode>
  files: { name: string; path: string; size: number }[]
}

function buildDirTree(files: ListFilesResponse['files']): DirNode {
  const root: DirNode = { dirs: new Map(), files: [] }
  for (const f of files) {
    const parts = f.path.split('/')
    let node = root
    for (const part of parts.slice(0, -1)) {
      let child = node.dirs.get(part)
      if (child === undefined) {
        child = { dirs: new Map(), files: [] }
        node.dirs.set(part, child)
      }
      node = child
    }
    node.files.push({ name: parts[parts.length - 1], path: f.path, size: Number(f.size) })
  }
  return root
}

function emitDir(
  node: DirNode,
  depth: number,
  sourceRef: string,
  prefix: string,
  expanded: ReadonlySet<string>,
  into: TreeRowVM[],
): void {
  for (const dirName of [...node.dirs.keys()].sort((a, b) => a.localeCompare(b))) {
    const child = node.dirs.get(dirName)
    if (child === undefined) continue
    const key = `${sourceRef}:${prefix}${dirName}/`
    const isExpanded = expanded.has(key)
    into.push({
      type: 'dir',
      key,
      name: dirName,
      depth,
      hasChildren: child.dirs.size > 0 || child.files.length > 0,
      isExpanded,
    })
    if (isExpanded) emitDir(child, depth + 1, sourceRef, `${prefix}${dirName}/`, expanded, into)
  }
  for (const file of [...node.files].sort((a, b) => a.name.localeCompare(b.name))) {
    into.push({
      type: 'file',
      key: `${sourceRef}:${file.path}`,
      sourceRef,
      path: file.path,
      name: file.name,
      size: file.size,
      depth,
      hasChildren: false,
      isExpanded: false,
    })
  }
}

/** The rows shown under an expanded gitsource: its file forest, or a
 * loading/error/empty note while the listing is not ready. */
function sourceFileRows(
  sourceRef: string,
  view: SourceFilesView | undefined,
  depth: number,
  expanded: ReadonlySet<string>,
): TreeRowVM[] {
  const note = (kind: 'loading' | 'error' | 'empty'): NoteRowVM => ({
    type: 'note',
    note: kind,
    key: `${sourceRef}:@${kind}`,
    depth,
    hasChildren: false,
    isExpanded: false,
  })
  if (view === undefined || (!view.loaded && view.error === null)) return [note('loading')]
  if (!view.loaded && view.error !== null) return [note('error')]
  const files = view.data?.files ?? []
  if (files.length === 0) return [note('empty')]
  const rows: TreeRowVM[] = []
  emitDir(buildDirTree(files), depth, sourceRef, '', expanded, rows)
  return rows
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
  const kind = slash === -1 ? resource.kind : resource.ref.slice(0, slash)
  return {
    type: 'record',
    key: resource.ref,
    ref: resource.ref,
    kind,
    id: slash === -1 ? resource.ref : resource.ref.slice(slash + 1),
    phase: resource.phase,
    depth,
    // A gitsource's children are its files (fetched lazily on expand),
    // so it is always expandable even with no owned records.
    hasChildren: kind === SOURCE_KIND || node.children.length > 0,
    isExpanded,
    pendingCommands: resource.pendingCommands,
    markedForDeletion: resource.markedForDeletion,
    startedMs: timestampMs(resource.startedAt),
    finishedMs: timestampMs(resource.finishedAt),
  }
}

/** Flattens the visible tree. With a filter, a node stays when its
 * ref matches or any descendant matches; groups and ancestors of
 * matches render force-expanded so results are always revealed. */
export function flattenTree(
  roots: TreeNode[],
  expanded: ReadonlySet<string>,
  filter: string,
  filesBySource: ReadonlyMap<string, SourceFilesView> = new Map(),
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

        // A gitsource opens into its file listing, not owned records.
        // Files are searched by ref only (the listing is lazy), so a
        // filter never descends into paths.
        if (node.resource?.kind === SOURCE_KIND) {
          if (needle !== '' && !selfMatch) continue
          groupMatch = true
          const isExpanded = needle === '' && expanded.has(ref)
          const row = recordRow(node, depth + 1, isExpanded)
          if (row === null) continue
          memberRows.push(row)
          if (isExpanded) {
            memberRows.push(...sourceFileRows(ref, filesBySource.get(ref), depth + 2, expanded))
          }
          continue
        }

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
