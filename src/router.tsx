// Namespace-aware router shim (stroppy-cloud pattern): pages import
// Link/NavLink/useNavigate from HERE, never from react-router — every
// in-app path is automatically prefixed with the current /n/<namespace>
// scope. Paths starting with "/n/" or external URLs pass through.
import {
  Link as BaseLink,
  NavLink as BaseNavLink,
  Navigate as BaseNavigate,
  useNavigate as useBaseNavigate,
  useParams,
  type NavigateOptions,
  type To,
} from 'react-router'

export * from 'react-router'

function usePrefix(): string {
  const { ns } = useParams()
  return ns === undefined ? '' : `/n/${ns}`
}

function scoped(to: To, prefix: string): To {
  if (typeof to !== 'string') return to
  if (!to.startsWith('/') || to.startsWith('/n/')) return to
  return `${prefix}${to}`
}

export function Link({ to, ...rest }: React.ComponentProps<typeof BaseLink>) {
  return <BaseLink to={scoped(to, usePrefix())} {...rest} />
}

export function NavLink({ to, ...rest }: React.ComponentProps<typeof BaseNavLink>) {
  return <BaseNavLink to={scoped(to, usePrefix())} {...rest} />
}

export function Navigate({ to, ...rest }: React.ComponentProps<typeof BaseNavigate>) {
  return <BaseNavigate to={scoped(to, usePrefix())} {...rest} />
}

export function useNavigate() {
  const navigate = useBaseNavigate()
  const prefix = usePrefix()
  return (to: To, options?: NavigateOptions) => navigate(scoped(to, prefix), options)
}
