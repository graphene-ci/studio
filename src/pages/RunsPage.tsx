import { useTranslation } from 'react-i18next'

import { RunsPanel } from '@/components/runs/RunsPanel'

export function RunsPage() {
  const { t } = useTranslation()
  return (
    <div className="flex min-h-0 flex-1 flex-col p-3">
      <RunsPanel defaultQ="kind=run" title={t('graphene.nav.runs')} />
    </div>
  )
}
