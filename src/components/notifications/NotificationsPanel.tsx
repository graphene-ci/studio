import { useStore } from '@nanostores/react'
import { Trash2Icon } from 'lucide-react'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'

import { SeverityIcon } from '@/components/status/SeverityIcon'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  $notifications,
  clearNotifications,
  markAllNotificationsRead,
} from '@/stores/notificationsStore'

// Lives in the panel's HEADER, next to the title.
export function NotificationsPanelActions() {
  const { t } = useTranslation()
  const items = useStore($notifications)
  return (
    <div className="flex items-center pr-1">
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={t('graphene.notifications.clear')}
        title={t('graphene.notifications.clear')}
        disabled={items.length === 0}
        onClick={clearNotifications}
      >
        <Trash2Icon />
      </Button>
    </div>
  )
}

// The notification center (JB model): balloons are transient, this
// panel is the truth. Opening it marks everything read.
export function NotificationsPanel() {
  const { t, i18n } = useTranslation()
  const items = useStore($notifications)

  useEffect(() => {
    markAllNotificationsRead()
  }, [])

  const time = new Intl.DateTimeFormat(i18n.language, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })

  if (items.length === 0) {
    return (
      <p className="px-3 py-4 text-xs text-muted-foreground">{t('graphene.notifications.empty')}</p>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <ul
        className="min-h-0 flex-1 overflow-y-auto px-2 py-1"
        aria-label={t('graphene.workspace.panels.notifications')}
      >
        {items.map((n) => (
          <li
            key={n.id}
            className="flex items-start gap-2 rounded-sm px-1.5 py-1.5 hover:bg-surface-hover"
          >
            <SeverityIcon severity={n.severity} className="mt-0.5" />
            <span className="flex min-w-0 grow flex-col">
              <span className={cn('text-xs', !n.read && 'font-semibold')}>{n.title}</span>
              {n.body !== '' && <span className="text-2xs text-muted-foreground">{n.body}</span>}
            </span>
            <span className="shrink-0 font-mono text-3xs text-muted-foreground">
              {time.format(n.at)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
