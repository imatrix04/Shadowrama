import { app, BrowserWindow, Menu, ipcMain, globalShortcut, shell } from 'electron'
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
      // Le renderer tourne dans le bac à sable de Chromium. Les deux preloads
      // n'importent que le module `electron`, seul module accessible dans un
      // preload sandboxé — rien à adapter.
      sandbox: true,
      preload: join(__dirname, 'preload.js'),
    },
  })

  hardenNavigation(win)

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

/**
 * Empêche la fenêtre applicative de devenir un navigateur.
 *
 * Sans ces deux garde-fous, un lien dans un bloc de texte — ou n'importe quel
 * `window.location = …` — remplace l'éditeur par une page distante, qui hérite
 * alors du preload et de son accès au système de fichiers. Une navigation
 * externe part donc dans le navigateur de l'utilisateur, jamais ici.
 */
function hardenNavigation(win: BrowserWindow) {
  const isInternal = (url: string) => {
    if (url.startsWith('file://')) return true
    return process.env.NODE_ENV === 'development' && url.startsWith('http://localhost:5173')
  }

  win.webContents.on('will-navigate', (event, url) => {
    if (isInternal(url)) return
    event.preventDefault()
    void openExternally(url)
  })

  win.webContents.setWindowOpenHandler(({ url }) => {
    void openExternally(url)
    return { action: 'deny' }
  })
}

/** N'ouvre à l'extérieur que ce qui est réellement une page web. */
async function openExternally(url: string) {
  try {
    const { protocol } = new URL(url)
    if (protocol !== 'http:' && protocol !== 'https:') return
    await shell.openExternal(url)
  } catch {
    // URL invalide : il n'y a rien à ouvrir, et surtout rien à faire ici.
  }
}

ipcMain.on('set-fullscreen', (_event, value: boolean) => {
  // La fenêtre peut avoir été fermée entre-temps ; appeler une méthode sur un
  // BrowserWindow détruit lève.
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.setFullScreen(value)
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