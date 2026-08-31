// Pipeline verbs: activation (the pipeline's own command) and source
// materialization (the Materialize stream). The stream is a WINDOW,
// not the work: the revision record is built server-side as the
// record's own Init and lands even if this client dies mid-stream.

import type { Api } from '@/lib/api'

import type { InternalStores, MaterializationVM } from '../store/internal'
import type { WatchHub } from '../watch/hub'

export interface PipelineVerbDeps {
  api: () => Api
  hub: WatchHub
  internal: InternalStores
}

const encoder = new TextEncoder()
const LOG_CAP = 500

export class PipelineVerbs {
  private readonly deps: PipelineVerbDeps

  constructor(deps: PipelineVerbDeps) {
    this.deps = deps
  }

  /** Makes one revision the version automatic starts use (rollback =
   * activating an older one). The pipeline record's own command. */
  async activate(pipelineId: string, revisionId: string): Promise<void> {
    await this.deps.api().resources.invoke({
      ref: `pipeline/${pipelineId}`,
      command: 'activate',
      payload: encoder.encode(JSON.stringify({ revisionId })),
    })
    this.deps.hub.poke(
      (key) => key === 'tree' || key.startsWith('list:') || key === `record:pipeline/${pipelineId}`,
    )
  }

  /** Draft run: executes ONE revision (active or not) with ITS image
   * and manifest — validation against that revision, the pipeline's
   * automatic behavior untouched. */
  async draftRun(input: {
    pipelineId: string
    revisionId: string
    runId: string
    params: unknown
  }): Promise<void> {
    await this.deps.api().revisions.runRevision({
      pipelineId: input.pipelineId,
      revisionId: input.revisionId,
      runId: input.runId,
      params: encoder.encode(JSON.stringify(input.params ?? {})),
      labels: {},
    })
    this.deps.hub.poke((key) => key === 'tree' || key.startsWith('list:') || key.startsWith('tree:'))
  }

  /** Builds a revision from a server-side source tree, streaming
   * stages and build-log lines into the materializations store. One
   * build per source at a time (the UI disables the button). */
  materialize(pipelineId: string, sourceRef: string): void {
    const store = this.deps.internal.meta.materializations
    const current = store.get()[sourceRef]
    if (current?.running === true) return

    const patch = (vm: Partial<MaterializationVM>) => {
      const prev = store.get()[sourceRef] ?? {
        running: false,
        stage: '',
        log: [],
        error: null,
        revisionId: null,
      }
      store.setKey(sourceRef, { ...prev, ...vm })
    }

    patch({ running: true, stage: 'upload', log: [], error: null, revisionId: null })

    void (async () => {
      try {
        const stream = this.deps.api().revisions.materialize({
          pipelineId,
          sourceRef,
          source: new Uint8Array(),
        })
        for await (const event of stream) {
          const prev = store.get()[sourceRef]
          const log =
            event.message === ''
              ? (prev?.log ?? [])
              : [...(prev?.log ?? []), `${event.stage}  ${event.message}`].slice(-LOG_CAP)
          patch({ stage: event.stage, log })
          if (event.result !== undefined && event.result.revisionId !== '') {
            patch({ revisionId: event.result.revisionId })
          }
        }
        patch({ running: false })
      } catch (err) {
        patch({ running: false, error: err instanceof Error ? err.message : String(err) })
      }
      // The revision record (and the pipeline's children) changed.
      this.deps.hub.poke((key) => key === 'tree' || key.startsWith('list:'))
    })()
  }
}
