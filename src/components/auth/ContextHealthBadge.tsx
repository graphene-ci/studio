import { useTranslation } from 'react-i18next'

import type { ContextHealth } from '@/stores/contextHealthStore'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'

interface ContextHealthBadgeProps {
  health: ContextHealth | undefined
}

const toneByState = {
  ok: 'text-status-success',
  reachable: 'text-status-running',
  invalid_token: 'text-status-pending',
  unreachable: 'text-status-failed',
} as const

export function ContextHealthBadge({ health }: ContextHealthBadgeProps) {
  const { t } = useTranslation()

  if (health === undefined) return null
  if (health.state === undefined) {
    // First check still running — nothing known yet.
    return health.checking ? <Spinner className="size-3.5 text-muted-foreground" /> : null
  }
  return (
    <Badge
      variant="secondary"
      className={`text-2xs ${toneByState[health.state]} ${health.checking ? 'opacity-60' : ''}`}
    >
      {health.state === 'ok'
        ? t('graphene.contexts.health.ok', { role: health.role })
        : t(`graphene.contexts.health.${health.state}`)}
    </Badge>
  )
}
