import { useStore } from '@nanostores/react'
import { CheckIcon, PaletteIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { $theme, setTheme, type Theme } from '@/stores/themeStore'

const LIGHT_THEMES: readonly Theme[] = ['light', 'snow', 'paper']
const DARK_THEMES: readonly Theme[] = ['dark', 'midnight', 'graphite']

// Mini window painted with the THEME'S OWN tokens: the theme class on
// the swatch root re-scopes every CSS variable for the subtree, so the
// preview can never drift from index.css.
function ThemeSwatch({ theme }: { theme: Theme }) {
  return (
    <span
      className={cn(
        theme,
        'pointer-events-none flex h-14 w-full overflow-hidden rounded-md border border-border bg-background',
      )}
      aria-hidden
    >
      <span className="flex w-4 shrink-0 flex-col items-center gap-1 bg-sidebar p-1">
        <span className="size-1.5 rounded-full bg-primary" />
        <span className="h-1 w-2 rounded-full bg-border" />
        <span className="h-1 w-2 rounded-full bg-border" />
      </span>
      <span className="flex grow flex-col gap-1 p-1.5">
        <span className="h-1.5 w-9 rounded-full bg-foreground" />
        <span className="flex grow flex-col justify-center gap-1 rounded-sm border border-border bg-card px-1.5">
          <span className="h-1 w-10 rounded-full bg-muted-foreground" />
          <span className="h-1 w-6 rounded-full bg-muted-foreground" />
        </span>
        <span className="h-2 w-8 rounded-sm bg-primary" />
      </span>
    </span>
  )
}

function ThemeOption({ theme }: { theme: Theme }) {
  const { t } = useTranslation()
  const active = useStore($theme) === theme

  return (
    <DropdownMenuItem asChild onSelect={() => setTheme(theme)}>
      <button
        type="button"
        role="menuitemradio"
        aria-checked={active}
        className={cn(
          'flex w-32 flex-col items-stretch gap-1.5 rounded-md border p-1.5 text-left',
          active ? 'border-primary bg-accent' : 'border-transparent',
        )}
      >
        <ThemeSwatch theme={theme} />
        <span className="flex items-center gap-1 px-0.5 text-xs">
          <span className="grow">{t(`graphene.theme.${theme}`)}</span>
          {active && <CheckIcon className="size-3 text-primary" />}
        </span>
      </button>
    </DropdownMenuItem>
  )
}

export function ThemeMenu() {
  const { t } = useTranslation()
  const theme = useStore($theme)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`${t('graphene.app.theme')}: ${t(`graphene.theme.${theme}`)}`}
          className="flex size-6 items-center justify-center rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <PaletteIcon className="size-3.5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-max max-w-none p-2">
        <DropdownMenuLabel className="px-1.5 pb-1 text-xs text-muted-foreground">
          {t('graphene.app.themesLight')}
        </DropdownMenuLabel>
        <div className="grid grid-cols-3 gap-1">
          {LIGHT_THEMES.map((id) => (
            <ThemeOption key={id} theme={id} />
          ))}
        </div>
        <DropdownMenuLabel className="px-1.5 pt-2 pb-1 text-xs text-muted-foreground">
          {t('graphene.app.themesDark')}
        </DropdownMenuLabel>
        <div className="grid grid-cols-3 gap-1">
          {DARK_THEMES.map((id) => (
            <ThemeOption key={id} theme={id} />
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
