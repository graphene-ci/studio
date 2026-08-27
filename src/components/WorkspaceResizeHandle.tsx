import { type KeyboardEvent, type PointerEvent, useRef } from 'react'

import { cn } from '@/lib/utils'

const KEYBOARD_RESIZE_STEP = 8

interface WorkspaceResizeHandleProps {
  orientation: 'vertical' | 'horizontal'
  direction: 1 | -1
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
}

export function WorkspaceResizeHandle({
  orientation,
  direction,
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
    }
  }

  const handlePointerMove = (event: PointerEvent<HTMLHRElement>) => {
    const start = resizeStart.current
    if (start === null || start.pointerId !== event.pointerId) return
    const delta = (getCoordinate(event) - start.coordinate) * direction
    onResize(start.size + delta)
  }

  const handlePointerEnd = (event: PointerEvent<HTMLHRElement>) => {
    if (resizeStart.current?.pointerId !== event.pointerId) return
    resizeStart.current = null
    event.currentTarget.releasePointerCapture(event.pointerId)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLHRElement>) => {
    let delta = 0
    if (orientation === 'vertical' && event.key === 'ArrowLeft') delta = -KEYBOARD_RESIZE_STEP
    if (orientation === 'vertical' && event.key === 'ArrowRight') delta = KEYBOARD_RESIZE_STEP
    if (orientation === 'horizontal' && event.key === 'ArrowUp') delta = -KEYBOARD_RESIZE_STEP
    if (orientation === 'horizontal' && event.key === 'ArrowDown') delta = KEYBOARD_RESIZE_STEP

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
    onResize(size + delta * direction)
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
