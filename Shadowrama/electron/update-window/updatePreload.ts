import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('updateDialogAPI', {
  respond: (choice: 'restart' | 'later') =>
    ipcRenderer.send('update-dialog:response', choice),
})