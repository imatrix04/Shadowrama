import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('updateAPI', {
  onStatus: (callback: (data: any) => void) => {
    ipcRenderer.on('update-status', (_event, data) => callback(data))
  },
  startDownload: () => ipcRenderer.send('start-download'),
  installNow: () => ipcRenderer.send('quit-and-install'),
  later: () => ipcRenderer.send('update-dialog:later'),
})