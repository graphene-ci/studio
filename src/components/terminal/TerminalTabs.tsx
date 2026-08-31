import { useStore } from '@nanostores/react'
import { ChevronDownIcon, PlusIcon, XIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { StatusDot } from '@/components/status/StatusDot'
import { useAgents } from '@/components/terminal/useAgents'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { displayAddresses } from '@/helpers/agentState'
import { cn } from '@/lib/utils'
import {
  $activePtySession,
  $ptySessions,
  closePtySession,
  openPtySession,
} from '@/stores/terminalStore'

// Lives in the terminal panel's HEADER, next to the title (VSCode
// pattern): session tabs, then "+" (one more shell on the ACTIVE
// tab's agent) and "▾" (pick an online agent explicitly).
export function TerminalTabs() {
  const { t } = useTranslation()
  const sessions = useStore($ptySessions)
  const active = useStore($activePtySession)
  const { agents } = useAgents()

  // "+" target: the active tab's agent; "▾" picks explicitly.
  const activeAgentRef = sessions.find((s) => s.key === active)?.agentRef ?? null
  const plusAgent = agents.find((a) => a.ref === activeAgentRef && a.connected) ?? null
  const online = agents.filter((a) => a.connected)

  return (
    <div className="flex min-w-0 grow items-center gap-1 overflow-x-auto px-2">
      {sessions.map((session) => (
        <span
          key={session.key}
          className={cn(
            'flex h-6 shrink-0 items-center gap-1 rounded-sm pr-1 pl-2 font-mono text-2xs',
            session.key === active
              ? 'bg-accent text-accent-foreground'
              : 'text-muted-foreground hover:bg-surface-hover',
          )}
        >
          <button
            type="button"
            className="outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => $activePtySession.set(session.key)}
            onAuxClick={(e) => {
              if (e.button === 1) closePtySession(session.key)
            }}
          >
            {session.title}
          </button>
          <button
            type="button"
            aria-label={t('graphene.terminal.closeSession', { title: session.title })}
            className="flex size-4 items-center justify-center rounded-xs outline-none hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => closePtySession(session.key)}
          >
            <XIcon className="size-3" />
          </button>
        </span>
      ))}
      <span className="flex shrink-0 items-center">
        <button
          type="button"
          aria-label={t('graphene.terminal.newSession')}
          title={
            plusAgent !== null
              ? t('graphene.terminal.newSessionOn', { id: plusAgent.id })
              : t('graphene.terminal.newSession')
          }
          disabled={plusAgent === null}
          className="flex size-6 items-center justify-center rounded-sm text-muted-foreground outline-none hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40"
          onClick={() => plusAgent !== null && openPtySession(plusAgent.ref)}
        >
          <PlusIcon className="size-3.5" />
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={t('graphene.terminal.pickAgent')}
              className="flex h-6 w-4 items-center justify-center rounded-sm text-muted-foreground outline-none hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ChevronDownIcon className="size-3" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuLabel>{t('graphene.terminal.pickAgent')}</DropdownMenuLabel>
            {online.length === 0 && (
              <div className="px-2 py-1.5 text-xs text-muted-foreground">
                {t('graphene.terminal.noneOnline')}
              </div>
            )}
            {online.map((agent) => (
              <DropdownMenuItem key={agent.ref} onSelect={() => openPtySession(agent.ref)}>
                <StatusDot tone="success" />
                <span className="font-mono text-xs">{agent.id}</span>
                {displayAddresses(agent)[0] !== undefined && (
                  <span className="ml-auto truncate font-mono text-2xs text-muted-foreground">
                    {displayAddresses(agent)[0]}
                  </span>
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </span>
    </div>
  )
}
