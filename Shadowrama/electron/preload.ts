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
// Assistant IA (voir electron/ai.ts). La clé API n'est jamais exposée ici :
// l'interface peut l'envoyer pour l'enregistrer, jamais la relire.
contextBridge.exposeInMainWorld('aiAPI', {
  getSettings: () => ipcRenderer.invoke('ai:get-settings'),
  saveSettings: (patch: { provider?: string; model?: string; consent?: boolean; effort?: string; webSearch?: boolean }) =>
    ipcRenderer.invoke('ai:save-settings', patch),
  setKey: (provider: string, key: string) => ipcRenderer.invoke('ai:set-key', provider, key),
  clearKey: (provider: string) => ipcRenderer.invoke('ai:clear-key', provider),
  turn: (request: unknown) => ipcRenderer.invoke('ai:turn', request),
  abort: (requestId: string) => ipcRenderer.send('ai:abort', requestId),
  // Réponse en direct : renvoie la fonction qui arrête l'écoute.
  onDelta: (callback: (delta: unknown) => void) => {
    const listener = (_event: unknown, delta: unknown) => callback(delta)
    ipcRenderer.on('ai:delta', listener)
    return () => { ipcRenderer.removeListener('ai:delta', listener) }
  },
})
