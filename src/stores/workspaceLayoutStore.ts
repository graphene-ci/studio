import { persistentAtom } from '@nanostores/persistent'

export type WorkspacePanelId = 'resources' | 'inspector' | 'terminal' | 'notifications'
export type WorkspaceResizablePanelId = 'resources' | 'inspector' | 'bottom'

export interface WorkspacePanelVisibility {
  isOpen: boolean
}

export interface WorkspacePanelLayout extends WorkspacePanelVisibility {
  size: number
}

export interface WorkspaceLayoutState {
  resources: WorkspacePanelLayout
  inspector: WorkspacePanelLayout
  terminal: WorkspacePanelVisibility
  notifications: WorkspacePanelVisibility
  bottom: { size: number }
}

export const WORKSPACE_PANEL_LIMITS: Record<
  WorkspaceResizablePanelId,
  { min: number; max: number }
> = {
  resources: { min: 200, max: 640 },
  inspector: { min: 240, max: 720 },
  bottom: { min: 160, max: 640 },
}

const DEFAULT_WORKSPACE_LAYOUT: WorkspaceLayoutState = {
  resources: { isOpen: true, size: 288 },
  inspector: { isOpen: false, size: 320 },
  terminal: { isOpen: false },
  notifications: { isOpen: false },
  bottom: { size: 288 },
}

function clampPanelSize(panel: WorkspaceResizablePanelId, size: number): number {
  const limits = WORKSPACE_PANEL_LIMITS[panel]
  return Math.min(limits.max, Math.max(limits.min, Math.round(size)))
}

function decodeVisibility(
  value: unknown,
  fallback: WorkspacePanelVisibility,
): WorkspacePanelVisibility {
  if (typeof value !== 'object' || value === null) return fallback
  const isOpen =
    'isOpen' in value && typeof value.isOpen === 'boolean' ? value.isOpen : fallback.isOpen
  return { isOpen }
}

function decodePanel(
  value: unknown,
  fallback: WorkspacePanelLayout,
  panel: 'resources' | 'inspector',
): WorkspacePanelLayout {
  const visibility = decodeVisibility(value, fallback)
  if (typeof value !== 'object' || value === null) return fallback
  const size = 'size' in value && typeof value.size === 'number' ? value.size : fallback.size
  return { ...visibility, size: clampPanelSize(panel, size) }
}

function decodeBottom(value: unknown): WorkspaceLayoutState['bottom'] {
  if (typeof value !== 'object' || value === null) return DEFAULT_WORKSPACE_LAYOUT.bottom
  const size =
    'size' in value && typeof value.size === 'number'
      ? value.size
      : DEFAULT_WORKSPACE_LAYOUT.bottom.size
  return { size: clampPanelSize('bottom', size) }
}

function decodeWorkspaceLayout(raw: string): WorkspaceLayoutState {
  try {
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return DEFAULT_WORKSPACE_LAYOUT
    return {
      resources: decodePanel(
        'resources' in parsed ? parsed.resources : undefined,
        DEFAULT_WORKSPACE_LAYOUT.resources,
        'resources',
      ),
      inspector: decodePanel(
        'inspector' in parsed ? parsed.inspector : undefined,
        DEFAULT_WORKSPACE_LAYOUT.inspector,
        'inspector',
      ),
      terminal: decodeVisibility(
        'terminal' in parsed ? parsed.terminal : undefined,
        DEFAULT_WORKSPACE_LAYOUT.terminal,
      ),
      notifications: decodeVisibility(
        'notifications' in parsed ? parsed.notifications : undefined,
        DEFAULT_WORKSPACE_LAYOUT.notifications,
      ),
      bottom: decodeBottom('bottom' in parsed ? parsed.bottom : undefined),
    }
  } catch {
    return DEFAULT_WORKSPACE_LAYOUT
  }
}

export const $workspaceLayout = persistentAtom<WorkspaceLayoutState>(
  'graphene.workspace.layout.v1',
  DEFAULT_WORKSPACE_LAYOUT,
  { encode: JSON.stringify, decode: decodeWorkspaceLayout },
)

export function toggleWorkspacePanel(panel: WorkspacePanelId): void {
  const current = $workspaceLayout.get()
  $workspaceLayout.set({
    ...current,
    [panel]: { ...current[panel], isOpen: !current[panel].isOpen },
  })
}

export function setWorkspacePanelSize(panel: WorkspaceResizablePanelId, size: number): void {
  const current = $workspaceLayout.get()
  const nextSize = clampPanelSize(panel, size)
  if (current[panel].size === nextSize) return
  $workspaceLayout.set({
    ...current,
    [panel]: { ...current[panel], size: nextSize },
  })
}
