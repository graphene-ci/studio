// Editor tabs — the central canvas state (VSCode preview pattern):
// opening from the tree lands in the PREVIEW tab (italic, reused by
// the next open); editing or re-opening pins it. App state.

import { persistentAtom } from '@nanostores/persistent'
import { atom } from 'nanostores'

export interface FileTab {
  type: 'file'
  /** "file:<sourceRef>:<path>" */
  id: string
  sourceRef: string
  path: string
  /** Last path segment, for the tab label. */
  name: string
  /** gitsource — the whole source is read-only. */
  readOnly: boolean
}

export interface ResourceTab {
  type: 'resource'
  /** "resource:<ref>" */
  id: string
  /** Record ref ("kind/id"). */
  ref: string
  kind: string
}

export type EditorTab = FileTab | ResourceTab

export interface EditorTabsState {
  tabs: EditorTab[]
  activeId: string | null
  /** The one preview tab; null — none. */
  previewId: string | null
}

export const fileTabId = (sourceRef: string, path: string) => `file:${sourceRef}:${path}`
export const resourceTabId = (ref: string) => `resource:${ref}`

/** Mode state of the ACTIVE file view, for the status bar. */
export interface EditorFileStatus {
  state: 'readonly' | 'loading'
}

export const $editorFileStatus = atom<EditorFileStatus | null>(null)

export function setEditorFileStatus(status: EditorFileStatus | null): void {
  $editorFileStatus.set(status)
}

const EMPTY: EditorTabsState = { tabs: [], activeId: null, previewId: null }

/** Legacy pipeline-hub tabs (removed) migrate to resource tabs for
 * `pipeline/<id>` — the one central view now owns the pipeline. */
function migrateTab(raw: unknown): EditorTab | null {
  if (typeof raw !== 'object' || raw === null || !('type' in raw)) return null
  const tab = raw as { type: string; pipelineId?: string }
  if (tab.type === 'pipeline') {
    const pipelineId = tab.pipelineId ?? ''
    if (pipelineId === '') return null
    const ref = `pipeline/${pipelineId}`
    return { type: 'resource', id: resourceTabId(ref), ref, kind: 'pipeline' }
  }
  if (tab.type === 'file' || tab.type === 'resource') return raw as EditorTab
  return null
}

function decodeTabs(raw: string): EditorTabsState {
  try {
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null || !('tabs' in parsed)) return EMPTY
    const state = parsed as { tabs: unknown[]; activeId?: unknown; previewId?: unknown }
    const seen = new Set<string>()
    const tabs: EditorTab[] = []
    for (const entry of Array.isArray(state.tabs) ? state.tabs : []) {
      const tab = migrateTab(entry)
      if (tab === null || seen.has(tab.id)) continue
      seen.add(tab.id)
      tabs.push(tab)
    }
    const has = (id: unknown): id is string => typeof id === 'string' && seen.has(id)
    return {
      tabs,
      activeId: has(state.activeId) ? state.activeId : (tabs[tabs.length - 1]?.id ?? null),
      previewId: has(state.previewId) ? state.previewId : null,
    }
  } catch {
    return EMPTY
  }
}

export const $editorTabs = persistentAtom<EditorTabsState>('graphene.editor.tabs', EMPTY, {
  encode: JSON.stringify,
  decode: decodeTabs,
})

/** Opens (or activates) a tab. Explicit opens (dblclick/Enter/deep
 * link) land PINNED — tabs pile up like an IDE. `preview: true` is
 * the browsing mode (kept for a future single-click/palette flow):
 * an unknown item replaces the current preview tab; re-opening the
 * active preview pins it; editing pins via pinTab. */
function openTab(tab: EditorTab, preview: boolean): void {
  const state = $editorTabs.get()
  const existing = state.tabs.find((t) => t.id === tab.id)
  if (existing !== undefined) {
    $editorTabs.set({
      ...state,
      activeId: tab.id,
      // Re-opening the already-active preview is the pin gesture.
      previewId: state.previewId === tab.id && state.activeId === tab.id ? null : state.previewId,
    })
    return
  }
  if (preview && state.previewId !== null) {
    const index = state.tabs.findIndex((t) => t.id === state.previewId)
    const tabs = [...state.tabs]
    tabs.splice(index === -1 ? tabs.length : index, index === -1 ? 0 : 1, tab)
    $editorTabs.set({ tabs, activeId: tab.id, previewId: tab.id })
    return
  }
  $editorTabs.set({
    tabs: [...state.tabs, tab],
    activeId: tab.id,
    previewId: preview ? tab.id : state.previewId,
  })
}

export function openFileTab(input: Omit<FileTab, 'type' | 'id'>, preview = false): void {
  openTab({ type: 'file', id: fileTabId(input.sourceRef, input.path), ...input }, preview)
}

export function openResourceTab(ref: string, preview = false): void {
  const kind = ref.slice(0, Math.max(ref.indexOf('/'), 0))
  openTab({ type: 'resource', id: resourceTabId(ref), ref, kind }, preview)
}

/** Editing (or an explicit gesture) keeps the tab for good. */
export function pinTab(id: string): void {
  const state = $editorTabs.get()
  if (state.previewId !== id) return
  $editorTabs.set({ ...state, previewId: null })
}

export function setActiveTab(id: string): void {
  const state = $editorTabs.get()
  if (state.activeId === id) return
  $editorTabs.set({ ...state, activeId: id })
}

export function closeTab(id: string): void {
  const state = $editorTabs.get()
  const index = state.tabs.findIndex((t) => t.id === id)
  if (index === -1) return
  const tabs = state.tabs.filter((t) => t.id !== id)
  const activeId =
    state.activeId === id ? (tabs[Math.min(index, tabs.length - 1)]?.id ?? null) : state.activeId
  $editorTabs.set({
    tabs,
    activeId,
    previewId: state.previewId === id ? null : state.previewId,
  })
}
