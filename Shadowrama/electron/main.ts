import { app, BrowserWindow, Menu, ipcMain } from 'electron'
import { autoUpdater } from 'electron-updater'
import log from 'electron-log'
import { join } from 'path'
import { showUpdateDialog } from './update-window/updateWindow'

let mainWindow: BrowserWindow | null = null

function createWindow() {

  if (process.env.NODE_ENV !== 'development') {
    Menu.setApplicationMenu(null)
  }

  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: join(__dirname, 'preload.js'),
    },
  })

  win.maximize()
  win.show()

  if (process.env.NODE_ENV === 'development') {
    win.loadURL('http://localhost:5173')
  } else {
    win.loadFile(join(__dirname, '../dist/index.html'))
  }

  mainWindow = win
  return win
}

ipcMain.on('set-fullscreen', (_event, value: boolean) => {
  mainWindow?.setFullScreen(value)
})

function setupAutoUpdater() {
  log.transports.file.level = 'info'
  autoUpdater.logger = log
  autoUpdater.checkForUpdatesAndNotify()

  autoUpdater.on('update-available', () => {
    console.log('Mise à jour disponible, téléchargement en cours...')
  })

  autoUpdater.on('update-downloaded', async () => {
  const choice = await showUpdateDialog()
  if (choice === 'restart') {
    autoUpdater.quitAndInstall()
  }
})

  autoUpdater.on('error', (err) => {
    console.error('Erreur de mise à jour:', err)
  })
}

app.whenReady().then(() => {
  createWindow()
  if (process.env.NODE_ENV !== 'development') {
    setupAutoUpdater()
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})