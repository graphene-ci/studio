// Part of the pinned status-color module (see PhaseBadge): phase as
// plain colored text — the dense k9s-style variant for tree/list rows.

import { cn } from '@/lib/utils'

import { TONE_TEXT, type StatusTone } from './tones'

function toneOf(phase: string): StatusTone {
  switch (phase.toLowerCase()) {
    case 'ready':
      return 'success'
    case 'creating':
    case 'pending':
      return 'pending'
    case 'deleting':
      return 'warning'
    case 'failed':
    case 'deleted':
      return 'failed'
    default:
      return 'canceled'
  }
}

interface PhaseTextProps {
  phase: string
  className?: string
}

/** Phase value in its status color; server vocabulary, untranslated. */
export function PhaseText({ phase, className }: PhaseTextProps) {
  if (phase === '') return null
  return <span className={cn(TONE_TEXT[toneOf(phase)], className)}>{phase}</span>
}
