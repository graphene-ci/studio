// Part of the pinned status-color module: a small state dot.

import { cn } from '@/lib/utils'

import { TONE_DOT, type StatusTone } from './tones'

interface StatusDotProps {
  tone: StatusTone
  className?: string
}

export function StatusDot({ tone, className }: StatusDotProps) {
  return (
    <span
      aria-hidden="true"
      className={cn('inline-block size-1.5 rounded-full', TONE_DOT[tone], className)}
    />
  )
}
