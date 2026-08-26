import { contextBridge, ipcRenderer } from 'electron'

// Sandboxed preload scripts must stay self-contained: Electron's restricted
// preload require cannot load a sibling module before contextBridge runs.
const WINDOW_CONTROL_CHANNELS = {
  minimize: 'window-controls:minimize',
  toggleMaximize: 'window-controls:toggle-maximize',
  close: 'window-controls:close',
  isMaximized: 'window-controls:is-maximized',
  maximizedChanged: 'window-controls:maximized-changed',
} as const

contextBridge.exposeInMainWorld('desktop', {
  isDesktop: true,
  platform: process.platform,
  windowControls: {
    minimize: () => ipcRenderer.send(WINDOW_CONTROL_CHANNELS.minimize),
    toggleMaximize: () => ipcRenderer.invoke(WINDOW_CONTROL_CHANNELS.toggleMaximize),
    close: () => ipcRenderer.send(WINDOW_CONTROL_CHANNELS.close),
    isMaximized: () => ipcRenderer.invoke(WINDOW_CONTROL_CHANNELS.isMaximized),
    onMaximizedChange: (listener: (isMaximized: boolean) => void) => {
      const handleChange = (_event: Electron.IpcRendererEvent, isMaximized: boolean) => {
        listener(isMaximized)
      }
      ipcRenderer.on(WINDOW_CONTROL_CHANNELS.maximizedChanged, handleChange)
      return () => ipcRenderer.removeListener(WINDOW_CONTROL_CHANNELS.maximizedChanged, handleChange)
    },
  },
})
