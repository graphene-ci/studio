// Pure view-model builder for the Files panel: pipelines → their
// sources → the source's file tree (folders derived from flat server
// paths). Flat render-ready rows, same contract as the resource tree.

import type { TreeNode } from '@/proto/management/v1/resources_pb'
import type { ListFilesResponse } from '@/proto/management/v1/source_pb'

const SOURCE_KINDS = new Set(['gitsource', 'managedsource'])

export interface PipelineRowVM {
  type: 'pipeline'
  key: string
  ref: string
  id: string
  depth: number
  hasChildren: boolean
  isExpanded: boolean
}

export interface SourceRowVM {
  type: 'source'
  key: string
  ref: string
  kind: string
  id: string
  readOnly: boolean
  depth: number
  hasChildren: true
  isExpanded: boolean
}

export interface DirRowVM {
  type: 'dir'
  key: string
  name: string
  depth: number
  hasChildren: boolean
  isExpanded: boolean
}

export interface FileRowVM {
  type: 'file'
  key: string
  sourceRef: string
  path: string
  name: string
  size: number
  depth: number
  hasChildren: false
  isExpanded: false
}

/** Placeholder under an expanded source: files still loading/failed. */
export interface NoteRowVM {
  type: 'note'
  note: 'loading' | 'error'
  key: string
  depth: number
  hasChildren: false
  isExpanded: false
}

export type FileTreeRowVM = PipelineRowVM | SourceRowVM | DirRowVM | FileRowVM | NoteRowVM

export interface SourceFilesView {
  loaded: boolean
  error: string | null
  data: ListFilesResponse | null
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
    const name = parts[parts.length - 1]
    node.files.push({ name, path: f.path, size: Number(f.size) })
  }
  return root
}

/** Lists the sources under every pipeline root (ownership order). */
export function pipelineSources(roots: TreeNode[]): Map<string, string[]> {
  const out = new Map<string, string[]>()
  for (const node of roots) {
    if (node.resource?.kind !== 'pipeline') continue
    const refs = node.children
      .filter((c) => SOURCE_KINDS.has(c.resource?.kind ?? ''))
      .map((c) => c.resource?.ref ?? '')
      .filter((r) => r !== '')
      .sort((a, b) => a.localeCompare(b))
    out.set(node.resource.ref, refs)
  }
  return out
}

/** Flattens the pipeline→source→files forest. Filter matches
 * pipeline/source refs and file paths; matches force-expand their
 * ancestors, like the resource tree. */
export function flattenFileTree(
  roots: TreeNode[],
  expanded: ReadonlySet<string>,
  filter: string,
  filesBySource: ReadonlyMap<string, SourceFilesView>,
): FileTreeRowVM[] {
  const needle = filter.trim().toLowerCase()
  const rows: FileTreeRowVM[] = []

  const collectDir = (
    node: DirNode,
    depth: number,
    sourceRef: string,
    prefix: string,
    into: FileTreeRowVM[],
  ): boolean => {
    let anyMatch = false
    for (const dirName of [...node.dirs.keys()].sort((a, b) => a.localeCompare(b))) {
      const child = node.dirs.get(dirName)
      if (child === undefined) continue
      const key = `${sourceRef}:${prefix}${dirName}/`
      const childRows: FileTreeRowVM[] = []
      const childMatch = collectDir(child, depth + 1, sourceRef, `${prefix}${dirName}/`, childRows)
      const selfMatch = needle === '' || `${prefix}${dirName}/`.toLowerCase().includes(needle)
      if (needle !== '' && !selfMatch && !childMatch) continue
      anyMatch = true
      const isExpanded = needle !== '' ? childMatch || selfMatch : expanded.has(key)
      into.push({
        type: 'dir',
        key,
        name: dirName,
        depth,
        hasChildren: child.dirs.size > 0 || child.files.length > 0,
        isExpanded,
      })
      if (isExpanded) into.push(...childRows)
    }
    for (const file of [...node.files].sort((a, b) => a.name.localeCompare(b.name))) {
      if (needle !== '' && !file.path.toLowerCase().includes(needle)) continue
      anyMatch = true
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
    return anyMatch
  }

  for (const node of [...roots]
    .filter((n) => n.resource?.kind === 'pipeline')
    .sort((a, b) => (a.resource?.ref ?? '').localeCompare(b.resource?.ref ?? ''))) {
    const resource = node.resource
    if (resource === undefined) continue
    const sources = node.children
      .filter((c) => SOURCE_KINDS.has(c.resource?.kind ?? ''))
      .sort((a, b) => (a.resource?.ref ?? '').localeCompare(b.resource?.ref ?? ''))

    const sourceRows: FileTreeRowVM[] = []
    let anySourceMatch = false
    for (const sourceNode of sources) {
      const source = sourceNode.resource
      if (source === undefined) continue
      const ref = source.ref
      const view = filesBySource.get(ref)
      const selfMatch = needle === '' || ref.toLowerCase().includes(needle)

      const fileRows: FileTreeRowVM[] = []
      let fileMatch = false
      if (view?.data != null) {
        fileMatch = collectDir(buildDirTree(view.data.files), 2, ref, '', fileRows)
      }

      if (needle !== '' && !selfMatch && !fileMatch) continue
      anySourceMatch = true

      const isExpanded = needle !== '' ? fileMatch || selfMatch : expanded.has(ref)
      sourceRows.push({
        type: 'source',
        key: ref,
        ref,
        kind: source.kind,
        id: ref.slice(ref.indexOf('/') + 1),
        readOnly: source.kind === 'gitsource',
        depth: 1,
        hasChildren: true,
        isExpanded,
      })
      if (isExpanded) {
        if (view === undefined || (!view.loaded && view.error === null)) {
          sourceRows.push({
            type: 'note',
            note: 'loading',
            key: `${ref}:@loading`,
            depth: 2,
            hasChildren: false,
            isExpanded: false,
          })
        } else if (!view.loaded && view.error !== null) {
          sourceRows.push({
            type: 'note',
            note: 'error',
            key: `${ref}:@error`,
            depth: 2,
            hasChildren: false,
            isExpanded: false,
          })
        } else {
          sourceRows.push(...fileRows)
        }
      }
    }

    const pipelineMatch = needle === '' || resource.ref.toLowerCase().includes(needle)
    if (needle !== '' && !pipelineMatch && !anySourceMatch) continue

    const isExpanded = needle !== '' ? anySourceMatch || pipelineMatch : expanded.has(resource.ref)
    rows.push({
      type: 'pipeline',
      key: resource.ref,
      ref: resource.ref,
      id: resource.ref.slice(resource.ref.indexOf('/') + 1),
      depth: 0,
      hasChildren: sources.length > 0,
      isExpanded: sources.length > 0 && isExpanded,
    })
    if (sources.length > 0 && isExpanded) rows.push(...sourceRows)
  }

  return rows
}

/** Which sources need their file listings watched: the expanded ones
 * (or all, while a filter needs to search file paths). */
export function sourcesToWatch(
  roots: TreeNode[],
  expanded: ReadonlySet<string>,
  filter: string,
): string[] {
  const all = [...pipelineSources(roots).values()].flat()
  if (filter.trim() !== '') return all
  return all.filter((ref) => expanded.has(ref))
}
