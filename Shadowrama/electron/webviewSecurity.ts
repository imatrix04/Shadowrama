import { session } from 'electron'
import type { BrowserWindow, Event as ElectronEvent } from 'electron'

/**
 * Sécurité des pages web affichées dans les blocs « Page web » (<webview>).
 *
 * Une page de bloc est du contenu distant, souvent écrit par un tiers : elle ne
 * doit avoir accès à rien de ce qui appartient à Shadowrama. Tout le dispositif
 * tient ici, côté processus principal, parce que le renderer n'est pas une
 * frontière de confiance — c'est lui qui décrit la balise, et un projet .shma
 * piégé pourrait la décrire autrement.
 *
 * - session dédiée, persistante : les connexions survivent, mais aucune donnée
 *   de l'application n'y est partagée ;
 * - aucun preload, aucun Node, bac à sable et isolation de contexte imposés ;
 * - seules les adresses http(s) sont chargées (jamais file:, data:, etc.) ;
 * - jamais de fenêtre supplémentaire : un lien « nouvel onglet » s'ouvre dans le
 *   même bloc ;
 * - permissions refusées (caméra, micro, position, notifications…), sauf le
 *   plein écran et l'écriture dans le presse-papiers ;
 * - téléchargements refusés ;
 * - Échap et clics dans la page signalés au renderer, qui ne les reçoit pas
 *   autrement (voir WebviewBlock).
 */

/** Doit rester identique à `WEB_PARTITION` de WebviewBlock.tsx. */
export const WEB_PARTITION = 'persist:shadowrama-web'

const ALLOWED_PERMISSIONS = new Set(['fullscreen', 'clipboard-sanitized-write', 'pointerLock'])
const ALLOWED_AUTOPLAY = new Set(['document-user-activation-required', 'no-user-gesture-required'])

function isWebUrl(url: string): boolean {
  try {
    const { protocol } = new URL(url)
    return protocol === 'http:' || protocol === 'https:'
  } catch {
    return false
  }
}

/** Messages envoyés au renderer (voir `onWebviewEvent` dans le preload). */
type WebviewEvent = { type: 'escape' | 'pointer'; id: number }

let sessionConfigured = false

function configureWebSession() {
  if (sessionConfigured) return
  sessionConfigured = true

  const webSession = session.fromPartition(WEB_PARTITION)
  webSession.setPermissionRequestHandler((_contents, permission, callback) => {
    callback(ALLOWED_PERMISSIONS.has(permission))
  })
  webSession.setPermissionCheckHandler((_contents, permission) => ALLOWED_PERMISSIONS.has(permission))
  webSession.on('will-download', event => event.preventDefault())
}

export function secureWebviews(win: BrowserWindow) {
  configureWebSession()
  const host = win.webContents

  host.on('will-attach-webview', (event, webPreferences, params) => {
    // Une balise qui ne vise pas une page web n'est pas attachée du tout.
    if (!isWebUrl(params.src ?? '')) {
      event.preventDefault()
      return
    }

    // Quoi que demande la balise, les réglages sûrs l'emportent.
    delete webPreferences.preload
    delete (webPreferences as { preloadURL?: string }).preloadURL
    webPreferences.nodeIntegration = false
    webPreferences.nodeIntegrationInSubFrames = false
    webPreferences.contextIsolation = true
    webPreferences.sandbox = true
    webPreferences.webSecurity = true
    webPreferences.allowRunningInsecureContent = false
    if (webPreferences.autoplayPolicy && !ALLOWED_AUTOPLAY.has(webPreferences.autoplayPolicy)) {
      delete webPreferences.autoplayPolicy
    }

    params.partition = WEB_PARTITION
  })

  host.on('did-attach-webview', (_event, guest) => {
    // Un lien « nouvel onglet » ou window.open() : on reste dans le bloc. La
    // balise porte `allowpopups` (sinon Electron bloque avant d'arriver ici), et
    // c'est ce gestionnaire, qui refuse toujours la fenêtre, qui garantit qu'il
    // ne s'en ouvre aucune.
    guest.setWindowOpenHandler(({ url }) => {
      if (isWebUrl(url)) void guest.loadURL(url)
      return { action: 'deny' }
    })

    // Ni file:// ni schéma applicatif, même par redirection depuis un site.
    const refuseNonWeb = (event: ElectronEvent<{ url: string }>) => {
      if (!isWebUrl(event.url)) event.preventDefault()
    }
    guest.on('will-navigate', refuseNonWeb)
    guest.on('will-redirect', refuseNonWeb)

    const notifyHost = (event: WebviewEvent) => {
      if (!host.isDestroyed()) host.send('webview-event', event)
    }

    // Quand la page a le clavier, Échap ne remonte pas à Shadowrama : sans ça on
    // ne pourrait plus quitter la présentation au clavier. On la retient, on rend
    // le focus à la fenêtre, et le renderer décide quoi en faire.
    guest.on('before-input-event', (event, input) => {
      if (input.type !== 'keyDown' || input.key !== 'Escape') return
      event.preventDefault()
      if (!host.isDestroyed()) host.focus()
      notifyHost({ type: 'escape', id: guest.id })
    })

    // Un clic dans la page ne remonte pas au renderer (autre processus), et ne
    // lui donne pas toujours le focus clavier : on le signale pour qu'il le fasse.
    guest.on('input-event', (_event, input) => {
      if (input.type === 'mouseDown') notifyHost({ type: 'pointer', id: guest.id })
    })
  })
}