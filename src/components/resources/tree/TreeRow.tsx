import { ChevronDownIcon, ChevronRightIcon } from 'lucide-react'
import type { Ref } from 'react'

import { KindIcon } from '@/components/resources/tree/KindIcon'
import { PendingCommandsDot } from '@/components/status/PendingCommandsDot'
import { PhaseText } from '@/components/status/PhaseText'
import type { TreeRowVM } from '@/helpers/resourceTree'
import { cn } from '@/lib/utils'

interface TreeRowProps {
  row: TreeRowVM
  isSelected: boolean
  isActive: boolean
  rowRef?: Ref<HTMLDivElement>
  /** Single click: activate the row (records also select). */
  onActivate: (row: TreeRowVM) => void
  onToggle: (key: string, open?: boolean) => void
}

function Chevron({ isExpanded }: { isExpanded: boolean }) {
  return isExpanded ? (
    <ChevronDownIcon className="size-3.5" />
  ) : (
    <ChevronRightIcon className="size-3.5" />
  )
}

/** One tree row: a kind group (`pipeline/ · 3`) or a record
 * (`kind/` muted + id, phase colored on the right). Dense, mono. */
export function TreeRow({ row, isSelected, isActive, rowRef, onActivate, onToggle }: TreeRowProps) {
  const hasChildren = row.type === 'group' ? row.count > 0 : row.hasChildren

  return (
    // Keyboard is handled by the tree container (roving tabindex, APG
    // tree pattern) — the row itself only carries focus and click.
    // biome-ignore lint/a11y/useKeyWithClickEvents: keys live on the role=tree container.
    <div
      ref={rowRef}
      role="treeitem"
      aria-level={row.depth + 1}
      aria-selected={row.type === 'record' ? isSelected : undefined}
      aria-expanded={hasChildren ? row.isExpanded : undefined}
      tabIndex={isActive ? 0 : -1}
      className={cn(
        'flex h-6 min-w-0 cursor-pointer items-center gap-1 rounded-sm pr-2 font-mono text-xs outline-none',
        'focus-visible:ring-2 focus-visible:ring-ring',
        isSelected ? 'bg-accent text-accent-foreground' : 'hover:bg-surface-hover',
      )}
      style={{ paddingLeft: `calc(${row.depth} * var(--tree-indent) + var(--tree-pad))` }}
      onClick={() => onActivate(row)}
      onDoubleClick={() => {
        if (hasChildren) onToggle(row.key)
      }}
    >
      {hasChildren ? (
        <button
          type="button"
          tabIndex={-1}
          aria-hidden="true"
          className="flex size-4 shrink-0 items-center justify-center text-muted-foreground"
          onClick={(e) => {
            e.stopPropagation()
            onToggle(row.key)
          }}
        >
          <Chevron isExpanded={row.isExpanded} />
        </button>
      ) : (
        <span className="size-4 shrink-0" />
      )}
      <KindIcon kind={row.kind} />
      {row.type === 'group' ? (
        <span className="flex min-w-0 grow items-baseline gap-1.5">
          <span className="truncate">{row.kind}/</span>
          <span className="text-2xs text-muted-foreground">{row.count}</span>
        </span>
      ) : (
        <>
          <span
            className={cn(
              'flex min-w-0 grow items-baseline',
              row.markedForDeletion && 'line-through opacity-60',
            )}
          >
            <span className="text-muted-foreground">{row.kind}/</span>
            <span className="truncate">{row.id}</span>
          </span>
          <PendingCommandsDot count={row.pendingCommands} />
          <PhaseText phase={row.phase} className="shrink-0 text-2xs" />
        </>
      )}
    </div>
  )
}
