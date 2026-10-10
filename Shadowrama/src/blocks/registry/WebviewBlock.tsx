import { useCallback, useEffect, useRef, useState } from 'react'
import type { BlockComponentProps, WebviewBlockData } from '../../types'
import { normalizeWebUrl, webUrlHost } from '../../utils/webUrl'
import Icon from '../../components/ui/Icon'
import styles from './WebviewBlock.module.css'

/**
 * Doit rester identique à `WEB_PARTITION` (electron/webviewSecurity.ts), qui
 * l'impose de toute façon : une session persistante, séparée de celle de
 * l'application, pour que les connexions aux sites survivent d'une séance à
 * l'autre sans jamais toucher aux données de Shadowrama.
 */
const WEB_PARTITION = 'persist:shadowrama-web'

/** Ce que Shadowrama utilise de la balise `<webview>` d'Electron. */
interface WebviewElement extends HTMLElement {
  loadURL(url: string): Promise<void>
  goBack(): void
  goForward(): void
  reload(): void
  canGoBack(): boolean
  canGoForward(): boolean
  getURL(): string
  getWebContentsId(): number
}

interface NavState {
  url: string
  canBack: boolean
  canForward: boolean
  loading: boolean
  /** Description lisible de l'échec de chargement de la page principale. */
  error: string | null
}

const ERROR_LABELS: Record<string, string> = {
  ERR_CONNECTION_REFUSED: "Le serveur refuse la connexion. S'il est local, est-il bien démarré ?",
  ERR_NAME_NOT_RESOLVED: "Ce nom de site est introuvable. Vérifiez l'adresse.",
  ERR_INTERNET_DISCONNECTED: 'Aucune connexion à Internet.',
  ERR_CONNECTION_TIMED_OUT: 'Le serveur met trop de temps à répondre.',
  ERR_CERT_AUTHORITY_INVALID: 'Le certificat de ce site n’est pas reconnu.',
  ERR_CERT_COMMON_NAME_INVALID: 'Le certificat de ce site ne correspond pas à son adresse.',
  ERR_BLOCKED_BY_RESPONSE: 'Ce site refuse d’être affiché ici.',
}

function describeError(code: string): string {
  return ERROR_LABELS[code] ?? `La page n’a pas pu être chargée (${code || 'erreur inconnue'}).`
}

export default function WebviewBlock({
  block, onUpdate, mode, onStartEdit, onStopEdit,
}: BlockComponentProps<WebviewBlockData>) {
  const startUrl = normalizeWebUrl(block.url)
  // `<webview>` n'existe que dans Electron : ni dans un navigateur (npm run dev
  // ouvert à part) ni dans les tests.
  const supported = typeof window !== 'undefined' && !!window.electronAPI

  if (!mode || !supported) {
    return <Inert block={block} startUrl={startUrl} unsupported={!!mode && !supported} />
  }
  return (
    <LiveWebview
      block={block}
      startUrl={startUrl}
      mode={mode}
      onUpdate={onUpdate}
      onStartEdit={onStartEdit}
      onStopEdit={onStopEdit}
    />
  )
}

/**
 * Rendu sans page vivante : vignettes du panneau diapos, couche sortante d'une
 * transition. Charger la page ici la ferait vivre deux fois (deux vidéos, deux
 * sons) pour une image qu'on ne regarde pas.
 */
function Inert({ block, startUrl, unsupported }: {
  block: WebviewBlockData
  startUrl: string | null
  unsupported: boolean
}) {
  return (
    <div className={styles.inert} style={{ borderRadius: block.borderRadius ?? 0 }}>
      <Icon name="globe" size={28} />
      <span className={styles.inertHost}>{startUrl ? webUrlHost(startUrl) : 'Page web'}</span>
      {unsupported && (
        <span className={styles.inertNote}>Affichée dans l’application de bureau</span>
      )}
    </div>
  )
}

interface LiveProps {
  block: WebviewBlockData
  startUrl: string | null
  mode: 'edit' | 'present'
  onUpdate: BlockComponentProps<WebviewBlockData>['onUpdate']
  onStartEdit: BlockComponentProps<WebviewBlockData>['onStartEdit']
  onStopEdit: BlockComponentProps<WebviewBlockData>['onStopEdit']
}

