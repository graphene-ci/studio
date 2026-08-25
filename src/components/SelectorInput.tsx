import { CornerDownLeftIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Input } from '@/components/ui/input'
import { tryParseQ } from '@/helpers/runsFilters'
import { cn } from '@/lib/utils'

interface SelectorInputProps {
  value: string
  // The parse error of the COMMITTED value (URL may carry a bad q).
  committedError: string | null
  onCommit: (q: string) => void
  // Empty text means "everything" on pages without a fixed kind.
  allowEmpty?: boolean
}

// The selector-language input: `kind=run, phase in (Running), label.env=prod`.
// Enter (or blur with changes) commits into the URL; local parse errors
// show inline before anything is committed. Autocomplete comes later.
export function SelectorInput({
  value,
  committedError,
  onCommit,
  allowEmpty = false,
}: SelectorInputProps) {
  const { t } = useTranslation()
  const [text, setText] = useState(value)
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    setText(value)
    setDirty(false)
  }, [value])

  const validate = (s: string): string | null =>
    allowEmpty && s.trim() === '' ? null : tryParseQ(s).error

  const localError = dirty ? validate(text) : null
  const error = localError ?? (dirty ? null : committedError)

  const commit = () => {
    if (validate(text) === null && text.trim() !== value) {
      onCommit(text.trim())
    }
    setDirty(false)
  }

  return (
    <div className="flex min-w-0 max-w-xl grow flex-col gap-1">
      <div className="relative">
        <Input
          value={text}
          spellCheck={false}
          aria-label={t('graphene.selector.label')}
          aria-invalid={error !== null}
          placeholder="kind=run, phase in (Running, Failed), label.env=prod"
          className="h-7 pr-8 font-mono text-xs"
          onChange={(event) => {
            setText(event.target.value)
            setDirty(true)
          }}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              commit()
            }
          }}
        />
        <CornerDownLeftIcon
          className={cn(
            'absolute top-1/2 right-2.5 size-3 -translate-y-1/2 text-muted-foreground',
            !dirty && 'opacity-0',
          )}
          aria-hidden
        />
      </div>
      {error !== null && <span className="font-mono text-2xs text-status-failed">{error}</span>}
    </div>
  )
}
