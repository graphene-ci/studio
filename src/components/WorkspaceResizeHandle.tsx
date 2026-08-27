import { type KeyboardEvent, type PointerEvent, useRef } from 'react'

import { cn } from '@/lib/utils'

const KEYBOARD_RESIZE_STEP = 8
const RELATIVE_KEYBOARD_RESIZE_STEP = 2

interface WorkspaceResizeHandleProps {
  orientation: 'vertical' | 'horizontal'
  direction: 1 | -1
  relative?: boolean
  label: string
  size: number
  min: number
  max: number
  className?: string
  onResize: (size: number) => void
}

interface ResizeStart {
  pointerId: number
  coordinate: number
  size: number
  extent: number
}

export function WorkspaceResizeHandle({
  orientation,
  direction,
  relative = false,
  label,
  size,
  min,
  max,
  className,
  onResize,
}: WorkspaceResizeHandleProps) {
  const resizeStart = useRef<ResizeStart | null>(null)

  const getCoordinate = (event: PointerEvent) =>
    orientation === 'vertical' ? event.clientX : event.clientY

  const handlePointerDown = (event: PointerEvent<HTMLHRElement>) => {
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    resizeStart.current = {
      pointerId: event.pointerId,
      coordinate: getCoordinate(event),
      size,
      extent: relative
        ? orientation === 'vertical'
          ? (event.currentTarget.parentElement?.clientWidth ?? 1)
          : (event.currentTarget.parentElement?.clientHeight ?? 1)
        : 1,
    }
  }

  const handlePointerMove = (event: PointerEvent<HTMLHRElement>) => {
    const start = resizeStart.current
    if (start === null || start.pointerId !== event.pointerId) return
    const pixelDelta = (getCoordinate(event) - start.coordinate) * direction
    const delta = relative ? (pixelDelta / start.extent) * 100 : pixelDelta
    onResize(start.size + delta)
  }

  const handlePointerEnd = (event: PointerEvent<HTMLHRElement>) => {
    if (resizeStart.current?.pointerId !== event.pointerId) return
    resizeStart.current = null
    event.currentTarget.releasePointerCapture(event.pointerId)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLHRElement>) => {
    let delta = 0
    if (orientation === 'vertical' && event.key === 'ArrowLeft') delta = -1
    if (orientation === 'vertical' && event.key === 'ArrowRight') delta = 1
    if (orientation === 'horizontal' && event.key === 'ArrowUp') delta = -1
    if (orientation === 'horizontal' && event.key === 'ArrowDown') delta = 1

    if (event.key === 'Home') {
      event.preventDefault()
      onResize(min)
      return
    }
    if (event.key === 'End') {
      event.preventDefault()
      onResize(max)
      return
    }
    if (delta === 0) return
    event.preventDefault()
    const step = relative ? RELATIVE_KEYBOARD_RESIZE_STEP : KEYBOARD_RESIZE_STEP
    onResize(size + delta * direction * step)
  }

  return (
    <hr
      className={cn('workspace-resize-handle', `workspace-resize-handle-${orientation}`, className)}
      aria-label={label}
      aria-orientation={orientation}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={size}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
    />
  )
}
