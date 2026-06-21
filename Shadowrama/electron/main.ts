import { app, BrowserWindow, dialog } from 'electron'
import { autoUpdater } from 'electron-updater'
import log from 'electron-log'
import { join } from 'path'

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  if (process.env.NODE_ENV === 'development') {
    win.loadURL('http://localhost:5173')
  } else {
    win.loadFile(join(__dirname, '../dist/index.html'))
  }

  return win
}

function setupAutoUpdater() {
  log.transports.file.level = 'info'
  autoUpdater.logger = log
  autoUpdater.checkForUpdatesAndNotify()

  autoUpdater.on('update-available', () => {
    console.log('Mise à jour disponible, téléchargement en cours...')
  })

  autoUpdater.on('update-downloaded', () => {
    dialog.showMessageBox({
      type: 'info',
      title: 'Mise à jour disponible',
      message: 'Une nouvelle version de Shadowrama a été téléchargée.',
      detail: "L'application va redémarrer pour appliquer la mise à jour.",
      buttons: ['Redémarrer maintenant', 'Plus tard'],
    }).then(({ response }) => {
      if (response === 0) {
        autoUpdater.quitAndInstall()
      }
    })
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