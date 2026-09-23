// Pure builder for the namespace data-flow topology: the ownership
// tree (TreeNode[]) + each record's declared outgoing flows →
// machine-grouped nodes and directed edges. DECLARED, not verified:
// edges come straight from the record's `flows`, no probe confirms them.
// The door mirrors them from the record's state into visibility, so a
// tree row carries them — for a live record and for a deleted one of a
// finished run alike.

import type { Resource, TreeNode } from '@/proto/management/v1/resources_pb'

/** One outgoing data-flow edge a record declares. */
export interface Flow {
  /** Target: another record's ref ("agent/edge-1") or an external
   * endpoint string ("stroppy-server", "10.0.0.5:5432"). */
  to: string
  protocol: string
  label?: string
  port?: number
  /** A system edge that always exists (agent↔server), not one declared. */
  virtual?: boolean
}

/** The outgoing edges a record declares (empty when the kind carries none). */
export function recordFlows(record: Resource): Flow[] {
  const out: Flow[] = []
  for (const f of record.flows) {
    if (f.to === '') continue
    out.push({
      to: f.to,
      protocol: f.protocol,
      label: f.label !== '' ? f.label : undefined,
      port: f.port > 0 ? f.port : undefined,
      virtual: f.virtual || undefined,
    })
  }
  return out
}

export interface TopoNode {
  ref: string
  kind: string
  id: string
  flows: Flow[]
}

/** A machine box: an `agent/*` and everything owned beneath it. The
 * ungrouped box (agentRef '') holds records with no agent ancestor. */
export interface TopoGroup {
  agentRef: string
  agentId: string
  nodes: TopoNode[]
}

export interface TopoEdge {
  from: string
  to: string
  protocol: string
  label?: string
  port?: number
  /** True when `to` is not a known record ref (an external endpoint). */
  external: boolean
}

export interface TopologyModel {
  groups: TopoGroup[]
  /** Unique external endpoints referenced by some flow. */
  externals: string[]
  edges: TopoEdge[]
}

function kindOf(ref: string, fallback: string): string {
  const slash = ref.indexOf('/')
  return slash === -1 ? fallback : ref.slice(0, slash)
}

function idOf(ref: string): string {
  const slash = ref.indexOf('/')
  return slash === -1 ? ref : ref.slice(slash + 1)
}

/** Builds the topology from the ownership tree. Records fold into the
 * box of their nearest `agent/*` ancestor (the agent itself heads its
 * own box); the rest land in the ungrouped box. Edges come from every
 * record's declared flows; a flow whose target is not a known record
 * becomes an external endpoint. */
export function buildTopology(roots: TreeNode[]): TopologyModel {
  const byBox = new Map<string, TopoNode[]>()
  const nodeRefs = new Set<string>()

  const walk = (list: TreeNode[], agentRef: string): void => {
    for (const tn of list) {
      const r = tn.resource
      if (r === undefined || r.ref === '') {
        walk(tn.children, agentRef)
        continue
      }
      const kind = kindOf(r.ref, r.kind)
      // The agent record heads its own box; descendants join it.
      const boxRef = kind === 'agent' ? r.ref : agentRef
      const bucket = byBox.get(boxRef)
      const node: TopoNode = { ref: r.ref, kind, id: idOf(r.ref), flows: recordFlows(r) }
      if (bucket === undefined) byBox.set(boxRef, [node])
      else bucket.push(node)
      nodeRefs.add(r.ref)
      walk(tn.children, boxRef)
    }
  }
  walk(roots, '')

  const groups: TopoGroup[] = [...byBox.entries()]
    .map(([agentRef, nodes]) => ({ agentRef, agentId: idOf(agentRef), nodes }))
    // Agent boxes first (sorted by id), the ungrouped box last.
    .sort((a, b) => {
      if (a.agentRef === '') return 1
      if (b.agentRef === '') return -1
      return a.agentId.localeCompare(b.agentId)
    })

  const edges: TopoEdge[] = []
  const externals = new Set<string>()
  for (const group of groups) {
    for (const node of group.nodes) {
      for (const flow of node.flows) {
        const external = !nodeRefs.has(flow.to)
        if (external) externals.add(flow.to)
        edges.push({
          from: node.ref,
          to: flow.to,
          protocol: flow.protocol,
          label: flow.label,
          port: flow.port,
          external,
        })
      }
    }
  }

  return { groups, externals: [...externals].sort((a, b) => a.localeCompare(b)), edges }
}

/** Edge caption: "protocol :port · label", trimmed of empty parts. */
export function edgeCaption(edge: TopoEdge): string {
  let head = edge.protocol
  if (edge.port !== undefined) head = head === '' ? `:${edge.port}` : `${head}:${edge.port}`
  return edge.label === undefined ? head : head === '' ? edge.label : `${head} · ${edge.label}`
}
