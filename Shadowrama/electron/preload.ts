import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  setFullScreen: (value: boolean) => ipcRenderer.send('set-fullscreen', value),
  getAppVersion: (): Promise<string> => ipcRenderer.invoke('get-app-version'),
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),

  onWebviewEvent: (callback: (event: { type: 'escape' | 'pointer'; id: number }) => void) => {
    const listener = (_e: unknown, event: { type: 'escape' | 'pointer'; id: number }) => callback(event)
    ipcRenderer.on('webview-event', listener)
    return () => { ipcRenderer.removeListener('webview-event', listener) }
  },
})

contextBridge.exposeInMainWorld('fileAPI', {
  saveProjectAs: (manifestJson: string, media: { key: string; data: Uint8Array }[], defaultName: string) =>
    ipcRenderer.invoke('save-project-as', manifestJson, media, defaultName),
  saveProject: (filePath: string, manifestJson: string, media: { key: string; data: Uint8Array }[]) =>
    ipcRenderer.invoke('save-project', filePath, manifestJson, media),
  openProject: () => ipcRenderer.invoke('open-project'),
  openProjectAt: (filePath: string) => ipcRenderer.invoke('open-project-at', filePath),
  openPptx: () => ipcRenderer.invoke('open-pptx'),
})