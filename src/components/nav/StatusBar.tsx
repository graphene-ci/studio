import { useStore } from '@nanostores/react'
import { useTranslation } from 'react-i18next'

import { useParams } from '@/router'
import { $currentContext } from '@/stores/contextsStore'
import { $session } from '@/stores/sessionStore'

// The console's bottom line: where am I, what am I, is the server well.
export function StatusBar() {
  const { t } = useTranslation()
  const context = useStore($currentContext)
  const session = useStore($session)
  const { ns } = useParams()

  return (
    <footer className="flex h-6 shrink-0 items-center gap-4 bg-sidebar px-3 font-mono text-2xs text-muted-foreground">
      <span>
        ctx <span className="text-foreground">{context}</span>
      </span>
      <span>
        ns <span className="text-foreground">{ns}</span>
      </span>
      {session !== null && (
        <span>
          role <span className="text-foreground">{session.role}</span>
        </span>
      )}
      <span className="grow" />
      <span>{t('graphene.statusbar.escHint')}</span>
    </footer>
  )
}
