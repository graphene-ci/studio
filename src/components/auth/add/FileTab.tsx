import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ImportPreview } from '@/components/auth/add/ImportPreview'
import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field'
import { parseCliConfig, type ParseOutcome } from '@/helpers/cliConfig'
import { $currentContext, upsertContext } from '@/stores/contextsStore'

interface FileTabProps {
  onDone: () => void
}

interface Loaded {
  fileName: string
  outcome: ParseOutcome
}

export function FileTab({ onDone }: FileTabProps) {
  const { t } = useTranslation()
  const inputRef = useRef<HTMLInputElement>(null)
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [error, setError] = useState<string | null>(null)

  const readFile = async (file: File) => {
    const text = await file.text()
    try {
      setLoaded({ fileName: file.name, outcome: parseCliConfig(text) })
      setError(null)
    } catch {
      setLoaded(null)
      setError(t('graphene.contexts.errors.unparsable'))
    }
  }

  const handleImport = () => {
    if (loaded === null) return
    for (const { name, ctx } of loaded.outcome.contexts) upsertContext(name, ctx)
    if (loaded.outcome.current !== '' && $currentContext.get() === '') {
      $currentContext.set(loaded.outcome.current)
    }
    onDone()
  }

  return (
    <div className="flex flex-col gap-4 pt-2">
      <Field data-invalid={error !== null}>
        <FieldLabel htmlFor="ctx-file">{t('graphene.contexts.fileLabel')}</FieldLabel>
        <button
          type="button"
          className="flex flex-col items-center gap-1.5 rounded-md border border-dashed border-input bg-muted px-4 py-6 text-sm hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => inputRef.current?.click()}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault()
            const file = event.dataTransfer.files[0]
            if (file !== undefined) void readFile(file)
          }}
        >
          <span>{t('graphene.contexts.dropHint')}</span>
          <span className="font-mono text-xs text-muted-foreground">
            ~/.config/graphene/config.yaml
          </span>
        </button>
        <input
          ref={inputRef}
          id="ctx-file"
          type="file"
          accept=".yaml,.yml,.json,text/*"
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file !== undefined) void readFile(file)
          }}
        />
        <FieldDescription>{t('graphene.contexts.fileStaysLocal')}</FieldDescription>
        {error !== null && <FieldError>{error}</FieldError>}
      </Field>
      {loaded !== null && (
        <>
          <FieldDescription>
            {t('graphene.contexts.fileParsed', {
              file: loaded.fileName,
              count: loaded.outcome.contexts.length,
            })}
          </FieldDescription>
          <ImportPreview parsed={loaded.outcome.contexts} />
        </>
      )}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onDone}>
          {t('graphene.contexts.cancel')}
        </Button>
        <Button type="button" disabled={loaded === null} onClick={handleImport}>
          {t('graphene.contexts.importCount', {
            count: loaded?.outcome.contexts.length ?? 0,
          })}
        </Button>
      </div>
    </div>
  )
}
