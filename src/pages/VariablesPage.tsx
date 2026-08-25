import { useStore } from '@nanostores/react'
import { Trash2Icon } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { NameValueForm } from '@/components/namespace/NameValueForm'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { $api } from '@/stores/apiStore'

interface Row {
  name: string
  value: string
}

export function VariablesPage() {
  const { t } = useTranslation()
  const api = useStore($api)
  const [rows, setRows] = useState<Row[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const resp = await api.vars.listVars({})
      setRows(resp.vars.map((v) => ({ name: v.name, value: v.value })))
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setRows([])
    }
  }, [api])

  useEffect(() => {
    void load()
  }, [load])

  const setVar = async (name: string, value: string) => {
    await api.vars.setVar({ name, value })
    await load()
  }

  const deleteVar = async (name: string) => {
    await api.vars.deleteVar({ name })
    await load()
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <div>
        <h1 className="text-base font-semibold">{t('graphene.nav.variables')}</h1>
        <p className="text-sm text-muted-foreground">{t('graphene.namespace.varsSubtitle')}</p>
      </div>
      <NameValueForm idPrefix="var" secretValue={false} onSubmit={setVar} />
      {error !== null && (
        <div className="rounded-md bg-status-failed-bg p-3 font-mono text-xs text-status-failed">
          {error}
        </div>
      )}
      <div className="rounded-md bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="w-64 px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                {t('graphene.namespace.nameLabel')}
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                {t('graphene.namespace.valueLabel')}
              </th>
              <th className="w-12 px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows === null ? (
              <tr>
                <td colSpan={3} className="h-20 text-center">
                  <Spinner className="inline size-4 text-muted-foreground" />
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td
                  colSpan={3}
                  className="h-20 px-3 text-center font-mono text-xs text-muted-foreground"
                >
                  {t('graphene.namespace.varsEmpty')}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.name} className="group/row">
                  <td className="px-3 py-2 font-mono text-xs group-hover/row:bg-surface-hover">
                    {row.name}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-muted-foreground group-hover/row:bg-surface-hover">
                    {row.value}
                  </td>
                  <td className="px-3 py-2 text-right group-hover/row:bg-surface-hover">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={t('graphene.namespace.deleteEntry', { name: row.name })}
                      onClick={() => void deleteVar(row.name)}
                    >
                      <Trash2Icon />
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
