import { useStore } from '@nanostores/react'
import { LockIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { parse as parseYamlText } from 'yaml'

import { client } from '@/client'
import { CodeEditor } from '@/components/CodeEditor'
import { CopyButton } from '@/components/CopyButton'
import { ActionsPane } from '@/components/resources/view/ActionsPane'
import { EventsFeed } from '@/components/resources/view/EventsFeed'
import { ObsPane } from '@/components/resources/view/ObsPane'
import { KindIcon } from '@/components/resources/tree/KindIcon'
import { PendingCommandsDot } from '@/components/status/PendingCommandsDot'
import { PhaseBadge } from '@/components/status/PhaseBadge'
import { PhaseText } from '@/components/status/PhaseText'
import { StatusBanner } from '@/components/status/StatusBanner'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { bytesAsYaml, timestampMs } from '@/helpers/describe'
import { yamlLanguage } from '@/helpers/editorLanguage'
import { findAncestry } from '@/helpers/resourceTree'
import { cn } from '@/lib/utils'
import type { Resource } from '@/proto/management/v1/resources_pb'
import { useParams } from '@/router'
import { setBreadcrumbs } from '@/stores/breadcrumbsStore'
import { notify } from '@/stores/notificationsStore'
import { openResourceTab, type ResourceTab } from '@/stores/editorTabsStore'

// The record view — the central surface of a resource tab, all five
// dimensions in one place: state + editable spec in the middle,
// commands and the live event feed on the right, the telemetry plane
// (logs/metrics/trace) in the bottom half. Everything is live by
// subscription; nothing here is a workspace panel.
export function ResourceView({ tab }: { tab: ResourceTab }) {
  const { t } = useTranslation()
  const view = useStore(client.stores.record(tab.ref))
  const tree = useStore(client.stores.tree())
  const { ns } = useParams()
  const record = view.data

  // The active record view owns the footer trail: namespace › the
  // ownership chain down to this record.
  useEffect(() => {
    if (ns === undefined) return
    const chain = findAncestry(tree.data, tab.ref) ?? [tab.ref]
    setBreadcrumbs([{ id: 'ns', label: ns }, ...chain.map((ref) => ({ id: ref, label: ref }))])
  }, [ns, tab.ref, tree.data])

  if (record === null && view.error !== null) {
    return (
      <p className="px-4 py-6 text-xs text-destructive">{t('graphene.resources.detailFailed')}</p>
    )
  }
  if (record === null) {
    return (
      <div className="flex justify-center py-10">
        <Spinner className="size-5" />
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <ResourceHeader record={record} />
      {view.error !== null && (
        <StatusBanner tone="warning" className="shrink-0">
          {t('graphene.resourceView.stale', { error: view.error })}
        </StatusBanner>
      )}
      {/* Plane of truth: state/spec in the middle, actions + events right. */}
      <div className="grid min-h-0 flex-[3] grid-cols-[minmax(0,1fr)_20rem] gap-4 px-4 pt-2 pb-3">
        <StatePane record={record} />
        <div className="flex min-h-0 flex-col gap-3 overflow-y-auto">
          <ActionsPane record={record} />
          <EventsFeed resourceRef={record.ref} />
        </div>
      </div>
      {/* Telemetry plane below. */}
      <div className="min-h-0 flex-[2] border-t border-border">
        <ObsPane resourceRef={record.ref} />
      </div>
    </div>
  )
}

export function ResourceHeader({ record }: { record: Resource }) {
  const { t } = useTranslation()
  const [showSystem, setShowSystem] = useState(false)
  const labels = Object.entries(record.labels).filter(([key]) => !key.startsWith('graphene.io/'))
  const systemLabels = Object.entries(record.labels).filter(([key]) =>
    key.startsWith('graphene.io/'),
  )

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1.5 px-4 pt-3">
      <span className="flex items-center gap-2">
        <KindIcon kind={record.kind} className="size-4" />
        <span
          className={cn(
            'font-mono text-sm font-medium',
            record.markedForDeletion && 'line-through opacity-60',
          )}
        >
          {record.ref}
        </span>
      </span>
      <CopyButton value={record.ref} />
      <PhaseBadge phase={record.phase} />
      <PendingCommandsDot count={record.pendingCommands} />
      {record.protected && (
        <span className="flex items-center gap-1 text-2xs text-muted-foreground">
          <LockIcon className="size-3" aria-hidden="true" />
          {t('graphene.resourceView.protected')}
        </span>
      )}
      {record.owner !== '' && (
        <span className="flex items-center gap-1 font-mono text-xs text-muted-foreground">
          {t('graphene.resources.colOwner')}:
          <button
            type="button"
            className="text-link hover:underline"
            onClick={() => openResourceTab(record.owner)}
          >
            {record.owner}
          </button>
        </span>
      )}
      <span className="grow" />
      {labels.map(([key, value]) => (
        <span
          key={key}
          className="rounded-sm bg-muted px-1.5 py-0.5 font-mono text-2xs text-muted-foreground"
        >
          {key}={value}
        </span>
      ))}
      {systemLabels.length > 0 && (
        <button
          type="button"
          className="rounded-sm bg-muted px-1.5 py-0.5 font-mono text-2xs text-muted-foreground hover:bg-surface-hover"
          aria-expanded={showSystem}
          onClick={() => setShowSystem((v) => !v)}
        >
          {t('graphene.resourceView.systemLabels', { count: systemLabels.length })}
        </button>
      )}
      {showSystem &&
        systemLabels.map(([key, value]) => (
          <span
            key={key}
            className="rounded-sm bg-muted px-1.5 py-0.5 font-mono text-2xs text-muted-foreground opacity-70"
          >
            {key.slice('graphene.io/'.length)}={value}
          </span>
        ))}
    </div>
  )
}

// State (readonly truth) + spec (editable declaration, YAML in the
// editor, applied as JSON) + the owned subtree.
export function StatePane({ record }: { record: Resource }) {
  const { t, i18n } = useTranslation()
  const spec = bytesAsYaml(record.spec)
  const state = bytesAsYaml(record.state)
  const [draft, setDraft] = useState<string | null>(null)
  const [applying, setApplying] = useState(false)
  const started = timestampMs(record.startedAt)
  const finished = timestampMs(record.finishedAt)
  const time = new Intl.DateTimeFormat(i18n.language, { dateStyle: 'short', timeStyle: 'medium' })

  const dirty = draft !== null && draft !== spec

  const handleApply = async () => {
    if (draft === null) return
    let parsed: unknown
    try {
      parsed = draft.trim() === '' ? {} : parseYamlText(draft)
    } catch {
      notify({ severity: 'warning', title: t('graphene.resourceView.applyBadYaml') })
      return
    }
    setApplying(true)
    try {
      await client.resource(record.ref).apply(parsed)
      notify({
        severity: 'success',
        title: t('graphene.resourceView.applied', { ref: record.ref }),
      })
      setDraft(null)
    } catch (err) {
      notify({
        severity: 'error',
        title: t('graphene.resourceView.applyFailed', { ref: record.ref }),
        body: err instanceof Error ? err.message : String(err),
      })
    } finally {
      setApplying(false)
    }
  }

  return (
    <div className="flex min-h-0 flex-col gap-4 overflow-y-auto pr-1">
      {(started !== null || finished !== null) && (
        <div className="flex gap-6 font-mono text-2xs text-muted-foreground">
          {started !== null && (
            <span>
              {t('graphene.resourceView.started')}: {time.format(started)}
            </span>
          )}
          {finished !== null && (
            <span>
              {t('graphene.resourceView.finished')}: {time.format(finished)}
            </span>
          )}
        </div>
      )}

      <section className="flex flex-col gap-1.5">
        <h3 className="flex items-center gap-2 text-2xs font-semibold tracking-wide text-muted-foreground uppercase">
          {t('graphene.resources.spec')}
          {dirty && (
            <span className="rounded-sm bg-muted px-1 font-mono text-3xs normal-case">
              {t('graphene.resourceView.specDirty')}
            </span>
          )}
        </h3>
        <CodeEditor
          value={draft ?? spec}
          onChange={(next) => setDraft(next)}
          autoHeight
          language={yamlLanguage()}
        />
        {dirty && (
          <div className="flex gap-2">
            <Button size="sm" disabled={applying} onClick={() => void handleApply()}>
              {applying && <Spinner />}
              {t('graphene.resourceView.apply')}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setDraft(null)}>
              {t('graphene.resourceView.reset')}
            </Button>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-1.5">
        <h3 className="text-2xs font-semibold tracking-wide text-muted-foreground uppercase">
          {t('graphene.resources.state')}
        </h3>
        {state === '' ? (
          <p className="text-xs text-muted-foreground">{t('graphene.resourceView.emptyBlock')}</p>
        ) : (
          <CodeEditor
            value={state}
            onChange={() => {}}
            readOnly
            autoHeight
            language={yamlLanguage()}
          />
        )}
      </section>

      <OwnsSection ownerRef={record.ref} />
    </div>
  )
}

// The record's own subtree — what dies with it. Live while visible.
function OwnsSection({ ownerRef }: { ownerRef: string }) {
  const { t } = useTranslation()
  const view = useStore(client.stores.tree(ownerRef))
  if (!view.loaded || view.data.length === 0) return null
  return (
    <section className="flex flex-col gap-1.5">
      <h3 className="text-2xs font-semibold tracking-wide text-muted-foreground uppercase">
        {t('graphene.inspector.tab.owns')}
      </h3>
      <ul className="flex flex-col">
        {view.data.map((node) => {
          const resource = node.resource
          if (resource === undefined) return null
          return (
            <li key={resource.ref}>
              <button
                type="button"
                className="flex h-6 w-full min-w-0 items-center gap-1.5 rounded-sm px-1.5 text-left font-mono text-xs hover:bg-surface-hover"
                onClick={() => openResourceTab(resource.ref)}
              >
                <KindIcon kind={resource.kind} className="size-3.5" />
                <span className="min-w-0 truncate">{resource.ref}</span>
                <span className="grow" />
                <PhaseText phase={resource.phase} className="text-2xs" />
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
