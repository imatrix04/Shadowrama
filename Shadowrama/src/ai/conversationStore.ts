import { DRAFT_STORE, withStore } from '../utils/idb'
import { resolveMedia } from '../utils/mediaStore'
import { EMPTY_USAGE } from './types'
import type { Attachment, ChatItem, Usage, WireMessage } from './types'

/**
 * Conversation de l'assistant, conservée par projet.
 *
 * Elle vit dans le magasin `draft` d'IndexedDB (déjà utilisé par l'autosauvegarde
 * du projet, donc sans changement de version de base), sous une clé par projet :
 * le chemin du fichier `.shma`, ou « draft » tant que le projet n'est pas
 * enregistré. Elle ne contient que du texte et des références de pièces jointes :
 * jamais le contenu des fichiers, qui reste dans le magasin de médias.
 */

const PREFIX = 'assistant:'
const MAX_ITEMS = 200
const MAX_DRAFT = 20000

export const UNSAVED_PROJECT_KEY = 'draft'

export const projectKeyOf = (filePath: string | null): string => filePath ?? UNSAVED_PROJECT_KEY

export interface SavedConversation {
  items: ChatItem[]
  /** Historique envoyé au modèle à la demande suivante (texte seulement). */
  history: WireMessage[]
  usage: Usage
  attachments: Attachment[]
  nextItemId: number
  nextAttachmentId: number
  /** Texte en cours de frappe, pas encore envoyé. */
  draft: string
  /** Vrai si l'application a été quittée pendant une demande en cours. */
  interrupted: boolean
}

export const emptyConversation = (): SavedConversation => ({
  items: [], history: [], usage: EMPTY_USAGE, attachments: [],
  nextItemId: 0, nextAttachmentId: 0, draft: '', interrupted: false,
})

const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const count = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : 0)

/** Relit un enregistrement sans lui faire confiance : le stockage peut être ancien ou abîmé. */
function parse(raw: unknown): SavedConversation | null {
  if (!isRecord(raw)) return null
  const items: ChatItem[] = (Array.isArray(raw.items) ? raw.items : [])
    .filter((i): i is Record<string, unknown> => isRecord(i)
      && typeof i.id === 'number' && typeof i.text === 'string'
      && (i.kind === 'user' || i.kind === 'assistant' || i.kind === 'action' || i.kind === 'error'))
    .map(i => ({
      id: i.id as number, kind: i.kind as ChatItem['kind'], text: i.text as string,
      ...(i.isError === true && { isError: true }),
    }))
  const history: WireMessage[] = (Array.isArray(raw.history) ? raw.history : [])
    .filter((m): m is Record<string, unknown> => isRecord(m)
      && (m.role === 'user' || m.role === 'assistant') && Array.isArray(m.content)
      && (m.content as unknown[]).every(b => isRecord(b) && typeof b.type === 'string'))
    .map(m => m as unknown as WireMessage)
  const attachments: Attachment[] = (Array.isArray(raw.attachments) ? raw.attachments : [])
    .filter((a): a is Record<string, unknown> => isRecord(a)
      && typeof a.id === 'number' && typeof a.name === 'string' && typeof a.key === 'string'
      && a.key.startsWith('media/') && (a.kind === 'image' || a.kind === 'video'))
    .map(a => ({
      id: a.id as number, name: a.name as string, key: a.key as string, kind: a.kind as Attachment['kind'],
      ...(typeof a.width === 'number' && { width: a.width }),
      ...(typeof a.height === 'number' && { height: a.height }),
    }))
  const usage = isRecord(raw.usage) ? raw.usage : {}
  return {
    items, history, attachments,
    usage: {
      input: count(usage.input), output: count(usage.output),
      cacheRead: count(usage.cacheRead), cacheWrite: count(usage.cacheWrite),
    },
    nextItemId: Math.max(count(raw.nextItemId), ...items.map(i => i.id)),
    nextAttachmentId: Math.max(count(raw.nextAttachmentId), ...attachments.map(a => a.id)),
    draft: typeof raw.draft === 'string' ? raw.draft.slice(0, MAX_DRAFT) : '',
    interrupted: raw.interrupted === true,
  }
}

export async function loadConversation(projectKey: string): Promise<SavedConversation | null> {
  try {
    const stored = await withStore<unknown>(DRAFT_STORE, 'readonly', s => s.get(PREFIX + projectKey))
    return parse(stored)
  } catch {
    return null
  }
}

/**
 * Écarte les pièces jointes dont le média n'existe plus dans le magasin (projet
 * lu longtemps après, média purgé) : le modèle ne doit pas les proposer.
 */
export function withAvailableMedia(conversation: SavedConversation): SavedConversation {
  return { ...conversation, attachments: conversation.attachments.filter(a => resolveMedia(a.key) !== undefined) }
}

export const isEmpty =(c: SavedConversation) =>
  c.items.length === 0 && c.history.length === 0 && c.attachments.length === 0 && c.draft.trim() === ''

/** Enregistre ; une conversation vide supprime l'enregistrement (« Effacer »). */
export async function saveConversation(projectKey: string, conversation: SavedConversation): Promise<void> {
  try {
    if (isEmpty(conversation)) {
      await withStore(DRAFT_STORE, 'readwrite', s => s.delete(PREFIX + projectKey))
      return
    }
    const record = {
      ...conversation,
      items: conversation.items.slice(-MAX_ITEMS),
      draft: conversation.draft.slice(0, MAX_DRAFT),
      id: PREFIX + projectKey,
      savedAt: Date.now(),
    }
    await withStore(DRAFT_STORE, 'readwrite', s => s.put(record))
  } catch {
    // Stockage indisponible : la conversation reste en mémoire, rien de plus à faire.
  }
}

export async function deleteConversation(projectKey: string): Promise<void> {
  try {
    await withStore(DRAFT_STORE, 'readwrite', s => s.delete(PREFIX + projectKey))
  } catch {
    /* rien à supprimer si le stockage est indisponible */
  }
}
