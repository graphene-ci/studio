import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

const controlClassName =
  'flex h-full w-10 items-center justify-center text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground active:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring'

export function WindowControls() {
  const { t } = useTranslation()
  const controls = window.desktop?.windowControls
  const [isMaximized, setIsMaximized] = useState(false)

  useEffect(() => {
    if (controls === undefined) return
    void controls.isMaximized().then(setIsMaximized)
    return controls.onMaximizedChange(setIsMaximized)
  }, [controls])

  if (controls === undefined) return null

  const handleToggleMaximize = async () => {
    setIsMaximized(await controls.toggleMaximize())
  }

  return (
    <fieldset className="window-controls flex h-full min-w-0 border-0 p-0">
      <legend className="sr-only">{t('graphene.app.windowControls')}</legend>
      <button
        type="button"
        className={controlClassName}
        aria-label={t('graphene.app.minimize')}
        onClick={() => controls.minimize()}
      >
        <span aria-hidden className="h-px w-3 bg-current" />
      </button>
      <button
        type="button"
        className={controlClassName}
        aria-label={t(isMaximized ? 'graphene.app.restore' : 'graphene.app.maximize')}
        onClick={() => void handleToggleMaximize()}
      >
        {isMaximized ? (
          <span aria-hidden className="relative size-3">
            <span className="absolute top-0 right-0 size-2.5 border border-current" />
            <span className="absolute bottom-0 left-0 size-2.5 border border-current bg-sidebar" />
          </span>
        ) : (
          <span aria-hidden className="size-2.5 border border-current" />
        )}
      </button>
      <button
        type="button"
        className={`${controlClassName} hover:bg-destructive hover:text-background`}
        aria-label={t('graphene.app.close')}
        onClick={() => controls.close()}
      >
        <span aria-hidden className="relative size-3">
          <span className="absolute top-1/2 left-0 h-px w-3 -translate-y-1/2 rotate-45 bg-current" />
          <span className="absolute top-1/2 left-0 h-px w-3 -translate-y-1/2 -rotate-45 bg-current" />
        </span>
      </button>
    </fieldset>
  )
}
