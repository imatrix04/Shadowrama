import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  setFullScreen: (value: boolean) => ipcRenderer.send('set-fullscreen', value),
})

contextBridge.exposeInMainWorld('fileAPI', {
  saveProjectAs: (manifestJson: string, media: { key: string; data: string }[], defaultName: string) =>
    ipcRenderer.invoke('save-project-as', manifestJson, media, defaultName),
  saveProject: (filePath: string, manifestJson: string, media: { key: string; data: string }[]) =>
    ipcRenderer.invoke('save-project', filePath, manifestJson, media),
  openProject: () => ipcRenderer.invoke('open-project'),
})