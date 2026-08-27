// WatchHub — refcounted liveness for everything the UI looks at.
// External stores acquire a target in onMount and release it when the
// last subscriber leaves; the hub keeps exactly one runner per key.
// UI never talks to the hub directly.

/** A running target: a poll loop or a server stream. */
export interface TargetHandle {
  stop(): void
  /** Fast-refresh request (after a mutation). Poll targets burst;
   * stream targets ignore it — the server pushes on its own. */
  poke?(): void
}

export type TargetFactory = () => TargetHandle

interface HubEntry {
  count: number
  handle: TargetHandle
  factory: TargetFactory
  lingerTimer: ReturnType<typeof setTimeout> | null
}

/** How long a released target keeps running so a remount (tab switch,
 * panel toggle) does not drop and recreate the world it just had. */
const LINGER_MS = 5_000

export class WatchHub {
  private readonly entries = new Map<string, HubEntry>()

  acquire(key: string, factory: TargetFactory): void {
    const entry = this.entries.get(key)
    if (entry !== undefined) {
      entry.count += 1
      if (entry.lingerTimer !== null) {
        clearTimeout(entry.lingerTimer)
        entry.lingerTimer = null
      }
      return
    }
    this.entries.set(key, { count: 1, handle: factory(), factory, lingerTimer: null })
  }

  release(key: string): void {
    const entry = this.entries.get(key)
    if (entry === undefined) return
    entry.count -= 1
    if (entry.count > 0) return
    entry.lingerTimer = setTimeout(() => {
      entry.handle.stop()
      this.entries.delete(key)
    }, LINGER_MS)
  }

  /** Pokes every live target whose key matches. */
  poke(matches: (key: string) => boolean): void {
    for (const [key, entry] of this.entries) {
      if (matches(key)) entry.handle.poke?.()
    }
  }

  /** World reset (context/namespace switch): every runner is stopped;
   * targets that still have subscribers restart fresh against the new
   * world, lingering ones are dropped. onMount refcounts are untouched
   * — the UI never notices. */
  restartAll(): void {
    for (const [key, entry] of this.entries) {
      if (entry.lingerTimer !== null) clearTimeout(entry.lingerTimer)
      entry.handle.stop()
      if (entry.count > 0) {
        entry.lingerTimer = null
        entry.handle = entry.factory()
      } else {
        this.entries.delete(key)
      }
    }
  }

  /** Stops everything for good (dispose). */
  stopAll(): void {
    for (const entry of this.entries.values()) {
      if (entry.lingerTimer !== null) clearTimeout(entry.lingerTimer)
      entry.handle.stop()
    }
    this.entries.clear()
  }

  /** True when a runner exists for the key (test/debug aid). */
  has(key: string): boolean {
    return this.entries.has(key)
  }
}

/** graphenectl `-w` semantics: full snapshot fetch on a fixed cadence
 * (2s, same as ctl), diff happens downstream in the stores. A poke
 * bursts 0/1/3s — visibility can lag a mutation. Ticks never overlap;
 * a poke during flight schedules one trailing rerun. */
export function pollTarget(tick: () => Promise<void>, intervalMs = 2_000): TargetHandle {
  let stopped = false
  let inflight = false
  let rerun = false
  let timer: ReturnType<typeof setTimeout> | null = null
  const burstTimers: ReturnType<typeof setTimeout>[] = []

  const schedule = (delay: number) => {
    if (stopped) return
    if (timer !== null) clearTimeout(timer)
    timer = setTimeout(run, delay)
  }

  const run = async () => {
    if (stopped) return
    if (inflight) {
      rerun = true
      return
    }
    inflight = true
    try {
      await tick()
    } catch {
      // The tick owns error reporting into meta stores; the loop
      // itself only keeps breathing.
    } finally {
      inflight = false
    }
    if (rerun) {
      rerun = false
      schedule(0)
    } else {
      schedule(intervalMs)
    }
  }

  void run()

  return {
    stop() {
      stopped = true
      if (timer !== null) clearTimeout(timer)
      for (const t of burstTimers) clearTimeout(t)
    },
    poke() {
      if (stopped) return
      void run()
      for (const delay of [1_000, 3_000]) {
        burstTimers.push(setTimeout(() => void run(), delay))
      }
    },
  }
}

/** Server-stream runner with reconnect: run() is expected to consume
 * the stream until it ends or the signal aborts; a drop reconnects
 * with backoff 0.5s→8s, reset after a healthy minute. */
export function streamTarget(run: (signal: AbortSignal) => Promise<void>): TargetHandle {
  const controller = new AbortController()
  let backoff = 500

  const loop = async () => {
    while (!controller.signal.aborted) {
      const startedAt = Date.now()
      try {
        await run(controller.signal)
      } catch {
        // Reconnect below; stream errors surface through meta stores
        // inside run() itself.
      }
      if (controller.signal.aborted) return
      if (Date.now() - startedAt > 60_000) backoff = 500
      await new Promise((resolve) => setTimeout(resolve, backoff))
      backoff = Math.min(backoff * 2, 8_000)
    }
  }

  void loop()

  return {
    stop() {
      controller.abort()
    },
  }
}
