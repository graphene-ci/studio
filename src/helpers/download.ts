// Saves raw bytes to the user's disk from the renderer. Works the same
// in the Electron renderer and in a plain browser: assemble a Blob,
// mint an object URL, click a transient `<a download>`, then revoke the
// URL. No IPC, no main-process hop, no dependencies.
export function saveBytes(
  filename: string,
  bytes: Uint8Array,
  mime = 'application/octet-stream',
): void {
  // A copy backed by a plain ArrayBuffer: the streamed bytes may be
  // typed over ArrayBufferLike (possibly SharedArrayBuffer), which the
  // Blob constructor's BlobPart does not accept.
  const buffer = new Uint8Array(bytes.byteLength)
  buffer.set(bytes)
  const blob = new Blob([buffer], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
