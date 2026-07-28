import { app, BrowserWindow, Menu, ipcMain, globalShortcut } from 'electron'
import { autoUpdater } from 'electron-updater'
import log from 'electron-log'
import { join } from 'path'
import './fileHandlers'
import { openUpdateDialog } from './update-window/updateWindow'

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

// Une vérification au seul démarrage laissait passer les versions publiées
// pendant qu'une session reste ouverte plusieurs jours.
const UPDATE_CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000

function setupAutoUpdater() {
  log.transports.file.level = 'info'
  autoUpdater.logger = log

  // Sans ça (défaut : true), le téléchargement démarre dès la détection, alors
  // que la fenêtre propose à l'utilisateur de lire les nouveautés puis de
  // décider. Le choix offert doit être réel.
  autoUpdater.autoDownload = false

  // Renvoie les notes de TOUTES les versions entre celle installée et la plus
  // récente : quelqu'un qui a sauté trois versions doit les voir toutes.
  autoUpdater.fullChangelog = true

  autoUpdater.on('update-available', (info) => {
    log.info('Mise à jour disponible :', info.version)
    openUpdateDialog(info)
  })

  autoUpdater.on('update-not-available', () => {
    log.info('Aucune mise à jour disponible')
  })

  autoUpdater.on('error', (err) => {
    log.error('Erreur de mise à jour:', err)
  })

  autoUpdater.checkForUpdates()
  setInterval(() => autoUpdater.checkForUpdates(), UPDATE_CHECK_INTERVAL_MS)
}

// Version installée, pour l'écran « Nouveautés » côté interface.
ipcMain.handle('get-app-version', () => app.getVersion())

// Vérification déclenchée par l'utilisateur : contrairement au contrôle
// automatique, elle doit répondre même quand aucune mise à jour n'existe.
ipcMain.handle('check-for-updates', async () => {
  if (process.env.NODE_ENV === 'development') {
    return { status: 'dev' as const }
  }
  try {
    const result = await autoUpdater.checkForUpdates()
    const version = result?.updateInfo?.version
    if (version && version !== app.getVersion()) {
      return { status: 'available' as const, version }
    }
    return { status: 'up-to-date' as const }
  } catch (err) {
    log.error('Vérification manuelle échouée:', err)
    return { status: 'error' as const, message: err instanceof Error ? err.message : String(err) }
  }
})

app.whenReady().then(() => {
  createWindow()

  if (process.env.NODE_ENV !== 'development') {
    setupAutoUpdater()
  } else {
    globalShortcut.register('CommandOrControl+Shift+U', () => {
      openUpdateDialog()
    })
  }
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})