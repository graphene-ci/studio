// The pinned status-color module: CI/entity status tokens reach
// markup ONLY through here (see AGENTS.md "Theming").

import { cn } from '@/lib/utils'

type Tone = 'success' | 'pending' | 'warning' | 'failed' | 'canceled'

const TONE_CLASSES: Record<Tone, string> = {
  success: 'bg-status-success-bg text-status-success',
  pending: 'bg-status-pending-bg text-status-pending',
  warning: 'bg-status-warning-bg text-status-warning',
  failed: 'bg-status-failed-bg text-status-failed',
  canceled: 'bg-status-canceled-bg text-status-canceled',
}

function toneOf(phase: string): Tone {
  switch (phase.toLowerCase()) {
    case 'ready':
    case 'completed':
      return 'success'
    case 'creating':
    case 'pending':
      return 'pending'
    case 'deleting':
    case 'running':
      return 'warning'
    case 'failed':
    case 'deleted':
    case 'terminated':
    case 'timedout':
      return 'failed'
    default:
      // canceled and any unknown status.
      return 'canceled'
  }
}

interface PhaseBadgeProps {
  phase: string
  className?: string
}

/** Entity phase as a soft badge; the phase VALUE is server vocabulary
 * and stays untranslated. */
export function PhaseBadge({ phase, className }: PhaseBadgeProps) {
  if (phase === '') return null
  return (
    <span
      className={cn(
        'inline-flex h-5 items-center rounded-sm px-1.5 font-mono text-2xs',
        TONE_CLASSES[toneOf(phase)],
        className,
      )}
    >
      {phase}
    </span>
  )
}
