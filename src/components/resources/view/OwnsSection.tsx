import { useStore } from '@nanostores/react'
import { useTranslation } from 'react-i18next'

import { client } from '@/client'
import { KindIcon } from '@/components/resources/tree/KindIcon'
import { PhaseText } from '@/components/status/PhaseText'
import { openResourceTab } from '@/stores/editorTabsStore'

// The record's own subtree — what dies with it. Live while visible.
export function OwnsSection({ ownerRef }: { ownerRef: string }) {
  const { t } = useTranslation()
  const view = useStore(client.stores.tree(ownerRef))
  if (!view.loaded || view.data.length === 0) return null
  return (
    <section className="flex flex-col gap-1.5">
      <h3 className="text-2xs font-semibold tracking-wide text-muted-foreground uppercase">
        {t('graphene.inspector.tab.owns')}
      </h3>
      <ul className="flex flex-col">
        {view.data.map((node) => {
          const resource = node.resource
          if (resource === undefined) return null
          return (
            <li key={resource.ref}>
              <button
                type="button"
                className="flex h-6 w-full min-w-0 items-center gap-1.5 rounded-sm px-1.5 text-left font-mono text-xs hover:bg-surface-hover"
                onClick={() => openResourceTab(resource.ref)}
              >
                <KindIcon kind={resource.kind} className="size-3.5" />
                <span className="min-w-0 truncate">{resource.ref}</span>
                <span className="grow" />
                <PhaseText phase={resource.phase} className="text-2xs" />
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
