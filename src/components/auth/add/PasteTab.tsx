import { zodResolver } from '@hookform/resolvers/zod'
import { useMemo } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'

import { ImportPreview } from '@/components/auth/add/ImportPreview'
import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field'
import { Textarea } from '@/components/ui/textarea'
import { parseCliConfig, type ParseOutcome } from '@/helpers/cliConfig'
import { $currentContext, upsertContext } from '@/stores/contextsStore'

interface PasteTabProps {
  onDone: () => void
}

function tryParse(text: string): ParseOutcome | null {
  try {
    return parseCliConfig(text)
  } catch {
    return null
  }
}

export function PasteTab({ onDone }: PasteTabProps) {
  const { t } = useTranslation()

  const schema = useMemo(
    () =>
      z.object({
        text: z.string().refine((value) => tryParse(value) !== null, {
          message: t('graphene.contexts.errors.unparsable'),
        }),
      }),
    [t],
  )
  type Values = z.infer<typeof schema>

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    mode: 'onTouched',
    defaultValues: { text: '' },
  })
  const outcome = tryParse(form.watch('text'))

  const handleImport = form.handleSubmit((values) => {
    const parsed = tryParse(values.text)
    if (parsed === null) return
    for (const { name, ctx } of parsed.contexts) upsertContext(name, ctx)
    if (parsed.current !== '' && $currentContext.get() === '') {
      $currentContext.set(parsed.current)
    }
    onDone()
  })

  return (
    <form onSubmit={handleImport} className="flex flex-col gap-4 pt-2">
      <Controller
        control={form.control}
        name="text"
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor="paste-config">{t('graphene.contexts.pasteLabel')}</FieldLabel>
            <Textarea
              {...field}
              id="paste-config"
              aria-invalid={fieldState.invalid}
              rows={9}
              spellCheck={false}
              className="font-mono text-xs"
              placeholder={
                'contexts:\n  prod:\n    server: graphene.example.com:7233\n    token: grn_…\n    namespace: ci'
              }
            />
            {outcome !== null ? (
              <FieldDescription>
                {t('graphene.contexts.parsedSummary', {
                  count: outcome.contexts.length,
                  format: outcome.format.toUpperCase(),
                })}
              </FieldDescription>
            ) : (
              <FieldDescription>{t('graphene.contexts.pasteHint')}</FieldDescription>
            )}
            {fieldState.error && <FieldError>{fieldState.error.message}</FieldError>}
          </Field>
        )}
      />
      {outcome !== null && <ImportPreview parsed={outcome.contexts} />}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onDone}>
          {t('graphene.contexts.cancel')}
        </Button>
        <Button type="submit" disabled={outcome === null}>
          {t('graphene.contexts.importCount', { count: outcome?.contexts.length ?? 0 })}
        </Button>
      </div>
    </form>
  )
}
