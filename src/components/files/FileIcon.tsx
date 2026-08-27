// File-type icons — the FULL JetBrains fileTypes set (classic
// platform icons + expui gap-fillers, Apache 2.0, vendored; see
// ICONS-NOTICE.md), auto-registered from the assets folder. We don't
// know what a user keeps in a source tree, so quantity wins.

import { ThemedIcon } from '@/components/ThemedIcon'
import { cn } from '@/lib/utils'

// stem → asset URL, built from the folder: <stem>.svg / <stem>_dark.svg.
const modules = import.meta.glob('@/assets/icons/file/*.svg', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>

const REGISTRY = new Map<string, { light: string; dark?: string }>()
for (const [path, url] of Object.entries(modules)) {
  const base = path.slice(path.lastIndexOf('/') + 1).replace(/\.svg$/, '')
  const stem = base.replace(/_dark$/, '')
  const entry = REGISTRY.get(stem) ?? { light: '' }
  if (base.endsWith('_dark')) entry.dark = url
  else entry.light = url
  REGISTRY.set(stem, entry)
}

/** Whole-name matches (lowercased) — files whose type is the name. */
const BY_NAME: Record<string, string> = {
  dockerfile: 'docker',
  jenkinsfile: 'jenkins',
  makefile: 'config',
  'go.mod': 'go',
  'go.sum': 'go',
  '.gitignore': 'gitignore',
  '.dockerignore': 'gitignore',
  '.editorconfig': 'editorConfig',
  '.env': 'properties',
}

/** Extensions that map to a differently-named icon stem. */
const EXT_ALIAS: Record<string, string> = {
  yml: 'yaml',
  js: 'javaScript',
  mjs: 'javaScript',
  cjs: 'javaScript',
  jsx: 'javaScript',
  ts: 'typeScript',
  mts: 'typeScript',
  cts: 'typeScript',
  tsx: 'typeScript',
  md: 'markdown',
  mdx: 'markdown',
  sh: 'shell',
  bash: 'shell',
  zsh: 'shell',
  cs: 'Csharp',
  cc: 'cpp',
  cxx: 'cpp',
  hpp: 'h',
  htm: 'html',
  svg: 'image',
  png: 'image',
  jpg: 'image',
  jpeg: 'image',
  gif: 'image',
  webp: 'image',
  ico: 'image',
  bmp: 'image',
  tar: 'archive',
  gz: 'archive',
  tgz: 'archive',
  zip: 'archive',
  jar: 'archive',
  env: 'properties',
  ini: 'config',
  conf: 'config',
  cfg: 'config',
  tf: 'terraform',
  tfvars: 'terraform',
  kts: 'gradle',
  pl: 'perl',
  py: 'python',
  rs: 'rust',
  rb: 'ruby',
  kt: 'kotlin',
  swift: 'swiftLang',
  ipynb: 'jupyter',
  gql: 'graphql',
  diff: 'patch',
  rc: 'config',
  txt: 'text',
  log: 'text',
  lock: 'text',
  gohtml: 'html',
  tmpl: 'text',
}

function stemFor(name: string): string {
  const lower = name.toLowerCase()
  const byName = BY_NAME[lower]
  if (byName !== undefined && REGISTRY.has(byName)) return byName
  const dot = lower.lastIndexOf('.')
  const ext = dot > 0 ? lower.slice(dot + 1) : ''
  if (ext === '') return REGISTRY.has('anyType') ? 'anyType' : 'text'
  const alias = EXT_ALIAS[ext]
  if (alias !== undefined && REGISTRY.has(alias)) return alias
  // Many stems ARE the extension: css, json, java, yaml, xml, sql, …
  if (REGISTRY.has(ext)) return ext
  return 'text'
}

interface FileIconProps {
  /** File name; undefined — a directory. */
  name?: string
  className?: string
}

export function FileIcon({ name, className }: FileIconProps) {
  const stem = name === undefined ? 'folder' : stemFor(name)
  const asset = REGISTRY.get(stem) ?? REGISTRY.get('text')
  if (asset === undefined || asset.light === '') return null
  return (
    <ThemedIcon
      light={asset.light}
      dark={asset.dark}
      className={cn('size-3.5 shrink-0', className)}
    />
  )
}
