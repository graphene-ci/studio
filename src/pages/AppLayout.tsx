import { useStore } from '@nanostores/react'
import { useEffect } from 'react'

import { ContextSwitcher } from '@/components/auth/ContextSwitcher'
import { SignInCard } from '@/components/auth/SignInCard'
import { Logo } from '@/components/Logo'
import { AppearanceMenus } from '@/components/nav/AppearanceMenus'
import { Breadcrumbs } from '@/components/nav/Breadcrumbs'
import { NamespaceSwitcher } from '@/components/nav/NamespaceSwitcher'
import { Rail } from '@/components/nav/Rail'
import { StatusBar } from '@/components/nav/StatusBar'
import { Spinner } from '@/components/ui/spinner'
import { Navigate, Outlet, useParams } from '@/router'
import { $contexts, $currentContext, upsertContext } from '@/stores/contextsStore'
import { $session, $sessionRestoring } from '@/stores/sessionStore'

// AppLayout guards the /n/:ns scope, then renders the console frame:
// a FULL-WIDTH top bar, the rail | content row, a full-width status
// line — one dark chrome around the working surface (the mock).
export function AppLayout() {
  const session = useStore($session)
  const restoring = useStore($sessionRestoring)
  const { ns } = useParams()

  // The URL is the namespace's source of truth: every RPC carries it
  // via the current context (x-graphene-namespace).
  useEffect(() => {
    if (session === null || session.namespace !== '*' || ns === undefined) return
    const name = $currentContext.get()
    const ctx = $contexts.get()[name]
    if (ctx !== undefined && ctx.namespace !== ns) {
      upsertContext(name, { ...ctx, namespace: ns })
    }
  }, [session, ns])

  if (restoring) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background">
        <Spinner className="size-6" />
      </div>
    )
  }

  if (session === null) {
    return (
      <div className="flex min-h-svh flex-col bg-background">
        <header className="flex h-10 items-center justify-end gap-1 px-4">
          <AppearanceMenus />
        </header>
        <main className="flex grow items-center justify-center p-4">
          <SignInCard />
        </main>
      </div>
    )
  }

  // A namespaced token lives in exactly one namespace — a foreign URL
  // scope is corrected, not asked.
  if (session.namespace !== '*' && ns !== session.namespace) {
    return <Navigate to={`/n/${session.namespace}/runs`} replace />
  }

  return (
    <div className="flex h-svh flex-col bg-background">
      <header className="flex h-10 shrink-0 items-center gap-3 bg-sidebar px-3">
        <Logo className="size-4" />
        <span className="text-xs font-semibold">graphene</span>
        <NamespaceSwitcher />
        <Breadcrumbs />
        <span className="grow" />
        <ContextSwitcher />
        <AppearanceMenus />
      </header>
      <div className="flex min-h-0 flex-1">
        <Rail />
        <main className="flex min-h-0 min-w-0 flex-1 flex-col">
          <Outlet />
        </main>
      </div>
      <StatusBar />
    </div>
  )
}
