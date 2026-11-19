import type { Slide, SlideNumbering } from '../types'
import { SYSTEM_PROMPT, editorContext } from './prompt'
import { TOOL_DEFS, executeTool } from './tools'
import type { Attachment, ContentBlock, Provider, Usage, WireMessage } from './types'

/** Tours modèle ↔ outils par demande : borne le coût et coupe les boucles folles. */
export const MAX_TURNS = 30
/** Appels d'outils par demande, tous tours confondus. */
export const MAX_TOOL_CALLS = 300

export type SessionEvent =
  /** Texte de la réponse en cours d'écriture : tout ce qui est arrivé jusqu'ici pour ce tour. */
  | { type: 'stream'; text: string }
  | { type: 'text'; text: string }
  | { type: 'action'; label: string; isError: boolean }

export type SessionEnd = 'done' | 'stopped' | 'error' | 'limit'

export interface SessionOptions {
  provider: Provider
  /** Conversation précédente, réduite au texte (voir `condense`). */
  history: WireMessage[]
  userText: string
  slides: Slide[]
  editor: { currentSlide: number; selectedIds: number[]; ultra: boolean }
  /** Fichiers joints à la conversation (seuls nom et dimensions sont décrits au modèle). */
  attachments?: Attachment[]
  /** Appelé à chaque modification, avec l'état complet des diapositives. */
  onSlides: (slides: Slide[]) => void
  /** Numérotation actuelle du projet (réglage hors diapositives). */
  numbering?: SlideNumbering
  /** Appelé quand l'assistant modifie la numérotation. */
  onNumbering?: (numbering: SlideNumbering) => void
  onFocusSlide: (index: number) => void
  onEvent: (event: SessionEvent) => void
  signal: AbortSignal
  /** Appelé après chaque réponse du modèle, avec les tokens de cet appel. */
  onUsage?: (usage: Usage) => void
}

export interface SessionResult {
  end: SessionEnd
  /** Message à afficher quand `end` est `error` ou `limit`. */
  error?: string
  /** Historique à conserver pour la demande suivante. */
  history: WireMessage[]
}

type ToolUse = Extract<ContentBlock, { type: 'tool_use' }>

const textOf = (blocks: ContentBlock[]) =>
  blocks
    .filter((b): b is Extract<ContentBlock, { type: 'text' }> => b.type === 'text')
    .map(b => b.text)
    .join('\n')
    .trim()

/**
 * Boucle de l'assistant : le modèle propose des appels d'outils, l'application
 * les exécute (voir tools.ts) et lui renvoie les résultats, jusqu'à ce qu'il
 * réponde sans demander d'outil.
 *
 * Les diapositives sont suivies dans une copie locale (`working`) et publiées à
 * chaque changement : l'utilisateur voit le travail avancer, et l'appelant
 * regroupe le tout en UNE entrée d'historique (une session = un seul Ctrl+Z).
 */
