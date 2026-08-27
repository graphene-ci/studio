import { useStore } from '@nanostores/react'
import type { CSSProperties, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import filesIcon from '@/assets/icons/toolwindow/files.svg'
import filesIconDark from '@/assets/icons/toolwindow/files_dark.svg'
import inspectorIcon from '@/assets/icons/toolwindow/inspector.svg'
import inspectorIconDark from '@/assets/icons/toolwindow/inspector_dark.svg'
import notificationsIcon from '@/assets/icons/toolwindow/notifications.svg'
import notificationsIconDark from '@/assets/icons/toolwindow/notifications_dark.svg'
import resourcesIcon from '@/assets/icons/toolwindow/resources.svg'
import terminalIcon from '@/assets/icons/toolwindow/terminal.svg'
import terminalIconDark from '@/assets/icons/toolwindow/terminal_dark.svg'
import { ThemedIcon } from '@/components/ThemedIcon'

import { FileTreePanel } from '@/components/files/FileTreePanel'
import {
  NotificationsPanel,
  NotificationsPanelActions,
} from '@/components/notifications/NotificationsPanel'
import { ResourceTreePanel } from '@/components/resources/tree/ResourceTreePanel'
import { WorkspacePanel, WorkspacePanelTitle } from '@/components/WorkspacePanel'
import { WorkspaceResizeHandle } from '@/components/WorkspaceResizeHandle'
import { cn } from '@/lib/utils'
import { $notifications } from '@/stores/notificationsStore'
import {
  $workspaceLayout,
  setWorkspaceBottomSplit,
  setWorkspacePanelSize,
  toggleWorkspacePanel,
  WORKSPACE_BOTTOM_SPLIT_LIMITS,
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
  const unreadCount = useStore($notifications).filter((n) => !n.read).length
  const isBottomOpen = layout.terminal.isOpen || layout.notifications.isOpen
  // The left slot holds one panel at a time: resources or files.
  const leftPanel = layout.resources.isOpen ? 'resources' : layout.files.isOpen ? 'files' : null
  const layoutStyle = {
    '--workspace-resources-width': `${leftPanel === null ? layout.resources.size : layout[leftPanel].size}px`,
    '--workspace-inspector-width': `${layout.inspector.size}px`,
    '--workspace-bottom-height': `${layout.bottom.size}px`,
    '--workspace-bottom-terminal-track': `${layout.bottom.split}fr`,
    '--workspace-bottom-notifications-track': `${100 - layout.bottom.split}fr`,
  } as CSSProperties

  return (
    <div
      className={cn(
        'workspace-layout absolute inset-0 overflow-hidden',
        leftPanel !== null && 'workspace-layout-resources-open',
        layout.inspector.isOpen && 'workspace-layout-inspector-open',
        isBottomOpen && 'workspace-layout-bottom-open',
      )}
      style={layoutStyle}
    >
      <ToolBar
        side="left"
        label={t('graphene.workspace.toolbars.left')}
        top={
          <>
            <ToolBarAction
              buttonLabel={t('graphene.workspace.panels.resources')}
              isActive={layout.resources.isOpen}
              icon={<ThemedIcon light={resourcesIcon} />}
              onToggle={() => toggleWorkspacePanel('resources')}
            />
            <ToolBarAction
              buttonLabel={t('graphene.workspace.panels.files')}
              isActive={layout.files.isOpen}
              icon={<ThemedIcon light={filesIcon} dark={filesIconDark} />}
              onToggle={() => toggleWorkspacePanel('files')}
            />
          </>
        }
        bottom={
          <ToolBarAction
            buttonLabel={t('graphene.workspace.panels.terminal')}
            isActive={layout.terminal.isOpen}
            icon={<ThemedIcon light={terminalIcon} dark={terminalIconDark} />}
            onToggle={() => toggleWorkspacePanel('terminal')}
          />
        }
      />

      {leftPanel !== null && (
        <aside className="workspace-panel-slot workspace-resources-panel min-h-0 min-w-0">
          <WorkspacePanel
            className="size-full"
            header={
              <WorkspacePanelTitle>
                {t(`graphene.workspace.panels.${leftPanel}`)}
              </WorkspacePanelTitle>
            }
            aria-label={t(`graphene.workspace.panels.${leftPanel}`)}
          >
            {leftPanel === 'resources' ? <ResourceTreePanel /> : <FileTreePanel />}
          </WorkspacePanel>
        </aside>
      )}

      {leftPanel !== null && (
        <WorkspaceResizeHandle
          orientation="vertical"
          direction={1}
          label={t('graphene.workspace.panels.resizeResources')}
          size={layout[leftPanel].size}
          min={WORKSPACE_PANEL_LIMITS[leftPanel].min}
          max={WORKSPACE_PANEL_LIMITS[leftPanel].max}
          className="workspace-resize-handle-grid workspace-resources-resize-handle"
          onResize={(size) => setWorkspacePanelSize(leftPanel, size)}
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
            icon={<ThemedIcon light={inspectorIcon} dark={inspectorIconDark} />}
            onToggle={() => toggleWorkspacePanel('inspector')}
          />
        }
        bottom={
          <ToolBarAction
            buttonLabel={t('graphene.workspace.panels.notifications')}
            isActive={layout.notifications.isOpen}
            icon={
              <span className="relative inline-flex">
                <ThemedIcon light={notificationsIcon} dark={notificationsIconDark} />
                {unreadCount > 0 && (
                  <span className="absolute -top-1.5 -right-2 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-destructive px-0.5 font-mono text-4xs font-semibold text-primary-foreground">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </span>
            }
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
              className="workspace-bottom-terminal-panel size-full"
              header={
                <WorkspacePanelTitle>{t('graphene.workspace.panels.terminal')}</WorkspacePanelTitle>
              }
              aria-label={t('graphene.workspace.panels.terminal')}
            />
          )}
          {layout.terminal.isOpen && layout.notifications.isOpen && (
            <WorkspaceResizeHandle
              orientation="vertical"
              direction={1}
              relative
              label={t('graphene.workspace.panels.resizeBottomSplit')}
              size={layout.bottom.split}
              min={WORKSPACE_BOTTOM_SPLIT_LIMITS.min}
              max={WORKSPACE_BOTTOM_SPLIT_LIMITS.max}
              className="workspace-resize-handle-grid workspace-bottom-split-handle"
              onResize={setWorkspaceBottomSplit}
            />
          )}
          {layout.notifications.isOpen && (
            <WorkspacePanel
              className="workspace-bottom-notifications-panel size-full"
              header={
                <>
                  <WorkspacePanelTitle>
                    {t('graphene.workspace.panels.notifications')}
                  </WorkspacePanelTitle>
                  <NotificationsPanelActions />
                </>
              }
              aria-label={t('graphene.workspace.panels.notifications')}
            >
              <NotificationsPanel />
            </WorkspacePanel>
          )}
        </div>
      )}
    </div>
  )
}
