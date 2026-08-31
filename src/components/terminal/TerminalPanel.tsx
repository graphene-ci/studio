import { useStore } from '@nanostores/react'
import { useTranslation } from 'react-i18next'

import { PtySession } from '@/components/terminal/PtySession'
import { $activePtySession, $ptySessions } from '@/stores/terminalStore'

// The Terminal panel body: the session canvas. Tabs live in the
// panel's HEADER (TerminalTabs); agents live on the Agents board —
// sessions arrive from there, or from the header's "+" / "▾".
export function TerminalPanel() {
  const { t } = useTranslation()
  const sessions = useStore($ptySessions)
  const activeSession = useStore($activePtySession)

  return (
    <div className="relative h-full min-h-0 min-w-0">
      {sessions.map((session) => (
        <PtySession
          key={session.key}
          agentId={session.agentRef.slice(session.agentRef.indexOf('/') + 1)}
          isActive={session.key === activeSession}
        />
      ))}
      {sessions.length === 0 && (
        <div className="flex h-full items-center justify-center px-4">
          <p className="text-center text-xs text-muted-foreground">
            {t('graphene.terminal.openHint')}
          </p>
        </div>
      )}
    </div>
  )
}
