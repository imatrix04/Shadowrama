import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  setFullScreen: (value: boolean) => ipcRenderer.send('set-fullscreen', value),
  getAppVersion: (): Promise<string> => ipcRenderer.invoke('get-app-version'),
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),

  // Captures pour l'export PowerPoint (voir electron/main.ts).
  captureRect: (rect: { x: number; y: number; width: number; height: number }): Promise<Uint8Array> =>
    ipcRenderer.invoke('capture-rect', rect),
  captureWebview: (id: number): Promise<Uint8Array> => ipcRenderer.invoke('capture-webview', id),

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
  pickPptxPath: (defaultName: string): Promise<string | null> => ipcRenderer.invoke('pick-pptx-path', defaultName),
  writePptx: (data: Uint8Array): Promise<string> => ipcRenderer.invoke('write-pptx', data),
})