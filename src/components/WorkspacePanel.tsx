import type { ComponentPropsWithoutRef, ReactNode, Ref } from 'react'

import { cn } from '@/lib/utils'

interface WorkspacePanelProps extends ComponentPropsWithoutRef<'section'> {
  header?: ReactNode
  headerClassName?: string
  bodyClassName?: string
  panelRef?: Ref<HTMLElement>
}

export function WorkspacePanel({
  header,
  headerClassName,
  bodyClassName,
  panelRef,
  className,
  children,
  ...props
}: WorkspacePanelProps) {
  return (
    <section
      ref={panelRef}
      className={cn('workspace-panel flex min-h-0 min-w-0 flex-col', className)}
      {...props}
    >
      {header !== undefined && (
        <header
          className={cn(
            'workspace-panel-header flex min-w-0 shrink-0 items-stretch',
            headerClassName,
          )}
        >
          {header}
        </header>
      )}
      <div className={cn('workspace-panel-body min-h-0 flex-1', bodyClassName)}>{children}</div>
    </section>
  )
}

interface WorkspacePanelTitleProps extends ComponentPropsWithoutRef<'div'> {
  children: ReactNode
}

export function WorkspacePanelTitle({ className, children, ...props }: WorkspacePanelTitleProps) {
  return (
    <div
      className={cn('flex min-w-0 flex-1 items-center px-3 text-xs font-medium', className)}
      {...props}
    >
      <span className="truncate">{children}</span>
    </div>
  )
}
