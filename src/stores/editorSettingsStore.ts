// Editor behavior settings — app state, edited in the Settings
// dialog, persisted per browser.

import { persistentAtom } from '@nanostores/persistent'

export interface EditorSettings {
  /** Soft-wrap long lines. */
  wordWrap: boolean
  /** Render whitespace characters. */
  showWhitespace: boolean
  /** Vertical indentation guides. */
  indentationMarkers: boolean
  /** Minimap in the right gutter. */
  minimap: boolean
  /** Reformat on the EXPLICIT save gesture (Ctrl+S); autosave never
   * reformats — it would yank the cursor mid-thought. */
  formatOnSave: boolean
  /** Trim trailing spaces + ensure a final newline on every write. */
  trimOnSave: boolean
}

export const DEFAULT_EDITOR_SETTINGS: EditorSettings = {
  wordWrap: false,
  showWhitespace: false,
  indentationMarkers: true,
  minimap: true,
  formatOnSave: false,
  trimOnSave: true,
}

function decode(raw: string): EditorSettings {
  try {
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return DEFAULT_EDITOR_SETTINGS
    return { ...DEFAULT_EDITOR_SETTINGS, ...parsed }
  } catch {
    return DEFAULT_EDITOR_SETTINGS
  }
}

export const $editorSettings = persistentAtom<EditorSettings>(
  'graphene.editor.settings',
  DEFAULT_EDITOR_SETTINGS,
  { encode: JSON.stringify, decode },
)

export function setEditorSetting<K extends keyof EditorSettings>(
  key: K,
  value: EditorSettings[K],
): void {
  $editorSettings.set({ ...$editorSettings.get(), [key]: value })
}
