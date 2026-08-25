import { useStore } from '@nanostores/react'
import { useTranslation } from 'react-i18next'

import { ThemeMenu } from '@/components/ThemeMenu'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { $lang, LANGS, setLang, type Lang } from '@/stores/langStore'

export function AppearanceMenus() {
  const { t } = useTranslation()
  const lang = useStore($lang)

  return (
    <>
      <ThemeMenu />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={t('graphene.app.language')}
            className="flex h-6 items-center rounded-sm px-1.5 font-mono text-2xs text-muted-foreground uppercase hover:bg-muted hover:text-foreground"
          >
            {lang}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuRadioGroup value={lang} onValueChange={(value) => setLang(value as Lang)}>
            {LANGS.map((id) => (
              <DropdownMenuRadioItem key={id} value={id}>
                {t(`graphene.lang.${id}`)}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  )
}
