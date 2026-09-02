import { useStore } from '@nanostores/react'
import { NetworkIcon } from 'lucide-react'
import type { CSSProperties, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import pipelinesIcon from '@/assets/icons/kind/pipeline.svg'
import agentsIcon from '@/assets/icons/toolwindow/agents.svg'
import agentsIconDark from '@/assets/icons/toolwindow/agents_dark.svg'
import buildIcon from '@/assets/icons/toolwindow/build.svg'
import buildIconDark from '@/assets/icons/toolwindow/build_dark.svg'
import inspectorIcon from '@/assets/icons/toolwindow/inspector.svg'
import inspectorIconDark from '@/assets/icons/toolwindow/inspector_dark.svg'
import notificationsIcon from '@/assets/icons/toolwindow/notifications.svg'
import notificationsIconDark from '@/assets/icons/toolwindow/notifications_dark.svg'
import resourcesIcon from '@/assets/icons/toolwindow/resources.svg'
import terminalIcon from '@/assets/icons/toolwindow/terminal.svg'
import terminalIconDark from '@/assets/icons/toolwindow/terminal_dark.svg'
import { AgentsPanel } from '@/components/agents/AgentsPanel'
import { BuildPanel } from '@/components/build/BuildPanel'
import { EditorArea, EditorTabBar } from '@/components/editor/EditorArea'
import {
  NotificationsPanel,
  NotificationsPanelActions,
} from '@/components/notifications/NotificationsPanel'
import { PipelinesPanel } from '@/components/pipelines/PipelinesPanel'
import { ResourceTreePanel } from '@/components/resources/tree/ResourceTreePanel'
import { ThemedIcon } from '@/components/ThemedIcon'
import { TopologyPanel } from '@/components/topology/TopologyPanel'
import { TerminalPanel } from '@/components/terminal/TerminalPanel'
import { TerminalTabs } from '@/components/terminal/TerminalTabs'
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
  const isBottomOpen = layout.terminal.isOpen || layout.agents.isOpen || layout.notifications.isOpen
  const bottomOpenCount = [layout.terminal, layout.agents, layout.notifications].filter(
    (p) => p.isOpen,
  ).length
  // A side slot holds one panel at a time.
  const leftPanel = layout.resources.isOpen
    ? 'resources'
    : layout.pipelines.isOpen
      ? 'pipelines'
      : layout.topology.isOpen
        ? 'topology'
        : null
  const rightPanel = layout.inspector.isOpen ? 'inspector' : layout.build.isOpen ? 'build' : null
  const layoutStyle = {
    '--workspace-resources-width': `${leftPanel === null ? layout.resources.size : layout[leftPanel].size}px`,
    '--workspace-inspector-width': `${rightPanel === null ? layout.inspector.size : layout[rightPanel].size}px`,
    '--workspace-bottom-height': `${layout.bottom.size}px`,
    '--workspace-bottom-terminal-track': `${layout.bottom.split}fr`,
    '--workspace-bottom-notifications-track': `${100 - layout.bottom.split}fr`,
  } as CSSProperties

  return (
    <div
      className={cn(
        'workspace-layout absolute inset-0 overflow-hidden',
        leftPanel !== null && 'workspace-layout-resources-open',
        rightPanel !== null && 'workspace-layout-inspector-open',
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
              buttonLabel={t('graphene.workspace.panels.pipelines')}
              isActive={layout.pipelines.isOpen}
              icon={<ThemedIcon light={pipelinesIcon} />}
              onToggle={() => toggleWorkspacePanel('pipelines')}
            />
            <ToolBarAction
              buttonLabel={t('graphene.workspace.panels.resources')}
              isActive={layout.resources.isOpen}
              icon={<ThemedIcon light={resourcesIcon} />}
              onToggle={() => toggleWorkspacePanel('resources')}
            />
            <ToolBarAction
              buttonLabel={t('graphene.workspace.panels.topology')}
              isActive={layout.topology.isOpen}
              icon={<NetworkIcon />}
              onToggle={() => toggleWorkspacePanel('topology')}
            />
          </>
        }
        bottom={
          <>
            <ToolBarAction
              buttonLabel={t('graphene.workspace.panels.agents')}
              isActive={layout.agents.isOpen}
              icon={<ThemedIcon light={agentsIcon} dark={agentsIconDark} />}
              onToggle={() => toggleWorkspacePanel('agents')}
            />
            <ToolBarAction
              buttonLabel={t('graphene.workspace.panels.terminal')}
              isActive={layout.terminal.isOpen}
              icon={<ThemedIcon light={terminalIcon} dark={terminalIconDark} />}
              onToggle={() => toggleWorkspacePanel('terminal')}
            />
          </>
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
            {leftPanel === 'resources' ? (
              <ResourceTreePanel />
            ) : leftPanel === 'pipelines' ? (
              <PipelinesPanel />
            ) : (
              <TopologyPanel />
            )}
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
        header={<EditorTabBar />}
        aria-label={t('graphene.workspace.surface')}
      >
        <EditorArea />
      </WorkspacePanel>

      {rightPanel !== null && (
        <WorkspaceResizeHandle
          orientation="vertical"
          direction={-1}
          label={t('graphene.workspace.panels.resizeInspector')}
          size={layout[rightPanel].size}
          min={WORKSPACE_PANEL_LIMITS[rightPanel].min}
          max={WORKSPACE_PANEL_LIMITS[rightPanel].max}
          className="workspace-resize-handle-grid workspace-inspector-resize-handle"
          onResize={(size) => setWorkspacePanelSize(rightPanel, size)}
        />
      )}

      {rightPanel !== null && (
        <aside className="workspace-panel-slot workspace-inspector-panel min-h-0 min-w-0">
          <WorkspacePanel
            className="size-full"
            header={
              <WorkspacePanelTitle>
                {t(`graphene.workspace.panels.${rightPanel}`)}
              </WorkspacePanelTitle>
            }
            aria-label={t(`graphene.workspace.panels.${rightPanel}`)}
          >
            {rightPanel === 'build' && <BuildPanel />}
          </WorkspacePanel>
        </aside>
      )}

      <ToolBar
        side="right"
        label={t('graphene.workspace.toolbars.right')}
        top={
          <>
            <ToolBarAction
              buttonLabel={t('graphene.workspace.panels.inspector')}
              isActive={layout.inspector.isOpen}
              icon={<ThemedIcon light={inspectorIcon} dark={inspectorIconDark} />}
              onToggle={() => toggleWorkspacePanel('inspector')}
            />
            <ToolBarAction
              buttonLabel={t('graphene.workspace.panels.build')}
              isActive={layout.build.isOpen}
              icon={<ThemedIcon light={buildIcon} dark={buildIconDark} />}
              onToggle={() => toggleWorkspacePanel('build')}
            />
          </>
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
            bottomOpenCount === 2 && 'workspace-bottom-panels-split',
          )}
          style={
            bottomOpenCount === 3 ? { gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' } : undefined
          }
        >
          {layout.agents.isOpen && (
            <WorkspacePanel
              className="workspace-bottom-notifications-panel size-full"
              header={
                <WorkspacePanelTitle>{t('graphene.workspace.panels.agents')}</WorkspacePanelTitle>
              }
              aria-label={t('graphene.workspace.panels.agents')}
            >
              <AgentsPanel />
            </WorkspacePanel>
          )}
          {bottomOpenCount === 2 && layout.agents.isOpen && (
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
          {layout.terminal.isOpen && (
            <WorkspacePanel
              className="workspace-bottom-terminal-panel size-full"
              header={
                <>
                  <WorkspacePanelTitle className="flex-none">
                    {t('graphene.workspace.panels.terminal')}
                  </WorkspacePanelTitle>
                  <TerminalTabs />
                </>
              }
              aria-label={t('graphene.workspace.panels.terminal')}
            >
              <TerminalPanel />
            </WorkspacePanel>
          )}
          {bottomOpenCount === 2 && !layout.agents.isOpen && layout.terminal.isOpen && (
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
