import { persistentAtom } from '@nanostores/persistent'

export type WorkspacePanelId =
  | 'resources'
  | 'pipelines'
  | 'topology'
  | 'inspector'
  | 'build'
  | 'terminal'
  | 'agents'
  | 'notifications'
export type WorkspaceResizablePanelId =
  | 'resources'
  | 'pipelines'
  | 'topology'
  | 'inspector'
  | 'build'
  | 'bottom'

export interface WorkspacePanelVisibility {
  isOpen: boolean
}

export interface WorkspacePanelLayout extends WorkspacePanelVisibility {
  size: number
}

export interface WorkspaceLayoutState {
  resources: WorkspacePanelLayout
  pipelines: WorkspacePanelLayout
  topology: WorkspacePanelLayout
  inspector: WorkspacePanelLayout
  build: WorkspacePanelLayout
  terminal: WorkspacePanelVisibility
  agents: WorkspacePanelVisibility
  notifications: WorkspacePanelVisibility
  bottom: { size: number; split: number }
}

export const WORKSPACE_BOTTOM_SPLIT_LIMITS = { min: 20, max: 80 }

export const WORKSPACE_PANEL_LIMITS: Record<
  WorkspaceResizablePanelId,
  { min: number; max: number }
> = {
  resources: { min: 200, max: 640 },
  pipelines: { min: 200, max: 640 },
  topology: { min: 200, max: 640 },
  inspector: { min: 240, max: 720 },
  build: { min: 260, max: 720 },
  bottom: { min: 160, max: 640 },
}

const DEFAULT_WORKSPACE_LAYOUT: WorkspaceLayoutState = {
  resources: { isOpen: true, size: 288 },
  pipelines: { isOpen: false, size: 288 },
  topology: { isOpen: false, size: 288 },
  inspector: { isOpen: false, size: 320 },
  build: { isOpen: false, size: 340 },
  terminal: { isOpen: false },
  agents: { isOpen: false },
  notifications: { isOpen: false },
  bottom: { size: 288, split: 50 },
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
  panel: 'resources' | 'pipelines' | 'topology' | 'inspector' | 'build',
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
  const split =
    'split' in value && typeof value.split === 'number'
      ? Math.min(
          WORKSPACE_BOTTOM_SPLIT_LIMITS.max,
          Math.max(WORKSPACE_BOTTOM_SPLIT_LIMITS.min, value.split),
        )
      : DEFAULT_WORKSPACE_LAYOUT.bottom.split
  return { size: clampPanelSize('bottom', size), split }
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
      pipelines: decodePanel(
        'pipelines' in parsed ? parsed.pipelines : undefined,
        DEFAULT_WORKSPACE_LAYOUT.pipelines,
        'pipelines',
      ),
      topology: decodePanel(
        'topology' in parsed ? parsed.topology : undefined,
        DEFAULT_WORKSPACE_LAYOUT.topology,
        'topology',
      ),
      inspector: decodePanel(
        'inspector' in parsed ? parsed.inspector : undefined,
        DEFAULT_WORKSPACE_LAYOUT.inspector,
        'inspector',
      ),
      build: decodePanel(
        'build' in parsed ? parsed.build : undefined,
        DEFAULT_WORKSPACE_LAYOUT.build,
        'build',
      ),
      terminal: decodeVisibility(
        'terminal' in parsed ? parsed.terminal : undefined,
        DEFAULT_WORKSPACE_LAYOUT.terminal,
      ),
      agents: decodeVisibility(
        'agents' in parsed ? parsed.agents : undefined,
        DEFAULT_WORKSPACE_LAYOUT.agents,
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

// A side slot holds ONE panel at a time (IDE toolwindow behavior).
const LEFT_SLOT = ['resources', 'pipelines', 'topology'] as const
const RIGHT_SLOT = ['inspector', 'build'] as const

export function toggleWorkspacePanel(panel: WorkspacePanelId): void {
  const current = $workspaceLayout.get()
  const next: WorkspaceLayoutState = {
    ...current,
    [panel]: { ...current[panel], isOpen: !current[panel].isOpen },
  }
  if (
    (panel === 'resources' || panel === 'pipelines' || panel === 'topology') &&
    next[panel].isOpen
  ) {
    for (const other of LEFT_SLOT) {
      if (other !== panel) next[other] = { ...next[other], isOpen: false }
    }
  }
  if ((panel === 'inspector' || panel === 'build') && next[panel].isOpen) {
    for (const other of RIGHT_SLOT) {
      if (other !== panel) next[other] = { ...next[other], isOpen: false }
    }
  }
  $workspaceLayout.set(next)
}

/** Opens a panel (idempotent), honoring the slot radio rules. */
export function openWorkspacePanel(panel: WorkspacePanelId): void {
  if (!$workspaceLayout.get()[panel].isOpen) toggleWorkspacePanel(panel)
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

export function setWorkspaceBottomSplit(split: number): void {
  const current = $workspaceLayout.get()
  const nextSplit = Math.min(
    WORKSPACE_BOTTOM_SPLIT_LIMITS.max,
    Math.max(WORKSPACE_BOTTOM_SPLIT_LIMITS.min, split),
  )
  if (current.bottom.split === nextSplit) return
  $workspaceLayout.set({
    ...current,
    bottom: { ...current.bottom, split: nextSplit },
  })
}
