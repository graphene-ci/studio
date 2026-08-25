import { useStore } from '@nanostores/react'
import { CheckIcon, ChevronDownIcon } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ContextHealthBadge } from '@/components/auth/ContextHealthBadge'
import { ManageContextsDialog } from '@/components/auth/ManageContextsDialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { $contextHealth, checkAllContexts } from '@/stores/contextHealthStore'
import { $contexts, $currentContext } from '@/stores/contextsStore'
import { $session, login, logout } from '@/stores/sessionStore'

export function ContextSwitcher() {
  const { t } = useTranslation()
  const contexts = useStore($contexts)
  const current = useStore($currentContext)
  const health = useStore($contextHealth)
  const [manageOpen, setManageOpen] = useState(false)

  const names = Object.keys(contexts).sort()

  const switchTo = async (name: string) => {
    if (name === current) return
    const ctx = contexts[name]
    if (ctx === undefined) return
    if (ctx.token === '') {
      // No saved token — hand over to the sign-in screen with this
      // context preselected.
      $currentContext.set(name)
      $session.set(null)
      return
    }
    try {
      await login(name)
    } catch {
      $currentContext.set(name)
      $session.set(null)
    }
  }

  return (
    <>
      <DropdownMenu onOpenChange={(open) => open && void checkAllContexts()}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex h-6 items-center gap-1.5 rounded-sm bg-muted px-2 font-mono text-2xs hover:text-foreground"
          >
            <span className="size-1.5 rounded-full bg-status-success" aria-hidden />
            {current}
            <ChevronDownIcon className="size-3 text-muted-foreground" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72">
          <DropdownMenuLabel>{t('graphene.contexts.menuLabel')}</DropdownMenuLabel>
          {names.map((name) => {
            const ctx = contexts[name]
            if (ctx === undefined) return null
            return (
              <DropdownMenuItem key={name} onSelect={() => void switchTo(name)}>
                <span className="flex w-4 justify-center">
                  {name === current && <CheckIcon className="size-3.5 text-primary" />}
                </span>
                <span className="flex min-w-0 grow flex-col">
                  <span className="text-sm font-medium">{name}</span>
                  <span className="truncate font-mono text-xs text-muted-foreground">
                    {ctx.server === '' ? t('graphene.auth.sameOrigin') : ctx.server}
                  </span>
                </span>
                <ContextHealthBadge health={health[name]} />
                {health[name] === undefined && ctx.token === '' && (
                  <span className="text-2xs text-status-pending">
                    {t('graphene.auth.tokenNeeded')}
                  </span>
                )}
              </DropdownMenuItem>
            )
          })}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setManageOpen(true)}>
            {t('graphene.contexts.manage')}
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onSelect={() => logout(false)}>
            {t('graphene.contexts.signOut', { name: current })}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ManageContextsDialog open={manageOpen} onOpenChange={setManageOpen} />
    </>
  )
}
