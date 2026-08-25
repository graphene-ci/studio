import { parse as parseYaml } from 'yaml'

import type { ContextMap, GrapheneContext } from '@/helpers/contexts'

// Parses graphenectl config content (YAML or JSON): either a full
// config ({current, contexts: {name: {...}}}) or a single context
// object ({server, token, ...}). Pure — no stores, no I/O.

export interface ParsedContext {
  name: string
  ctx: GrapheneContext
}

export interface ParseOutcome {
  format: 'yaml' | 'json'
  contexts: ParsedContext[]
  current: string
}

function asString(v: unknown): string {
  return typeof v === 'string' ? v : ''
}

function toContext(v: unknown): GrapheneContext | null {
  if (v === null || typeof v !== 'object') return null
  const rec = v as Record<string, unknown>
  const server = asString(rec.server)
  if (server === '' && !('server' in rec)) return null
  return {
    server,
    token: asString(rec.token),
    namespace: asString(rec.namespace),
    insecure: rec.insecure === true,
  }
}

/** Parses config text. Throws Error('unparsable') when neither YAML nor
 * JSON yields a usable shape. */
export function parseCliConfig(text: string): ParseOutcome {
  const trimmed = text.trim()
  if (trimmed === '') throw new Error('unparsable')

  let value: unknown
  let format: 'yaml' | 'json'
  try {
    value = JSON.parse(trimmed)
    format = 'json'
  } catch {
    try {
      value = parseYaml(trimmed)
      format = 'yaml'
    } catch {
      throw new Error('unparsable')
    }
  }
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('unparsable')
  }
  const root = value as Record<string, unknown>

  const contexts: ParsedContext[] = []
  if (root.contexts !== null && typeof root.contexts === 'object') {
    for (const [name, raw] of Object.entries(root.contexts as Record<string, unknown>)) {
      const ctx = toContext(raw)
      if (ctx !== null) contexts.push({ name, ctx })
    }
  } else {
    const single = toContext(root)
    if (single !== null) {
      const name = asString(root.name) || hostOf(single.server) || 'imported'
      contexts.push({ name, ctx: single })
    }
  }
  if (contexts.length === 0) throw new Error('unparsable')
  return { format, contexts, current: asString(root.current) }
}

function hostOf(server: string): string {
  const bare = server.replace(/^https?:\/\//i, '')
  return bare.split(':')[0] ?? ''
}

export type ImportStatus = 'new' | 'replaces'

/** Labels each parsed context against the already-stored map. */
export function importStatus(existing: ContextMap, name: string): ImportStatus {
  return name in existing ? 'replaces' : 'new'
}
