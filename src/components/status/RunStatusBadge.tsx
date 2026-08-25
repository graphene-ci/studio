import { Badge } from '@/components/ui/badge'

// THE pinned mapping of run statuses to status tokens — the one place
// raw status colors are chosen (see AGENTS.md, Theming).
const toneByStatus: Record<string, string> = {
  Running: 'text-status-running',
  Completed: 'text-status-success',
  Failed: 'text-status-failed',
  Canceled: 'text-status-canceled',
  Terminated: 'text-status-failed',
  TimedOut: 'text-status-warning',
}

const dotByStatus: Record<string, string> = {
  Running: 'bg-status-running',
  Completed: 'bg-status-success',
  Failed: 'bg-status-failed',
  Canceled: 'bg-status-canceled',
  Terminated: 'bg-status-failed',
  TimedOut: 'bg-status-warning',
}

export function RunStatusBadge({ status }: { status: string }) {
  return (
    <Badge
      variant="secondary"
      className={`gap-1.5 ${toneByStatus[status] ?? 'text-muted-foreground'}`}
    >
      <span
        className={`size-1.5 rounded-full ${dotByStatus[status] ?? 'bg-muted-foreground'} ${status === 'Running' ? 'animate-pulse' : ''}`}
        aria-hidden
      />
      {status}
    </Badge>
  )
}
