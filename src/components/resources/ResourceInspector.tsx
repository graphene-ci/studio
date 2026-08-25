import { useStore } from '@nanostores/react'
import { XIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { CopyButton } from '@/components/CopyButton'
import { YamlView } from '@/components/YamlView'
import { PhaseBadge } from '@/components/status/PhaseBadge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'
import { $api } from '@/stores/apiStore'

interface Described {
  phase: string
  owner: string
  labels: Record<string, string>
  spec: unknown
  state: unknown
}

const TABS = ['state', 'spec'] as const
type Tab = (typeof TABS)[number]

// ResourceInspector — the right panel: the record described on demand
// (Get wakes nothing extra; the listing stays visibility-only).
export function ResourceInspector({ refId, onClose }: { refId: string; onClose: () => void }) {
  const { t } = useTranslation()
  const api = useStore($api)
  const [tab, setTab] = useState<Tab>('state')
  const [detail, setDetail] = useState<Described | 'loading' | 'error'>('loading')

  useEffect(() => {
    setDetail('loading')
    setTab('state')
    void (async () => {
      try {
        const resp = await api.resources.get({ ref: refId })
        const r = resp.resource
        if (r === undefined) throw new Error(`resource ${refId} is missing`)
        const parse = (raw: Uint8Array): unknown => {
          try {
            return JSON.parse(new TextDecoder().decode(raw))
          } catch {
            return null
          }
        }
        setDetail({
          phase: r.phase,
          owner: r.owner,
          labels: r.labels,
          spec: parse(r.spec),
          state: parse(r.state),
        })
      } catch {
        setDetail('error')
      }
    })()
  }, [api, refId])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="flex w-105 shrink-0 flex-col gap-2 rounded-md bg-card p-3">
      <div className="flex items-center gap-2">
        <span className="font-mono text-sm font-semibold">{refId}</span>
        <CopyButton value={refId} label={refId} />
        {detail !== 'loading' && detail !== 'error' && <PhaseBadge phase={detail.phase} />}
        <span className="grow" />
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t('graphene.inspector.close')}
          onClick={onClose}
        >
          <XIcon />
        </Button>
      </div>
      {detail === 'loading' ? (
        <div className="flex h-24 items-center justify-center">
          <Spinner className="size-4 text-muted-foreground" />
        </div>
      ) : detail === 'error' ? (
        <span className="font-mono text-xs text-status-failed">
          {t('graphene.resources.detailFailed')}
        </span>
      ) : (
        <>
          <div className="grid grid-cols-[72px_1fr] gap-x-3 gap-y-1.5 text-xs">
            <span className="text-muted-foreground">{t('graphene.resources.colOwner')}</span>
            <span className="font-mono">{detail.owner || '—'}</span>
            {Object.keys(detail.labels).length > 0 && (
              <>
                <span className="text-muted-foreground">{t('graphene.runs.colLabels')}</span>
                <span className="flex flex-wrap gap-1">
                  {Object.entries(detail.labels).map(([k, v]) => (
                    <Badge key={k} variant="outline" className="font-mono text-2xs">
                      {k}={v}
                    </Badge>
                  ))}
                </span>
              </>
            )}
          </div>
          <div className="flex gap-1 text-xs">
            {TABS.map((id) => (
              <button
                key={id}
                type="button"
                aria-pressed={tab === id}
                className={cn(
                  'rounded-sm px-2 py-1',
                  tab === id
                    ? 'bg-accent text-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )}
                onClick={() => setTab(id)}
              >
                {t(`graphene.resources.${id}`)}
              </button>
            ))}
          </div>
          <YamlView value={tab === 'state' ? detail.state : detail.spec} className="min-h-0 grow" />
        </>
      )}
    </div>
  )
}
