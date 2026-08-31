// Pure helpers over agent records (kind "agent").

import type { Resource } from '@/proto/management/v1/resources_pb'

export interface AgentCapability {
  name: string
  version: string
  ready: boolean
}

export interface AgentNic {
  name: string
  addresses: string[]
}

export interface AgentFacts {
  hostname: string
  os: string
  arch: string
  cpus: number
  memoryBytes: number
  osReleaseId: string
  osReleaseVersion: string
  interfaces: AgentNic[]
}

export interface AgentInfo {
  ref: string
  id: string
  /** The registry's word, reconciled into the record's state. */
  connected: boolean
  addresses: string[]
  phase: string
  /** Unix ms of the last connect; 0 — never seen. */
  connectedAt: number
  capabilities: AgentCapability[]
  facts: AgentFacts | null
}

const decoder = new TextDecoder()

/** Interface names that are machinery, not the machine: loopback and
 * the container/VM bridges. */
const VIRTUAL_NIC = /^(lo$|docker|br-|veth|virbr|cni|flannel|kube|tailscale)/

/** Picks the addresses worth a human's glance. With facts present the
 * choice is honest — real NICs by name, IPv4 only. Without facts an
 * address-shape heuristic fills in; everything filtered away falls
 * back to the raw first address. */
export function displayAddresses(agent: Pick<AgentInfo, 'addresses' | 'facts'>): string[] {
  if (agent.facts !== null && agent.facts.interfaces.length > 0) {
    const kept = agent.facts.interfaces
      .filter((nic) => !VIRTUAL_NIC.test(nic.name))
      .flatMap((nic) => nic.addresses)
      .filter((a) => !a.includes(':'))
    if (kept.length > 0) return kept
  }
  const kept = agent.addresses.filter((a) => {
    if (a.includes(':')) return false // IPv6 — noise on an ops board
    if (a.startsWith('127.')) return false
    if (a.startsWith('169.254.')) return false
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(a)) return false
    return /^\d+\.\d+\.\d+\.\d+$/.test(a)
  })
  if (kept.length > 0) return kept
  return agent.addresses.slice(0, 1)
}

function parseFacts(v: unknown): AgentFacts | null {
  if (v === null || typeof v !== 'object') return null
  const o = v as Record<string, unknown>
  const str = (k: string) => (typeof o[k] === 'string' ? (o[k] as string) : '')
  const num = (k: string) => (typeof o[k] === 'number' ? (o[k] as number) : 0)
  const interfaces: AgentNic[] = []
  if (Array.isArray(o.interfaces)) {
    for (const nic of o.interfaces) {
      if (
        nic !== null &&
        typeof nic === 'object' &&
        typeof (nic as { name?: unknown }).name === 'string'
      ) {
        const n = nic as { name: string; addresses?: unknown }
        interfaces.push({
          name: n.name,
          addresses: Array.isArray(n.addresses)
            ? n.addresses.filter((a): a is string => typeof a === 'string')
            : [],
        })
      }
    }
  }
  return {
    hostname: str('hostname'),
    os: str('os'),
    arch: str('arch'),
    cpus: num('cpus'),
    memoryBytes: num('memoryBytes'),
    osReleaseId: str('osReleaseId'),
    osReleaseVersion: str('osReleaseVersion'),
    interfaces,
  }
}

export function agentInfo(record: Resource): AgentInfo {
  let connected = false
  let addresses: string[] = []
  let connectedAt = 0
  let facts: AgentFacts | null = null
  const capabilities: AgentCapability[] = []
  try {
    const state: unknown = JSON.parse(decoder.decode(record.state))
    if (state !== null && typeof state === 'object') {
      if ('agentConnected' in state && typeof state.agentConnected === 'boolean') {
        connected = state.agentConnected
      }
      if ('addresses' in state && Array.isArray(state.addresses)) {
        addresses = state.addresses.filter((a): a is string => typeof a === 'string')
      }
      if ('connectedAt' in state && typeof state.connectedAt === 'string') {
        const at = Date.parse(state.connectedAt)
        if (!Number.isNaN(at)) connectedAt = at
      }
      if ('facts' in state) {
        facts = parseFacts(state.facts)
      }
      if ('capabilities' in state && Array.isArray(state.capabilities)) {
        for (const c of state.capabilities) {
          if (c !== null && typeof c === 'object' && 'name' in c && typeof c.name === 'string') {
            capabilities.push({
              name: c.name,
              version: 'version' in c && typeof c.version === 'string' ? c.version : '',
              ready: 'ready' in c && typeof c.ready === 'boolean' ? c.ready : false,
            })
          }
        }
      }
    }
  } catch {
    // An unreadable state renders as a disconnected agent.
  }
  return {
    ref: record.ref,
    id: record.ref.slice(record.ref.indexOf('/') + 1),
    connected,
    addresses,
    phase: record.phase,
    connectedAt,
    capabilities,
    facts,
  }
}
