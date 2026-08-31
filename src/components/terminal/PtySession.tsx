import { FitAddon } from '@xterm/addon-fit'
import { Terminal } from '@xterm/xterm'
import { RotateCcwIcon } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import '@xterm/xterm/css/xterm.css'

import { client, type PtyHandle } from '@/client'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type PtyState =
  | { kind: 'live' }
  | { kind: 'closed'; exitCode: number; message: string }
  | { kind: 'error'; message: string }

// Reads the theme tokens the terminal canvas needs — xterm paints its
// own canvas, so token VALUES are resolved here, at open time.
function terminalTheme() {
  const style = getComputedStyle(document.documentElement)
  const token = (name: string) => style.getPropertyValue(name).trim()
  return {
    background: token('--background'),
    foreground: token('--foreground'),
    cursor: token('--foreground'),
    selectionBackground: token('--accent'),
  }
}

interface PtySessionProps {
  /** Agent record id ("bare-1"). */
  agentId: string
  /** Inactive tabs stay mounted — the session lives across switches. */
  isActive: boolean
}

// One PTY session (one tab): opens on mount, dies with the tab, the
// stream, the agent or the shell — reconnect reuses the tab. Copy is
// terminal-style: selection auto-copies; Ctrl+Shift+C / Ctrl+Shift+V
// work explicitly.
export function PtySession({ agentId, isActive }: PtySessionProps) {
  const { t } = useTranslation()
  const hostRef = useRef<HTMLDivElement | null>(null)
  const sessionRef = useRef<{ term: Terminal; handle: PtyHandle; observer: ResizeObserver } | null>(
    null,
  )
  const [state, setState] = useState<PtyState>({ kind: 'live' })

  const teardown = useCallback(() => {
    const session = sessionRef.current
    if (session === null) return
    sessionRef.current = null
    session.observer.disconnect()
    session.handle.close()
    session.term.dispose()
  }, [])

  const connect = useCallback(() => {
    const host = hostRef.current
    if (host === null) return
    teardown()

    const term = new Terminal({
      fontFamily: getComputedStyle(document.documentElement).getPropertyValue('--font-mono').trim(),
      fontSize: 12,
      theme: terminalTheme(),
      cursorBlink: true,
    })
    const fit = new FitAddon()
    term.loadAddon(fit)
    term.open(host)
    fit.fit()

    const handle = client.agents.openPty(
      agentId,
      { cols: term.cols, rows: term.rows },
      {
        onData: (data) => term.write(data),
        onClosed: (exitCode, message) => {
          setState({ kind: 'closed', exitCode, message })
          teardown()
        },
        onError: (message) => {
          setState({ kind: 'error', message })
          teardown()
        },
      },
    )
    term.onData((data) => handle.send(data))
    term.onResize(({ cols, rows }) => handle.resize(cols, rows))

    // Terminal-style clipboard: selection auto-copies; the explicit
    // combos stay off the shell's back (never reach the pty).
    term.onSelectionChange(() => {
      const selection = term.getSelection()
      if (selection !== '') void navigator.clipboard.writeText(selection)
    })
    term.attachCustomKeyEventHandler((event) => {
      if (event.type !== 'keydown' || !event.ctrlKey || !event.shiftKey) return true
      if (event.code === 'KeyC') {
        const selection = term.getSelection()
        if (selection !== '') void navigator.clipboard.writeText(selection)
        return false
      }
      if (event.code === 'KeyV') {
        void navigator.clipboard.readText().then((text) => {
          if (text !== '') handle.send(text)
        })
        return false
      }
      return true
    })

    const observer = new ResizeObserver(() => {
      if (host.clientWidth > 0) fit.fit()
    })
    observer.observe(host)

    sessionRef.current = { term, handle, observer }
    setState({ kind: 'live' })
    term.focus()
  }, [agentId, teardown])

  // Open on mount, bury on unmount (tab closed).
  useEffect(() => {
    connect()
    return teardown
  }, [connect, teardown])

  // Becoming visible again: refit and refocus.
  useEffect(() => {
    if (!isActive) return
    const session = sessionRef.current
    if (session === null) return
    requestAnimationFrame(() => {
      const host = hostRef.current
      if (host !== null && host.clientWidth > 0) {
        session.term.focus()
      }
    })
  }, [isActive])

  return (
    <div className={cn('relative h-full min-h-0 flex-col', isActive ? 'flex' : 'hidden')}>
      <div ref={hostRef} className={state.kind === 'live' ? 'min-h-0 grow p-1' : 'hidden'} />
      {state.kind !== 'live' && (
        <div className="flex grow flex-col items-center justify-center gap-3">
          {state.kind === 'closed' && (
            <p className="font-mono text-xs text-muted-foreground">
              {t('graphene.terminal.closed', { code: state.exitCode })}
              {state.message !== '' && ` · ${state.message}`}
            </p>
          )}
          {state.kind === 'error' && (
            <p className="max-w-96 truncate font-mono text-xs text-destructive">
              {t('graphene.terminal.failed')} · {state.message}
            </p>
          )}
          <Button onClick={connect}>
            <RotateCcwIcon />
            {t('graphene.terminal.reconnect')}
          </Button>
        </div>
      )}
    </div>
  )
}
