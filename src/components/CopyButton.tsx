import { CheckIcon, CopyIcon } from 'lucide-react'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'

// Small copy affordance for ids, digests, refs.
export function CopyButton({ value, label }: { value: string; label: string }) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label={t('graphene.app.copy', { what: label })}
      onClick={() => {
        void navigator.clipboard.writeText(value)
        setCopied(true)
        if (timerRef.current !== null) clearTimeout(timerRef.current)
        timerRef.current = setTimeout(() => setCopied(false), 1500)
      }}
    >
      {copied ? (
        <CheckIcon className="size-3 text-status-success" />
      ) : (
        <CopyIcon className="size-3 text-muted-foreground" />
      )}
    </Button>
  )
}
