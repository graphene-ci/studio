import * as path from 'node:path'

import { app, BrowserWindow, ipcMain, Menu, nativeImage, shell, Tray } from 'electron'

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null

const WINDOW_CONTROL_CHANNELS = {
  minimize: 'window-controls:minimize',
  toggleMaximize: 'window-controls:toggle-maximize',
  close: 'window-controls:close',
  isMaximized: 'window-controls:is-maximized',
  maximizedChanged: 'window-controls:maximized-changed',
} as const

ipcMain.on(WINDOW_CONTROL_CHANNELS.minimize, (event) => {
  BrowserWindow.fromWebContents(event.sender)?.minimize()
})

ipcMain.handle(WINDOW_CONTROL_CHANNELS.toggleMaximize, (event) => {
  const window = BrowserWindow.fromWebContents(event.sender)
  if (window === null) return false
  if (window.isMaximized()) {
    window.unmaximize()
  } else {
    window.maximize()
  }
  return window.isMaximized()
})

ipcMain.on(WINDOW_CONTROL_CHANNELS.close, () => {
  app.quit()
})

ipcMain.handle(WINDOW_CONTROL_CHANNELS.isMaximized, (event) => {
  return BrowserWindow.fromWebContents(event.sender)?.isMaximized() ?? false
})

if (process.platform === 'linux') {
  app.commandLine.appendSwitch('ozone-platform-hint', 'auto')
  // Studio has no video surface. Avoid probing a broken VA-API backend while
  // retaining GPU compositing for the application UI.
  app.commandLine.appendSwitch('disable-accelerated-video-decode')
  app.commandLine.appendSwitch('disable-accelerated-video-encode')
}

function focusMainWindow(): void {
  if (mainWindow === null || mainWindow.isDestroyed()) return
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.show()
  mainWindow.focus()
}

function trayIconPath(): string {
  return app.isPackaged
    ? path.join(app.getAppPath(), 'dist/tray-icon.png')
    : path.join(app.getAppPath(), 'public/tray-icon.png')
}

function createTray(): void {
  const icon = nativeImage.createFromPath(trayIconPath())
  const isRussian = app.getLocale().toLowerCase().startsWith('ru')
  tray = new Tray(icon)
  tray.setToolTip('Graphene Studio')
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: isRussian ? 'Показать' : 'Show', click: focusMainWindow },
      {
        label: isRussian ? 'Выйти' : 'Quit',
        click: () => app.quit(),
      },
    ]),
  )
  tray.on('click', focusMainWindow)
}

function createWindow(): void {
  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 640,
    show: false,
    frame: false,
    icon: trayIconPath(),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  mainWindow = window
  window.setMenu(null)
  window.on('maximize', () => {
    window.webContents.send(WINDOW_CONTROL_CHANNELS.maximizedChanged, true)
  })
  window.on('unmaximize', () => {
    window.webContents.send(WINDOW_CONTROL_CHANNELS.maximizedChanged, false)
  })
  window.once('ready-to-show', () => window.show())
  window.on('closed', () => {
    if (mainWindow === window) mainWindow = null
  })
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://') || url.startsWith('http://')) {
      void shell.openExternal(url)
    }
    return { action: 'deny' }
  })

  if (!app.isPackaged) {
    window.webContents.on('before-input-event', (event, input) => {
      if (input.type === 'keyDown' && input.key === 'F12') {
        window.webContents.toggleDevTools()
        event.preventDefault()
      }
    })
  }

  const devServerUrl = process.env.VITE_DEV_SERVER_URL
  if (devServerUrl) {
    void window.loadURL(devServerUrl)
  } else {
    void window.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

app.whenReady().then(() => {
  createWindow()
  createTray()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    } else {
      focusMainWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
