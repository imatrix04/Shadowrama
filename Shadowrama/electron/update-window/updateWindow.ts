import { app, BrowserWindow, ipcMain } from 'electron'
import { autoUpdater } from 'electron-updater'
import type { UpdateInfo } from 'electron-updater'
import { join } from 'path'
import { readFileSync, writeFileSync } from 'fs'

let updateWin: BrowserWindow | null = null

export interface ReleaseNote {
  version: string
  note: string
}

export type UpdateStatus =
  | { state: 'available'; version: string; notes: ReleaseNote[] }
  | { state: 'downloading'; percent: number; transferred: number; total: number; bytesPerSecond: number }
  | { state: 'downloaded' }
  | { state: 'error'; message: string }

// Dernier statut connu. Le renderer le réclame à son montage : envoyer
// « available » au moment où il survient ne fonctionne pas, car la fenêtre
// n'a pas encore chargé son script et le message est perdu — or c'est lui qui
// transporte le numéro de version et les notes.
let lastStatus: UpdateStatus | null = null

function send(status: UpdateStatus) {
  lastStatus = status
  if (updateWin && !updateWin.isDestroyed()) {
    updateWin.webContents.send('update-status', status)
  }
}

/**
 * `releaseNotes` vaut une chaîne, ou un tableau `{version, note}` quand
 * `fullChangelog` est actif. On normalise pour que l'affichage n'ait qu'une
 * seule forme à traiter.
 */
function normalizeNotes(info: UpdateInfo): ReleaseNote[] {
  const raw = info.releaseNotes
  if (!raw) return []
  if (typeof raw === 'string') return [{ version: info.version, note: raw }]
  return raw
    .filter(entry => !!entry?.note)
    .map(entry => ({ version: entry.version, note: entry.note ?? '' }))
}

// ── Versions ignorées ───────────────────────────────────────────────────────
// Persisté dans le dossier utilisateur : « Plus tard » rouvrait la fenêtre à
// chaque lancement, sans moyen d'écarter durablement une version.

function skipFilePath() {
  return join(app.getPath('userData'), 'skipped-version.json')
}

function readSkippedVersion(): string | null {
  try {
    return JSON.parse(readFileSync(skipFilePath(), 'utf8')).version ?? null
  } catch {
    return null
  }
}

function writeSkippedVersion(version: string | null) {
  try {
    writeFileSync(skipFilePath(), JSON.stringify({ version }), 'utf8')
  } catch {
    // Sans persistance, la fenêtre se contentera de réapparaître : pas bloquant.
  }
}

// ── Événements de l'updater ─────────────────────────────────────────────────

autoUpdater.on('update-available', (info) => {
  send({ state: 'available', version: info.version, notes: normalizeNotes(info) })
})

autoUpdater.on('download-progress', (progress) => {
  send({
    state: 'downloading',
    percent: Math.round(progress.percent),
    transferred: progress.transferred,
    total: progress.total,
    bytesPerSecond: progress.bytesPerSecond,
  })
})

autoUpdater.on('update-downloaded', () => {
  send({ state: 'downloaded' })
})

autoUpdater.on('error', (err) => {
  send({ state: 'error', message: err.message })
})

// ── IPC de la fenêtre ───────────────────────────────────────────────────────

// Poignée de main : le renderer réclame l'état courant dès qu'il est prêt.
ipcMain.handle('update:request-status', () => lastStatus)

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

ipcMain.on('update-dialog:skip', (_e, version: string) => {
  writeSkippedVersion(version)
  updateWin?.close()
  updateWin = null
})

/**
 * En développement (Ctrl+Maj+U) aucun `UpdateInfo` n'existe : on simule une
 * version disponible à partir du changelog local, pour pouvoir travailler la
 * fenêtre sans publier une release.
 */
function simulatedStatus(): UpdateStatus {
  try {
    const path = join(__dirname, '../../changelog.json')
    const { releases } = JSON.parse(readFileSync(path, 'utf8'))
    const latest = releases[0]
    const notes: ReleaseNote[] = releases.slice(0, 2).map((r: { version: string; summary?: string }) => ({
      version: r.version,
      note: r.summary ?? '',
    }))
    return { state: 'available', version: `${latest.version} (simulation)`, notes }
  } catch {
    return { state: 'available', version: '0.0.0 (simulation)', notes: [] }
  }
}

export function openUpdateDialog(info?: UpdateInfo) {
  if (info) {
    if (readSkippedVersion() === info.version) return // version écartée par l'utilisateur
    send({ state: 'available', version: info.version, notes: normalizeNotes(info) })
  } else if (process.env.NODE_ENV === 'development') {
    send(simulatedStatus())
  }
  if (updateWin) {
    updateWin.focus()
    return
  }

  updateWin = new BrowserWindow({
    width: 460,
    height: 520,
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
      send({ state: 'downloaded' })
      return
    }
    send({
      state: 'downloading',
      percent: Math.round(percent),
      transferred: percent * 1024 * 1024,
      total: 100 * 1024 * 1024,
      bytesPerSecond: 2_500_000 + Math.random() * 1_000_000,
    })
  }, 400)
}
