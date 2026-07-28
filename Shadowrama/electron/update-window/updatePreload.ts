import { contextBridge, ipcRenderer } from 'electron'
import type { UpdateStatus } from './updateWindow'

contextBridge.exposeInMainWorld('updateAPI', {
  onStatus: (callback: (data: UpdateStatus) => void) => {
    ipcRenderer.on('update-status', (_event, data) => callback(data))
  },
  // Réclamé au montage : le statut « available » est émis avant que ce script
  // ne soit chargé, donc l'écoute seule ne suffit pas à le recevoir.
  requestStatus: (): Promise<UpdateStatus | null> => ipcRenderer.invoke('update:request-status'),
  startDownload: () => ipcRenderer.send('start-download'),
  installNow: () => ipcRenderer.send('quit-and-install'),
  later: () => ipcRenderer.send('update-dialog:later'),
  skipVersion: (version: string) => ipcRenderer.send('update-dialog:skip', version),
})
