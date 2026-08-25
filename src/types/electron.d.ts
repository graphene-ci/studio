export interface DesktopBridge {
  readonly isDesktop: true
  readonly platform: NodeJS.Platform
}

declare global {
  interface Window {
    readonly desktop?: DesktopBridge
  }
}
