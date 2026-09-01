// The per-kind sub-tab registry. The resource view's shell (header,
// breadcrumbs, sub-tab bar) is common to EVERY kind; the body of each
// sub-tab is contributed here. Base sub-tabs (Overview, Observability)
// live in ResourceView; kinds add EXTRA sub-tabs through `kindSubTabs`
// and an optional Overview header through `kindOverviewHeader`. This is
// the extension point for docker/k8s/agent tomorrow — add an entry,
// never an `if (kind === …)` chain.

import type { ComponentType } from 'react'

import { PipelineOverviewHeader, pipelineSubTabs } from '@/components/pipelines/pipelineSubTabs'
import { runSubTabs } from '@/components/runs/runSubTabs'
import type { Resource } from '@/proto/management/v1/resources_pb'

/** One extra sub-tab of a resource view. */
export interface SubTabDef {
  /** Stable id (also the local active-tab key). */
  id: string
  /** i18n key for the tab label. */
  labelKey: string
  Body: ComponentType<{ record: Resource }>
}

/** Extra sub-tabs per kind, inserted BEFORE Observability. */
export const kindSubTabs: Record<string, SubTabDef[]> = {
  pipeline: pipelineSubTabs,
  run: runSubTabs,
}

/** Optional header rendered at the top of the Overview body per kind. */
export const kindOverviewHeader: Record<string, ComponentType<{ record: Resource }>> = {
  pipeline: PipelineOverviewHeader,
}
