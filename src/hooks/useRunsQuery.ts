import { useStore } from '@nanostores/react'
import { useCallback, useEffect, useRef, useState } from 'react'

import { runVMFromResource, type RunVM } from '@/helpers/runVM'
import { $api } from '@/stores/apiStore'

export interface RunsQueryState {
  runs: RunVM[]
  loading: boolean
  refreshing: boolean
  error: string | null
  hasNext: boolean
  hasPrev: boolean
}

/** Server-side runs listing: cursor pagination with a token back-stack
 * (a working Prev over an opaque cursor). Only the very first load
 * blanks the table; filter changes, paging, and polling all refresh IN
 * PLACE over the previous rows so nothing on the page jumps.
 * selector === null means "don't fetch" (the q text is invalid). */
export function useRunsQuery(
  selector: string | null,
  pageSize: number,
  pollMs: number,
  paused: boolean,
) {
  const api = useStore($api)
  const [state, setState] = useState<RunsQueryState>({
    runs: [],
    loading: true,
    refreshing: false,
    error: null,
    hasNext: false,
    hasPrev: false,
  })
  // Stack of page tokens leading TO the current page; the current
  // page's own token is the top. next token from the last reply.
  const stackRef = useRef<string[]>([''])
  const nextRef = useRef<string>('')
  const seqRef = useRef(0)

  const fetchPage = useCallback(async () => {
    if (selector === null) return
    const seq = ++seqRef.current
    setState((s) => ({ ...s, refreshing: true }))
    try {
      const token = stackRef.current[stackRef.current.length - 1] ?? ''
      const resp = await api.resources.list({
        query: selector,
        pageSize,
        pageToken: token,
      })
      if (seq !== seqRef.current) return
      nextRef.current = resp.nextPageToken
      setState({
        runs: resp.resources.map(runVMFromResource),
        loading: false,
        refreshing: false,
        error: null,
        hasNext: resp.nextPageToken !== '',
        hasPrev: stackRef.current.length > 1,
      })
    } catch (err) {
      if (seq !== seqRef.current) return
      setState((s) => ({
        ...s,
        loading: false,
        refreshing: false,
        error: err instanceof Error ? err.message : String(err),
      }))
    }
  }, [api, selector, pageSize])

  // New selector/size/api — back to the first page.
  useEffect(() => {
    stackRef.current = ['']
    nextRef.current = ''
    void fetchPage()
  }, [fetchPage])

  useEffect(() => {
    if (pollMs <= 0 || paused) return
    const timer = setInterval(() => void fetchPage(), pollMs)
    return () => clearInterval(timer)
  }, [pollMs, paused, fetchPage])

  const goNext = useCallback(() => {
    if (nextRef.current === '') return
    stackRef.current.push(nextRef.current)
    void fetchPage()
  }, [fetchPage])

  const goPrev = useCallback(() => {
    if (stackRef.current.length <= 1) return
    stackRef.current.pop()
    void fetchPage()
  }, [fetchPage])

  const refresh = useCallback(() => void fetchPage(), [fetchPage])

  return { ...state, goNext, goPrev, refresh, pageIndex: stackRef.current.length - 1 }
}
