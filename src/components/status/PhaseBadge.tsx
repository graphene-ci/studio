import { Badge } from '@/components/ui/badge'

// Pinned mapping of entity phases to status tokens (see AGENTS.md).
const toneByPhase: Record<string, string> = {
  ready: 'text-status-success',
  creating: 'text-status-running',
  provisioning: 'text-status-running',
  deleting: 'text-status-warning',
  deleted: 'text-status-canceled',
  failed: 'text-status-failed',
  error: 'text-status-failed',
}

export function PhaseBadge({ phase }: { phase: string }) {
  if (phase === '') return null
  return (
    <Badge
      variant="secondary"
      className={`text-2xs ${toneByPhase[phase] ?? 'text-muted-foreground'}`}
    >
      {phase}
    </Badge>
  )
}
