import { useStore } from '@nanostores/react'
import { KeyRoundIcon, Trash2Icon } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { NameValueForm } from '@/components/namespace/NameValueForm'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { $api } from '@/stores/apiStore'

export function SecretsPage() {
  const { t } = useTranslation()
  const api = useStore($api)
  const [names, setNames] = useState<string[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const resp = await api.secrets.listSecrets({})
      setNames([...resp.names].sort())
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setNames([])
    }
  }, [api])

  useEffect(() => {
    void load()
  }, [load])

  const setSecret = async (name: string, value: string) => {
    await api.secrets.setSecret({ name, value })
    await load()
  }

  const deleteSecret = async (name: string) => {
    await api.secrets.deleteSecret({ name })
    await load()
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <div>
        <h1 className="text-base font-semibold">{t('graphene.nav.secrets')}</h1>
        <p className="text-sm text-muted-foreground">{t('graphene.namespace.secretsSubtitle')}</p>
      </div>
      <NameValueForm idPrefix="secret" secretValue onSubmit={setSecret} />
      {error !== null && (
        <div className="rounded-md bg-status-failed-bg p-3 font-mono text-xs text-status-failed">
          {error}
        </div>
      )}
      <ul className="flex flex-col rounded-md bg-card" aria-label={t('graphene.nav.secrets')}>
        {names === null ? (
          <li className="flex h-20 items-center justify-center">
            <Spinner className="size-4 text-muted-foreground" />
          </li>
        ) : names.length === 0 ? (
          <li className="flex h-20 items-center justify-center font-mono text-xs text-muted-foreground">
            {t('graphene.namespace.secretsEmpty')}
          </li>
        ) : (
          names.map((name) => (
            <li
              key={name}
              className="group/row flex items-center gap-2.5 px-3 py-1.5 hover:bg-surface-hover"
            >
              <KeyRoundIcon className="size-3.5 text-muted-foreground" />
              <span className="grow font-mono text-xs">{name}</span>
              <span className="font-mono text-2xs text-muted-foreground">
                {t('graphene.namespace.valueHidden')}
              </span>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={t('graphene.namespace.deleteEntry', { name })}
                onClick={() => void deleteSecret(name)}
              >
                <Trash2Icon />
              </Button>
            </li>
          ))
        )}
      </ul>
    </div>
  )
}
