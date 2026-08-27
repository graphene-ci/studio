// Shared roving-tabindex tree navigation (APG tree pattern) for the
// left-panel trees: ↑/↓ rows, →/← expand/collapse (← from a leaf
// jumps to the parent), Home/End, Enter/Space primary action, "/"
// focuses the filter.

import { useRef, useState, type KeyboardEvent } from 'react'

export interface NavRow {
  key: string
  depth: number
  hasChildren: boolean
  isExpanded: boolean
}

interface TreeNavigationOptions<R extends NavRow> {
  rows: R[]
  onToggle: (key: string, open?: boolean) => void
  /** Enter/Space on a row. */
  onPrimary: (row: R) => void
  onFocusFilter?: () => void
}

export function useTreeNavigation<R extends NavRow>({
  rows,
  onToggle,
  onPrimary,
  onFocusFilter,
}: TreeNavigationOptions<R>) {
  const [activeKey, setActiveKey] = useState<string | null>(null)
  const rowElements = useRef(new Map<string, HTMLElement>())

  const activeIndex = Math.max(
    0,
    rows.findIndex((r) => r.key === activeKey),
  )

  const focusRow = (key: string) => {
    setActiveKey(key)
    const el = rowElements.current.get(key)
    el?.focus()
    el?.scrollIntoView({ block: 'nearest' })
  }

  const registerRow = (key: string) => (el: HTMLElement | null) => {
    if (el === null) rowElements.current.delete(key)
    else rowElements.current.set(key, el)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (rows.length === 0) return
    const row = rows[activeIndex]
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        focusRow(rows[Math.min(activeIndex + 1, rows.length - 1)].key)
        break
      case 'ArrowUp':
        event.preventDefault()
        focusRow(rows[Math.max(activeIndex - 1, 0)].key)
        break
      case 'ArrowRight':
        event.preventDefault()
        if (row.hasChildren && !row.isExpanded) onToggle(row.key, true)
        else if (row.hasChildren && activeIndex + 1 < rows.length) {
          focusRow(rows[activeIndex + 1].key)
        }
        break
      case 'ArrowLeft': {
        event.preventDefault()
        if (row.hasChildren && row.isExpanded) {
          onToggle(row.key, false)
          break
        }
        for (let i = activeIndex - 1; i >= 0; i -= 1) {
          if (rows[i].depth < row.depth) {
            focusRow(rows[i].key)
            break
          }
        }
        break
      }
      case 'Home':
        event.preventDefault()
        focusRow(rows[0].key)
        break
      case 'End':
        event.preventDefault()
        focusRow(rows[rows.length - 1].key)
        break
      case 'Enter':
      case ' ':
        event.preventDefault()
        onPrimary(row)
        break
      case '/':
        if (onFocusFilter !== undefined) {
          event.preventDefault()
          onFocusFilter()
        }
        break
      default:
        break
    }
  }

  return { activeKey, setActiveKey, activeIndex, focusRow, registerRow, handleKeyDown }
}
