import {
  CpuIcon,
  MemoryStickIcon,
  RotateCcwIcon,
  SquareTerminalIcon,
  UploadIcon,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

import archLogo from '@/assets/icons/os/arch.svg'
import debianLogo from '@/assets/icons/os/debian.svg'
import dockerLogo from '@/assets/icons/os/docker.svg'
import fedoraLogo from '@/assets/icons/os/fedora.svg'
import linuxLogo from '@/assets/icons/os/linux.svg'
import ubuntuLogo from '@/assets/icons/os/ubuntu.svg'
import { StatusDot } from '@/components/status/StatusDot'
import { useAgents } from '@/components/terminal/useAgents'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { displayAddresses, type AgentCapability, type AgentInfo } from '@/helpers/agentState'
import { relativeTime } from '@/helpers/relativeTime'
import { cn } from '@/lib/utils'
import { openPtySession } from '@/stores/terminalStore'
import { openWorkspacePanel } from '@/stores/workspaceLayoutStore'

const OS_LOGOS: Record<string, string> = {
  ubuntu: ubuntuLogo,
  debian: debianLogo,
  fedora: fedoraLogo,
  arch: archLogo,
  archlinux: archLogo,
}

const CAPABILITY_LOGOS: Record<string, string> = {
  docker: dockerLogo,
}

// The Agents board — machine CARDS in a wrapping grid: each card is
// its own width unit, rows wrap instead of one endless table line.
export function AgentsPanel() {
  const { t } = useTranslation()
  const { agents: roster, loaded, error } = useAgents()
  // Online first, then by id — the live machines are what you came for.
  const agents = [...roster].sort((a, b) =>
    a.connected === b.connected ? a.id.localeCompare(b.id) : a.connected ? -1 : 1,
  )

  if (!loaded && error === null) {
    return (
      <div className="flex justify-center py-6">
        <Spinner className="size-4" />
      </div>
    )
  }
  if (!loaded && error !== null) {
    return <p className="px-3 py-4 text-xs text-destructive">{t('graphene.terminal.listError')}</p>
  }
  if (agents.length === 0) {
    return <p className="px-3 py-4 text-xs text-muted-foreground">{t('graphene.terminal.empty')}</p>
  }

  return (
    <div className="h-full min-h-0 overflow-y-auto p-2">
      <div className="grid grid-cols-[repeat(auto-fill,minmax(20rem,26rem))] justify-start gap-2">
        {agents.map((agent) => (
          <AgentCard key={agent.ref} agent={agent} />
        ))}
      </div>
    </div>
  )
}

function AgentCard({ agent }: { agent: AgentInfo }) {
  const { t, i18n } = useTranslation()
  const facts = agent.facts

  const shell = () => {
    openWorkspacePanel('terminal')
    openPtySession(agent.ref)
  }

  return (
    <div className="flex flex-col gap-1.5 rounded-md bg-muted p-2.5 font-mono text-xs">
      <div className="flex min-w-0 grow flex-col gap-1.5">
        <div className="flex items-center gap-2">
          {/* The distro mark rides the title line — no dead column. */}
          <img
            src={facts !== null ? (OS_LOGOS[facts.osReleaseId] ?? linuxLogo) : linuxLogo}
            alt={facts?.osReleaseId ?? ''}
            className={cn('size-4.5 shrink-0', !agent.connected && 'opacity-40 grayscale')}
          />
          <span className="min-w-0 truncate font-medium">{agent.id}</span>
          <StatusDot tone={agent.connected ? 'success' : 'canceled'} />
          <span className="min-w-0 truncate text-2xs text-muted-foreground">
            {agent.connected
              ? t('graphene.agentsPanel.online', {
                  since:
                    agent.connectedAt > 0 ? relativeTime(agent.connectedAt, i18n.language) : '',
                })
              : t('graphene.agentsPanel.offline')}
          </span>
          <span className="grow" />
          <IconAction
            label={t('graphene.agentsPanel.shell')}
            disabled={!agent.connected}
            onClick={shell}
          >
            <SquareTerminalIcon />
          </IconAction>
          <SoonAction label={t('graphene.agentsPanel.update')}>
            <UploadIcon />
          </SoonAction>
          <SoonAction label={t('graphene.agentsPanel.restart')}>
            <RotateCcwIcon />
          </SoonAction>
        </div>

        {facts !== null && (
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground">
            <span className="min-w-0 truncate">
              {facts.hostname}
              {facts.osReleaseId !== '' &&
                ` · ${facts.osReleaseId} ${facts.osReleaseVersion}`.trimEnd()}
              {` · ${facts.os}/${facts.arch}`}
            </span>
            <span className="flex items-center gap-1">
              <CpuIcon className="size-3 shrink-0" aria-hidden="true" />
              {facts.cpus}
            </span>
            <span className="flex items-center gap-1">
              <MemoryStickIcon className="size-3 shrink-0" aria-hidden="true" />
              {(facts.memoryBytes / (1024 * 1024 * 1024)).toFixed(1)}G
            </span>
          </div>
        )}

        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <span className="truncate text-2xs text-muted-foreground">
            {displayAddresses(agent).join(' · ') || '—'}
          </span>
          <span className="grow" />
          {agent.capabilities.map((cap) => (
            <CapabilityChip key={cap.name} capability={cap} />
          ))}
        </div>
      </div>
    </div>
  )
}

function CapabilityChip({ capability }: { capability: AgentCapability }) {
  const logo = CAPABILITY_LOGOS[capability.name]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-sm bg-background px-1.5 py-0.5 text-2xs',
        !capability.ready && 'opacity-60',
      )}
    >
      {logo !== undefined && <img src={logo} alt="" aria-hidden="true" className="size-3" />}
      {capability.name}
      {capability.version !== '' && (
        <span className="text-muted-foreground">{capability.version}</span>
      )}
    </span>
  )
}

function IconAction({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string
  disabled?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={label}
          disabled={disabled}
          onClick={onClick}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

// aria-disabled instead of disabled: a dead button swallows hover,
// and the "coming soon" tooltip must still speak.
function SoonAction({ label, children }: { label: string; children: React.ReactNode }) {
  const { t } = useTranslation()
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={label}
          aria-disabled="true"
          className="opacity-50"
          onClick={(e) => e.preventDefault()}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {label} — {t('graphene.app.comingSoon')}
      </TooltipContent>
    </Tooltip>
  )
}
