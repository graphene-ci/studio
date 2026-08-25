// URL <-> table state. The `q` selector STRING is the single source of
// filter truth (the language first — column filters are just visual
// editors of its terms). Everything lives in the link.

import {
  formatSelector,
  parseSelector,
  termFor,
  withoutField,
  type SelectorTerm,
} from '@/helpers/selector'

export const RUN_STATUSES = [
  'Running',
  'Completed',
  'Failed',
  'Canceled',
  'Terminated',
  'TimedOut',
] as const

export const STARTED_WINDOWS = ['1h', '6h', '24h', '7d'] as const
export const POLL_OPTIONS_MS = [0, 5_000, 15_000, 30_000] as const
export const PAGE_SIZES = [10, 25, 50, 100] as const

export interface TableUrlState {
  // Raw selector text — may be invalid while the user types a link by
  // hand; pages surface the parse error and stop fetching.
  q: string
  favoritesOnly: boolean
  size: number
  pollMs: number
}

export function parseTableParams(sp: URLSearchParams, defaultQ: string): TableUrlState {
  const size = Number(sp.get('size'))
  const pollMs = sp.has('iv') ? Number(sp.get('iv')) : 5_000
  return {
    q: sp.get('q') ?? defaultQ,
    favoritesOnly: sp.get('fav') === '1',
    size: (PAGE_SIZES as readonly number[]).includes(size) ? size : 25,
    pollMs: (POLL_OPTIONS_MS as readonly number[]).includes(pollMs) ? pollMs : 5_000,
  }
}

export function tableParamsToSearch(state: TableUrlState, defaultQ: string): URLSearchParams {
  const sp = new URLSearchParams()
  if (state.q !== defaultQ) sp.set('q', state.q)
  if (state.favoritesOnly) sp.set('fav', '1')
  if (state.size !== 25) sp.set('size', String(state.size))
  if (state.pollMs !== 5_000) sp.set('iv', String(state.pollMs))
  return sp
}

/** Parses q; returns terms or the error message. */
export function tryParseQ(
  q: string,
): { terms: SelectorTerm[]; error: null } | { terms: null; error: string } {
  try {
    return { terms: parseSelector(q), error: null }
  } catch (err) {
    return { terms: null, error: err instanceof Error ? err.message : String(err) }
  }
}

/** Serializes terms back to q, keeping the kind term first. */
export function formatQ(terms: SelectorTerm[], kind: string): string {
  const kindTerm = termFor(terms, 'kind') ?? { field: 'kind', op: '=' as const, values: [kind] }
  return formatSelector([kindTerm, ...withoutField(terms, 'kind')])
}

// --- Column-filter views over the terms (runs table) ---

export function statusesOf(terms: SelectorTerm[]): string[] {
  const t = termFor(terms, 'phase')
  return t !== undefined && (t.op === '=' || t.op === 'in') ? t.values : []
}

export function withStatuses(terms: SelectorTerm[], statuses: string[]): SelectorTerm[] {
  const rest = withoutField(terms, 'phase')
  if (statuses.length === 0) return rest
  if (statuses.length === 1) return [...rest, { field: 'phase', op: '=', values: statuses }]
  return [...rest, { field: 'phase', op: 'in', values: statuses }]
}

export function pipelineOf(terms: SelectorTerm[]): string {
  const t = termFor(terms, 'pipeline')
  return t !== undefined && t.op === '=' ? (t.values[0] ?? '') : ''
}

export function withPipeline(terms: SelectorTerm[], pipeline: string): SelectorTerm[] {
  const rest = withoutField(terms, 'pipeline')
  if (pipeline === '') return rest
  return [...rest, { field: 'pipeline', op: '=', values: [pipeline] }]
}

export function startedOf(terms: SelectorTerm[]): string {
  const t = termFor(terms, 'started')
  if (t === undefined || t.op !== '>') return ''
  const v = t.values[0] ?? ''
  const window = v.startsWith('-') ? v.slice(1) : ''
  return (STARTED_WINDOWS as readonly string[]).includes(window) ? window : ''
}

export function withStarted(terms: SelectorTerm[], window: string): SelectorTerm[] {
  const rest = withoutField(terms, 'started')
  if (window === '') return rest
  return [...rest, { field: 'started', op: '>', values: [`-${window}`] }]
}

/** Generic equality views for simple text filters (resources table). */
export function eqOf(terms: SelectorTerm[], field: string): string {
  const t = termFor(terms, field)
  return t !== undefined && t.op === '=' ? (t.values[0] ?? '') : ''
}

export function withEq(terms: SelectorTerm[], field: string, value: string): SelectorTerm[] {
  const rest = withoutField(terms, field)
  if (value === '') return rest
  return [...rest, { field, op: '=', values: [value] }]
}

/** Serializes terms as-is — no kind injection (resources page). */
export function formatTerms(terms: SelectorTerm[]): string {
  return formatSelector(terms)
}

/** Prefix filter over ids (pipelines table). */
export function idPrefixOf(terms: SelectorTerm[]): string {
  const t = termFor(terms, 'id')
  return t !== undefined && t.op === '=^' ? (t.values[0] ?? '') : ''
}

export function withIdPrefix(terms: SelectorTerm[], prefix: string): SelectorTerm[] {
  const rest = withoutField(terms, 'id')
  if (prefix === '') return rest
  return [...rest, { field: 'id', op: '=^', values: [prefix] }]
}
