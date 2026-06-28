import { BrowserWindow, ipcMain } from 'electron'
import { autoUpdater } from 'electron-updater'
import { join } from 'path'

let updateWin: BrowserWindow | null = null

function send(channel: string, data: any) {
  if (updateWin && !updateWin.isDestroyed()) {
    updateWin.webContents.send(channel, data)
  }
}

autoUpdater.on('update-available', (info) => {
  send('update-status', { state: 'available', info })
})

autoUpdater.on('download-progress', (progress) => {
  send('update-status', {
    state: 'downloading',
    percent: Math.round(progress.percent),
    transferred: progress.transferred,
    total: progress.total,
    bytesPerSecond: progress.bytesPerSecond,
  })
})

autoUpdater.on('update-downloaded', () => {
  send('update-status', { state: 'downloaded' })
})

autoUpdater.on('error', (err) => {
  send('update-status', { state: 'error', message: err.message })
})

ipcMain.on('start-download', () => {
  if (process.env.NODE_ENV === 'development') {
    simulateDownload()
  } else {
    autoUpdater.downloadUpdate()
  }
})

ipcMain.on('quit-and-install', () => {
  autoUpdater.quitAndInstall()
})

ipcMain.on('update-dialog:later', () => {
  updateWin?.close()
  updateWin = null
})

export function openUpdateDialog() {
  if (updateWin) return // déjà ouverte

  updateWin = new BrowserWindow({
    width: 400,
    height: 200,
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
    updateWin = null
  })
}

//côté simulation

export function simulateDownload() {
  let percent = 0
  const interval = setInterval(() => {
    percent += Math.random() * 15
    if (percent >= 100) {
      percent = 100
      clearInterval(interval)
      send('update-status', { state: 'downloaded' })
      return
    }
    send('update-status', {
      state: 'downloading',
      percent: Math.round(percent),
      transferred: percent * 1024 * 1024,
      total: 100 * 1024 * 1024,
      bytesPerSecond: 2_500_000 + Math.random() * 1_000_000,
    })
  }, 400)
}