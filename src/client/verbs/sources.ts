// Source file verbs — direct typed methods over SourceAPI. A
// gitsource is a READ-ONLY checkout: reads are one-shot (the files
// LISTING is the watched thing), and there is no write path.

import type { Api } from '@/lib/api'

import { collectChunks } from './resources'

export interface SourceVerbDeps {
  api: () => Api
}

const decoder = new TextDecoder()

export class SourceVerbs {
  private readonly deps: SourceVerbDeps

  constructor(deps: SourceVerbDeps) {
    this.deps = deps
  }

  /** Reads one file of a source as text (UTF-8). */
  async readFile(sourceRef: string, path: string): Promise<string> {
    const reply = await this.deps.api().source.readFile({ source: sourceRef, path })
    return decoder.decode(reply.content)
  }

  /** Streams the source's current working tree (a .tgz) and joins the
   * chunks into one Uint8Array. */
  async download(sourceRef: string): Promise<Uint8Array> {
    const stream = this.deps.api().source.downloadSource({ source: sourceRef })
    return collectChunks(stream, (chunk) => chunk.data)
  }
}
