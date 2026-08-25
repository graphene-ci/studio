import { useStore } from '@nanostores/react'
import { useTranslation } from 'react-i18next'

import { useSectionCounts } from '@/hooks/useSectionCounts'
import { useServerInfo } from '@/hooks/useServerInfo'
import { cn } from '@/lib/utils'
import { NavLink } from '@/router'
import { $session } from '@/stores/sessionStore'

const NAMESPACE_ITEMS = [
  { key: 'variables', to: '/settings/variables' },
  { key: 'secrets', to: '/settings/secrets' },
] as const

function RailLink({
  label,
  to,
  count,
  countTone,
}: {
  label: string
  to: string
  count?: number | null
  countTone?: string
}) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-2 rounded-sm px-2 py-1 text-xs',
          isActive ? 'bg-accent text-foreground' : 'text-muted-foreground hover:text-foreground',
        )
      }
    >
      {label}
      <span className="grow" />
      {count !== undefined && count !== null && (
        <span
          className={cn('font-mono text-2xs tabular-nums', countTone ?? 'text-muted-foreground')}
        >
          {count}
        </span>
      )}
    </NavLink>
  )
}

// The console rail: text sections with live counts, server health at
// the bottom — the mock's left column, one dark chrome with the top
// bar and the status line.
export function Rail() {
  const { t } = useTranslation()
  const session = useStore($session)
  const counts = useSectionCounts(session !== null)
  const info = useServerInfo()

  return (
    <aside className="flex w-42 shrink-0 flex-col gap-0.5 bg-sidebar px-2 py-2">
      <RailLink label={t('graphene.nav.pipelines')} to="/pipelines" count={counts.pipelines} />
      <RailLink
        label={t('graphene.nav.runs')}
        to="/runs"
        count={counts.runningRuns}
        countTone={(counts.runningRuns ?? 0) > 0 ? 'text-status-running' : undefined}
      />
      <RailLink label={t('graphene.nav.resources')} to="/resources" count={counts.resources} />
      {session?.role === 'admin' && (
        <>
          <span className="px-2 pt-3 pb-1 text-3xs tracking-widest text-muted-foreground uppercase">
            {t('graphene.nav.namespaceGroup')}
          </span>
          {NAMESPACE_ITEMS.map(({ key, to }) => (
            <RailLink key={key} label={t(`graphene.nav.${key}`)} to={to} />
          ))}
        </>
      )}
      <span className="grow" />
      {info !== null && (
        <div className="flex flex-col gap-0.5 px-2 py-1 font-mono text-2xs text-muted-foreground">
          <span>server v{info.version}</span>
          {info.components.map((c) => (
            <span
              key={c.name}
              className={c.ok ? 'text-status-success' : 'text-status-failed'}
              title={c.detail}
            >
              {c.name} · {c.ok ? 'ok' : 'down'}
            </span>
          ))}
        </div>
      )}
    </aside>
  )
}
