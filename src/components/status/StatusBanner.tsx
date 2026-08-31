// Part of the pinned status-color module: a soft tone strip (e.g.
// the read-only banner over a git-source file).

import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'
import type { StatusTone } from './tones'

const TONE_BANNER: Record<StatusTone, string> = {
  success: 'bg-status-success-bg text-status-success',
  pending: 'bg-status-pending-bg text-status-pending',
  warning: 'bg-status-warning-bg text-status-warning',
  failed: 'bg-status-failed-bg text-status-failed',
  canceled: 'bg-status-canceled-bg text-status-canceled',
}

interface StatusBannerProps {
  tone: StatusTone
  className?: string
  children: ReactNode
}

export function StatusBanner({ tone, className, children }: StatusBannerProps) {
  return <div className={cn('px-4 py-1.5 text-2xs', TONE_BANNER[tone], className)}>{children}</div>
}
