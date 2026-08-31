import { useTranslation } from 'react-i18next'

import { client } from '@/client'
import { CommandForm } from '@/components/resources/view/CommandForm'
import type { SchemaField } from '@/helpers/kindSchema'
import { notify } from '@/stores/notificationsStore'
import { openResourceTab } from '@/stores/editorTabsStore'

interface StartRunFormProps {
  pipelineId: string
  paramsFields: SchemaField[]
  /** null — a normal start (fire, arbitration applies); a revision id
   * — a DRAFT run of exactly that revision. */
  draftRevisionId: string | null
  onDone: () => void
}

function newRunId(pipelineId: string): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pipelineId}-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(
    now.getHours(),
  )}${pad(now.getMinutes())}${pad(now.getSeconds())}`
}

// The launch form, generated from the manifest's paramsSchema. A
// normal start goes through the pipeline's own `fire` command (the
// arbiter decides); a draft run executes ONE revision via
// RunRevision — validation against that revision's manifest.
export function StartRunForm({ pipelineId, paramsFields, draftRevisionId, onDone }: StartRunFormProps) {
  const { t } = useTranslation()

  const handleSubmit = async (params: Record<string, unknown>) => {
    const runId = newRunId(pipelineId)
    if (draftRevisionId !== null) {
      await client.pipelines.draftRun({ pipelineId, revisionId: draftRevisionId, runId, params })
    } else {
      await client.resource(`pipeline/${pipelineId}`).invoke('fire', { params, runId })
    }
    notify({
      severity: 'success',
      title: t('graphene.pipeline.started', { runId }),
    })
    onDone()
    openResourceTab(`run/${runId}`)
  }

  return (
    <div className="flex flex-col gap-1.5">
      <h3 className="text-2xs font-semibold tracking-wide text-muted-foreground uppercase">
        {draftRevisionId === null
          ? t('graphene.pipeline.start')
          : t('graphene.pipeline.startDraft', { revisionId: draftRevisionId })}
      </h3>
      <CommandForm
        fields={paramsFields}
        submitLabel={t('graphene.pipeline.startSubmit')}
        onSubmit={handleSubmit}
        onCancel={onDone}
      />
    </div>
  )
}
