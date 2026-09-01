// The generic write door of the dictionary, shaped as a RESOURCE
// HANDLE: `client.resource(ref)` gives typed methods over one record.
// A mutation reply means "accepted"; the poked watch folds the durable
// truth in (no optimistic writes).

import type { Api } from '@/lib/api'

import { recordKey, treeKey } from '../keys'
import type { WatchHub } from '../watch/hub'

export interface ResourceVerbDeps {
  api: () => Api
  hub: WatchHub
}

const encoder = new TextEncoder()

/** Drains a Connect server-stream of byte chunks into ONE Uint8Array,
 * `pick` selecting the bytes field off each chunk. Connect streams are
 * async-iterable, so a plain `for await` consumes them to the end. */
export async function collectChunks<T>(
  stream: AsyncIterable<T>,
  pick: (chunk: T) => Uint8Array,
): Promise<Uint8Array> {
  const parts: Uint8Array[] = []
  let total = 0
  for await (const chunk of stream) {
    const data = pick(chunk)
    parts.push(data)
    total += data.length
  }
  const out = new Uint8Array(total)
  let offset = 0
  for (const part of parts) {
    out.set(part, offset)
    offset += part.length
  }
  return out
}

function pokeAround(hub: WatchHub, ref: string): void {
  hub.poke(
    (key) =>
      key === treeKey() ||
      key.startsWith('tree:') ||
      key.startsWith('list:') ||
      key === recordKey(ref),
  )
}

export class ResourceHandle {
  private readonly deps: ResourceVerbDeps
  readonly ref: string
  readonly kind: string
  readonly id: string

  constructor(deps: ResourceVerbDeps, ref: string) {
    this.deps = deps
    this.ref = ref
    const slash = ref.indexOf('/')
    this.kind = slash === -1 ? '' : ref.slice(0, slash)
    this.id = slash === -1 ? ref : ref.slice(slash + 1)
  }

  /** Invokes a dictionary command; payload is the command's request
   * object (validated server-side against the kind's payloadSchema).
   * Returns the command result as decoded JSON text. */
  async invoke(command: string, payload: unknown = {}): Promise<string> {
    const reply = await this.deps.api().resources.invoke({
      ref: this.ref,
      command,
      payload: encoder.encode(JSON.stringify(payload ?? {})),
    })
    pokeAround(this.deps.hub, this.ref)
    return new TextDecoder().decode(reply.result)
  }

  /** Re-declares the record with a new spec (apply semantics). */
  async apply(spec: unknown, labels: Record<string, string> = {}): Promise<void> {
    await this.deps.api().resources.apply({
      kind: this.kind,
      id: this.id,
      spec: encoder.encode(JSON.stringify(spec ?? {})),
      labels,
    })
    pokeAround(this.deps.hub, this.ref)
  }

  /** Tears the record down with its subtree, deepest first. */
  async delete(): Promise<void> {
    await this.deps.api().resources.delete({ ref: this.ref })
    pokeAround(this.deps.hub, this.ref)
  }

  /** Streams the bytes this record holds (an artifact's blob, or any
   * kind whose state names a blob) and joins the chunks into one
   * Uint8Array. The server 404s a record with no downloadable bytes. */
  async download(): Promise<Uint8Array> {
    const stream = this.deps.api().resources.download({ ref: this.ref })
    return collectChunks(stream, (chunk) => chunk.data)
  }

  /** Transfers ownership; keepSeconds bounds the stay (0 — until an
   * explicit delete). */
  async transfer(newOwner: string, keepSeconds = 0): Promise<void> {
    await this.deps.api().resources.transfer({
      ref: this.ref,
      newOwner,
      keepSeconds: BigInt(keepSeconds),
    })
    pokeAround(this.deps.hub, this.ref)
  }
}
