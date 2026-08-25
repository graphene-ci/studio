import { zodResolver } from '@hookform/resolvers/zod'
import { useMemo } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'

// Shared name/value creation form of the Variables and Secrets pages.
interface NameValueFormProps {
  idPrefix: string
  secretValue: boolean
  onSubmit: (name: string, value: string) => Promise<void>
}

export function NameValueForm({ idPrefix, secretValue, onSubmit }: NameValueFormProps) {
  const { t } = useTranslation()

  const schema = useMemo(
    () =>
      z.object({
        name: z
          .string()
          .trim()
          .min(1, t('graphene.namespace.errors.nameRequired'))
          .regex(/^[a-zA-Z0-9._-]+$/, t('graphene.namespace.errors.nameFormat')),
        value: z.string().min(1, t('graphene.namespace.errors.valueRequired')),
      }),
    [t],
  )
  type Values = z.infer<typeof schema>

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    mode: 'onTouched',
    defaultValues: { name: '', value: '' },
  })

  const handleAdd = form.handleSubmit(async (values) => {
    try {
      await onSubmit(values.name, values.value)
      form.reset()
    } catch (err) {
      form.setError('root', {
        message: err instanceof Error ? err.message : String(err),
      })
    }
  })

  return (
    <form onSubmit={handleAdd} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-start gap-3">
        <Controller
          control={form.control}
          name="name"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid} className="w-56">
              <FieldLabel htmlFor={`${idPrefix}-name`}>
                {t('graphene.namespace.nameLabel')}
              </FieldLabel>
              <Input
                {...field}
                id={`${idPrefix}-name`}
                aria-invalid={fieldState.invalid}
                autoComplete="off"
                className="h-8 font-mono text-xs"
              />
              {fieldState.error && <FieldError>{fieldState.error.message}</FieldError>}
            </Field>
          )}
        />
        <Controller
          control={form.control}
          name="value"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid} className="min-w-56 grow">
              <FieldLabel htmlFor={`${idPrefix}-value`}>
                {t('graphene.namespace.valueLabel')}
              </FieldLabel>
              <Input
                {...field}
                id={`${idPrefix}-value`}
                type={secretValue ? 'password' : 'text'}
                aria-invalid={fieldState.invalid}
                autoComplete="off"
                className="h-8 font-mono text-xs"
              />
              {fieldState.error && <FieldError>{fieldState.error.message}</FieldError>}
            </Field>
          )}
        />
        <Button type="submit" size="sm" className="mt-5" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting && <Spinner />}
          {t('graphene.namespace.set')}
        </Button>
      </div>
      {form.formState.errors.root && <FieldError>{form.formState.errors.root.message}</FieldError>}
    </form>
  )
}
