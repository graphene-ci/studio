import { CheckIcon, CopyIcon } from 'lucide-react'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { TONE_TEXT } from '@/components/status/tones'
import { Button } from '@/components/ui/button'

interface CopyButtonProps {
  /** What lands in the clipboard. */
  value: string
  /** Accessible name; defaults to the generic "copy". */
  label?: string
}

/** Small copy-to-clipboard button with a transient check. */
export function CopyButton({ value, label }: CopyButtonProps) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      if (timerRef.current !== null) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard refused (permissions) — nothing to report loudly.
    }
  }

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label={label ?? t('graphene.app.copy', { what: value })}
      title={label ?? t('graphene.app.copy', { what: value })}
      onClick={() => void handleCopy()}
    >
      {copied ? <CheckIcon className={TONE_TEXT.success} /> : <CopyIcon />}
    </Button>
  )
}
