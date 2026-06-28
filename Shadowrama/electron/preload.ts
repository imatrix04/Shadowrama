import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  setFullScreen: (value: boolean) => ipcRenderer.send('set-fullscreen', value),
})

contextBridge.exposeInMainWorld('fileAPI', {
  saveProjectAs: (json: string, defaultName: string): Promise<string | null> =>
    ipcRenderer.invoke('save-project-as', json, defaultName),
  saveProject: (filePath: string, json: string): Promise<string> =>
    ipcRenderer.invoke('save-project', filePath, json),
  openProject: (): Promise<{ filePath: string; content: string } | null> =>
    ipcRenderer.invoke('open-project'),
})