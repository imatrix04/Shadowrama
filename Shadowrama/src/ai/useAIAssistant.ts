import { useCallback, useEffect, useRef, useState } from 'react'
import type { Slide } from '../types'
import { runAssistant } from './session'
import { EMPTY_USAGE, addUsage } from './types'
import { generateMediaKey, registerMedia } from '../utils/mediaStore'
import { MAX_VIDEO_BYTES, readVideoSize } from '../utils/video'
import type { Attachment, Provider, Usage, WireMessage } from './types'

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

export interface ChatItem {
  id: number
  kind: 'user' | 'assistant' | 'action' | 'error'
  text: string
  isError?: boolean
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
}

/**
 * État de la conversation avec l'assistant.
 *
 * Une demande = UNE entrée d'historique : `begin` est appelé à la première
 * modification (pas avant, pour qu'une simple question ne laisse pas un faux
 * point d'annulation), puis chaque changement passe par `patch`. Un seul Ctrl+Z
 * défait donc tout ce que l'IA a fait pour cette demande.
 */
export function useAIAssistant({ slides, currentSlide, selectedIds, ultra, begin, patch, onFocusSlide }: Params) {
  const [items, setItems] = useState<ChatItem[]>([])
  const [running, setRunning] = useState(false)
  // Cumul de la conversation en cours (remis à zéro par « Effacer »).
  const [usage, setUsage] = useState<Usage>(EMPTY_USAGE)
  // Fichiers joints : leur contenu reste dans le magasin de médias de l'éditeur,
  // le modèle n'en reçoit que le numéro, le nom et les dimensions.
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [attachError, setAttachError] = useState<string | null>(null)
  const attachmentsRef = useRef<Attachment[]>([])
  const attachIdRef = useRef(0)
  const historyRef = useRef<WireMessage[]>([])
  const controllerRef = useRef<AbortController | null>(null)
  const idRef = useRef(0)

  // L'état courant est lu au moment de l'envoi, pas à celui du rendu.
  const latest = useRef({ slides, currentSlide, selectedIds, ultra })
  useEffect(() => { latest.current = { slides, currentSlide, selectedIds, ultra } })
  useEffect(() => { attachmentsRef.current = attachments }, [attachments])

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

  const send = useCallback(async (text: string, provider: Provider) => {
    const trimmed = text.trim()
    if (!trimmed || controllerRef.current) return

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
        onUsage: u => setUsage(prev => addUsage(prev, u)),
        onEvent: event => {
          if (event.type === 'text') push({ kind: 'assistant', text: event.text })
          else push({ kind: 'action', text: event.label, isError: event.isError })
        },
      })
      historyRef.current = result.history
      if (result.end === 'stopped') push({ kind: 'error', text: 'Interrompu. Les modifications déjà faites restent (Ctrl+Z pour les annuler).' })
      else if (result.error) push({ kind: 'error', text: result.error })
    } finally {
      controllerRef.current = null
      setRunning(false)
    }
  }, [begin, patch, onFocusSlide, push])

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

  return { items, running, usage, attachments, attachError, attach, removeAttachment, send, stop, clear }
}
