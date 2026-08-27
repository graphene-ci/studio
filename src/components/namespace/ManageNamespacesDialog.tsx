import { zodResolver } from '@hookform/resolvers/zod'
import { useStore } from '@nanostores/react'
import { LockIcon, PlusIcon, Trash2Icon } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'

import { client } from '@/client'
import { PhaseBadge } from '@/components/status/PhaseBadge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { namespaceInfo } from '@/helpers/namespaceSpec'

interface ManageNamespacesDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

// Live management of the namespace dictionary: the open dialog
// subscribes the namespaces store (its watch runs while it's open),
// so created/deleted rows and phase transitions fold in on their own.
export function ManageNamespacesDialog({ open, onOpenChange }: ManageNamespacesDialogProps) {
  const { t } = useTranslation()
  const [creating, setCreating] = useState(false)

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setCreating(false)
        onOpenChange(next)
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('graphene.ns.manageTitle')}</DialogTitle>
          <DialogDescription>{t('graphene.ns.manageSubtitle')}</DialogDescription>
        </DialogHeader>
        {open && <NamespaceRows />}
        {creating ? (
          <CreateNamespaceForm onDone={() => setCreating(false)} />
        ) : (
          <DialogFooter className="sm:justify-start">
            <Button variant="outline" onClick={() => setCreating(true)}>
              <PlusIcon />
              {t('graphene.ns.create')}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}

function NamespaceRows() {
  const { t } = useTranslation()
  const view = useStore(client.stores.namespaces())
  // Ref of the row whose delete awaits its second, confirming click.
  const [armed, setArmed] = useState<string | null>(null)
  const [failure, setFailure] = useState<string | null>(null)

  const rows = view.data.map(namespaceInfo).sort((a, b) => a.name.localeCompare(b.name))

  const handleDelete = async (name: string) => {
    if (armed !== name) {
      setArmed(name)
      return
    }
    setArmed(null)
    setFailure(null)
    try {
      await client.namespaces.delete(name)
    } catch {
      setFailure(t('graphene.ns.deleteFailed', { name }))
    }
  }

  if (!view.loaded && view.error === null) {
    return (
      <div className="flex justify-center py-4">
        <Spinner className="size-5" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1.5">
      {view.error !== null && (
        <p className="text-xs text-destructive">{t('graphene.nav.namespacesFailed')}</p>
      )}
      {failure !== null && <p className="text-xs text-destructive">{failure}</p>}
      <ul className="flex flex-col gap-1.5" aria-label={t('graphene.nav.namespaces')}>
        {rows.map((row) => {
          const system = row.protected
          return (
            <li key={row.name} className="flex items-center gap-2.5 rounded-md bg-muted p-2.5">
              <span className="flex min-w-0 grow flex-col gap-0.5">
                <span className="flex items-center gap-1.5 text-sm font-medium">
                  {row.name}
                  {system && (
                    <LockIcon
                      className="size-3 text-muted-foreground"
                      aria-label={t('graphene.ns.system')}
                    />
                  )}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {row.description !== '' && <>{row.description} · </>}
                  {row.retentionDays > 0
                    ? t('graphene.ns.retention', { days: row.retentionDays })
                    : t('graphene.ns.retentionDefault')}
                </span>
              </span>
              <PhaseBadge phase={row.phase} />
              {!system &&
                (armed === row.name ? (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => void handleDelete(row.name)}
                    onBlur={() => setArmed(null)}
                  >
                    {t('graphene.ns.deleteConfirm')}
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t('graphene.ns.delete', { name: row.name })}
                    onClick={() => void handleDelete(row.name)}
                  >
                    <Trash2Icon />
                  </Button>
                ))}
            </li>
          )
        })}
      </ul>
      <p className="text-xs text-muted-foreground">{t('graphene.ns.deleteHint')}</p>
    </div>
  )
}

function CreateNamespaceForm({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation()

  const schema = useMemo(
    () =>
      z.object({
        // Tolerant mirror of what the durable core accepts as a
        // namespace name; the server is the final truth.
        name: z
          .string()
          .trim()
          .min(1, t('graphene.ns.errors.nameRequired'))
          .regex(/^[a-z0-9][a-z0-9._-]*$/, t('graphene.ns.errors.nameFormat')),
        description: z.string().trim(),
        // nsflow.Spec.Validate: retention cannot be negative. Kept as
        // a digits-only string in the form; parsed on submit.
        retentionDays: z.string().trim().regex(/^\d*$/, t('graphene.ns.errors.retentionFormat')),
      }),
    [t],
  )
  type Values = z.infer<typeof schema>

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    mode: 'onTouched',
    defaultValues: { name: '', description: '', retentionDays: '' },
  })

  const handleCreate = form.handleSubmit(async (values) => {
    const retentionDays = values.retentionDays === '' ? 0 : Number.parseInt(values.retentionDays, 10)
    try {
      await client.namespaces.create(values.name, {
        description: values.description === '' ? undefined : values.description,
        retentionDays: retentionDays === 0 ? undefined : retentionDays,
      })
    } catch {
      form.setError('root', { message: t('graphene.ns.errors.createFailed') })
      return
    }
    onDone()
  })

  return (
    <form onSubmit={handleCreate} className="flex flex-col gap-4 border-t pt-4">
      <div className="grid grid-cols-2 gap-4">
        <Controller
          control={form.control}
          name="name"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="ns-name">{t('graphene.ns.nameLabel')}</FieldLabel>
              <Input {...field} id="ns-name" aria-invalid={fieldState.invalid} className="font-mono" />
              {fieldState.error && <FieldError>{fieldState.error.message}</FieldError>}
            </Field>
          )}
        />
        <Controller
          control={form.control}
          name="retentionDays"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="ns-retention">{t('graphene.ns.retentionLabel')}</FieldLabel>
              <Input
                {...field}
                id="ns-retention"
                aria-invalid={fieldState.invalid}
                inputMode="numeric"
                className="font-mono"
              />
              <FieldDescription>{t('graphene.ns.retentionHint')}</FieldDescription>
              {fieldState.error && <FieldError>{fieldState.error.message}</FieldError>}
            </Field>
          )}
        />
      </div>
      <Controller
        control={form.control}
        name="description"
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor="ns-description">{t('graphene.ns.descriptionLabel')}</FieldLabel>
            <Input {...field} id="ns-description" aria-invalid={fieldState.invalid} />
          </Field>
        )}
      />
      {form.formState.errors.root && (
        <p className="text-xs text-destructive">{form.formState.errors.root.message}</p>
      )}
      <DialogFooter className="sm:justify-start">
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting && <Spinner />}
          {t('graphene.ns.createSubmit')}
        </Button>
        <Button type="button" variant="ghost" onClick={onDone}>
          {t('graphene.contexts.cancel')}
        </Button>
      </DialogFooter>
    </form>
  )
}
