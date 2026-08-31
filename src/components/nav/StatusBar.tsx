import { useStore } from '@nanostores/react'
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { client } from '@/client'
import { Breadcrumbs } from '@/components/nav/Breadcrumbs'
import { StatusDot } from '@/components/status/StatusDot'
import { TONE_TEXT } from '@/components/status/tones'
import { $currentContext } from '@/stores/contextsStore'
import { $editorFileStatus } from '@/stores/editorTabsStore'
import { dismissBalloon, notify } from '@/stores/notificationsStore'
import { cn } from '@/lib/utils'

type DoorState = 'live' | 'degraded' | 'down'

// StatusBar — the always-on connection monitor: rendering it is what
// keeps the ServerInfo heartbeat polling (5s). Door down beats
// everything; degraded means some watch target is failing while the
// door still answers.
export function StatusBar() {
  const { t } = useTranslation()
  const server = useStore(client.stores.server())
  const connection = useStore(client.stores.connection())
  const context = useStore($currentContext)

  const doorDown = server.error !== null
  const state: DoorState = doorDown ? 'down' : connection === 'degraded' ? 'degraded' : 'live'

  // Transition toasts: learn about a fallen server the moment the
  // heartbeat misses, not at the next restart.
  const prevDown = useRef<boolean | null>(null)
  useEffect(() => {
    if (prevDown.current === null) {
      prevDown.current = doorDown
      return
    }
    if (doorDown && !prevDown.current) {
      // Sticky, JB-style: an unreachable door stays on screen until
      // closed — or until the door answers again.
      notify({
        severity: 'error',
        title: t('graphene.statusbar.serverLost', { context }),
        key: 'server-conn',
      })
    } else if (!doorDown && prevDown.current) {
      dismissBalloon('server-conn')
      notify({
        severity: 'success',
        title: t('graphene.statusbar.serverBack', { context }),
        key: 'server-conn',
      })
    }
    prevDown.current = doorDown
  }, [doorDown, context, t])

  const sickComponents = (server.data?.components ?? []).filter((c) => !c.ok)
  const fileStatus = useStore($editorFileStatus)

  return (
    <div className="flex w-full items-center gap-3 px-3 font-mono text-2xs leading-none text-muted-foreground">
      <Breadcrumbs />
      <span className="grow" />
      {state === 'down' && (
        <span className={cn('min-w-0 truncate', TONE_TEXT.failed)}>
          {t('graphene.statusbar.serverDown')}
        </span>
      )}
      {state === 'degraded' && (
        <span className={TONE_TEXT.warning}>{t('graphene.statusbar.degraded')}</span>
      )}
      {state !== 'down' && sickComponents.length > 0 && (
        <span className={cn('min-w-0 truncate', TONE_TEXT.warning)}>
          {sickComponents
            .map((c) => `${c.name}: ${c.detail || t('graphene.statusbar.notOk')}`)
            .join(' · ')}
        </span>
      )}
      {fileStatus !== null && (
        <span className="shrink-0 text-muted-foreground">
          {fileStatus.state === 'readonly' && t('graphene.editor.readOnly')}
          {fileStatus.state === 'loading' && '…'}
        </span>
      )}
      <span className="flex shrink-0 items-center gap-1.5">
        <StatusDot
          tone={state === 'live' ? 'success' : state === 'degraded' ? 'warning' : 'failed'}
        />
        {context}
        {server.data !== null &&
          ` · ${t('graphene.statusbar.server', { version: server.data.version })}`}
      </span>
    </div>
  )
}
