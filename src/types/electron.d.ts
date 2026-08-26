export interface DesktopBridge {
  readonly isDesktop: true
  readonly platform: NodeJS.Platform
  readonly windowControls: {
    minimize(): void
    toggleMaximize(): Promise<boolean>
    close(): void
    isMaximized(): Promise<boolean>
    onMaximizedChange(listener: (isMaximized: boolean) => void): () => void
  }
}

declare global {
  interface Window {
    readonly desktop?: DesktopBridge
  }
}
