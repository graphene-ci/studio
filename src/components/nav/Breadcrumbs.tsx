import { Fragment } from 'react'
import { useTranslation } from 'react-i18next'

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { pipelineOf, tryParseQ } from '@/helpers/runsFilters'
import { Link, useLocation, useParams, useSearchParams } from '@/router'

// Section segments with a nav label; deeper segments (ids) render as
// monospace. Grows richer as detail pages land.
const SECTIONS = new Set(['pipelines', 'runs', 'resources', 'settings'])

export function Breadcrumbs() {
  const { t } = useTranslation()
  const { ns } = useParams()
  const location = useLocation()
  const [searchParams] = useSearchParams()

  if (ns === undefined) return null
  const segments = location.pathname
    .replace(`/n/${ns}`, '')
    .split('/')
    .filter((s) => s !== '')
  if (segments.length === 0) return null

  // A pipeline-scoped runs view reads as Pipelines › <name> › Runs —
  // the way back is a breadcrumb, not a browser button.
  const scopedPipeline =
    segments[0] === 'runs' ? pipelineOf(tryParseQ(searchParams.get('q') ?? '').terms ?? []) : ''

  const label = (segment: string) => {
    if (segment === 'settings') return t('graphene.nav.namespaceGroup')
    if (SECTIONS.has(segment) || segment === 'variables' || segment === 'secrets') {
      return t(`graphene.nav.${segment}`)
    }
    return segment
  }

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {scopedPipeline !== '' && (
          <>
            <BreadcrumbItem>
              <BreadcrumbLink asChild className="text-link hover:text-link">
                <Link to="/pipelines">{t('graphene.nav.pipelines')}</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator>/</BreadcrumbSeparator>
            <BreadcrumbItem>
              <span className="font-mono">{scopedPipeline}</span>
            </BreadcrumbItem>
          </>
        )}
        {segments.map((segment, i) => {
          const last = i === segments.length - 1
          const path = `/${segments.slice(0, i + 1).join('/')}`
          const isId = !SECTIONS.has(segment) && segment !== 'variables' && segment !== 'secrets'
          return (
            <Fragment key={path}>
              {(i > 0 || scopedPipeline !== '') && <BreadcrumbSeparator>/</BreadcrumbSeparator>}
              <BreadcrumbItem>
                {last || segment === 'settings' ? (
                  <BreadcrumbPage className={isId ? 'font-mono' : undefined}>
                    {label(segment)}
                  </BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild className="text-link hover:text-link">
                    <Link to={path}>{label(segment)}</Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </Fragment>
          )
        })}
      </BreadcrumbList>
    </Breadcrumb>
  )
}
