import { useCallback, useEffect, useRef, useState } from 'react'
import type { Slide } from '../types'
import {
  UNSAVED_PROJECT_KEY, deleteConversation, emptyConversation, loadConversation, saveConversation,
  withAvailableMedia,
} from './conversationStore'
import type { SavedConversation } from './conversationStore'
import { runAssistant } from './session'
import { EMPTY_USAGE, addUsage } from './types'
import { generateMediaKey, registerMedia } from '../utils/mediaStore'
import { MAX_VIDEO_BYTES, readVideoSize } from '../utils/video'
import type { Attachment, ChatItem, Provider, Usage, WireMessage } from './types'

export type { ChatItem } from './types'

const MAX_ATTACHMENTS = 20
const MAX_IMAGE_BYTES = 30 * 1024 * 1024
const VIDEO_NAME = /\.(mp4|m4v|webm|ogv|mov|mkv)$/i

function readImageSize(url: string): Promise<{ width: number; height: number } | null> {
  return new Promise(resolve => {
    const img = new Image()
    img.onload = () => resolve(img.naturalWidth && img.naturalHeight ? { width: img.naturalWidth, height: img.naturalHeight } : null)
    img.onerror = () => resolve(null)
    img.src = url
  })
}

/**
 * Conversation relue du stockage. Une demande interrompue par la fermeture de
 * l'application est signalée, comme un arrêt manuel : les modifications déjà
 * faites sur les diapositives, elles, sont restées.
 */
function restore(saved: SavedConversation): SavedConversation {
  if (!saved.interrupted) return saved
  const id = saved.nextItemId + 1
  return {
    ...saved,
    interrupted: false,
    nextItemId: id,
    items: [...saved.items, {
      id, kind: 'error',
      text: "Interrompu : l'éditeur a été quitté pendant la demande. Les modifications déjà faites restent (Ctrl+Z pour les annuler).",
    }],
  }
}

interface Params {
  slides: Slide[]
  currentSlide: number
  selectedIds: number[]
  ultra: boolean
  /** Ouvre une entrée d'historique (voir useEditorHistory). */
  begin: () => void
  /** Remplace l'état sans nouvelle entrée d'historique. */
  patch: (updater: (prev: Slide[]) => Slide[]) => void
  onFocusSlide: (index: number) => void
  /** Identité du projet : chemin du fichier, ou « draft » tant qu'il n'est pas enregistré. */
  projectKey: string
  /** Conversation enregistrée de ce projet, lue au démarrage de l'éditeur. */
  initial: SavedConversation | null
}

/**
 * État de la conversation avec l'assistant.
 *
 * Une demande = UNE entrée d'historique : `begin` est appelé à la première
 * modification (pas avant, pour qu'une simple question ne laisse pas un faux
 * point d'annulation), puis chaque changement passe par `patch`. Un seul Ctrl+Z
 * défait donc tout ce que l'IA a fait pour cette demande.
 *
 * La conversation est rattachée au projet et enregistrée à chaque changement
 * (voir conversationStore) : elle survit à la navigation vers les réglages, à
 * l'accueil et au redémarrage. Quand l'éditeur change de projet (ouverture,
 * nouveau projet), l'appelant le signale avec `switchProject` ; un simple
 * changement de chemin sans signal (premier enregistrement, « Enregistrer
 * sous ») est le MÊME projet : la conversation le suit.
 */
