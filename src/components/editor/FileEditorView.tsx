import { useStore } from '@nanostores/react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { client } from '@/client'
import { CodeEditor } from '@/components/CodeEditor'
import { Spinner } from '@/components/ui/spinner'
import { languageForFile } from '@/helpers/editorLanguage'
import { $editorSettings } from '@/stores/editorSettingsStore'
import { setEditorFileStatus, type FileTab } from '@/stores/editorTabsStore'

const noop = () => {}

// One open file: read-once content shown READ-ONLY. A gitsource is a
// checkout of a commit — Studio never writes back.
export function FileEditorView({ tab }: { tab: FileTab }) {
  const { t } = useTranslation()
  const [text, setText] = useState<string | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const settings = useStore($editorSettings)

  useEffect(() => {
    let cancelled = false
    setText(null)
    setLoadFailed(false)
    setEditorFileStatus({ state: 'loading' })
    client.sources
      .readFile(tab.sourceRef, tab.path)
      .then((content) => {
        if (cancelled) return
        setText(content)
        setEditorFileStatus({ state: 'readonly' })
      })
      .catch(() => {
        if (!cancelled) {
          setLoadFailed(true)
          setEditorFileStatus(null)
        }
      })
    return () => {
      cancelled = true
      setEditorFileStatus(null)
    }
  }, [tab.sourceRef, tab.path])

  if (loadFailed) {
    return (
      <p className="px-4 py-6 text-xs text-destructive">
        {t('graphene.editor.loadFailed', { path: tab.path })}
      </p>
    )
  }
  if (text === null) {
    return (
      <div className="flex justify-center py-10">
        <Spinner className="size-5" />
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1">
        <CodeEditor
          value={text}
          onChange={noop}
          readOnly
          language={languageForFile(tab.name)}
          fill
          ide={settings}
        />
      </div>
    </div>
  )
}
