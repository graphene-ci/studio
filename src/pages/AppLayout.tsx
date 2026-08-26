import { useStore } from '@nanostores/react'
import { useEffect } from 'react'

import { ContextSwitcher } from '@/components/auth/ContextSwitcher'
import { SignInCard } from '@/components/auth/SignInCard'
import { Logo } from '@/components/Logo'
import { WindowControls } from '@/components/WindowControls'
import { AppearanceMenus } from '@/components/nav/AppearanceMenus'
import { Breadcrumbs } from '@/components/nav/Breadcrumbs'
import { Spinner } from '@/components/ui/spinner'
import { Navigate, useParams } from '@/router'
import { $contexts, $currentContext, upsertContext } from '@/stores/contextsStore'
import { $session, $sessionRestoring } from '@/stores/sessionStore'

// AppLayout keeps connection/session handling and the global header around
// an intentionally empty workspace. Product surfaces are built from here.
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
        <header className="window-titlebar flex items-center justify-end gap-2">
          <AppearanceMenus />
          <WindowControls />
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
    return <Navigate to={`/n/${session.namespace}`} replace />
  }

  return (
    <div className="flex h-svh flex-col bg-background">
      <header className="window-titlebar flex shrink-0 items-center gap-3 bg-sidebar">
        <Logo className="size-7" />
        <span className="text-sm font-semibold tracking-tight">Graphene Studio</span>
        <Breadcrumbs />
        <span className="grow" />
        <ContextSwitcher />
        <AppearanceMenus />
        <WindowControls />
      </header>
      <main className="min-h-0 min-w-0 flex-1" />
    </div>
  )
}
