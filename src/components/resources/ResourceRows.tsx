import { ChevronDownIcon } from 'lucide-react'

import { PhaseBadge } from '@/components/status/PhaseBadge'
import { Badge } from '@/components/ui/badge'
import { formatRelative } from '@/helpers/relativeTime'
import type { ResourceVM } from '@/helpers/resourceVM'
import { cn } from '@/lib/utils'

export const RESOURCE_TD =
  'px-3 py-1.5 align-middle transition-colors group-hover/row:bg-surface-hover'

// The columns every resource row shares (everything after the ref).
export function ResourceTailCells({ r, now }: { r: ResourceVM; now: Date }) {
  return (
    <>
      <td className={RESOURCE_TD}>
        <span className="text-xs text-muted-foreground">{r.kind}</span>
      </td>
      <td className={RESOURCE_TD}>
        <span className="flex items-center gap-1.5">
          <PhaseBadge phase={r.phase} />
          {r.markedForDeletion && (
            <Badge variant="secondary" className="text-2xs text-status-failed">
              deleting
            </Badge>
          )}
          {r.pendingCommands > 0 && (
            <Badge variant="secondary" className="font-mono text-2xs text-status-pending">
              {r.pendingCommands}⌛
            </Badge>
          )}
        </span>
      </td>
      <td className={RESOURCE_TD}>
        <span className="font-mono text-xs text-muted-foreground">{r.owner}</span>
      </td>
      <td className={RESOURCE_TD}>
        <span className="flex flex-wrap gap-1">
          {Object.entries(r.labels).map(([k, v]) => (
            <Badge key={k} variant="outline" className="font-mono text-2xs">
              {k}={v}
            </Badge>
          ))}
        </span>
      </td>
      <td className={RESOURCE_TD}>
        {r.startedAt && (
          <span className="text-xs text-muted-foreground" title={r.startedAt.toLocaleString()}>
            {formatRelative(r.startedAt, now)}
          </span>
        )}
      </td>
    </>
  )
}

export const RESOURCE_COLSPAN = 6

interface ExpandChevronProps {
  expanded: boolean
  onToggle: () => void
  label: string
}

export function ExpandChevron({ expanded, onToggle, label }: ExpandChevronProps) {
  return (
    <button
      type="button"
      aria-expanded={expanded}
      aria-label={label}
      className="flex size-4 items-center justify-center text-muted-foreground hover:text-foreground"
      onClick={onToggle}
    >
      <ChevronDownIcon className={cn('size-3', !expanded && '-rotate-90')} />
    </button>
  )
}
