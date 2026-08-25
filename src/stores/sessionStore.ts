import { Code, ConnectError } from '@connectrpc/connect'
import { atom } from 'nanostores'

import type { GrapheneContext } from '@/helpers/contexts'
import { makeApi } from '@/lib/api'
import { baseUrlFor } from '@/lib/serverUrl'
import { $contexts, $currentContext, upsertContext } from '@/stores/contextsStore'

// Who the token is, per Whoami. null = not signed in.
export interface Session {
  role: string
  // Namespace scope of the token; "*" = every namespace (admin).
  namespace: string
}

export const $session = atom<Session | null>(null)

// True while the boot-time session restore is still probing the server.
export const $sessionRestoring = atom<boolean>(false)

export type LoginFailure = 'invalid_token' | 'unreachable'

export class LoginError extends Error {
  readonly reason: LoginFailure

  constructor(reason: LoginFailure) {
    super(reason)
    this.reason = reason
  }
}

function failureOf(err: unknown): LoginFailure {
  if (err instanceof ConnectError && err.code === Code.Unauthenticated) {
    return 'invalid_token'
  }
  return 'unreachable'
}

/** Verifies a context+token with Whoami WITHOUT touching the stores —
 * the shared handshake of sign-in and verify-and-add. */
export async function verifyContext(ctx: GrapheneContext, token: string): Promise<Session> {
  const probe = makeApi(baseUrlFor(ctx.server, ctx.insecure), () => ({
    token,
    namespace: '',
  }))
  try {
    const who = await probe.namespaces.whoami({})
    return { role: who.role, namespace: who.namespace }
  } catch (err) {
    throw new LoginError(failureOf(err))
  }
}

/** Signs into a saved context. tokenOverride covers the token-less
 * context (sign-in asked for it) and rotation; a successful handshake
 * saves it into the context. */
export async function login(name: string, tokenOverride?: string): Promise<Session> {
  const ctx = $contexts.get()[name]
  if (ctx === undefined) throw new LoginError('unreachable')
  const token = tokenOverride ?? ctx.token
  const session = await verifyContext(ctx, token)
  if (tokenOverride !== undefined) upsertContext(name, { ...ctx, token })
  if (session.namespace !== '*' && ctx.namespace !== session.namespace) {
    const saved = $contexts.get()[name] ?? ctx
    upsertContext(name, { ...saved, namespace: session.namespace })
  }
  $currentContext.set(name)
  $session.set(session)
  return session
}

/** Drops the session; keepToken=false also forgets the context's token. */
export function logout(keepToken = true) {
  const name = $currentContext.get()
  const ctx = $contexts.get()[name]
  if (!keepToken && ctx !== undefined) upsertContext(name, { ...ctx, token: '' })
  $session.set(null)
}

/** Boot: revalidates the current context's saved token. An unreachable
 * server keeps the token (the stand may be down); a rejected one drops
 * the session but keeps the token for the user to replace. */
export async function restoreSession(): Promise<void> {
  const ctx = $contexts.get()[$currentContext.get()]
  if (ctx === undefined || ctx.token === '') return
  $sessionRestoring.set(true)
  try {
    await login($currentContext.get())
  } catch {
    $session.set(null)
  } finally {
    $sessionRestoring.set(false)
  }
}
