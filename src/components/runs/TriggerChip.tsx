import { Clock3Icon, PlayIcon, WebhookIcon } from 'lucide-react'

// Renders the run's trigger label ("manual" | "<kind>:<name>").
export function TriggerChip({ trigger }: { trigger: string }) {
  const [kind, name] = trigger.includes(':')
    ? [trigger.slice(0, trigger.indexOf(':')), trigger.slice(trigger.indexOf(':') + 1)]
    : ['manual', trigger]
  const Icon = kind === 'cron' ? Clock3Icon : kind === 'webhook' ? WebhookIcon : PlayIcon
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-xs">
      <Icon className="size-3 shrink-0 text-muted-foreground" />
      {trigger === '' || trigger === 'manual' ? 'manual' : name}
      {kind !== 'manual' && trigger !== '' && trigger !== 'manual' && (
        <span className="text-muted-foreground">{kind}</span>
      )}
    </span>
  )
}