function LiveWebview({ block, startUrl, mode, onUpdate, onStartEdit, onStopEdit }: LiveProps) {
  const editing = mode === 'edit'
  const hasUrl = startUrl !== null

  const rootRef = useRef<HTMLDivElement>(null)
  const hostRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<WebviewElement | null>(null)
  // `loadURL` n'est utilisable qu'après `dom-ready`.
  const readyRef = useRef(false)
  // Dernière page demandée par Shadowrama (et non celle où l'on a navigué).
  const requestedRef = useRef<string | null>(startUrl)
  const startRef = useRef(startUrl)
  // Vrai quand la page a (à notre connaissance) le focus clavier.
  const ownsKeyboardRef = useRef(false)

  const [nav, setNav] = useState<NavState>({
    url: startUrl ?? '', canBack: false, canForward: false, loading: hasUrl, error: null,
  })
  // En présentation la page répond tout de suite ; dans l'éditeur, un clic
  // sert d'abord à sélectionner et déplacer le bloc (voir `shield`).
  const [interactive, setInteractive] = useState(!editing)
  // `null` = la barre affiche l'adresse courante ; sinon, la saisie en cours.
  const [draft, setDraft] = useState<string | null>(null)
  const [invalid, setInvalid] = useState(false)

  const syncNav = useCallback((url?: string) => {
    const view = viewRef.current
    if (!view || !readyRef.current) return
    try {
      setNav(n => ({
        ...n,
        url: url ?? view.getURL() ?? n.url,
        canBack: view.canGoBack(),
        canForward: view.canGoForward(),
      }))
    } catch {
      // La page vient d'être détruite : rien à synchroniser.
    }
  }, [])

  // Lue par l'effet de création, qui ne doit pas se rejouer à chaque changement
  // d'adresse (voir l'effet « page de départ » plus bas). Déclaré avant lui.
  useEffect(() => { startRef.current = startUrl }, [startUrl])

  // ── Création de la balise ────────────────────────────────────────────────
  // Elle est construite à la main plutôt qu'en JSX : `partition` doit être posé
  // AVANT `src`, sans quoi la page se charge dans la session par défaut.
  useEffect(() => {
    const host = hostRef.current
    if (!host || !hasUrl) return

    const view = document.createElement('webview') as WebviewElement
    view.setAttribute('partition', WEB_PARTITION)
    // Sans cet attribut Electron bloque les « nouveaux onglets » avant même de
    // consulter le processus principal. Aucune fenêtre ne s'ouvrira pour autant :
    // il refuse toujours le popup et charge l'adresse dans ce bloc (voir
    // electron/webviewSecurity.ts).
    view.setAttribute('allowpopups', 'true')
    // Une présentation doit pouvoir lancer une vidéo sans clic ; dans l'éditeur,
    // un son qui démarre à chaque affichage de la diapo serait pénible.
    if (mode === 'present') view.setAttribute('webpreferences', 'autoplayPolicy=no-user-gesture-required')
    view.style.cssText = 'display:flex;width:100%;height:100%;border:0;background:#fff'

    requestedRef.current = startRef.current
    view.setAttribute('src', startRef.current ?? '')
    readyRef.current = false

    const listeners: [string, (e: Event) => void][] = [
      ['dom-ready', () => { readyRef.current = true; syncNav() }],
      ['did-start-loading', () => setNav(n => ({ ...n, loading: true, error: null }))],
      ['did-stop-loading', () => { setNav(n => ({ ...n, loading: false })); syncNav() }],
      ['did-navigate', e => syncNav((e as Event & { url: string }).url)],
      ['did-navigate-in-page', e => {
        const ev = e as Event & { url: string; isMainFrame: boolean }
        if (ev.isMainFrame) syncNav(ev.url)
      }],
      ['did-fail-load', e => {
        const ev = e as Event & { errorCode: number; errorDescription: string; isMainFrame: boolean }
        // -3 : navigation interrompue par une autre (clic rapide), pas une panne.
        if (!ev.isMainFrame || ev.errorCode === -3) return
        setNav(n => ({ ...n, loading: false, error: describeError(ev.errorDescription) }))
      }],
    ]
    for (const [name, fn] of listeners) view.addEventListener(name, fn)

    host.appendChild(view)
    viewRef.current = view

    return () => {
      for (const [name, fn] of listeners) view.removeEventListener(name, fn)
      readyRef.current = false
      viewRef.current = null
      view.remove()
    }
  }, [hasUrl, mode, syncNav])

  const load = useCallback((target: string) => {
    requestedRef.current = target
    const view = viewRef.current
    if (!view) return
    setNav(n => ({ ...n, error: null }))
    if (readyRef.current) view.loadURL(target).catch(() => { /* navigation interrompue */ })
    else view.setAttribute('src', target)
  }, [])

  // La page de départ a changé (barre d'adresse, menu contextuel, annuler).
  useEffect(() => {
    if (startUrl && startUrl !== requestedRef.current) load(startUrl)
  }, [startUrl, load])

  // ── Clavier ──────────────────────────────────────────────────────────────
  // Rend le clavier à Shadowrama : flèches et Échap agissent de nouveau sur les
  // diapositives, un second Échap ferme la présentation.
  const releaseKeyboard = useCallback(() => {
    ownsKeyboardRef.current = false
    viewRef.current?.blur()
    if (editing) setInteractive(false)
  }, [editing])

  // ── Interaction dans l'éditeur ───────────────────────────────────────────
  // Un clic dans la page ne remonte jamais jusqu'ici (autre processus) : seule
  // la sortie « par l'extérieur » est à surveiller.
  useEffect(() => {
    if (!editing || !interactive) return
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) releaseKeyboard()
    }
    window.addEventListener('mousedown', onDown, true)
    return () => window.removeEventListener('mousedown', onDown, true)
  }, [editing, interactive, releaseKeyboard])

  // Événements que le renderer ne reçoit pas de la page (autre processus).
  useEffect(() => {
    return window.electronAPI?.onWebviewEvent?.(event => {
      const view = viewRef.current
      if (!view || !readyRef.current) return
      try {
        if (view.getWebContentsId() !== event.id) return
      } catch {
        return
      }

      if (event.type === 'escape') {
        releaseKeyboard()
        return
      }

      // Clic dans la page : l'élément a le focus DOM, mais selon la plateforme
      // la page n'a pas toujours le focus clavier, et les touches partiraient vers
      // Shadowrama. Un cycle blur/focus le lui donne, sans toucher au champ actif
      // de la page. Une seule fois par prise de clavier : la page verrait sinon
      // passer un « blur » à chaque clic.
      if (!ownsKeyboardRef.current || document.activeElement !== view) {
        view.blur()
        view.focus()
        ownsKeyboardRef.current = true
      }
    })
  }, [releaseKeyboard])

  // Quand la page a le focus, Electron peut renvoyer à Shadowrama les touches
  // qu'elle n'a pas traitées (flèches, Suppr…) : laissées passer, elles
  // changeraient de diapo ou supprimeraient le bloc sélectionné. On les retient.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const view = viewRef.current
      if (!view || document.activeElement !== view) return
      e.stopImmediatePropagation()
      if (e.key === 'Escape') releaseKeyboard()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [releaseKeyboard])

  const startInteracting = () => {
    setInteractive(true)
    ownsKeyboardRef.current = true
    viewRef.current?.focus()
  }

  // ── Barre d'adresse ──────────────────────────────────────────────────────
  const submit = (input: HTMLInputElement) => {
    const target = normalizeWebUrl(draft ?? '')
    if (!target) {
      setInvalid(true)
      return
    }
    setInvalid(false)
    setDraft(null)
    // Dans l'éditeur l'adresse saisie devient la page de départ du bloc (et se
    // charge via l'effet ci-dessus) ; en présentation, elle ne vaut que pour
    // la séance : rien n'est écrit dans le projet.
    if (editing && target !== startUrl) onUpdate?.(block.id, { url: target })
    else load(target)
    input.blur()
  }

  const canPin = editing && hasUrl && !!normalizeWebUrl(nav.url) && nav.url !== startUrl
  const pinCurrentPage = () => {
    const target = normalizeWebUrl(nav.url)
    if (!target) return
    onStartEdit?.()
    onUpdate?.(block.id, { url: target })
    onStopEdit?.()
  }

  const showBar = block.showToolbar !== false || (editing && !hasUrl)
  const shielded = editing && !interactive

  return (
    <div
      ref={rootRef}
      className={styles.root}
      style={{ borderRadius: block.borderRadius ?? 0 }}
      // En présentation, un clic dans le bloc ne doit pas changer de diapo.
      onClick={mode === 'present' ? e => e.stopPropagation() : undefined}
    >
      {showBar && (
        <div
          className={styles.toolbar}
          // Dans l'éditeur, le bloc se déplace à la souris : la barre doit
          // rester un endroit où l'on peut cliquer et sélectionner du texte.
          onMouseDown={e => e.stopPropagation()}
        >
          <button
            className={styles.navBtn}
            onClick={() => viewRef.current?.goBack()}
            disabled={!nav.canBack}
            title="Page précédente"
            aria-label="Page précédente"
          >
            <Icon name="chevronLeft" size={14} />
          </button>
          <button
            className={styles.navBtn}
            onClick={() => viewRef.current?.goForward()}
            disabled={!nav.canForward}
            title="Page suivante"
            aria-label="Page suivante"
          >
            <Icon name="chevronRight" size={14} />
          </button>
          <button
            className={styles.navBtn}
            onClick={() => (nav.error && requestedRef.current ? load(requestedRef.current) : viewRef.current?.reload())}
            disabled={!hasUrl}
            title="Recharger"
            aria-label="Recharger"
          >
            <Icon name="reload" size={14} />
          </button>
          <input
            className={`${styles.address} ${invalid ? styles.addressInvalid : ''}`}
            value={draft ?? nav.url}
            placeholder="Adresse du site (ex : localhost:3000, youtube.com)"
            spellCheck={false}
            onFocus={e => {
              onStartEdit?.()
              setDraft(d => d ?? nav.url)
              e.currentTarget.select()
            }}
            onBlur={() => {
              setDraft(null)
              setInvalid(false)
              onStopEdit?.()
            }}
            onChange={e => { setDraft(e.target.value); setInvalid(false) }}
            onKeyDown={e => {
              e.stopPropagation()
              if (e.key === 'Enter') submit(e.currentTarget)
              if (e.key === 'Escape') e.currentTarget.blur()
            }}
          />
          {canPin && (
            <button
              className={styles.navBtn}
              onClick={pinCurrentPage}
              title="Utiliser cette page comme page de départ"
              aria-label="Utiliser cette page comme page de départ"
            >
              <Icon name="pin" size={14} />
            </button>
          )}
          {editing && interactive && (
            <button className={styles.doneBtn} onClick={releaseKeyboard}>
              Terminé
            </button>
          )}
          {nav.loading && <span className={styles.progress} />}
        </div>
      )}

      <div className={styles.stage}>
        <div ref={hostRef} className={styles.host} />

        {!hasUrl && (
          <div className={styles.empty}>
            <Icon name="globe" size={30} />
            <span>
              {editing
                ? 'Saisissez une adresse dans la barre ci-dessus, puis Entrée'
                : 'Aucune page définie'}
            </span>
          </div>
        )}

        {hasUrl && nav.error && (
          <div className={styles.error}>
            <strong>Impossible d’afficher la page</strong>
            <span>{nav.error}</span>
            <button
              className={styles.retryBtn}
              onClick={() => requestedRef.current && load(requestedRef.current)}
            >
              Réessayer
            </button>
          </div>
        )}

        {/* Tant que la page est « à plat », un double-clic l'active ; le reste
            des clics traverse jusqu'au bloc (sélection, déplacement). */}
        {shielded && hasUrl && (
          <div className={styles.shield} onDoubleClick={startInteracting}>
            <span className={styles.hint}>Double-clic pour utiliser la page</span>
          </div>
        )}
      </div>
    </div>
  )
}