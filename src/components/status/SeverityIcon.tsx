// Part of the pinned status-color module: notification severity glyph.

import { CircleAlertIcon, CircleCheckIcon, InfoIcon, TriangleAlertIcon } from 'lucide-react'

import type { NotificationSeverity } from '@/stores/notificationsStore'
import { cn } from '@/lib/utils'

import { TONE_TEXT, type StatusTone } from './tones'

const SEVERITY_TONE: Record<NotificationSeverity, StatusTone> = {
  info: 'canceled',
  success: 'success',
  warning: 'warning',
  error: 'failed',
}

const SEVERITY_ICON = {
  info: InfoIcon,
  success: CircleCheckIcon,
  warning: TriangleAlertIcon,
  error: CircleAlertIcon,
} as const

interface SeverityIconProps {
  severity: NotificationSeverity
  className?: string
}

export function SeverityIcon({ severity, className }: SeverityIconProps) {
  const Icon = SEVERITY_ICON[severity]
  return (
    <Icon
      aria-hidden="true"
      className={cn('size-3.5 shrink-0', TONE_TEXT[SEVERITY_TONE[severity]], className)}
    />
  )
}
