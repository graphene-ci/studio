import { useStore } from '@nanostores/react'
import { CheckIcon, ChevronDownIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { ThemeMenu } from '@/components/ThemeMenu'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { $lang, LANGS, setLang, type Lang } from '@/stores/langStore'

const LANGUAGE_FLAGS: Record<Lang, string> = {
  en: '🇬🇧',
  ru: '🇷🇺',
}

function LanguageOption({ id, active }: { id: Lang; active: boolean }) {
  const { t } = useTranslation()

  return (
    <DropdownMenuItem asChild onSelect={() => setLang(id)}>
      <button
        type="button"
        role="menuitemradio"
        aria-checked={active}
        className={cn(
          'flex h-24 flex-col items-center justify-center gap-2 rounded-md border p-3 text-center',
          active ? 'border-primary bg-accent' : 'border-transparent',
        )}
      >
        <span aria-hidden className="text-2xl leading-none">
          {LANGUAGE_FLAGS[id]}
        </span>
        <span className="flex w-full items-center justify-center gap-1.5 text-sm font-medium">
          {t(`graphene.lang.${id}`)}
          {active && <CheckIcon className="size-3.5 text-primary" />}
        </span>
      </button>
    </DropdownMenuItem>
  )
}

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
            className="flex h-8 items-center gap-1.5 rounded-sm bg-muted px-2 text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground"
          >
            <span className="font-mono text-xs uppercase">{lang}</span>
            <ChevronDownIcon className="size-3.5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72 p-2">
          <DropdownMenuLabel className="px-1.5 pb-2 text-xs text-muted-foreground">
            {t('graphene.app.language')}
          </DropdownMenuLabel>
          <div className="grid grid-cols-2 gap-1">
            {LANGS.map((id) => (
              <LanguageOption key={id} id={id} active={id === lang} />
            ))}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  )
}
