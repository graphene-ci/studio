// Pure parsing of the KIND DICTIONARY record (kind/<name>): what a
// kind can do (commands + payload schemas) and how it is declared
// (spec schema). The server owns the schema language (schemapb-style
// JSON); this mirrors just enough to build forms.

import type { Resource } from '@/proto/management/v1/resources_pb'

export interface SchemaField {
  name: string
  required: boolean
  /** string | json | duration | map | bool | int | unknown */
  type: string
  /** Secret values: masked input, never echoed. */
  secret: boolean
}

export interface CommandInfo {
  name: string
  fields: SchemaField[]
}

export interface KindInfo {
  description: string
  commands: CommandInfo[]
  specFields: SchemaField[]
  dimensions: string[]
}

const decoder = new TextDecoder()

function fieldType(raw: Record<string, unknown>): string {
  for (const key of ['string', 'json', 'duration', 'map', 'bool', 'int', 'number']) {
    if (key in raw) return key
  }
  return 'unknown'
}

export function parseSchemaFields(schema: unknown): SchemaField[] {
  if (schema === null || typeof schema !== 'object' || !('fields' in schema)) return []
  const fields = (schema as { fields: unknown }).fields
  if (!Array.isArray(fields)) return []
  return fields
    .filter((f): f is Record<string, unknown> => typeof f === 'object' && f !== null)
    .map((f) => ({
      name: typeof f.name === 'string' ? f.name : '',
      required: f.required === true,
      type: fieldType(f),
      secret: f.secret === true,
    }))
    .filter((f) => f.name !== '')
}

/** Reads a kind record into the surface the UI builds from. */
export function kindInfo(record: Resource): KindInfo {
  let state: Record<string, unknown> = {}
  try {
    const parsed: unknown = JSON.parse(decoder.decode(record.state))
    if (parsed !== null && typeof parsed === 'object') state = parsed as Record<string, unknown>
  } catch {
    // An unreadable dictionary entry yields an empty surface.
  }
  const commandsRaw = Array.isArray(state.commands) ? state.commands : []
  return {
    description: typeof state.description === 'string' ? state.description : '',
    commands: commandsRaw
      .filter((c): c is Record<string, unknown> => typeof c === 'object' && c !== null)
      .map((c) => ({
        name: typeof c.name === 'string' ? c.name : '',
        fields: parseSchemaFields(c.payloadSchema),
      }))
      .filter((c) => c.name !== ''),
    specFields: parseSchemaFields(state.specSchema),
    dimensions: Array.isArray(state.dimensions)
      ? state.dimensions.filter((d): d is string => typeof d === 'string')
      : [],
  }
}
