// Agent verbs — the operator's hand on a machine. The PTY is an
// INTERACTIVE session, not world state: no store, no auto-reconnect
// (the session is mortal by nature — it dies with the stream, the
// agent's disconnect, or the shell's exit). The verb returns a
// handle; the terminal surface owns its lifecycle.

import type { Api } from '@/lib/api'

export interface PtyCallbacks {
  onData: (data: Uint8Array) => void
  /** The shell ended (last chunk) — the handle is dead after this. */
  onClosed: (exitCode: number, message: string) => void
  /** Transport failure (not an explicit close). */
  onError: (message: string) => void
}

export interface PtyHandle {
  send(data: string): void
  resize(cols: number, rows: number): void
  /** Buries the shell explicitly and ends the stream. */
  close(): void
}

export interface AgentVerbDeps {
  api: () => Api
}

const encoder = new TextEncoder()

export class AgentVerbs {
  private readonly deps: AgentVerbDeps

  constructor(deps: AgentVerbDeps) {
    this.deps = deps
  }

  /** Opens a shell on the machine (browser half-duplex: an output
   * stream + unary inputs addressed by the announced session id). */
  openPty(
    agentId: string,
    size: { cols: number; rows: number },
    callbacks: PtyCallbacks,
  ): PtyHandle {
    const controller = new AbortController()
    let done = false

    let announce: (id: string) => void = () => {}
    const sessionId = new Promise<string>((resolve) => {
      announce = resolve
    })

    const finish = (fn: () => void) => {
      if (done) return
      done = true
      fn()
    }

    void (async () => {
      try {
        const stream = this.deps
          .api()
          .agents.pty(
            { agent: agentId, cols: size.cols, rows: size.rows },
            { signal: controller.signal },
          )
        for await (const chunk of stream) {
          switch (chunk.body.case) {
            case 'opened':
              announce(chunk.body.value.sessionId)
              break
            case 'data':
              callbacks.onData(chunk.body.value)
              break
            case 'closed':
              finish(() => {
                const closed = chunk.body.case === 'closed' ? chunk.body.value : undefined
                callbacks.onClosed(closed?.exitCode ?? 0, closed?.message ?? '')
              })
              controller.abort()
              return
            default:
              break
          }
        }
        // Stream ended without an explicit Closed — the door went away.
        finish(() => callbacks.onError('stream ended'))
      } catch (err) {
        if (controller.signal.aborted) return
        finish(() => callbacks.onError(err instanceof Error ? err.message : String(err)))
      }
    })()

    const input = (body: Parameters<Api['agents']['ptyInput']>[0]['body']) => {
      void sessionId.then((id) => {
        if (done && body?.case !== 'close') return
        this.deps
          .api()
          .agents.ptyInput({ sessionId: id, body })
          .catch(() => {
            // A failed keystroke is not fatal; a dead session announces
            // itself through the output stream.
          })
      })
    }

    return {
      send(data: string) {
        input({ case: 'data', value: encoder.encode(data) })
      },
      resize(cols: number, rows: number) {
        input({ case: 'resize', value: { cols, rows } })
      },
      close() {
        input({ case: 'close', value: true })
        finish(() => {})
        // Give the close frame a beat to leave before the stream dies.
        setTimeout(() => controller.abort(), 200)
      },
    }
  }
}
