import { useStore } from '@nanostores/react'
import { ChevronRightIcon } from 'lucide-react'
import { Fragment } from 'react'

import { FileIcon } from '@/components/files/FileIcon'
import { $breadcrumbs } from '@/stores/breadcrumbsStore'

/** The controlled context trail on the footer's left. */
export function Breadcrumbs() {
  const crumbs = useStore($breadcrumbs)
  if (crumbs.length === 0) return null
  return (
    <nav aria-label="breadcrumbs" className="flex min-w-0 items-center gap-1 font-mono text-2xs">
      {crumbs.map((crumb, i) => (
        <Fragment key={crumb.id}>
          {i > 0 && (
            <ChevronRightIcon
              className="size-3 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
          )}
          <span
            className={
              i === crumbs.length - 1
                ? 'flex min-w-0 items-center gap-1 truncate text-foreground'
                : 'flex min-w-0 items-center gap-1 truncate text-muted-foreground'
            }
          >
            {crumb.file !== undefined && <FileIcon name={crumb.file} className="size-3" />}
            {crumb.label}
          </span>
        </Fragment>
      ))}
    </nav>
  )
}
