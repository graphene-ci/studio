import { useStore } from '@nanostores/react'
import { useEffect, useRef } from 'react'

import { useLocation, useNavigate, useParams } from '@/router'
import {
  $editorTabs,
  fileTabId,
  openFileTab,
  openPipelineTab,
  openResourceTab,
  pinTab,
  pipelineTabId,
  resourceTabId,
  type EditorTab,
} from '@/stores/editorTabsStore'

// Deep links: the route mirrors the ACTIVE center tab —
//   /n/<ns>/resource/<kind>/<id>
//   /n/<ns>/file/<sourceKind>/<sourceId>/<path…>
// Opening a link opens (and pins) the tab; switching tabs rewrites
// the URL in place (replace — tab hopping is not history).
function tabPath(tab: EditorTab): string {
  if (tab.type === 'resource') return `/resource/${tab.ref}`
  if (tab.type === 'pipeline') return `/pipeline/${tab.pipelineId}`
  return `/file/${tab.sourceRef}/${tab.path}`
}

export function EditorUrlSync() {
  const { ns } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const { tabs, activeId } = useStore($editorTabs)
  // The path we last wrote ourselves — not a user navigation.
  const written = useRef<string | null>(null)

  const prefix = `/n/${ns ?? ''}`
  const rest = location.pathname.startsWith(prefix) ? location.pathname.slice(prefix.length) : ''

  // URL → tab (deep link / back-forward).
  useEffect(() => {
    if (ns === undefined || rest === written.current) return
    if (rest.startsWith('/resource/')) {
      const ref = decodeURIComponent(rest.slice('/resource/'.length))
      const id = resourceTabId(ref)
      if (activeId !== id) {
        openResourceTab(ref)
        pinTab(id)
      }
    } else if (rest.startsWith('/pipeline/')) {
      const pipelineId = decodeURIComponent(rest.slice('/pipeline/'.length))
      const id = pipelineTabId(pipelineId)
      if (activeId !== id) {
        openPipelineTab(pipelineId)
        pinTab(id)
      }
    } else if (rest.startsWith('/file/')) {
      const tail = rest.slice('/file/'.length)
      const parts = tail.split('/').map(decodeURIComponent)
      if (parts.length >= 3) {
        const sourceRef = `${parts[0]}/${parts[1]}`
        const path = parts.slice(2).join('/')
        const id = fileTabId(sourceRef, path)
        if (activeId !== id) {
          openFileTab({
            sourceRef,
            path,
            name: path.slice(path.lastIndexOf('/') + 1),
            readOnly: sourceRef.startsWith('gitsource/'),
          })
          pinTab(id)
        }
      }
    }
  }, [ns, rest, activeId])

  // Tab → URL. rest/navigate are location-derived; reacting to them
  // here would fight the URL→tab effect above.
  // biome-ignore lint/correctness/useExhaustiveDependencies: one-way write on tab change.
  useEffect(() => {
    if (ns === undefined) return
    const active = tabs.find((t) => t.id === activeId) ?? null
    const desired = active === null ? '' : tabPath(active)
    if (rest !== desired) {
      written.current = desired
      navigate(`${prefix}${desired}`, { replace: true })
    }
  }, [ns, activeId, tabs])

  return null
}
