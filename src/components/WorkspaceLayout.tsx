import { useStore } from '@nanostores/react'
import { BellIcon, FolderTreeIcon, PanelRightOpenIcon, SquareTerminalIcon } from 'lucide-react'
import type { CSSProperties, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { WorkspacePanel, WorkspacePanelTitle } from '@/components/WorkspacePanel'
import { WorkspaceResizeHandle } from '@/components/WorkspaceResizeHandle'
import { cn } from '@/lib/utils'
import {
  $workspaceLayout,
  setWorkspacePanelSize,
  toggleWorkspacePanel,
  WORKSPACE_PANEL_LIMITS,
} from '@/stores/workspaceLayoutStore'

interface ToolBarProps {
  side: 'left' | 'right'
  label: string
  top: ReactNode
  bottom?: ReactNode
}

interface ToolBarActionProps {
  buttonLabel: string
  isActive: boolean
  icon: ReactNode
  onToggle: () => void
}

function ToolBarAction({ buttonLabel, isActive, icon, onToggle }: ToolBarActionProps) {
  return (
    <button
      type="button"
      className={cn('workspace-toolbar-action', isActive && 'workspace-toolbar-action-active')}
      aria-label={buttonLabel}
      aria-pressed={isActive}
      title={buttonLabel}
      onClick={onToggle}
    >
      {icon}
    </button>
  )
}

function ToolBar({ side, label, top, bottom }: ToolBarProps) {
  return (
    <nav className={cn('workspace-toolbar', `workspace-toolbar-${side}`)} aria-label={label}>
      <div className="workspace-toolbar-group workspace-toolbar-group-top">{top}</div>
      <div className="workspace-toolbar-group workspace-toolbar-group-bottom">{bottom}</div>
    </nav>
  )
}

export function WorkspaceLayout() {
  const { t } = useTranslation()
  const layout = useStore($workspaceLayout)
  const isBottomOpen = layout.terminal.isOpen || layout.notifications.isOpen
  const layoutStyle = {
    '--workspace-resources-width': `${layout.resources.size}px`,
    '--workspace-inspector-width': `${layout.inspector.size}px`,
    '--workspace-bottom-height': `${layout.bottom.size}px`,
  } as CSSProperties

  return (
    <div
      className={cn(
        'workspace-layout absolute inset-0 overflow-hidden',
        layout.resources.isOpen && 'workspace-layout-resources-open',
        layout.inspector.isOpen && 'workspace-layout-inspector-open',
        isBottomOpen && 'workspace-layout-bottom-open',
      )}
      style={layoutStyle}
    >
      <ToolBar
        side="left"
        label={t('graphene.workspace.toolbars.left')}
        top={
          <ToolBarAction
            buttonLabel={t('graphene.workspace.panels.resources')}
            isActive={layout.resources.isOpen}
            icon={<FolderTreeIcon aria-hidden="true" />}
            onToggle={() => toggleWorkspacePanel('resources')}
          />
        }
        bottom={
          <ToolBarAction
            buttonLabel={t('graphene.workspace.panels.terminal')}
            isActive={layout.terminal.isOpen}
            icon={<SquareTerminalIcon aria-hidden="true" />}
            onToggle={() => toggleWorkspacePanel('terminal')}
          />
        }
      />

      {layout.resources.isOpen && (
        <aside className="workspace-panel-slot workspace-resources-panel min-h-0 min-w-0">
          <WorkspacePanel
            className="size-full"
            header={
              <WorkspacePanelTitle>{t('graphene.workspace.panels.resources')}</WorkspacePanelTitle>
            }
            aria-label={t('graphene.workspace.panels.resources')}
          />
        </aside>
      )}

      {layout.resources.isOpen && (
        <WorkspaceResizeHandle
          orientation="vertical"
          direction={1}
          label={t('graphene.workspace.panels.resizeResources')}
          size={layout.resources.size}
          min={WORKSPACE_PANEL_LIMITS.resources.min}
          max={WORKSPACE_PANEL_LIMITS.resources.max}
          className="workspace-resize-handle-grid workspace-resources-resize-handle"
          onResize={(size) => setWorkspacePanelSize('resources', size)}
        />
      )}

      <WorkspacePanel
        className="workspace-canvas-panel size-full"
        bodyClassName="flex items-center justify-center px-6"
        aria-label={t('graphene.workspace.surface')}
      >
        <p className="max-w-sm text-center text-xs text-muted-foreground">
          {t('graphene.workspace.empty.selectResource')}
        </p>
      </WorkspacePanel>

      {layout.inspector.isOpen && (
        <WorkspaceResizeHandle
          orientation="vertical"
          direction={-1}
          label={t('graphene.workspace.panels.resizeInspector')}
          size={layout.inspector.size}
          min={WORKSPACE_PANEL_LIMITS.inspector.min}
          max={WORKSPACE_PANEL_LIMITS.inspector.max}
          className="workspace-resize-handle-grid workspace-inspector-resize-handle"
          onResize={(size) => setWorkspacePanelSize('inspector', size)}
        />
      )}

      {layout.inspector.isOpen && (
        <aside className="workspace-panel-slot workspace-inspector-panel min-h-0 min-w-0">
          <WorkspacePanel
            className="size-full"
            header={
              <WorkspacePanelTitle>{t('graphene.workspace.panels.inspector')}</WorkspacePanelTitle>
            }
            aria-label={t('graphene.workspace.panels.inspector')}
          />
        </aside>
      )}

      <ToolBar
        side="right"
        label={t('graphene.workspace.toolbars.right')}
        top={
          <ToolBarAction
            buttonLabel={t('graphene.workspace.panels.inspector')}
            isActive={layout.inspector.isOpen}
            icon={<PanelRightOpenIcon aria-hidden="true" />}
            onToggle={() => toggleWorkspacePanel('inspector')}
          />
        }
        bottom={
          <ToolBarAction
            buttonLabel={t('graphene.workspace.panels.notifications')}
            isActive={layout.notifications.isOpen}
            icon={<BellIcon aria-hidden="true" />}
            onToggle={() => toggleWorkspacePanel('notifications')}
          />
        }
      />

      {isBottomOpen && (
        <WorkspaceResizeHandle
          orientation="horizontal"
          direction={-1}
          label={t('graphene.workspace.panels.resizeBottom')}
          size={layout.bottom.size}
          min={WORKSPACE_PANEL_LIMITS.bottom.min}
          max={WORKSPACE_PANEL_LIMITS.bottom.max}
          className="workspace-resize-handle-grid workspace-bottom-resize-handle"
          onResize={(size) => setWorkspacePanelSize('bottom', size)}
        />
      )}

      {isBottomOpen && (
        <div
          className={cn(
            'workspace-bottom-panels min-h-0 min-w-0',
            layout.terminal.isOpen &&
              layout.notifications.isOpen &&
              'workspace-bottom-panels-split',
          )}
        >
          {layout.terminal.isOpen && (
            <WorkspacePanel
              className="size-full"
              header={
                <WorkspacePanelTitle>{t('graphene.workspace.panels.terminal')}</WorkspacePanelTitle>
              }
              aria-label={t('graphene.workspace.panels.terminal')}
            />
          )}
          {layout.notifications.isOpen && (
            <WorkspacePanel
              className="size-full"
              header={
                <WorkspacePanelTitle>
                  {t('graphene.workspace.panels.notifications')}
                </WorkspacePanelTitle>
              }
              aria-label={t('graphene.workspace.panels.notifications')}
            />
          )}
        </div>
      )}
    </div>
  )
}