export function useAIAssistant({
  slides, currentSlide, selectedIds, ultra, begin, patch, onFocusSlide, projectKey, initial,
}: Params) {
  const [start] = useState(() => restore(initial ?? emptyConversation()))
  const [items, setItems] = useState<ChatItem[]>(start.items)
  const [running, setRunning] = useState(false)
  // Cumul de la conversation en cours (remis à zéro par « Effacer »).
  const [usage, setUsage] = useState<Usage>(start.usage)
  // Fichiers joints : leur contenu reste dans le magasin de médias de l'éditeur,
  // le modèle n'en reçoit que le numéro, le nom et les dimensions.
  const [attachments, setAttachments] = useState<Attachment[]>(start.attachments)
  const [attachError, setAttachError] = useState<string | null>(null)
  // Texte en cours de frappe : conservé avec la conversation (voir plus bas).
  const [draft, setDraftState] = useState(start.draft)
  const draftRef = useRef(start.draft)
  const setDraft = useCallback((value: string) => {
    draftRef.current = value
    setDraftState(value)
  }, [])
  const attachmentsRef = useRef<Attachment[]>(start.attachments)
  const attachIdRef = useRef(start.nextAttachmentId)
  const historyRef = useRef<WireMessage[]>(start.history)
  const controllerRef = useRef<AbortController | null>(null)
  const idRef = useRef(start.nextItemId)
  // Change à chaque changement de projet : une demande de l'ancien projet encore
  // en vol ne doit plus rien écrire dans la conversation du nouveau.
  const generationRef = useRef(0)

  // L'état courant est lu au moment de l'envoi, pas à celui du rendu.
  const latest = useRef({ slides, currentSlide, selectedIds, ultra })
  useEffect(() => { latest.current = { slides, currentSlide, selectedIds, ultra } })
  useEffect(() => { attachmentsRef.current = attachments }, [attachments])

  // ── Rattachement au projet ──
  const switchRef = useRef(false)
  const [epoch, setEpoch] = useState(0)
  const prevKeyRef = useRef(projectKey)
  // Clé pour laquelle l'état affiché est celui du stockage : tant qu'elle diffère
  // de `projectKey`, on n'enregistre rien (on écraserait la conversation du projet
  // qu'on est en train de charger).
  const hydratedKeyRef = useRef<string | null>(projectKey)

  const switchProject = useCallback(() => {
    switchRef.current = true
    setEpoch(e => e + 1)
  }, [])

  useEffect(() => {
    const previous = prevKeyRef.current
    const switching = switchRef.current
    if (!switching && previous === projectKey) return
    prevKeyRef.current = projectKey
    switchRef.current = false

    if (!switching) {
      // Même projet, nouveau chemin : l'enregistrement ci-dessous écrit sous la
      // nouvelle clé, on retire l'ancienne.
      hydratedKeyRef.current = projectKey
      void deleteConversation(previous)
      return
    }

    // Autre projet : on coupe ce qui tourne et on charge celui de la nouvelle clé.
    // Un projet pas encore enregistré n'a pas d'identité stable : il repart de zéro.
    const generation = ++generationRef.current
    controllerRef.current?.abort()
    controllerRef.current = null
    hydratedKeyRef.current = null
    setRunning(false)
    void (async () => {
      let saved: SavedConversation | null = null
      if (projectKey === UNSAVED_PROJECT_KEY) await deleteConversation(projectKey)
      else saved = await loadConversation(projectKey)
      if (generation !== generationRef.current) return
      const next = restore(withAvailableMedia(saved ?? emptyConversation()))
      historyRef.current = next.history
      idRef.current = next.nextItemId
      attachIdRef.current = next.nextAttachmentId
      attachmentsRef.current = next.attachments
      setDraft(next.draft)
      setItems(next.items)
      setUsage(next.usage)
      setAttachments(next.attachments)
      setAttachError(null)
      hydratedKeyRef.current = projectKey
    })()
  }, [projectKey, epoch])

  // Enregistrement à chaque changement. `running` en fait partie : si l'éditeur
  // est quitté en pleine demande, la dernière écriture porte « interrompu ».
  const snapshotRef = useRef<{ key: string; conversation: SavedConversation } | null>(null)
  useEffect(() => {
    snapshotRef.current = {
      key: projectKey,
      conversation: {
        items, usage, attachments,
        history: historyRef.current,
        nextItemId: idRef.current,
        nextAttachmentId: attachIdRef.current,
        draft: draftRef.current,
        interrupted: running,
      },
    }
    if (hydratedKeyRef.current !== projectKey) return
    // Pas d'écriture à chaque morceau de texte : la dernière, au tour fini, suffit.
    if (items[items.length - 1]?.streaming) return
    void saveConversation(projectKey, snapshotRef.current.conversation)
  }, [projectKey, items, usage, attachments, running])

  // La frappe, elle, est enregistrée avec un léger délai (une écriture par
  // touche serait inutile), et une dernière fois à la sortie de l'éditeur pour
  // ne rien perdre de ce qui a été tapé juste avant de quitter.
  useEffect(() => {
    const timer = setTimeout(() => {
      const snapshot = snapshotRef.current
      if (!snapshot || hydratedKeyRef.current !== snapshot.key) return
      void saveConversation(snapshot.key, { ...snapshot.conversation, draft: draftRef.current })
    }, 400)
    return () => clearTimeout(timer)
  }, [draft])

  useEffect(() => () => {
    const snapshot = snapshotRef.current
    if (!snapshot || hydratedKeyRef.current !== snapshot.key) return
    void saveConversation(snapshot.key, { ...snapshot.conversation, draft: draftRef.current })
  }, [])

  const attach = useCallback(async (files: File[]) => {
    setAttachError(null)
    const problems: string[] = []
    let count = attachmentsRef.current.length
    for (const file of files) {
      const isVideo = file.type.startsWith('video/') || VIDEO_NAME.test(file.name)
      if (!isVideo && !file.type.startsWith('image/')) {
        problems.push(`« ${file.name} » n'est ni une image ni une vidéo.`)
        continue
      }
      if (isVideo ? file.size > MAX_VIDEO_BYTES : file.size > MAX_IMAGE_BYTES) {
        problems.push(`« ${file.name} » est trop lourd.`)
        continue
      }
      if (count >= MAX_ATTACHMENTS) {
        problems.push(`Maximum ${MAX_ATTACHMENTS} fichiers joints.`)
        break
      }
      try {
        const bytes = new Uint8Array(await file.arrayBuffer())
        const key = generateMediaKey(file.name, isVideo ? 'vid' : 'img')
        const url = registerMedia(key, bytes, file.type || (isVideo ? 'video/mp4' : 'image/png'))
        const size = isVideo ? await readVideoSize(url) : await readImageSize(url)
        count++
        const item: Attachment = {
          id: ++attachIdRef.current, name: file.name, key, kind: isVideo ? 'video' : 'image',
          ...(size ?? {}),
        }
        attachmentsRef.current = [...attachmentsRef.current, item]
        setAttachments(attachmentsRef.current)
      } catch {
        problems.push(`Impossible de lire « ${file.name} ».`)
      }
    }
    if (problems.length) setAttachError(problems.join(' '))
  }, [])

  const removeAttachment = useCallback((id: number) => {
    attachmentsRef.current = attachmentsRef.current.filter(a => a.id !== id)
    setAttachments(attachmentsRef.current)
  }, [])

  const push = useCallback((item: Omit<ChatItem, 'id'>) => {
    setItems(prev => [...prev, { ...item, id: ++idRef.current }])
  }, [])

  // Réponse en cours d'écriture : une seule ligne, mise à jour à chaque morceau,
  // puis remplacée par le texte définitif (ou retirée si le tour n'a pas de texte).
  const streamingIdRef = useRef<number | null>(null)
  const showStream = useCallback((text: string) => {
    const id = streamingIdRef.current
    if (id === null) {
      const created = ++idRef.current
      streamingIdRef.current = created
      setItems(prev => [...prev, { id: created, kind: 'assistant', text, streaming: true }])
    } else {
      setItems(prev => prev.map(i => (i.id === id ? { ...i, text } : i)))
    }
  }, [])
  const finishStream = useCallback((finalText: string | null) => {
    const id = streamingIdRef.current
    streamingIdRef.current = null
    if (id === null) return false
    setItems(prev => (finalText
      ? prev.map(i => (i.id === id ? { id, kind: 'assistant' as const, text: finalText } : i))
      : prev.filter(i => i.id !== id)))
    return true
  }, [])

  const send = useCallback(async (text: string, provider: Provider) => {
    const trimmed = text.trim()
    if (!trimmed || controllerRef.current) return

    const generation = generationRef.current
    const current = () => generation === generationRef.current
    const controller = new AbortController()
    controllerRef.current = controller
    setRunning(true)
    push({ kind: 'user', text: trimmed })

    let began = false
    const state = latest.current
    try {
      const result = await runAssistant({
        provider,
        history: historyRef.current,
        userText: trimmed,
        slides: state.slides,
        editor: { currentSlide: state.currentSlide, selectedIds: state.selectedIds, ultra: state.ultra },
        attachments: attachmentsRef.current,
        signal: controller.signal,
        onSlides: next => {
          if (!began) { began = true; begin() }
          patch(() => next)
        },
        onFocusSlide,
        onUsage: u => { if (current()) setUsage(prev => addUsage(prev, u)) },
        onEvent: event => {
          if (!current()) return
          if (event.type === 'stream') {
            showStream(event.text)
          } else if (event.type === 'text') {
            // Le texte définitif prend la place de la ligne écrite en direct.
            if (!finishStream(event.text)) push({ kind: 'assistant', text: event.text })
          } else {
            // Un tour qui n'a que des actions : le texte provisoire n'a plus lieu d'être.
            finishStream(null)
            push({ kind: 'action', text: event.label, isError: event.isError })
          }
        },
      })
      if (!current()) return
      historyRef.current = result.history
      if (result.end === 'stopped') push({ kind: 'error', text: 'Interrompu. Les modifications déjà faites restent (Ctrl+Z pour les annuler).' })
      else if (result.error) push({ kind: 'error', text: result.error })
    } finally {
      // Interrompu en plein texte : on garde ce qui est déjà écrit, sans curseur.
      const id = streamingIdRef.current
      streamingIdRef.current = null
      if (id !== null) {
        setItems(prev => prev.map(i => (i.id === id ? { id, kind: 'assistant' as const, text: i.text } : i)))
      }
      if (controllerRef.current === controller) {
        controllerRef.current = null
        setRunning(false)
      }
    }
  }, [begin, patch, onFocusSlide, push, showStream, finishStream])

  const stop = useCallback(() => controllerRef.current?.abort(), [])

  const clear = useCallback(() => {
    if (controllerRef.current) return
    historyRef.current = []
    setItems([])
    setUsage(EMPTY_USAGE)
    attachmentsRef.current = []
    setAttachments([])
    setAttachError(null)
  }, [])

  // Quitter l'éditeur en pleine demande l'interrompt.
  useEffect(() => () => controllerRef.current?.abort(), [])

  return {
    items, running, usage, attachments, attachError, draft, setDraft,
    attach, removeAttachment, send, stop, clear, switchProject,
  }
}