export async function runAssistant(opts: SessionOptions): Promise<SessionResult> {
  const api = window.aiAPI
  if (!api) {
    return { end: 'error', error: "L'assistant n'est disponible que dans l'application de bureau.", history: opts.history }
  }

  const requestId = crypto.randomUUID()
  const onAbort = () => api.abort(requestId)
  opts.signal.addEventListener('abort', onAbort)

  const context = editorContext({
    currentSlide: opts.editor.currentSlide,
    slideCount: opts.slides.length,
    selectedIds: opts.editor.selectedIds,
    ultra: opts.editor.ultra,
    attachments: opts.attachments,
  })
  const userMessage: WireMessage = { role: 'user', content: [{ type: 'text', text: `${context}\n\n${opts.userText}` }] }

  // Messages « validés » : toujours cohérents (chaque appel d'outil a son résultat).
  const messages: WireMessage[] = [...opts.history, userMessage]
  let working = opts.slides
  let workingNumbering = opts.numbering
  let toolCalls = 0
  let finalText = ''
  let end: SessionEnd = 'limit'
  let error: string | undefined = 'Limite de tours atteinte pour une seule demande.'

  try {
    for (let turn = 0; turn < MAX_TURNS; turn++) {
      if (opts.signal.aborted) { end = 'stopped'; error = undefined; break }

      // La réponse s'affiche pendant qu'elle s'écrit ; le résultat complet, lui,
      // arrive à la fin de l'appel et remplace ce texte provisoire.
      let live = ''
      const stopListening = api.onDelta?.(delta => {
        if (delta.requestId !== requestId || delta.type !== 'text') return
        live += delta.text
        opts.onEvent({ type: 'stream', text: live })
      })
      const response = await api.turn({
        requestId, provider: opts.provider, system: SYSTEM_PROMPT, messages, tools: TOOL_DEFS,
      }).finally(() => stopListening?.())
      if (opts.signal.aborted) { end = 'stopped'; error = undefined; break }
      if (!response.ok) { end = 'error'; error = response.error; break }
      if (response.usage) opts.onUsage?.(response.usage)

      const text = textOf(response.content)
      if (text) {
        opts.onEvent({ type: 'text', text })
        finalText = text
      }

      // Recherches web faites par le fournisseur : on les montre à l'utilisateur.
      for (const block of response.content) {
        if (block.type !== 'server_tool_use') continue
        const query = (block.input as { query?: unknown } | undefined)?.query
        opts.onEvent({
          type: 'action',
          label: typeof query === 'string' && query ? `Recherche web : ${query.slice(0, 120)}` : 'Recherche web',
          isError: false,
        })
      }

      const calls = response.content.filter((b): b is ToolUse => b.type === 'tool_use')
      if (calls.length === 0 && response.stopReason === 'pause_turn') {
        // Le fournisseur a mis sa recherche en pause : on relance pour qu'il la termine.
        messages.push({ role: 'assistant', content: response.content })
        continue
      }
      if (calls.length === 0) {
        if (response.stopReason === 'max_tokens') {
          end = 'limit'
          error = 'La réponse a été coupée : elle dépassait la taille maximale. Demandez une étape plus petite.'
        } else {
          end = 'done'
          error = undefined
        }
        break
      }

      const results: ContentBlock[] = []
      for (const call of calls) {
        if (++toolCalls > MAX_TOOL_CALLS) {
          results.push({
            type: 'tool_result', tool_use_id: call.id, is_error: true,
            content: "Erreur : limite d'actions atteinte pour cette demande.",
          })
          continue
        }
        const outcome = executeTool(working, call.name, call.input, {
          ultra: opts.editor.ultra, attachments: opts.attachments, numbering: workingNumbering,
        })
        if (outcome.slides !== working) {
          working = outcome.slides
          opts.onSlides(working)
        }
        if (outcome.numbering) {
          workingNumbering = outcome.numbering
          opts.onNumbering?.(workingNumbering)
        }
        if (outcome.focusSlide !== undefined) opts.onFocusSlide(outcome.focusSlide)
        if (outcome.label || outcome.isError) {
          opts.onEvent({ type: 'action', label: outcome.label ?? 'Action refusée', isError: outcome.isError })
        }
        results.push({ type: 'tool_result', tool_use_id: call.id, content: outcome.result, is_error: outcome.isError })
      }
      messages.push({ role: 'assistant', content: response.content })
      messages.push({ role: 'user', content: results })

      if (toolCalls > MAX_TOOL_CALLS) {
        end = 'limit'
        error = "Limite d'actions atteinte pour une seule demande."
        break
      }
    }
  } catch (err) {
    end = 'error'
    error = err instanceof Error ? err.message : String(err)
  } finally {
    opts.signal.removeEventListener('abort', onAbort)
  }

  return { end, error, history: condense(opts.history, opts.userText, finalText, end) }
}

/**
 * Historique conservé d'une demande à l'autre : texte seulement. Les lectures
 * d'outils (diapositives entières) coûteraient cher à chaque message suivant et
 * seraient périmées ; le modèle relit l'état réel quand il en a besoin.
 */
function condense(history: WireMessage[], userText: string, assistantText: string, end: SessionEnd): WireMessage[] {
  const reply = assistantText || (end === 'stopped' ? "(Interrompu par l'utilisateur.)" : '(Pas de réponse.)')
  return [
    ...history,
    { role: 'user', content: [{ type: 'text', text: userText }] },
    { role: 'assistant', content: [{ type: 'text', text: reply }] },
  ]
}
