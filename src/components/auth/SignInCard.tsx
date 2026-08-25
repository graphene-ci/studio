import { zodResolver } from '@hookform/resolvers/zod'
import { useStore } from '@nanostores/react'
import { XIcon } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'

import { AddContextDialog } from '@/components/auth/AddContextDialog'
import { ContextHealthBadge } from '@/components/auth/ContextHealthBadge'
import { Logo } from '@/components/Logo'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Spinner } from '@/components/ui/spinner'
import { $contextHealth } from '@/stores/contextHealthStore'
import { $contexts, $currentContext, removeContext } from '@/stores/contextsStore'
import { LoginError, login } from '@/stores/sessionStore'

export function SignInCard() {
  const { t } = useTranslation()
  const contexts = useStore($contexts)
  const current = useStore($currentContext)
  const health = useStore($contextHealth)
  const [addOpen, setAddOpen] = useState(false)

  const names = Object.keys(contexts).sort()

  const schema = useMemo(
    () =>
      z
        .object({
          context: z.string().min(1, t('graphene.auth.errors.contextRequired')),
          token: z.string().trim(),
        })
        .superRefine((values, issues) => {
          const ctx = $contexts.get()[values.context]
          if (ctx !== undefined && ctx.token === '' && values.token === '') {
            issues.addIssue({
              code: 'custom',
              path: ['token'],
              message: t('graphene.auth.errors.tokenRequired'),
            })
          }
        }),
    [t],
  )
  type Values = z.infer<typeof schema>

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    mode: 'onTouched',
    defaultValues: { context: current !== '' && current in contexts ? current : '', token: '' },
  })
  const selectedName = form.watch('context')
  const selected = contexts[selectedName]
  const needsToken = selected !== undefined && selected.token === ''

  const handleSignIn = form.handleSubmit(async (values) => {
    try {
      await login(values.context, needsToken ? values.token : undefined)
    } catch (err) {
      if (err instanceof LoginError && err.reason === 'invalid_token') {
        form.setError(needsToken ? 'token' : 'root', {
          message: t('graphene.auth.errors.invalidToken'),
        })
      } else {
        form.setError('root', { message: t('graphene.auth.errors.unreachable') })
      }
    }
  })

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Logo />
          {t('graphene.auth.title')}
        </CardTitle>
        <CardDescription>{t('graphene.auth.subtitle')}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSignIn} className="flex flex-col gap-6">
          <Controller
            control={form.control}
            name="context"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel>{t('graphene.auth.contextLabel')}</FieldLabel>
                {names.length === 0 ? (
                  <FieldDescription>{t('graphene.auth.noContexts')}</FieldDescription>
                ) : (
                  <RadioGroup
                    value={field.value}
                    onValueChange={(value) => {
                      field.onChange(value)
                      form.clearErrors()
                    }}
                    aria-invalid={fieldState.invalid}
                    className="gap-1.5"
                  >
                    {names.map((name) => {
                      const ctx = contexts[name]
                      if (ctx === undefined) return null
                      return (
                        <label
                          key={name}
                          htmlFor={`context-${name}`}
                          className="group flex cursor-pointer items-center gap-3 rounded-md border p-2.5 has-data-[state=checked]:border-primary has-data-[state=checked]:bg-accent"
                        >
                          <RadioGroupItem id={`context-${name}`} value={name} />
                          <span className="flex min-w-0 grow flex-col gap-0.5">
                            <span className="flex items-center gap-2 text-sm font-medium">
                              {name}
                              {ctx.namespace !== '' && (
                                <Badge variant="outline" className="font-mono text-2xs">
                                  {ctx.namespace}
                                </Badge>
                              )}
                            </span>
                            <span className="truncate font-mono text-xs text-muted-foreground">
                              {ctx.server === '' ? t('graphene.auth.sameOrigin') : ctx.server}
                            </span>
                          </span>
                          <ContextHealthBadge health={health[name]} />
                          {ctx.token === '' && (
                            <Badge variant="secondary" className="text-2xs text-status-pending">
                              {t('graphene.auth.tokenNeeded')}
                            </Badge>
                          )}
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                            aria-label={t('graphene.auth.removeContext', { name })}
                            onClick={(event) => {
                              event.preventDefault()
                              removeContext(name)
                              if (field.value === name) field.onChange('')
                            }}
                          >
                            <XIcon />
                          </Button>
                        </label>
                      )
                    })}
                  </RadioGroup>
                )}
                {fieldState.error && <FieldError>{fieldState.error.message}</FieldError>}
                <Button
                  type="button"
                  variant="outline"
                  className="border-dashed"
                  onClick={() => setAddOpen(true)}
                >
                  {t('graphene.auth.addContext')}
                </Button>
              </Field>
            )}
          />
          {needsToken && (
            <Controller
              control={form.control}
              name="token"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="signin-token">{t('graphene.auth.tokenLabel')}</FieldLabel>
                  <Input
                    {...field}
                    id="signin-token"
                    type="password"
                    aria-invalid={fieldState.invalid}
                    autoComplete="off"
                    className="font-mono"
                  />
                  <FieldDescription>{t('graphene.auth.tokenAskedWhy')}</FieldDescription>
                  {fieldState.error && <FieldError>{fieldState.error.message}</FieldError>}
                </Field>
              )}
            />
          )}
          {form.formState.errors.root && (
            <FieldError>{form.formState.errors.root.message}</FieldError>
          )}
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting && <Spinner />}
            {t('graphene.auth.submit')}
          </Button>
        </form>
      </CardContent>
      <AddContextDialog open={addOpen} onOpenChange={setAddOpen} />
    </Card>
  )
}
