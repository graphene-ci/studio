import { useStore } from '@nanostores/react'
import { PlayIcon, RotateCcwIcon } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { client } from '@/client'
import { PhaseText } from '@/components/status/PhaseText'
import { Button } from '@/components/ui/button'
import { timestampMs } from '@/helpers/describe'
import { notify } from '@/stores/notificationsStore'
import { openResourceTab } from '@/stores/editorTabsStore'

interface RevisionsListProps {
  pipelineId: string
  activeRevisionId: string
  /** Draft-run opens the launch form bound to this revision. */
  onDraftRun: (revisionId: string) => void
}

// The pipeline's revisions — its commits: immutable builds of the
// source. Activate makes one the automatic version (rollback IS
// activating an older one); draft-run executes any of them.
export function RevisionsList({ pipelineId, activeRevisionId, onDraftRun }: RevisionsListProps) {
  const { t, i18n } = useTranslation()
  const subtree = useStore(client.stores.tree(`pipeline/${pipelineId}`))
  const [busy, setBusy] = useState<string | null>(null)

  const revisions = subtree.data
    .map((n) => n.resource)
    .filter((r): r is NonNullable<typeof r> => r !== undefined && r.kind === 'revision')
    .sort((a, b) => (timestampMs(b.startedAt) ?? 0) - (timestampMs(a.startedAt) ?? 0))

  const time = new Intl.DateTimeFormat(i18n.language, { dateStyle: 'short', timeStyle: 'short' })

  const activate = async (revisionId: string) => {
    setBusy(revisionId)
    try {
      await client.pipelines.activate(pipelineId, revisionId)
      notify({
        severity: 'success',
        title: t('graphene.pipeline.activated', { revisionId, pipelineId }),
      })
    } catch (err) {
      notify({
        severity: 'error',
        title: t('graphene.pipeline.activateFailed', { revisionId }),
        body: err instanceof Error ? err.message : String(err),
      })
    } finally {
      setBusy(null)
    }
  }

  if (revisions.length === 0) return null

  return (
    <section className="flex flex-col gap-1.5">
      <h3 className="text-2xs font-semibold tracking-wide text-muted-foreground uppercase">
        {t('graphene.pipeline.revisions')}
      </h3>
      <ul className="flex flex-col gap-1">
        {revisions.map((revision) => {
          const revisionId = revision.ref.slice(revision.ref.lastIndexOf('.') + 1)
          const isActive = revisionId === activeRevisionId
          const started = timestampMs(revision.startedAt)
          return (
            <li
              key={revision.ref}
              className="flex min-w-0 items-center gap-2 rounded-sm px-1.5 py-1 hover:bg-surface-hover"
            >
              <button
                type="button"
                className="flex min-w-0 grow items-center gap-2 text-left font-mono text-xs"
                onClick={() => openResourceTab(revision.ref)}
              >
                <span className="min-w-0 truncate">{revisionId}</span>
                {isActive && (
                  <span className="shrink-0 rounded-sm bg-accent px-1 text-3xs font-semibold text-accent-foreground">
                    ACTIVE
                  </span>
                )}
                <PhaseText phase={revision.phase} className="shrink-0 text-2xs" />
                <span className="grow" />
                {started !== null && (
                  <span className="shrink-0 text-3xs text-muted-foreground">
                    {time.format(started)}
                  </span>
                )}
              </button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={t('graphene.pipeline.draftRun', { revisionId })}
                title={t('graphene.pipeline.draftRun', { revisionId })}
                onClick={() => onDraftRun(revisionId)}
              >
                <PlayIcon />
              </Button>
              {!isActive && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  disabled={busy === revisionId}
                  aria-label={t('graphene.pipeline.activate', { revisionId })}
                  title={t('graphene.pipeline.activate', { revisionId })}
                  onClick={() => void activate(revisionId)}
                >
                  <RotateCcwIcon />
                </Button>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
