import { useTranslation } from 'react-i18next'

import logoDarkBg from '@/assets/logo.svg'
import logoLightBg from '@/assets/logo-light.svg'
import { cn } from '@/lib/utils'

interface LogoProps {
  className?: string
}

// Brand mark from the docs site. Two renders toggled by theme class:
// the light mark on dark themes, the dark mark on light ones (`dark:`
// used for visibility only — colors live in the SVGs themselves).
export function Logo({ className }: LogoProps) {
  const { t } = useTranslation()
  const alt = t('graphene.app.title')

  return (
    <span className={cn('inline-flex size-6 shrink-0', className)}>
      <img src={logoDarkBg} alt={alt} className="hidden size-full dark:block" />
      <img src={logoLightBg} alt={alt} className="size-full dark:hidden" />
    </span>
  )
}
