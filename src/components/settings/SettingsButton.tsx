import { SettingsIcon } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { SettingsDialog } from '@/components/settings/SettingsDialog'
import { Button } from '@/components/ui/button'

export function SettingsButton() {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={t('graphene.settings.title')}
        title={t('graphene.settings.title')}
        onClick={() => setOpen(true)}
      >
        <SettingsIcon />
      </Button>
      {open && <SettingsDialog open={open} onOpenChange={setOpen} />}
    </>
  )
}
