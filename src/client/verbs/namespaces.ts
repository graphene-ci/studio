// Namespace verbs — direct typed methods. Namespaces are records
// (kind "namespace") living in graphene-system; a mutation reply
// means "accepted", the poked watch folds the durable truth in.

import type { Api } from '@/lib/api'

import { namespacesKey, SYSTEM_NAMESPACE } from '../keys'
import type { WatchHub } from '../watch/hub'

export interface NamespaceVerbDeps {
  api: () => Api
  hub: WatchHub
}

/** Namespace declaration — mirrors nsflow.Spec (server truth). */
export interface NamespaceSpec {
  /** Days closed workflows are kept; 0 — installation default.
   * Server refuses negatives (nsflow.Spec.Validate). */
  retentionDays?: number
  description?: string
}

const encoder = new TextEncoder()
const systemScope = { headers: { 'x-graphene-namespace': SYSTEM_NAMESPACE } }

export class NamespaceVerbs {
  private readonly deps: NamespaceVerbDeps

  constructor(deps: NamespaceVerbDeps) {
    this.deps = deps
  }

  /** Declares a namespace (create or update — apply semantics). */
  async create(name: string, spec: NamespaceSpec = {}): Promise<void> {
    await this.deps
      .api()
      .resources.apply(
        { kind: 'namespace', id: name, spec: encoder.encode(JSON.stringify(spec)), labels: {} },
        systemScope,
      )
    this.deps.hub.poke((key) => key === namespacesKey())
  }

  /** Removes the namespace record: service stops, content survives
   * under its own retention. graphene-system and default are refused
   * by the server. */
  async delete(name: string): Promise<void> {
    await this.deps.api().resources.delete({ ref: `namespace/${name}` }, systemScope)
    this.deps.hub.poke((key) => key === namespacesKey())
  }
}
