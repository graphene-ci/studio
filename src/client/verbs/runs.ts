// Run verbs — direct typed methods over RunsAPI.

import type { Api } from '@/lib/api'

import { recordKey } from '../keys'
import type { WatchHub } from '../watch/hub'

export interface RunVerbDeps {
  api: () => Api
  hub: WatchHub
}

const decoder = new TextDecoder()

export class RunVerbs {
  private readonly deps: RunVerbDeps

  constructor(deps: RunVerbDeps) {
    this.deps = deps
  }

  /** The run's typed Result as JSON text; '' — no result (yet). */
  async result(runId: string): Promise<string> {
    const reply = await this.deps.api().runs.runResult({ runId })
    return decoder.decode(reply.result)
  }

  async cancel(runId: string): Promise<void> {
    await this.deps.api().runs.cancelRun({ runId })
    this.deps.hub.poke((key) => key === recordKey(`run/${runId}`) || key.startsWith('list:'))
  }
}
