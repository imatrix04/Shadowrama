import { BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'

let updateWin: BrowserWindow | null = null
let resolveChoice: ((choice: 'restart' | 'later') => void) | null = null

ipcMain.on('update-dialog:response', (_event, choice: 'restart' | 'later') => {
  resolveChoice?.(choice)
  resolveChoice = null
  updateWin?.close()
  updateWin = null
})

export function showUpdateDialog(): Promise<'restart' | 'later'> {
  return new Promise((resolve) => {
    resolveChoice = resolve

    updateWin = new BrowserWindow({
      width: 400,
      height: 180,
      frame: false,
      resizable: false,
      alwaysOnTop: true,
      transparent: true,
      backgroundColor: '#00000000',
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: join(__dirname, 'updatePreload.js'),
      },
    })

    updateWin.loadFile(join(__dirname, 'update-window/update-dialog.html'))

    updateWin.on('closed', () => {
      if (resolveChoice) {
        resolveChoice('later')
        resolveChoice = null
      }
      updateWin = null
    })
  })
}