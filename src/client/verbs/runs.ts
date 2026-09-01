// Run verbs — direct typed methods over RunsAPI.

import type { Api } from '@/lib/api'
import type { StartRunResponse } from '@/proto/management/v1/runs_pb'

import { recordKey } from '../keys'
import type { WatchHub } from '../watch/hub'

export interface RunVerbDeps {
  api: () => Api
  hub: WatchHub
}

export interface StartRunOptions {
  /** Explicit run id; when omitted the client mints `<pipeline>-<stamp>`. */
  runId?: string
  /** Managed run: server launches this worker image itself. */
  image?: string
  labels?: Record<string, string>
}

const decoder = new TextDecoder()
const encoder = new TextEncoder()

/** `<pipeline>-YYYYMMDD-HHMMSS`, matching the launch-form convention. */
function mintRunId(pipeline: string): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pipeline}-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(
    now.getHours(),
  )}${pad(now.getMinutes())}${pad(now.getSeconds())}`
}

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

  /** Fires a run of `pipeline` with `params` (JSON bytes, or a JSON
   * string). Returns the raw reply — `workflowId` carries the new
   * run's id. Pokes the run listings so the feed refreshes. */
  async start(
    pipeline: string,
    params: Uint8Array | string,
    opts?: StartRunOptions,
  ): Promise<StartRunResponse> {
    const reply = await this.deps.api().runs.startRun({
      runId: opts?.runId ?? mintRunId(pipeline),
      pipeline,
      params: typeof params === 'string' ? encoder.encode(params) : params,
      image: opts?.image ?? '',
      labels: opts?.labels ?? {},
    })
    this.deps.hub.poke((key) => key.startsWith('list:'))
    return reply
  }

  async cancel(runId: string): Promise<void> {
    await this.deps.api().runs.cancelRun({ runId })
    this.deps.hub.poke((key) => key === recordKey(`run/${runId}`) || key.startsWith('list:'))
  }
}
