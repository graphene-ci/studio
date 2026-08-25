import { useStore } from '@nanostores/react'
import { useCallback, useEffect, useRef, useState } from 'react'

import { resourceVMFromResource, type ResourceVM } from '@/helpers/resourceVM'
import type { TreeNode } from '@/proto/management/v1/resources_pb'
import { $api } from '@/stores/apiStore'

export interface ResourceTreeNode {
  resource: ResourceVM
  children: ResourceTreeNode[]
}

function fromTreeNode(node: TreeNode): ResourceTreeNode {
  if (node.resource === undefined) throw new Error('resource tree node is missing its resource')
  return {
    resource: resourceVMFromResource(node.resource),
    children: node.children.map(fromTreeNode),
  }
}

/** Entity-resource listing (selector) or ownership tree — one hook,
 * the mode picks the RPC. Same in-place refresh discipline as runs. */
export function useResourcesQuery(
  mode: 'table' | 'tree',
  selector: string | null,
  pageSize: number,
  pollMs: number,
  paused: boolean,
) {
  const api = useStore($api)
  const [resources, setResources] = useState<ResourceVM[]>([])
  const [roots, setRoots] = useState<ResourceTreeNode[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasNext, setHasNext] = useState(false)
  const [hasPrev, setHasPrev] = useState(false)
  const stackRef = useRef<string[]>([''])
  const nextRef = useRef<string>('')
  const seqRef = useRef(0)

  const fetchNow = useCallback(async () => {
    if (selector === null) return
    const seq = ++seqRef.current
    setRefreshing(true)
    try {
      if (mode === 'tree') {
        const resp = await api.resources.tree({ owner: '' })
        if (seq !== seqRef.current) return
        setRoots(resp.roots.map(fromTreeNode))
      } else {
        const token = stackRef.current[stackRef.current.length - 1] ?? ''
        const resp = await api.resources.list({
          // Empty selector lists every live record (the server's
          // legacy structural path).
          ...(selector === '' ? {} : { query: selector }),
          pageSize,
          pageToken: token,
        })
        if (seq !== seqRef.current) return
        nextRef.current = resp.nextPageToken
        setResources(resp.resources.map(resourceVMFromResource))
        setHasNext(resp.nextPageToken !== '')
        setHasPrev(stackRef.current.length > 1)
      }
      setLoading(false)
      setRefreshing(false)
      setError(null)
    } catch (err) {
      if (seq !== seqRef.current) return
      setLoading(false)
      setRefreshing(false)
      setError(err instanceof Error ? err.message : String(err))
    }
  }, [api, mode, selector, pageSize])

  useEffect(() => {
    stackRef.current = ['']
    nextRef.current = ''
    void fetchNow()
  }, [fetchNow])

  useEffect(() => {
    if (pollMs <= 0 || paused) return
    const timer = setInterval(() => void fetchNow(), pollMs)
    return () => clearInterval(timer)
  }, [pollMs, paused, fetchNow])

  const goNext = useCallback(() => {
    if (nextRef.current === '') return
    stackRef.current.push(nextRef.current)
    void fetchNow()
  }, [fetchNow])

  const goPrev = useCallback(() => {
    if (stackRef.current.length <= 1) return
    stackRef.current.pop()
    void fetchNow()
  }, [fetchNow])

  return {
    resources,
    roots,
    loading,
    refreshing,
    error,
    hasNext,
    hasPrev,
    pageIndex: stackRef.current.length - 1,
    refresh: useCallback(() => void fetchNow(), [fetchNow]),
    goNext,
    goPrev,
  }
}
