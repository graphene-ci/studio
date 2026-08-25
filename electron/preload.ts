import { contextBridge } from 'electron'

contextBridge.exposeInMainWorld('desktop', {
  isDesktop: true,
  platform: process.platform,
})
