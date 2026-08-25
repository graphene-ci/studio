// Client mirror of the server's selector language (internal/selector):
// `kind=run, phase in (Running, Failed), pipeline=deploy, label.env=prod,
// started>-2h`. The server compiles and VALIDATES authoritatively — this
// mirror only parses/serializes so the UI can edit terms structurally.
// Keep the grammar in lockstep with the Go package.

export type SelectorOp = '=' | '!=' | '=^' | '>' | '<' | 'in'

export interface SelectorTerm {
  field: string
  op: SelectorOp
  values: string[]
}

export const RESERVED_FIELDS = [
  'kind',
  'id',
  'phase',
  'owner',
  'pipeline',
  'started',
  'finished',
] as const

function isKnownField(field: string): boolean {
  return (RESERVED_FIELDS as readonly string[]).includes(field) || field.startsWith('label.')
}

/** Splits on top-level commas (outside parens and quotes). */
function splitTop(s: string): string[] {
  const parts: string[] = []
  let depth = 0
  let start = 0
  let inStr = false
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (c === '"') inStr = !inStr
    else if (inStr) continue
    else if (c === '(') depth++
    else if (c === ')') depth--
    else if (c === ',' && depth === 0) {
      parts.push(s.slice(start, i))
      start = i + 1
    }
  }
  parts.push(s.slice(start))
  return parts
}

function parseValue(raw: string): string {
  let v = raw.trim()
  if (v.startsWith('"') && v.endsWith('"') && v.length >= 2) v = v.slice(1, -1)
  if (v === '') throw new Error('empty value')
  if (v.includes('"') || v.includes("'")) throw new Error(`${v}: quotes are not allowed`)
  return v
}

function parseTerm(s: string): SelectorTerm {
  const inMatch = /^(.+?)\s+in\s+\((.*)\)$/.exec(s)
  if (inMatch !== null) {
    const field = (inMatch[1] ?? '').trim()
    const values = (inMatch[2] ?? '').split(',').map(parseValue)
    if (values.length === 0) throw new Error(`${s}: empty in list`)
    if (!isKnownField(field)) throw new Error(`unknown field "${field}"`)
    return { field, op: 'in', values }
  }
  for (const op of ['!=', '=^', '=', '>', '<'] as const) {
    const at = s.indexOf(op)
    if (at > 0) {
      const field = s.slice(0, at).trim()
      const value = parseValue(s.slice(at + op.length))
      if (!isKnownField(field)) throw new Error(`unknown field "${field}"`)
      return { field, op, values: [value] }
    }
  }
  throw new Error(`"${s.trim()}": no operator (=, !=, =^, >, <, in)`)
}

/** Parses selector text into terms. Throws Error with a message meant
 * for the input's error line. */
export function parseSelector(input: string): SelectorTerm[] {
  const trimmed = input.trim()
  if (trimmed === '') throw new Error('empty selector')
  return splitTop(trimmed).map((part) => parseTerm(part.trim()))
}

export function formatSelector(terms: SelectorTerm[]): string {
  return terms
    .map((t) =>
      t.op === 'in'
        ? `${t.field} in (${t.values.join(', ')})`
        : `${t.field}${t.op}${t.values[0] ?? ''}`,
    )
    .join(', ')
}

/** Returns terms with every `field` term removed. */
export function withoutField(terms: SelectorTerm[], field: string): SelectorTerm[] {
  return terms.filter((t) => t.field !== field)
}

/** Returns the first term for the field, if any. */
export function termFor(terms: SelectorTerm[], field: string): SelectorTerm | undefined {
  return terms.find((t) => t.field === field)
}
