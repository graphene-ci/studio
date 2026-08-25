// Server-address handling for graphenectl-style contexts. A context's
// server is "" (same-origin), "host:port", or a full http(s) URL.

/** Validates and canonicalizes user input for a context's server field.
 * Returns null when the input cannot be a server address. */
export function normalizeServer(raw: string): string | null {
  const trimmed = raw.trim().replace(/\/+$/, '')
  if (trimmed === '') return ''
  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`
  try {
    const url = new URL(candidate)
    if (url.pathname !== '/' || url.search || url.hash || url.username) return null
    return /^https?:\/\//i.test(trimmed) ? url.origin : url.host
  } catch {
    return null
  }
}

/** Resolves a context's server + insecure flag to a transport baseUrl. */
export function baseUrlFor(server: string, insecure: boolean): string {
  if (server === '') return window.location.origin
  if (/^https?:\/\//i.test(server)) return server
  return `${insecure ? 'http' : 'https'}://${server}`
}
