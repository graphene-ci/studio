import { useMemo, useState } from 'react'
import { stringify } from 'yaml'

import { CopyButton } from '@/components/CopyButton'
import { cn } from '@/lib/utils'

// YamlView renders any JSON value as highlighted YAML (the console's
// default lens) with a JSON toggle. Highlighting is a tiny line
// tokenizer — keys, strings, numbers, booleans, comments — no editor
// dependency.

type Tok = { text: string; cls: string }
type OffsetTok = Tok & { offset: number }

function withOffsets(tokens: Tok[]): OffsetTok[] {
  let offset = 0
  return tokens.map((token) => {
    const current = { ...token, offset }
    offset += token.text.length
    return current
  })
}

function linesWithOffsets(text: string): { text: string; offset: number }[] {
  let offset = 0
  return text.split('\n').map((line) => {
    const current = { text: line, offset }
    offset += line.length + 1
    return current
  })
}

function tokenizeLine(line: string): Tok[] {
  const out: Tok[] = []
  const keyMatch = /^(\s*(?:- )?)([\w./-]+)(:)(\s|$)/.exec(line)
  let rest = line
  if (keyMatch !== null) {
    const [, prefix = '', key = '', colon = '', spacing = ''] = keyMatch
    out.push({ text: prefix, cls: '' })
    out.push({ text: key, cls: 'text-primary' })
    out.push({ text: colon + spacing, cls: 'text-muted-foreground' })
    rest = line.slice(keyMatch[0].length)
  }
  const value = /^("[^"]*"|'[^']*')$/.test(rest.trim())
    ? 'string'
    : /^-?\d+(\.\d+)?$/.test(rest.trim())
      ? 'number'
      : /^(true|false|null|~)$/.test(rest.trim())
        ? 'bool'
        : null
  if (rest !== '') {
    const cls =
      value === 'string'
        ? 'text-status-success'
        : value === 'number'
          ? 'text-status-pending'
          : value === 'bool'
            ? 'text-status-pending'
            : rest.trimStart().startsWith('#')
              ? 'text-muted-foreground'
              : ''
    out.push({ text: rest, cls })
  }
  return out
}

interface YamlViewProps {
  value: unknown
  className?: string
}

export function YamlView({ value, className }: YamlViewProps) {
  const [asJson, setAsJson] = useState(false)
  const text = useMemo(() => {
    if (value === null || value === undefined) return ''
    try {
      return asJson ? JSON.stringify(value, null, 2) : stringify(value, { lineWidth: 100 })
    } catch {
      return String(value)
    }
  }, [value, asJson])

  return (
    <div className={cn('relative min-h-0 overflow-auto rounded-md bg-background', className)}>
      <div className="absolute top-1 right-1 z-10 flex items-center gap-0.5">
        <button
          type="button"
          className={cn(
            'rounded-sm px-1.5 py-0.5 font-mono text-2xs',
            !asJson ? 'bg-accent text-foreground' : 'text-muted-foreground',
          )}
          onClick={() => setAsJson(false)}
        >
          yaml
        </button>
        <button
          type="button"
          className={cn(
            'rounded-sm px-1.5 py-0.5 font-mono text-2xs',
            asJson ? 'bg-accent text-foreground' : 'text-muted-foreground',
          )}
          onClick={() => setAsJson(true)}
        >
          json
        </button>
        <CopyButton value={text} label={asJson ? 'JSON' : 'YAML'} />
      </div>
      <pre className="p-3 font-mono text-2xs leading-relaxed">
        {text === '' ? (
          <span className="text-muted-foreground">—</span>
        ) : asJson ? (
          text
        ) : (
          linesWithOffsets(text).map((line) => (
            <span key={line.offset} className="block">
              {withOffsets(tokenizeLine(line.text)).map((tok) => (
                <span key={tok.offset} className={tok.cls || undefined}>
                  {tok.text}
                </span>
              ))}
            </span>
          ))
        )}
      </pre>
    </div>
  )
}
