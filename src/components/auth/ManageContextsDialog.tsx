import { useStore } from '@nanostores/react'
import { PlusIcon, RefreshCwIcon, Trash2Icon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { AddContextDialog } from '@/components/auth/AddContextDialog'
import { ContextHealthBadge } from '@/components/auth/ContextHealthBadge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { $contextHealth, checkAllContexts, checkContext } from '@/stores/contextHealthStore'
import { $contexts, $currentContext, removeContext } from '@/stores/contextsStore'

interface ManageContextsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ManageContextsDialog({ open, onOpenChange }: ManageContextsDialogProps) {
  const { t } = useTranslation()
  const contexts = useStore($contexts)
  const current = useStore($currentContext)
  const health = useStore($contextHealth)
  const [addOpen, setAddOpen] = useState(false)

  const names = Object.keys(contexts).sort()
  const anyChecking = names.some((name) => health[name]?.checking)

  useEffect(() => {
    if (open) void checkAllContexts()
  }, [open])

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('graphene.contexts.manageTitle')}</DialogTitle>
            <DialogDescription>{t('graphene.contexts.manageSubtitle')}</DialogDescription>
          </DialogHeader>
          <ul className="flex flex-col gap-1.5" aria-label={t('graphene.contexts.menuLabel')}>
            {names.map((name) => {
              const ctx = contexts[name]
              if (ctx === undefined) return null
              return (
                <li key={name} className="flex items-center gap-2.5 rounded-md bg-muted p-2.5">
                  <span className="flex min-w-0 grow flex-col gap-0.5">
                    <span className="flex items-center gap-2 text-sm font-medium">
                      {name}
                      {name === current && (
                        <Badge variant="outline" className="text-2xs">
                          {t('graphene.contexts.currentBadge')}
                        </Badge>
                      )}
                      {ctx.namespace !== '' && (
                        <Badge variant="outline" className="font-mono text-2xs">
                          {ctx.namespace}
                        </Badge>
                      )}
                    </span>
                    <span className="truncate font-mono text-xs text-muted-foreground">
                      {ctx.server === '' ? t('graphene.auth.sameOrigin') : ctx.server}
                    </span>
                  </span>
                  <ContextHealthBadge health={health[name]} />
                  {ctx.token === '' && (
                    <Badge variant="secondary" className="text-2xs text-status-pending">
                      {t('graphene.auth.tokenNeeded')}
                    </Badge>
                  )}
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t('graphene.contexts.check', { name })}
                    disabled={health[name]?.checking}
                    onClick={() => void checkContext(name)}
                  >
                    <RefreshCwIcon className={health[name]?.checking ? 'animate-spin' : ''} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t('graphene.auth.removeContext', { name })}
                    disabled={name === current}
                    onClick={() => removeContext(name)}
                  >
                    <Trash2Icon />
                  </Button>
                </li>
              )
            })}
          </ul>
          <DialogFooter className="sm:justify-between">
            <Button variant="outline" onClick={() => setAddOpen(true)}>
              <PlusIcon />
              {t('graphene.auth.addContext')}
            </Button>
            <Button
              variant="secondary"
              disabled={anyChecking}
              onClick={() => void checkAllContexts()}
            >
              <RefreshCwIcon className={anyChecking ? 'animate-spin' : ''} />
              {t('graphene.contexts.checkAll')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <AddContextDialog open={addOpen} onOpenChange={setAddOpen} />
    </>
  )
}
