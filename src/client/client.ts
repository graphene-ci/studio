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
import { WatchHub } from './watch/hub'
import { listingTarget, recordTarget, treeTarget, type TargetDeps } from './watch/targets'

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

  private readonly internal = new InternalStores()
  private readonly hub = new WatchHub()
  private stopWorldWatch: (() => void) | null = null

  constructor(options: ClientOptions) {
    const targetDeps: TargetDeps = { api: options.api, internal: this.internal }

    this.stores = new ExternalStores({
      internal: this.internal,
      hub: this.hub,
      targets: {
        listing: (key, query) => () => listingTarget(targetDeps, key, query),
        record: (key, ref) => () => recordTarget(targetDeps, key, ref),
        tree: (key) => () => treeTarget(targetDeps, key),
      },
    })

    // Context/namespace switch: wipe the world first, then restart
    // the runners still under subscription — they refill the clean
    // snapshots from the new world. The UI never re-subscribes.
    this.stopWorldWatch = options.subscribeWorld(() => {
      this.internal.reset()
      this.hub.restartAll()
    })
  }

  /** Tears the client down (tests / HMR). */
  dispose(): void {
    this.stopWorldWatch?.()
    this.stopWorldWatch = null
    this.hub.stopAll()
    this.internal.reset()
  }
}
