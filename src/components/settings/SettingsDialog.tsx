import { useStore } from '@nanostores/react'
import { CheckIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { ThemeSwatch } from '@/components/ThemeMenu'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import {
  $editorSettings,
  setEditorSetting,
  type EditorSettings,
} from '@/stores/editorSettingsStore'
import { $lang, LANGS, setLang } from '@/stores/langStore'
import { $theme, setTheme, THEMES } from '@/stores/themeStore'

interface SettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const EDITOR_TOGGLES: (keyof EditorSettings)[] = [
  'wordWrap',
  'showWhitespace',
  'indentationMarkers',
  'minimap',
  'formatOnSave',
  'trimOnSave',
]

// The one settings home: appearance (theme, language) and editor
// behavior. Everything here is app state, persisted per browser.
export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const { t } = useTranslation()
  const theme = useStore($theme)
  const lang = useStore($lang)
  const editor = useStore($editorSettings)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t('graphene.settings.title')}</DialogTitle>
          <DialogDescription>{t('graphene.settings.subtitle')}</DialogDescription>
        </DialogHeader>

        <section className="flex flex-col gap-2">
          <h3 className="text-xs font-semibold text-muted-foreground">{t('graphene.app.theme')}</h3>
          <div className="grid grid-cols-3 gap-2">
            {THEMES.map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={theme === option}
                className={cn(
                  'flex flex-col items-stretch gap-1.5 rounded-md border p-1.5 text-left',
                  theme === option ? 'border-primary bg-accent' : 'border-border',
                )}
                onClick={() => setTheme(option)}
              >
                <ThemeSwatch theme={option} />
                <span className="flex items-center gap-1.5 text-xs font-medium">
                  {t(`graphene.theme.${option}`)}
                  {theme === option && <CheckIcon className="size-3 text-primary" />}
                </span>
              </button>
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-2">
          <h3 className="text-xs font-semibold text-muted-foreground">
            {t('graphene.app.language')}
          </h3>
          <div className="flex gap-2">
            {LANGS.map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={lang === option}
                className={cn(
                  'flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium',
                  lang === option ? 'border-primary bg-accent' : 'border-border',
                )}
                onClick={() => setLang(option)}
              >
                {t(`graphene.lang.${option}`)}
                {lang === option && <CheckIcon className="size-3 text-primary" />}
              </button>
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-2">
          <h3 className="text-xs font-semibold text-muted-foreground">
            {t('graphene.settings.editor')}
          </h3>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2">
            {EDITOR_TOGGLES.map((key) => (
              <Label key={key} className="flex items-center gap-2 text-xs font-normal">
                <Checkbox
                  checked={editor[key]}
                  onCheckedChange={(checked) => setEditorSetting(key, checked === true)}
                />
                {t(`graphene.settings.editorToggles.${key}`)}
              </Label>
            ))}
          </div>
        </section>
      </DialogContent>
    </Dialog>
  )
}
