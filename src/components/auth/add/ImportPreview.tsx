import { useStore } from '@nanostores/react'
import { useTranslation } from 'react-i18next'

import type { ParsedContext } from '@/helpers/cliConfig'
import { Badge } from '@/components/ui/badge'
import { $contexts } from '@/stores/contextsStore'

interface ImportPreviewProps {
  parsed: ParsedContext[]
}

export function ImportPreview({ parsed }: ImportPreviewProps) {
  const { t } = useTranslation()
  const existing = useStore($contexts)

  return (
    <ul
      className="flex max-h-48 flex-col gap-1 overflow-y-auto"
      aria-label={t('graphene.contexts.parsedLabel')}
    >
      {parsed.map(({ name, ctx }) => (
        <li key={name} className="flex items-center gap-2.5 rounded-md bg-muted p-2">
          <span className="grow text-sm font-medium">{name}</span>
          <span className="truncate font-mono text-xs text-muted-foreground">
            {ctx.server === '' ? t('graphene.auth.sameOrigin') : ctx.server}
            {ctx.namespace !== '' ? ` · ${ctx.namespace}` : ''}
          </span>
          {name in existing ? (
            <Badge variant="secondary" className="text-2xs text-status-pending">
              {t('graphene.contexts.replacesExisting')}
            </Badge>
          ) : (
            <Badge variant="secondary" className="text-2xs text-status-success">
              {t('graphene.contexts.newContext')}
            </Badge>
          )}
          {ctx.token === '' && (
            <Badge variant="secondary" className="text-2xs text-muted-foreground">
              {t('graphene.auth.tokenNeeded')}
            </Badge>
          )}
        </li>
      ))}
    </ul>
  )
}
