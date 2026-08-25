// A context is a named server connection — the web mirror of
// graphenectl's ~/.config/graphene/config.yaml entries.
export interface GrapheneContext {
  // Server address: "host:port" or a full http(s) URL; "" = the server
  // this UI is hosted on (same-origin).
  server: string
  // Bearer token; "" = not saved — sign-in asks for it.
  token: string
  // Namespace override; "" = pinned by the token.
  namespace: string
  // Plain HTTP for scheme-less servers.
  insecure: boolean
}

export type ContextMap = Record<string, GrapheneContext>
