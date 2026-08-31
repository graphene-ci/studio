// Language resolution for the code editor: file name → CodeMirror
// language support + an optional parse-check. Pure module — extend
// the maps here, never at call sites.

import { css } from '@codemirror/lang-css'
import { go } from '@codemirror/lang-go'
import { html } from '@codemirror/lang-html'
import { javascript } from '@codemirror/lang-javascript'
import { json, jsonParseLinter } from '@codemirror/lang-json'
import { markdown } from '@codemirror/lang-markdown'
import { sql } from '@codemirror/lang-sql'
import { xml } from '@codemirror/lang-xml'
import { yaml } from '@codemirror/lang-yaml'
import { StreamLanguage } from '@codemirror/language'
import { dockerFile } from '@codemirror/legacy-modes/mode/dockerfile'
import { properties } from '@codemirror/legacy-modes/mode/properties'
import { protobuf } from '@codemirror/legacy-modes/mode/protobuf'
import { shell } from '@codemirror/legacy-modes/mode/shell'
import { toml } from '@codemirror/legacy-modes/mode/toml'
import type { Extension } from '@codemirror/state'
import type { EditorView } from '@codemirror/view'
import { parse as parseYaml, YAMLParseError } from 'yaml'

export interface EditorDiagnostic {
  from: number
  to: number
  message: string
}

export interface EditorLanguage {
  support: Extension
  /** Built-in parse check; undefined — no checker for the language. */
  lint?: (view: EditorView) => EditorDiagnostic[]
  /** Indent unit; default four spaces. Go indents with a real tab. */
  indent?: string
}

function yamlLint(view: EditorView): EditorDiagnostic[] {
  const text = view.state.doc.toString()
  if (text.trim() === '') return []
  try {
    parseYaml(text)
    return []
  } catch (err) {
    if (err instanceof YAMLParseError && err.pos !== undefined) {
      const [from, to] = err.pos
      return [{ from, to: Math.max(to, from + 1), message: err.message }]
    }
    return []
  }
}

function jsonLint(view: EditorView): EditorDiagnostic[] {
  return jsonParseLinter()(view).map((d) => ({ from: d.from, to: d.to, message: d.message }))
}

const legacy = (mode: Parameters<typeof StreamLanguage.define>[0]): EditorLanguage => ({
  support: StreamLanguage.define(mode),
})

const BY_NAME: Record<string, EditorLanguage> = {
  dockerfile: legacy(dockerFile),
  makefile: legacy(shell),
}

const BY_EXTENSION: Record<string, () => EditorLanguage> = {
  go: () => ({ support: go(), indent: '\t' }),
  yaml: () => ({ support: yaml(), lint: yamlLint }),
  yml: () => ({ support: yaml(), lint: yamlLint }),
  json: () => ({ support: json(), lint: jsonLint }),
  md: () => ({ support: markdown() }),
  mdx: () => ({ support: markdown() }),
  js: () => ({ support: javascript() }),
  mjs: () => ({ support: javascript() }),
  cjs: () => ({ support: javascript() }),
  jsx: () => ({ support: javascript({ jsx: true }) }),
  ts: () => ({ support: javascript({ typescript: true }) }),
  tsx: () => ({ support: javascript({ typescript: true, jsx: true }) }),
  html: () => ({ support: html() }),
  htm: () => ({ support: html() }),
  css: () => ({ support: css() }),
  xml: () => ({ support: xml() }),
  svg: () => ({ support: xml() }),
  sql: () => ({ support: sql() }),
  sh: () => legacy(shell),
  bash: () => legacy(shell),
  zsh: () => legacy(shell),
  toml: () => legacy(toml),
  proto: () => legacy(protobuf),
  properties: () => legacy(properties),
  env: () => legacy(properties),
  ini: () => legacy(properties),
  conf: () => legacy(properties),
}

/** Resolves the language for a file name; null — plain text. */
export function languageForFile(name: string): EditorLanguage | null {
  const lower = name.toLowerCase()
  const byName = BY_NAME[lower]
  if (byName !== undefined) return byName
  const dot = lower.lastIndexOf('.')
  if (dot <= 0) return null
  const make = BY_EXTENSION[lower.slice(dot + 1)]
  return make === undefined ? null : make()
}

/** The paste-box default (yaml with its checker). */
export function yamlLanguage(): EditorLanguage {
  return { support: yaml(), lint: yamlLint }
}
