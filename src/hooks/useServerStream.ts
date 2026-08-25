import { useEffect, useRef, useState } from 'react'

export interface StreamState<T> {
  items: T[]
  // 'open' while the stream is live, 'done' after a clean end.
  status: 'open' | 'done' | 'error'
  error: string | null
}

/** Collects a connect server-stream into state. Items are flushed on a
 * short interval, not per message — a chatty log stream must not
 * re-render per line. Keeps at most `max` items (ring). The stream is
 * torn down and restarted whenever `key` changes; key === null means
 * "no stream". */
export function useServerStream<T>(
  key: string | null,
  open: (signal: AbortSignal) => AsyncIterable<T>,
  max = 5000,
): StreamState<T> {
  const [state, setState] = useState<StreamState<T>>({
    items: [],
    status: 'open',
    error: null,
  })
  const openRef = useRef(open)
  openRef.current = open

  useEffect(() => {
    if (key === null) return
    const controller = new AbortController()
    let buffer: T[] = []
    let dirty = false
    setState({ items: [], status: 'open', error: null })

    const flushTimer = setInterval(() => {
      if (!dirty) return
      dirty = false
      const snapshot = buffer
      setState((s) => ({ ...s, items: snapshot }))
    }, 200)

    void (async () => {
      try {
        for await (const item of openRef.current(controller.signal)) {
          buffer = buffer.length >= max ? [...buffer.slice(1), item] : [...buffer, item]
          dirty = true
        }
        if (!controller.signal.aborted) {
          const snapshot = buffer
          setState({ items: snapshot, status: 'done', error: null })
        }
      } catch (err) {
        if (controller.signal.aborted) return
        const snapshot = buffer
        setState({
          items: snapshot,
          status: 'error',
          error: err instanceof Error ? err.message : String(err),
        })
      }
    })()

    return () => {
      controller.abort()
      clearInterval(flushTimer)
    }
  }, [key, max])

  return state
}
