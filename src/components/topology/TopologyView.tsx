import { useStore } from '@nanostores/react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { client } from '@/client'
import { KindIcon } from '@/components/resources/tree/KindIcon'
import { Spinner } from '@/components/ui/spinner'
import { buildTopology, edgeCaption, type TopoEdge } from '@/helpers/topology'
import { openResourceTab } from '@/stores/editorTabsStore'
import { selectResource } from '@/stores/selectionStore'

// Deterministic grid: machine boxes as columns, external endpoints in
// the trailing column. No measuring, no force layout — positions come
// straight from the counts, edges drawn on top as SVG beziers.
const BOX_W = 248
const BOX_GAP = 96
const BOX_HEADER = 34
const BOX_PAD = 12
const NODE_W = BOX_W - BOX_PAD * 2
const NODE_H = 44
const NODE_GAP = 10
const ROW_H = NODE_H + NODE_GAP

interface Box {
  x: number
  width: number
  height: number
}

interface Placed {
  x: number
  y: number
  w: number
  h: number
}

export function TopologyView() {
  const { t } = useTranslation()
  const view = useStore(client.stores.tree())
  const model = useMemo(() => buildTopology(view.data), [view.data])

  const layout = useMemo(() => {
    const boxes = new Map<string, Box>()
    const pos = new Map<string, Placed>()
    let maxHeight = 0

    model.groups.forEach((group, i) => {
      const x = i * (BOX_W + BOX_GAP)
      const count = Math.max(group.nodes.length, 1)
      const height = BOX_HEADER + BOX_PAD + count * NODE_H + (count - 1) * NODE_GAP + BOX_PAD
      boxes.set(group.agentRef, { x, width: BOX_W, height })
      maxHeight = Math.max(maxHeight, height)
      group.nodes.forEach((node, j) => {
        pos.set(node.ref, {
          x: x + BOX_PAD,
          y: BOX_HEADER + BOX_PAD + j * ROW_H,
          w: NODE_W,
          h: NODE_H,
        })
      })
    })

    const extX = model.groups.length * (BOX_W + BOX_GAP)
    model.externals.forEach((target, k) => {
      pos.set(target, { x: extX, y: BOX_HEADER + BOX_PAD + k * ROW_H, w: NODE_W, h: NODE_H })
    })
    const extHeight =
      model.externals.length === 0
        ? 0
        : BOX_HEADER + BOX_PAD + model.externals.length * ROW_H - NODE_GAP + BOX_PAD

    const width = extX + (model.externals.length > 0 ? BOX_W : -BOX_GAP)
    const height = Math.max(maxHeight, extHeight, 1)
    return { boxes, pos, extX, width: Math.max(width, 1), height }
  }, [model])

  if (!view.loaded && view.error === null) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner className="size-4" />
      </div>
    )
  }
  if (model.groups.length === 0) {
    return (
      <div className="flex h-full items-center justify-center px-6">
        <p className="max-w-sm text-center text-xs text-muted-foreground">
          {t('graphene.topology.empty')}
        </p>
      </div>
    )
  }

  const anchor = (edge: TopoEdge) => {
    const from = layout.pos.get(edge.from)
    const to = layout.pos.get(edge.to)
    if (from === undefined || to === undefined) return null
    const x1 = from.x + from.w
    const y1 = from.y + from.h / 2
    const x2 = to.x
    const y2 = to.y + to.h / 2
    return { x1, y1, x2, y2 }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 overflow-auto p-4">
        <div className="relative" style={{ width: layout.width, height: layout.height }}>
          <svg
            className="pointer-events-none absolute inset-0"
            width={layout.width}
            height={layout.height}
            aria-hidden="true"
          >
            <defs>
              <marker
                id="topology-arrow"
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M0,0 L10,5 L0,10 z" fill="var(--muted-foreground)" />
              </marker>
            </defs>
            {model.edges.map((edge) => {
              const a = anchor(edge)
              if (a === null) return null
              const dx = Math.max(40, Math.abs(a.x2 - a.x1) / 2)
              return (
                <path
                  key={`${edge.from}->${edge.to}:${edge.protocol}:${edge.port ?? ''}`}
                  d={`M${a.x1},${a.y1} C${a.x1 + dx},${a.y1} ${a.x2 - dx},${a.y2} ${a.x2},${a.y2}`}
                  fill="none"
                  stroke="var(--border)"
                  strokeWidth="1.5"
                  markerEnd="url(#topology-arrow)"
                />
              )
            })}
          </svg>

          {/* Machine boxes (background containers). */}
          {model.groups.map((group) => {
            const box = layout.boxes.get(group.agentRef)
            if (box === undefined) return null
            const ungrouped = group.agentRef === ''
            return (
              <div
                key={group.agentRef || '@ungrouped'}
                className="absolute rounded-lg border border-border bg-surface-hover/40"
                style={{ left: box.x, top: 0, width: box.width, height: box.height }}
              >
                <div className="flex h-[34px] items-center gap-1.5 px-3 font-mono text-2xs text-muted-foreground">
                  {!ungrouped && <KindIcon kind="agent" className="size-3.5" />}
                  <span className="min-w-0 truncate">
                    {ungrouped ? t('graphene.topology.ungrouped') : group.agentId}
                  </span>
                </div>
              </div>
            )
          })}

          {/* External endpoints column background. */}
          {model.externals.length > 0 && (
            <div
              className="absolute font-mono text-2xs text-muted-foreground"
              style={{ left: layout.extX + BOX_PAD, top: BOX_PAD }}
            >
              {t('graphene.topology.external')}
            </div>
          )}

          {/* Record nodes. */}
          {model.groups.flatMap((group) =>
            group.nodes.map((node) => {
              const p = layout.pos.get(node.ref)
              if (p === undefined) return null
              return (
                <button
                  key={node.ref}
                  type="button"
                  className="absolute flex flex-col justify-center gap-0.5 rounded-md bg-muted px-2.5 text-left hover:bg-accent hover:text-accent-foreground"
                  style={{ left: p.x, top: p.y, width: p.w, height: p.h }}
                  onClick={() => {
                    selectResource(node.ref)
                    openResourceTab(node.ref)
                  }}
                  title={node.ref}
                >
                  <span className="flex min-w-0 items-center gap-1.5 font-mono text-xs">
                    <KindIcon kind={node.kind} className="size-3.5" />
                    <span className="min-w-0 truncate">{node.id}</span>
                  </span>
                  <span className="min-w-0 truncate font-mono text-3xs text-muted-foreground">
                    {node.kind}
                  </span>
                </button>
              )
            }),
          )}

          {/* External endpoint nodes. */}
          {model.externals.map((target) => {
            const p = layout.pos.get(target)
            if (p === undefined) return null
            return (
              <div
                key={target}
                className="absolute flex items-center rounded-md border border-dashed border-border bg-background px-2.5"
                style={{ left: p.x, top: p.y, width: p.w, height: p.h }}
                title={target}
              >
                <span className="min-w-0 truncate font-mono text-xs text-muted-foreground">
                  {target}
                </span>
              </div>
            )
          })}

          {/* Edge captions (protocol / port / label). */}
          {model.edges.map((edge) => {
            const a = anchor(edge)
            const caption = edgeCaption(edge)
            if (a === null || caption === '') return null
            return (
              <span
                key={`label:${edge.from}->${edge.to}:${edge.protocol}:${edge.port ?? ''}`}
                className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-sm bg-background/90 px-1 font-mono text-3xs text-muted-foreground"
                style={{ left: (a.x1 + a.x2) / 2, top: (a.y1 + a.y2) / 2 }}
              >
                {caption}
              </span>
            )
          })}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2 border-t border-border px-4 py-2 text-2xs text-muted-foreground">
        <span
          aria-hidden
          className="inline-block h-0 w-6 shrink-0 border-t-2 border-border"
          style={{ borderColor: 'var(--border)' }}
        />
        <span>{t('graphene.topology.declared')}</span>
      </div>
    </div>
  )
}
