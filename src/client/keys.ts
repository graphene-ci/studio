// Target keys — the hub's identity for a watched thing. One key = one
// runner; two components looking at the same listing share one poll.

/** Selector-language query normalized enough to dedup targets:
 * trimmed, inner whitespace runs collapsed. The server owns the real
 * grammar — this is identity, not validation. */
export function normalizeQuery(query: string): string {
  return query.trim().replace(/\s+/g, ' ')
}

export const listKey = (query: string) => `list:${normalizeQuery(query)}`
export const recordKey = (ref: string) => `record:${ref}`
export const treeKey = (owner = '') => (owner === '' ? 'tree' : `tree:${owner}`)
export const namespacesKey = () => 'namespaces'
export const filesKey = (sourceRef: string) => `files:${sourceRef}`
export const serverKey = () => 'server'
export const eventsKey = (ref: string) => `events:${ref}`
export const logsKey = (ref: string) => `logs:${ref}`
export const metricsKey = (ref: string) => `metrics:${ref}`
export const tracesKey = (ref: string) => `traces:${ref}`

/** Where the installation's own records live: the namespace
 * dictionary and the authorization contour. */
export const SYSTEM_NAMESPACE = 'graphene-system'
