// GrapheneClient — the headless apex. Read side only for now: the UI
// subscribes to `client.stores.*` (pure nanostores, watch included).
// The write side (direct typed methods; dynamic dictionary commands
// via a future resource handle: handle.invoke(command, data) /
// handle.commands()) is designed later, with the resource surfaces.
// Everything else is internal: transport, watch hub, poll/stream
// targets, world reset on context switch. No React, no DOM, no i18n.

import type { Api } from '@/lib/api'

import { ExternalStores } from './external'
import { InternalStores } from './store/internal'
import { AgentVerbs } from './verbs/agents'
import { NamespaceVerbs } from './verbs/namespaces'
import { ResourceHandle, type ResourceVerbDeps } from './verbs/resources'
import { RunVerbs } from './verbs/runs'
import { PipelineVerbs } from './verbs/pipelines'
import { SourceVerbs } from './verbs/sources'
import { WatchHub } from './watch/hub'
import {
  eventsTarget,
  logsTarget,
  metricsTarget,
  traceTarget,
} from './watch/observe'
import {
  filesTarget,
  serverTarget,
  listingTarget,
  namespacesTarget,
  recordTarget,
  treeTarget,
  type TargetDeps,
} from './watch/targets'

export interface ClientOptions {
  /** Current context's client set; read per call, so token/namespace
   * changes need no rebuild. */
  api: () => Api
  /** Identity of the world: changes when server/namespace change.
   * subscribeWorld calls onSwitch on every change of that identity. */
  subscribeWorld: (onSwitch: () => void) => () => void
}

export class GrapheneClient {
  readonly stores: ExternalStores
  readonly namespaces: NamespaceVerbs
  readonly agents: AgentVerbs
  readonly sources: SourceVerbs
  readonly runs: RunVerbs
  readonly pipelines: PipelineVerbs

  private readonly internal = new InternalStores()
  private readonly hub = new WatchHub()
  private resourceDeps!: ResourceVerbDeps
  private stopWorldWatch: (() => void) | null = null

  constructor(options: ClientOptions) {
    const targetDeps: TargetDeps = { api: options.api, internal: this.internal }

    this.stores = new ExternalStores({
      internal: this.internal,
      hub: this.hub,
      targets: {
        listing: (key, query) => () => listingTarget(targetDeps, key, query),
        record: (key, ref) => () => recordTarget(targetDeps, key, ref),
        tree: (key, owner) => () => treeTarget(targetDeps, key, owner),
        namespaces: (key) => () => namespacesTarget(targetDeps, key),
        files: (key, sourceRef) => () => filesTarget(targetDeps, key, sourceRef),
        server: (key) => () => serverTarget(targetDeps, key),
        events: (key, ref) => () => eventsTarget(targetDeps, key, ref),
        logs: (key, ref) => () => logsTarget(targetDeps, key, ref),
        metrics: (key, ref) => () => metricsTarget(targetDeps, key, ref),
        traces: (key, ref) => () => traceTarget(targetDeps, key, ref),
      },
    })

    this.namespaces = new NamespaceVerbs({ api: options.api, hub: this.hub })
    this.agents = new AgentVerbs({ api: options.api })
    this.sources = new SourceVerbs({ api: options.api })
    this.pipelines = new PipelineVerbs({ api: options.api, hub: this.hub, internal: this.internal })

    this.runs = new RunVerbs({ api: options.api, hub: this.hub })
    this.resourceDeps = { api: options.api, hub: this.hub }

    // Context/namespace switch: wipe the world first, then restart
    // the runners still under subscription — they refill the clean
    // snapshots from the new world. The UI never re-subscribes.
    this.stopWorldWatch = options.subscribeWorld(() => {
      this.internal.reset()
      this.hub.restartAll()
    })
  }

  /** Typed write handle over one record: invoke dictionary commands,
   * apply a new spec, delete, transfer. */
  resource(ref: string): ResourceHandle {
    return new ResourceHandle(this.resourceDeps, ref)
  }

  /** Tears the client down (tests / HMR). */
  dispose(): void {
    this.stopWorldWatch?.()
    this.stopWorldWatch = null
    this.hub.stopAll()
    this.internal.reset()
  }
}
