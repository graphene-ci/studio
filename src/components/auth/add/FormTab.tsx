import { zodResolver } from '@hookform/resolvers/zod'
import { useMemo } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { normalizeServer } from '@/lib/serverUrl'
import { upsertContext } from '@/stores/contextsStore'
import { LoginError, login, verifyContext } from '@/stores/sessionStore'

interface FormTabProps {
  onDone: () => void
}

export function FormTab({ onDone }: FormTabProps) {
  const { t } = useTranslation()

  const schema = useMemo(
    () =>
      z.object({
        name: z
          .string()
          .trim()
          .min(1, t('graphene.contexts.errors.nameRequired'))
          .regex(/^[a-zA-Z0-9._-]+$/, t('graphene.contexts.errors.nameFormat')),
        server: z.string().refine((value) => normalizeServer(value) !== null, {
          message: t('graphene.auth.errors.invalidServer'),
        }),
        namespace: z.string().trim(),
        token: z.string().trim().min(1, t('graphene.auth.errors.tokenRequired')),
        insecure: z.boolean(),
      }),
    [t],
  )
  type Values = z.infer<typeof schema>

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    mode: 'onTouched',
    defaultValues: { name: '', server: '', namespace: '', token: '', insecure: false },
  })

  const handleAdd = form.handleSubmit(async (values) => {
    const ctx = {
      server: normalizeServer(values.server) ?? '',
      token: values.token,
      namespace: values.namespace,
      insecure: values.insecure,
    }
    try {
      await verifyContext(ctx, ctx.token)
    } catch (err) {
      if (err instanceof LoginError && err.reason === 'invalid_token') {
        form.setError('token', { message: t('graphene.auth.errors.invalidToken') })
      } else {
        form.setError('root', { message: t('graphene.auth.errors.unreachable') })
      }
      return
    }
    upsertContext(values.name, ctx)
    await login(values.name)
    onDone()
  })

  return (
    <form onSubmit={handleAdd} className="flex flex-col gap-4 pt-2">
      <div className="grid grid-cols-2 gap-4">
        <Controller
          control={form.control}
          name="name"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="ctx-name">{t('graphene.contexts.nameLabel')}</FieldLabel>
              <Input {...field} id="ctx-name" aria-invalid={fieldState.invalid} />
              {fieldState.error && <FieldError>{fieldState.error.message}</FieldError>}
            </Field>
          )}
        />
        <Controller
          control={form.control}
          name="namespace"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="ctx-namespace">
                {t('graphene.contexts.namespaceLabel')}
              </FieldLabel>
              <Input
                {...field}
                id="ctx-namespace"
                aria-invalid={fieldState.invalid}
                placeholder={t('graphene.contexts.namespacePlaceholder')}
              />
            </Field>
          )}
        />
      </div>
      <Controller
        control={form.control}
        name="server"
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor="ctx-server">{t('graphene.auth.serverLabel')}</FieldLabel>
            <Input
              {...field}
              id="ctx-server"
              aria-invalid={fieldState.invalid}
              placeholder="graphene.example.com:7233"
              autoComplete="url"
              className="font-mono"
            />
            <FieldDescription>{t('graphene.auth.serverHint')}</FieldDescription>
            {fieldState.error && <FieldError>{fieldState.error.message}</FieldError>}
          </Field>
        )}
      />
      <Controller
        control={form.control}
        name="token"
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor="ctx-token">{t('graphene.auth.tokenLabel')}</FieldLabel>
            <Input
              {...field}
              id="ctx-token"
              type="password"
              aria-invalid={fieldState.invalid}
              autoComplete="off"
              className="font-mono"
            />
            {fieldState.error && <FieldError>{fieldState.error.message}</FieldError>}
          </Field>
        )}
      />
      <Controller
        control={form.control}
        name="insecure"
        render={({ field }) => (
          <Field orientation="horizontal">
            <Checkbox
              id="ctx-insecure"
              checked={field.value}
              onCheckedChange={(checked) => field.onChange(checked === true)}
            />
            <span className="flex flex-col">
              <FieldLabel htmlFor="ctx-insecure">{t('graphene.contexts.insecureLabel')}</FieldLabel>
              <FieldDescription>{t('graphene.contexts.insecureHint')}</FieldDescription>
            </span>
          </Field>
        )}
      />
      {form.formState.errors.root && <FieldError>{form.formState.errors.root.message}</FieldError>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onDone}>
          {t('graphene.contexts.cancel')}
        </Button>
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting && <Spinner />}
          {t('graphene.contexts.verifyAdd')}
        </Button>
      </div>
    </form>
  )
}
