import { CheckIcon, FilterIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

// ColumnHeader — the stroppy-ref pattern: `Label [⛃ filter]`. The
// filter popover's open-state is LIFTED to the page (openColumnId), so
// refetch re-renders can't close it and polling pauses while open.
interface ColumnHeaderProps {
  label: string
  columnId?: string
  filterActive?: boolean
  openColumnId: string | null
  onOpenChange: (columnId: string, open: boolean) => void
  children?: React.ReactNode
}

export function ColumnHeader({
  label,
  columnId,
  filterActive,
  openColumnId,
  onOpenChange,
  children,
}: ColumnHeaderProps) {
  const { t } = useTranslation()

  return (
    <div className="flex items-center gap-1.5">
      <span className="leading-none whitespace-nowrap">{label}</span>
      {children !== undefined && columnId !== undefined ? (
        <Popover
          open={openColumnId === columnId}
          onOpenChange={(open) => onOpenChange(columnId, open)}
        >
          <PopoverTrigger asChild>
            <button
              type="button"
              className={cn(
                'flex size-6 shrink-0 items-center justify-center rounded-sm hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring',
                filterActive ? 'text-primary' : 'text-muted-foreground',
              )}
              aria-label={t('graphene.runs.filterColumn', { label })}
            >
              <FilterIcon className="size-3" fill={filterActive ? 'currentColor' : 'none'} />
            </button>
          </PopoverTrigger>
          <PopoverContent align="center" className="w-56 p-0">
            {children}
          </PopoverContent>
        </Popover>
      ) : (
        <span className="size-6 shrink-0" aria-hidden />
      )}
    </div>
  )
}

/** Multi-select checklist filter body; empty selection = All. */
export function ChecklistFilter({
  options,
  selected,
  onChange,
}: {
  options: readonly string[]
  selected: string[]
  onChange: (next: string[]) => void
}) {
  const { t } = useTranslation()
  const set = new Set(selected)
  const allSelected = set.size === 0

  const row = (checked: boolean, label: string, onClick: () => void, key?: string) => (
    <button
      key={key ?? label}
      type="button"
      className="flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-xs hover:bg-accent"
      onClick={onClick}
    >
      <span
        className={cn(
          'flex size-3.5 shrink-0 items-center justify-center rounded-sm border border-input',
          checked && 'border-primary bg-primary',
        )}
      >
        {checked && <CheckIcon className="size-2.5 text-primary-foreground" />}
      </span>
      <span className="truncate">{label}</span>
    </button>
  )

  return (
    <div className="py-1">
      {row(allSelected, t('graphene.runs.filterAll'), () => onChange([]), '__all')}
      <div className="max-h-60 overflow-y-auto">
        {options.map((opt) =>
          row(
            set.has(opt),
            opt,
            () => {
              const next = new Set(set)
              if (next.has(opt)) {
                next.delete(opt)
              } else {
                next.add(opt)
              }
              onChange([...next])
            },
            opt,
          ),
        )}
      </div>
    </div>
  )
}

/** Debounced free-text filter body that keeps focus across refetches. */
export function TextFilter({
  value,
  placeholder,
  onCommit,
}: {
  value: string
  placeholder: string
  onCommit: (value: string) => void
}) {
  const [text, setText] = useState(value)
  const inputRef = useRef<HTMLInputElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => setText(value), [value])
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  return (
    <div className="p-2">
      <Input
        ref={inputRef}
        value={text}
        placeholder={placeholder}
        className="h-8 font-mono text-xs"
        onChange={(event) => {
          const next = event.target.value
          setText(next)
          if (timerRef.current !== null) clearTimeout(timerRef.current)
          timerRef.current = setTimeout(() => onCommit(next.trim()), 300)
        }}
      />
    </div>
  )
}
