// Part of the pinned status-color module: the "commands in flight"
// marker on a record row.

import { cn } from '@/lib/utils'

interface PendingCommandsDotProps {
  count: number
  className?: string
}

export function PendingCommandsDot({ count, className }: PendingCommandsDotProps) {
  if (count <= 0) return null
  return (
    <span
      role="status"
      className={cn('size-1.5 shrink-0 rounded-full bg-status-pending', className)}
      aria-label={`${count}`}
    />
  )
}
