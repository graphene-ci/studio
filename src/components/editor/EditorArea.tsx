import { useStore } from '@nanostores/react'
import { LockIcon, XIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { FileEditorView } from '@/components/editor/FileEditorView'
import { FileIcon } from '@/components/files/FileIcon'
import { KindIcon } from '@/components/resources/tree/KindIcon'
import { ResourceView } from '@/components/resources/view/ResourceView'
import { cn } from '@/lib/utils'
import {
  $editorTabs,
  closeTab,
  type EditorTab,
  pinTab,
  setActiveTab,
} from '@/stores/editorTabsStore'

// The central canvas: tab bar (the panel's header) + the active view.
export function EditorTabBar() {
  const { tabs, activeId, previewId } = useStore($editorTabs)
  const { t } = useTranslation()

  if (tabs.length === 0) return null
  return (
    <div
      role="tablist"
      aria-label={t('graphene.editor.tabs')}
      className="flex min-w-0 items-end gap-0.5 overflow-x-auto px-1 pt-1"
    >
      {tabs.map((tab) => (
        <div
          key={tab.id}
          role="tab"
          aria-selected={tab.id === activeId}
          tabIndex={0}
          className={cn(
            'group flex h-7 min-w-0 cursor-pointer items-center gap-1.5 rounded-t-md px-2.5 font-mono text-xs outline-none',
            'focus-visible:ring-2 focus-visible:ring-ring',
            tab.id === activeId
              ? 'bg-muted text-foreground'
              : 'text-muted-foreground hover:bg-surface-hover',
          )}
          onClick={() => setActiveTab(tab.id)}
          onDoubleClick={() => pinTab(tab.id)}
          onAuxClick={(e) => {
            if (e.button === 1) closeTab(tab.id)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') setActiveTab(tab.id)
            if (e.key === 'Delete') closeTab(tab.id)
          }}
        >
          {tab.type === 'file' ? (
            <FileIcon name={tab.name} className="size-3" />
          ) : (
            <KindIcon kind={tab.kind} className="size-3" />
          )}
          <span className={cn('truncate', tab.id === previewId && 'italic')}>
            {tab.type === 'file' ? tab.name : tab.ref}
          </span>
          {tab.type === 'file' && tab.readOnly && (
            <LockIcon
              className="size-2.5 shrink-0 text-muted-foreground"
              aria-label={t('graphene.editor.readOnly')}
            />
          )}
          <button
            type="button"
            tabIndex={-1}
            aria-label={t('graphene.editor.close', {
              name: tab.type === 'file' ? tab.name : tab.ref,
            })}
            className="flex size-3.5 shrink-0 items-center justify-center rounded-xs text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-foreground"
            onClick={(e) => {
              e.stopPropagation()
              closeTab(tab.id)
            }}
          >
            <XIcon className="size-3" />
          </button>
        </div>
      ))}
    </div>
  )
}

function activeTabOf(tabs: EditorTab[], activeId: string | null): EditorTab | null {
  return tabs.find((t) => t.id === activeId) ?? null
}

export function EditorArea() {
  const { tabs, activeId } = useStore($editorTabs)
  const { t } = useTranslation()
  const active = activeTabOf(tabs, activeId)

  if (active === null) {
    return (
      <div className="flex h-full items-center justify-center px-6">
        <p className="max-w-sm text-center text-xs text-muted-foreground">
          {t('graphene.workspace.empty.selectResource')}
        </p>
      </div>
    )
  }
  if (active.type === 'file') return <FileEditorView key={active.id} tab={active} />
  return <ResourceView key={active.id} tab={active} />
}
