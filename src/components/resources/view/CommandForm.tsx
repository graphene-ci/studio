import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { CodeEditor } from '@/components/CodeEditor'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import type { SchemaField } from '@/helpers/kindSchema'

interface CommandFormProps {
  fields: SchemaField[]
  submitLabel: string
  onSubmit: (payload: Record<string, unknown>) => Promise<void>
  onCancel: () => void
}

// A form generated from the kind dictionary's payload schema. The
// SERVER is the validator (schemapb coerce + required); this form only
// mirrors `required` and shapes the JSON. string/duration → input,
// json/map/unknown → a small JSON editor.
export function CommandForm({ fields, submitLabel, onSubmit, onCancel }: CommandFormProps) {
  const { t } = useTranslation()
  const [values, setValues] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)

  const missing = useMemo(
    () => fields.filter((f) => f.required && (values[f.name] ?? '').trim() === ''),
    [fields, values],
  )

  const handleSubmit = async () => {
    if (missing.length > 0) return
    const payload: Record<string, unknown> = {}
    for (const field of fields) {
      const raw = (values[field.name] ?? '').trim()
      if (raw === '') continue
      if (field.type === 'string' || field.type === 'duration') {
        payload[field.name] = raw
      } else {
        try {
          payload[field.name] = JSON.parse(raw)
        } catch {
          setFailure(t('graphene.commands.badJson', { field: field.name }))
          return
        }
      }
    }
    setBusy(true)
    setFailure(null)
    try {
      await onSubmit(payload)
    } catch (err) {
      setFailure(err instanceof Error ? err.message : String(err))
      setBusy(false)
      return
    }
    setBusy(false)
  }

  return (
    <div className="flex flex-col gap-2.5 rounded-md bg-muted p-2.5">
      {fields.length === 0 && (
        <p className="text-2xs text-muted-foreground">{t('graphene.commands.noPayload')}</p>
      )}
      {fields.map((field) => (
        <Label key={field.name} className="flex flex-col items-stretch gap-1 text-2xs font-normal">
          <span className="font-mono">
            {field.name}
            {field.required && <span className="text-destructive"> *</span>}
            <span className="text-muted-foreground"> · {field.type}</span>
          </span>
          {field.type === 'string' || field.type === 'duration' ? (
            <Input
              type={field.secret ? 'password' : 'text'}
              value={values[field.name] ?? ''}
              onChange={(e) => setValues((v) => ({ ...v, [field.name]: e.target.value }))}
              placeholder={field.type === 'duration' ? '30m' : undefined}
              autoComplete={field.secret ? 'off' : undefined}
              className="h-7 font-mono text-xs"
            />
          ) : (
            <CodeEditor
              value={values[field.name] ?? ''}
              onChange={(next) => setValues((v) => ({ ...v, [field.name]: next }))}
              autoHeight
              language={null}
              placeholder="{}"
              className="min-h-14"
            />
          )}
        </Label>
      ))}
      {failure !== null && <p className="text-2xs text-destructive">{failure}</p>}
      <div className="flex gap-2">
        <Button size="sm" disabled={busy || missing.length > 0} onClick={() => void handleSubmit()}>
          {busy && <Spinner />}
          {submitLabel}
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          {t('graphene.contexts.cancel')}
        </Button>
      </div>
    </div>
  )
}
