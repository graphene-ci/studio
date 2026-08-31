import { useTranslation } from 'react-i18next'

import { KindIcon } from '@/components/resources/tree/KindIcon'
import { TONE_TEXT } from '@/components/status/tones'
import { planLevels, type PlanStep } from '@/helpers/pipelineManifest'
import { cn } from '@/lib/utils'

/** Live coloring: step subject → status class. */
export type StepStatus = 'pending' | 'running' | 'completed' | 'failed'

const STATUS_TONE: Record<StepStatus, string> = {
  pending: TONE_TEXT.canceled,
  running: TONE_TEXT.pending,
  completed: TONE_TEXT.success,
  failed: TONE_TEXT.failed,
}

const COL_W = 200
const COL_GAP = 48
const ROW_H = 72
const NODE_H = 56

interface PlanGraphProps {
  steps: PlanStep[]
  /** Optional live statuses (the run view supplies them). */
  statusOf?: (step: PlanStep) => StepStatus | null
  onStepClick?: (step: PlanStep) => void
}

// The pipeline plan as a layered DAG (manifest.graph): declares,
// activities and transfers in dependency columns, edges drawn on a
// fixed grid — deterministic, no measuring.
export function PlanGraph({ steps, statusOf, onStepClick }: PlanGraphProps) {
  const { t } = useTranslation()
  const levels = planLevels(steps)

  if (steps.length === 0) {
    return <p className="text-xs text-muted-foreground">{t('graphene.pipeline.noPlan')}</p>
  }

  const position = new Map<string, { x: number; y: number }>()
  levels.forEach((column, level) => {
    column.forEach((step, row) => {
      position.set(step.subject, { x: level * (COL_W + COL_GAP), y: row * ROW_H })
    })
  })
  const width = levels.length * (COL_W + COL_GAP) - COL_GAP
  const height = Math.max(...levels.map((c) => c.length)) * ROW_H - (ROW_H - NODE_H)

  return (
    <div className="overflow-x-auto">
      <div className="relative" style={{ width, height }}>
        <svg
          className="pointer-events-none absolute inset-0"
          width={width}
          height={height}
          aria-hidden="true"
        >
          {steps.flatMap((step) =>
            step.deps.map((dep) => {
              const from = position.get(dep)
              const to = position.get(step.subject)
              if (from === undefined || to === undefined) return null
              const x1 = from.x + COL_W
              const y1 = from.y + NODE_H / 2
              const x2 = to.x
              const y2 = to.y + NODE_H / 2
              const mid = (x1 + x2) / 2
              return (
                <path
                  key={`${dep}->${step.subject}`}
                  d={`M${x1},${y1} C${mid},${y1} ${mid},${y2} ${x2},${y2}`}
                  fill="none"
                  stroke="var(--border)"
                  strokeWidth="1.5"
                />
              )
            }),
          )}
        </svg>
        {steps.map((step) => {
          const pos = position.get(step.subject)
          if (pos === undefined) return null
          const status = statusOf?.(step) ?? null
          const kind = step.subject.includes('/') ? step.subject.slice(0, step.subject.indexOf('/')) : ''
          return (
            <button
              key={step.subject}
              type="button"
              disabled={onStepClick === undefined}
              className={cn(
                'absolute flex flex-col justify-center gap-0.5 rounded-md bg-muted px-2.5 text-left',
                onStepClick !== undefined && 'cursor-pointer hover:bg-surface-hover',
                status === 'running' && 'ring-2 ring-ring',
              )}
              style={{ left: pos.x, top: pos.y, width: COL_W, height: NODE_H }}
              onClick={() => onStepClick?.(step)}
            >
              <span className="flex min-w-0 items-center gap-1.5 font-mono text-xs">
                {kind !== '' && <KindIcon kind={kind} className="size-3.5" />}
                <span className="min-w-0 truncate">{step.subject}</span>
              </span>
              <span className="flex min-w-0 items-center gap-1.5 font-mono text-3xs text-muted-foreground">
                <span>{t(`graphene.pipeline.op.${step.op}`, { defaultValue: step.op })}</span>
                {step.agent !== '' && <span className="truncate">· {step.agent}</span>}
                {step.note !== '' && <span className="truncate">· {step.note}</span>}
                {status !== null && (
                  <span className={cn('ml-auto', STATUS_TONE[status])}>
                    {t(`graphene.pipeline.status.${status}`)}
                  </span>
                )}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
