import { useStore } from '@nanostores/react'

import { cn } from '@/lib/utils'
import { $theme, type Theme } from '@/stores/themeStore'

const DARK_THEMES: readonly Theme[] = ['dark', 'midnight', 'graphite']

interface ThemedIconProps {
  /** Light-theme asset URL (vite import). */
  light: string
  /** Dark-theme variant; falls back to the light asset. */
  dark?: string
  alt?: string
  className?: string
}

/** Multi-color SVG asset with a per-theme variant: ONE img, the
 * variant picked from the theme store (pre-colored JetBrains artwork,
 * not token colors — the theming rule stays intact). */
export function ThemedIcon({ light, dark, alt = '', className }: ThemedIconProps) {
  const theme = useStore($theme)
  const src = dark !== undefined && DARK_THEMES.includes(theme) ? dark : light
  return <img src={src} alt={alt} aria-hidden={alt === ''} className={cn('size-4', className)} />
}
