import { useTranslation } from 'react-i18next'

import { FileTab } from '@/components/auth/add/FileTab'
import { FormTab } from '@/components/auth/add/FormTab'
import { PasteTab } from '@/components/auth/add/PasteTab'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface AddContextDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AddContextDialog({ open, onOpenChange }: AddContextDialogProps) {
  const { t } = useTranslation()
  const close = () => onOpenChange(false)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('graphene.contexts.addTitle')}</DialogTitle>
          <DialogDescription>{t('graphene.contexts.addSubtitle')}</DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="form">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="form">{t('graphene.contexts.tabForm')}</TabsTrigger>
            <TabsTrigger value="paste">{t('graphene.contexts.tabPaste')}</TabsTrigger>
            <TabsTrigger value="file">{t('graphene.contexts.tabFile')}</TabsTrigger>
          </TabsList>
          <TabsContent value="form">
            <FormTab onDone={close} />
          </TabsContent>
          <TabsContent value="paste">
            <PasteTab onDone={close} />
          </TabsContent>
          <TabsContent value="file">
            <FileTab onDone={close} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
