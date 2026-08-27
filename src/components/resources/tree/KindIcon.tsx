// Colored kind icons — JetBrains IntelliJ Platform classic set
// (Apache 2.0, vendored under src/assets/icons/kind; see
// ICONS-NOTICE.md). An unknown (brought) kind falls back to the
// platform's "unknown" glyph.

import agent from '@/assets/icons/kind/agent.svg'
import agentDark from '@/assets/icons/kind/agent_dark.svg'
import artifact from '@/assets/icons/kind/artifact.svg'
import gitsource from '@/assets/icons/kind/gitsource.svg'
import gitsourceDark from '@/assets/icons/kind/gitsource_dark.svg'
import kind_ from '@/assets/icons/kind/kind.svg'
import machine from '@/assets/icons/kind/machine.svg'
import managedsource from '@/assets/icons/kind/managedsource.svg'
import namespace from '@/assets/icons/kind/namespace.svg'
import pipeline from '@/assets/icons/kind/pipeline.svg'
import revision from '@/assets/icons/kind/revision.svg'
import role from '@/assets/icons/kind/role.svg'
import rolebinding from '@/assets/icons/kind/rolebinding.svg'
import run from '@/assets/icons/kind/run.svg'
import runDark from '@/assets/icons/kind/run_dark.svg'
import secret from '@/assets/icons/kind/secret.svg'
import serviceaccount from '@/assets/icons/kind/serviceaccount.svg'
import stand from '@/assets/icons/kind/stand.svg'
import trigger from '@/assets/icons/kind/trigger.svg'
import triggerDark from '@/assets/icons/kind/trigger_dark.svg'
import unknown from '@/assets/icons/kind/unknown.svg'
import variable from '@/assets/icons/kind/var.svg'

import { ThemedIcon } from '@/components/ThemedIcon'
import { cn } from '@/lib/utils'

interface IconAsset {
  light: string
  dark?: string
}

const KIND_ICONS: Record<string, IconAsset> = {
  pipeline: { light: pipeline },
  gitsource: { light: gitsource, dark: gitsourceDark },
  managedsource: { light: managedsource },
  revision: { light: revision },
  trigger: { light: trigger, dark: triggerDark },
  stand: { light: stand },
  agent: { light: agent, dark: agentDark },
  machine: { light: machine },
  artifact: { light: artifact },
  namespace: { light: namespace },
  var: { light: variable },
  secret: { light: secret },
  role: { light: role },
  rolebinding: { light: rolebinding },
  serviceaccount: { light: serviceaccount },
  kind: { light: kind_ },
  run: { light: run, dark: runDark },
}

interface KindIconProps {
  kind: string
  className?: string
}

export function KindIcon({ kind, className }: KindIconProps) {
  const asset = KIND_ICONS[kind] ?? { light: unknown }
  return (
    <ThemedIcon
      light={asset.light}
      dark={asset.dark}
      className={cn('size-3.5 shrink-0', className)}
    />
  )
}
