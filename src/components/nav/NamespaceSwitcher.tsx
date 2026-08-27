import { useStore } from '@nanostores/react'
import { CheckIcon, ChevronDownIcon, LockIcon } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { client } from '@/client'
import { ManageNamespacesDialog } from '@/components/namespace/ManageNamespacesDialog'
import { PhaseBadge } from '@/components/status/PhaseBadge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Spinner } from '@/components/ui/spinner'
import { namespaceInfo } from '@/helpers/namespaceSpec'
import { useNavigate, useParams } from '@/router'
import { $session } from '@/stores/sessionStore'

// NamespaceSwitcher scopes the whole app: the namespace lives in the
// URL (/n/<ns>), switching re-navigates under the new one. A
// namespaced token cannot switch — it shows a static badge. The list
// is live: the open menu subscribes the client's namespaces store,
// which is what starts (and later stops) its watch.
export function NamespaceSwitcher() {
  const session = useStore($session)
  const { ns } = useParams()
  const [manageOpen, setManageOpen] = useState(false)
  const { t } = useTranslation()

  if (session === null || ns === undefined) return null

  if (!session.clusterWide) {
    return (
      <span className="flex h-8 items-center gap-1 rounded-sm bg-muted px-2.5 font-mono text-xs">
        <span className="text-muted-foreground">ns:</span>
        {ns}
      </span>
    )
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex h-8 items-center gap-1.5 rounded-sm bg-muted px-2.5 font-mono text-xs transition-colors hover:bg-surface-hover hover:text-foreground"
          >
            <span className="text-muted-foreground">ns:</span>
            {ns}
            <ChevronDownIcon className="size-3.5 text-muted-foreground" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72">
          <NamespaceMenuItems current={ns} />
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setManageOpen(true)}>
            {t('graphene.ns.manage')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ManageNamespacesDialog open={manageOpen} onOpenChange={setManageOpen} />
    </>
  )
}

// Rendered only while the menu is open — that scoping is what keeps
// the namespaces watch off when nobody is looking.
function NamespaceMenuItems({ current }: { current: string }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const view = useStore(client.stores.namespaces())

  const rows = view.data.map(namespaceInfo).sort((a, b) => a.name.localeCompare(b.name))

  return (
    <>
      <DropdownMenuLabel>{t('graphene.nav.namespaces')}</DropdownMenuLabel>
      {!view.loaded && view.error === null && (
        <div className="flex justify-center py-2">
          <Spinner className="size-4" />
        </div>
      )}
      {!view.loaded && view.error !== null && (
        <div className="px-2 py-1.5 text-xs text-destructive">
          {t('graphene.nav.namespacesFailed')}
        </div>
      )}
      {rows.map((row) => (
        <DropdownMenuItem
          key={row.name}
          onSelect={() => {
            if (row.name !== current) navigate(`/n/${row.name}`)
          }}
        >
          <span className="flex w-4 shrink-0 justify-center">
            {row.name === current && <CheckIcon className="size-3.5 text-primary" />}
          </span>
          <span className="flex min-w-0 grow flex-col">
            <span className="flex items-center gap-1.5 text-sm font-medium">
              {row.name}
              {row.protected && (
                <LockIcon
                  className="size-3 text-muted-foreground"
                  aria-label={t('graphene.ns.system')}
                />
              )}
            </span>
            {row.description !== '' && (
              <span className="truncate text-xs text-muted-foreground">{row.description}</span>
            )}
          </span>
          {row.retentionDays > 0 && (
            <span className="shrink-0 font-mono text-2xs text-muted-foreground">
              {t('graphene.ns.retentionShort', { days: row.retentionDays })}
            </span>
          )}
          {row.phase.toLowerCase() !== 'ready' && <PhaseBadge phase={row.phase} />}
        </DropdownMenuItem>
      ))}
    </>
  )
}
