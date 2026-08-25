import { useStore } from '@nanostores/react'
import { ChevronDownIcon } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Spinner } from '@/components/ui/spinner'
import { useLocation, useNavigate, useParams } from '@/router'
import { $api } from '@/stores/apiStore'
import { $session } from '@/stores/sessionStore'

// NamespaceSwitcher scopes the whole app: the namespace lives in the
// URL (/n/<ns>/...); switching re-navigates to the same section under
// the new namespace. A namespaced token cannot switch — it shows a
// static badge.
export function NamespaceSwitcher() {
  const { t } = useTranslation()
  const { ns } = useParams()
  const session = useStore($session)
  const api = useStore($api)
  const navigate = useNavigate()
  const location = useLocation()
  const [names, setNames] = useState<string[] | null>(null)
  const [failed, setFailed] = useState(false)

  if (session === null || ns === undefined) return null

  if (session.namespace !== '*') {
    return (
      <span className="flex h-6 items-center rounded-sm bg-muted px-2 font-mono text-2xs">
        ns: <span className="ml-1 text-foreground">{ns}</span>
      </span>
    )
  }

  const loadNames = async () => {
    setFailed(false)
    try {
      const resp = await api.namespaces.listNamespaces({})
      setNames(resp.names)
    } catch {
      setFailed(true)
      setNames([])
    }
  }

  const switchTo = (name: string) => {
    if (name === ns) return
    const rest = location.pathname.replace(`/n/${ns}`, '') || '/runs'
    navigate(`/n/${name}${rest}`)
  }

  return (
    <DropdownMenu onOpenChange={(open) => open && void loadNames()}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex h-6 items-center gap-1 rounded-sm bg-muted px-2 font-mono text-2xs text-muted-foreground hover:text-foreground"
        >
          ns: <span className="text-foreground">{ns}</span>
          <ChevronDownIcon className="size-3" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-52">
        <DropdownMenuLabel>{t('graphene.nav.namespaces')}</DropdownMenuLabel>
        {names === null && (
          <div className="flex justify-center p-2">
            <Spinner className="size-4 text-muted-foreground" />
          </div>
        )}
        {failed && (
          <div className="p-2 text-xs text-muted-foreground">
            {t('graphene.nav.namespacesFailed')}
          </div>
        )}
        {names?.map((name) => (
          <DropdownMenuItem key={name} className="font-mono" onSelect={() => switchTo(name)}>
            {name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
