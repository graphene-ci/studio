import { useStore } from '@nanostores/react'
import {
  ChevronDownIcon,
  Clock3Icon,
  ContainerIcon,
  LayersIcon,
  ListOrderedIcon,
  ReplaceIcon,
  WebhookIcon,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { CopyButton } from '@/components/CopyButton'
import { YamlView } from '@/components/YamlView'
import { RunsPanel } from '@/components/runs/RunsPanel'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import {
  COUNTED_STATUSES,
  parseImageRef,
  pipelineDetailFromResource,
  shortKind,
  type PipelineDetailVM,
  type RunCounts,
} from '@/helpers/pipelineVM'
import { cn } from '@/lib/utils'
import { useParams } from '@/router'
import { $api } from '@/stores/apiStore'

const statusTone: Record<string, string> = {
  Running: 'text-status-running',
  Completed: 'text-status-success',
  Failed: 'text-status-failed',
}

// Start-policy icon: how firings queue up.
function PolicyIcon({ policy }: { policy: string }) {
  const cls = 'size-3 text-muted-foreground'
  if (policy === 'cancel-previous') return <ReplaceIcon className={cls} />
  if (policy === 'parallel') return <LayersIcon className={cls} />
  return <ListOrderedIcon className={cls} />
}

export function PipelineDetailPage() {
  const { t } = useTranslation()
  const { pipelineId = '' } = useParams()
  const api = useStore($api)
  const [detail, setDetail] = useState<PipelineDetailVM | null>(null)
  const [counts, setCounts] = useState<RunCounts | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [manifestOpen, setManifestOpen] = useState(false)

  const load = useCallback(async () => {
    try {
      const resp = await api.resources.get({ ref: `pipeline/${pipelineId}` })
      if (resp.resource === undefined) throw new Error(`pipeline ${pipelineId} is missing`)
      setDetail(pipelineDetailFromResource(resp.resource))
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
    try {
      const count = await api.resources.count({
        query: `kind=run, pipeline=${pipelineId}`,
        groupByStatus: true,
      })
      const byStatus: RunCounts = {}
      for (const g of count.groups) byStatus[g.status] = Number(g.count)
      setCounts(byStatus)
    } catch {
      setCounts({})
    }
  }, [api, pipelineId])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 p-3">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-mono text-sm font-semibold">{pipelineId}</h1>
        {detail !== null && detail.phase !== '' && (
          <Badge variant="secondary" className="text-2xs">
            {detail.phase}
          </Badge>
        )}
        {counts !== null &&
          COUNTED_STATUSES.filter((s) => (counts[s] ?? 0) > 0).map((status) => (
            <Badge
              key={status}
              variant="secondary"
              className={`font-mono text-2xs tabular-nums ${statusTone[status]}`}
            >
              {counts[status]} {status}
            </Badge>
          ))}
      </div>

      {error !== null && (
        <div className="rounded-md bg-status-failed-bg p-3 font-mono text-xs text-status-failed">
          {error}
        </div>
      )}

      {detail === null && error === null ? (
        <div className="flex h-20 items-center justify-center">
          <Spinner className="size-5 text-muted-foreground" />
        </div>
      ) : detail !== null ? (
        <div className="overflow-hidden rounded-md bg-card">
          <div className="flex flex-col gap-3 p-3">
            {/* Identity line: WHAT runs — the artifact coordinate.
                registry muted / name plain / :tag primary / @digest. */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              {detail.image === '' ? (
                <span className="font-mono text-sm text-muted-foreground">
                  {t('graphene.pipelines.noImage')}
                </span>
              ) : (
                (() => {
                  const ref = parseImageRef(detail.image)
                  return (
                    <span className="flex min-w-0 items-center">
                      <ContainerIcon className="mr-2 size-4 shrink-0 text-muted-foreground" />
                      <span className="truncate font-mono text-sm">
                        {ref.registry !== '' && (
                          <span className="text-muted-foreground">{ref.registry}/</span>
                        )}
                        <span>{ref.name}</span>
                        {ref.tag !== '' && <span className="text-primary">:{ref.tag}</span>}
                        {detail.digest !== '' && (
                          <span className="text-muted-foreground">
                            @{detail.digest.replace(/^sha256:/, '').slice(0, 12)}
                          </span>
                        )}
                      </span>
                      <CopyButton value={detail.image} label={t('graphene.pipelines.colImage')} />
                    </span>
                  )
                })()
              )}
              <span className="grow" />
              <Badge variant="outline" className="gap-1.5 text-2xs">
                <PolicyIcon policy={detail.concurrency} />
                {t(`graphene.pipelines.policy.${detail.concurrency || 'queue'}`, {
                  defaultValue: detail.concurrency || 'queue',
                })}
              </Badge>
            </div>

            {detail.triggers.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="mr-1 text-2xs text-muted-foreground">
                  {t('graphene.pipelines.triggers')}
                </span>
                {detail.triggers.map((trigger) => (
                  <Badge
                    key={`${trigger.kind}/${trigger.name}`}
                    variant="secondary"
                    className="gap-1.5 font-mono text-2xs"
                  >
                    {trigger.kind === 'cron' ? (
                      <Clock3Icon className="size-3 text-muted-foreground" />
                    ) : (
                      <WebhookIcon className="size-3 text-muted-foreground" />
                    )}
                    {trigger.name}
                    {trigger.spec !== '' && (
                      <span className="text-muted-foreground">{trigger.spec}</span>
                    )}
                  </Badge>
                ))}
              </div>
            )}

            {detail.kinds.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="mr-1 text-2xs text-muted-foreground">
                  {t('graphene.pipelines.kinds')}
                </span>
                {detail.kinds.map((kind) => (
                  <Badge key={kind} variant="outline" className="font-mono text-2xs" title={kind}>
                    {shortKind(kind)}
                  </Badge>
                ))}
              </div>
            )}

            {detail.activities.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="mr-1 text-2xs text-muted-foreground">
                  {t('graphene.pipelines.activities')}
                </span>
                {detail.activities.map((activity) => (
                  <span key={activity} className="font-mono text-2xs text-muted-foreground">
                    {activity}
                  </span>
                ))}
              </div>
            )}
          </div>

          {detail.manifest !== null && (
            <>
              <button
                type="button"
                aria-expanded={manifestOpen}
                className="flex w-full items-center gap-1.5 bg-muted px-4 py-2 text-2xs text-muted-foreground hover:text-foreground"
                onClick={() => setManifestOpen((o) => !o)}
              >
                <ChevronDownIcon className={cn('size-3', !manifestOpen && '-rotate-90')} />
                {t('graphene.pipelines.manifest')}
                <span className="font-mono">
                  {detail.digest !== '' && detail.digest.slice(0, 15)}
                </span>
              </button>
              {manifestOpen && (
                <div className="bg-muted px-4 pb-3">
                  <YamlView value={detail.manifest} className="max-h-80" />
                </div>
              )}
            </>
          )}
        </div>
      ) : null}

      <RunsPanel defaultQ={`kind=run, pipeline=${pipelineId}`} />
    </div>
  )
}
