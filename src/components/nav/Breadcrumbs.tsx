import { Fragment } from 'react'

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Link, useLocation, useParams } from '@/router'

export function Breadcrumbs() {
  const { ns } = useParams()
  const location = useLocation()

  if (ns === undefined) return null
  const segments = location.pathname
    .replace(`/n/${ns}`, '')
    .split('/')
    .filter((s) => s !== '')
  if (segments.length === 0) return null

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {segments.map((segment, i) => {
          const last = i === segments.length - 1
          const path = `/${segments.slice(0, i + 1).join('/')}`
          return (
            <Fragment key={path}>
              {i > 0 && <BreadcrumbSeparator>/</BreadcrumbSeparator>}
              <BreadcrumbItem>
                {last ? (
                  <BreadcrumbPage className="font-mono">{segment}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild className="text-link hover:text-link">
                    <Link to={path} className="font-mono">
                      {segment}
                    </Link>
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
