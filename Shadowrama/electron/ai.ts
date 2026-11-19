import { app, ipcMain, safeStorage } from 'electron'
import type { BrowserWindow } from 'electron'
import { join } from 'path'
import { promises as fs } from 'fs'

/**
 * Assistant IA — côté processus principal.
 *
 * Trois règles structurent ce fichier :
 *  1. La clé API ne quitte jamais ce processus. Elle est chiffrée avec le
 *     coffre du système (`safeStorage` : DPAPI sous Windows, Trousseau sous macOS)
 *     et n'est jamais renvoyée à l'interface — qui apprend seulement « une clé
 *     est enregistrée ».
 *  2. Aucune clé en clair, jamais : si le chiffrement n'est pas disponible, on
 *     refuse d'enregistrer plutôt que de se rabattre sur un fichier lisible.
 *  3. Le consentement à l'envoi des données est vérifié ICI, pas seulement dans
 *     l'interface : sans lui, aucun appel ne part, quoi que fasse le renderer.
 *
 * Les adresses des fournisseurs sont figées : l'interface ne choisit jamais où
 * partent les données (pas de redirection possible vers un autre serveur).
 */

export type Provider = 'anthropic' | 'openai'

type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
  | { type: 'tool_result'; tool_use_id: string; content: string; is_error?: boolean }
  /** Réflexion du modèle : renvoyée telle quelle (signature comprise) dans la boucle d'outils. */
  | { type: 'thinking' | 'redacted_thinking'; [key: string]: unknown }

interface WireMessage {
  role: 'user' | 'assistant'
  content: ContentBlock[]
}

interface ToolDef {
  name: string
  description: string
  input_schema: Record<string, unknown>
}

interface TurnRequest {
  requestId: string
  provider: Provider
  system: string
  messages: WireMessage[]
  tools: ToolDef[]
}

type TurnResult =
  | { ok: true; content: ContentBlock[]; stopReason: 'tool_use' | 'end' | 'max_tokens'; usage: Usage }
  | { ok: false; error: string }

/** Tokens d'un appel, normalisés entre fournisseurs (`input` exclut le cache). */
interface Usage { input: number; output: number; cacheRead: number; cacheWrite: number }

const count = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0)

/** Puissance de réflexion : plus c'est haut, plus le modèle raisonne (et consomme de tokens). */
export type Effort = 'low' | 'medium' | 'high' | 'xhigh'
const EFFORTS: Effort[] = ['low', 'medium', 'high', 'xhigh']
const DEFAULT_EFFORT: Effort = 'medium'
const isEffort = (value: unknown): value is Effort =>
  typeof value === 'string' && (EFFORTS as string[]).includes(value)

interface StoredSettings {
  provider: Provider
  models: Record<Provider, string>
  effort: Effort
  /** Consentement explicite, par fournisseur : un autre fournisseur = un autre destinataire. */
  consent: Record<Provider, boolean>
  /** Clés chiffrées (base64). */
  keys: Partial<Record<Provider, string>>
}

export interface PublicSettings {
  provider: Provider
  models: Record<Provider, string>
  effort: Effort
  consent: Record<Provider, boolean>
  hasKey: Record<Provider, boolean>
  /** Faux : impossible d'enregistrer une clé en sécurité sur cette machine. */
  secureStorage: boolean
}

const PROVIDERS: Provider[] = ['anthropic', 'openai']

const DEFAULT_MODELS: Record<Provider, string> = {
  anthropic: 'claude-sonnet-5-5',
  openai: 'gpt-4.1',
}

// La réflexion du modèle compte dans cette limite : trop basse, elle coupe la réponse.
const MAX_OUTPUT_TOKENS = 10_000
// Délai d'INACTIVITÉ : la réponse arrive en flux, donc une longue réponse n'est pas
// coupée tant que des données continuent d'arriver (le fournisseur envoie aussi des
// signaux de vie pendant la réflexion).
const IDLE_TIMEOUT_MS = 120_000

const isProvider = (value: unknown): value is Provider =>
  typeof value === 'string' && (PROVIDERS as string[]).includes(value)

// ── Stockage ────────────────────────────────────────────────────────────────

const settingsPath = () => join(app.getPath('userData'), 'ai-settings.json')

function defaults(): StoredSettings {
  return {
    provider: 'anthropic',
    models: { ...DEFAULT_MODELS },
    effort: DEFAULT_EFFORT,
    consent: { anthropic: false, openai: false },
    keys: {},
  }
}

async function readSettings(): Promise<StoredSettings> {
  const base = defaults()
  try {
    const raw: unknown = JSON.parse(await fs.readFile(settingsPath(), 'utf-8'))
    if (!raw || typeof raw !== 'object') return base
    const data = raw as Partial<StoredSettings>
    if (isProvider(data.provider)) base.provider = data.provider
    if (isEffort(data.effort)) base.effort = data.effort
    for (const p of PROVIDERS) {
      const model = data.models?.[p]
      if (typeof model === 'string' && model.trim()) base.models[p] = model.trim()
      base.consent[p] = data.consent?.[p] === true
      const key = data.keys?.[p]
      if (typeof key === 'string' && key) base.keys[p] = key
    }
  } catch {
    // Fichier absent ou illisible : réglages d'origine, sans clé ni consentement.
  }
  return base
}

async function writeSettings(settings: StoredSettings): Promise<void> {
  await fs.writeFile(settingsPath(), JSON.stringify(settings), 'utf-8')
}

/** Le coffre existe ET chiffre vraiment (sous Linux, « basic_text » ne protège rien). */
function secureStorageAvailable(): boolean {
  if (!safeStorage.isEncryptionAvailable()) return false
  const backend = (safeStorage as { getSelectedStorageBackend?: () => string }).getSelectedStorageBackend?.()
  return backend !== 'basic_text'
}

function toPublic(settings: StoredSettings): PublicSettings {
  return {
    provider: settings.provider,
    models: settings.models,
    effort: settings.effort,
    consent: settings.consent,
    hasKey: { anthropic: !!settings.keys.anthropic, openai: !!settings.keys.openai },
    secureStorage: secureStorageAvailable(),
  }
}

function decryptKey(settings: StoredSettings, provider: Provider): string | null {
  const stored = settings.keys[provider]
  if (!stored || !secureStorageAvailable()) return null
  try {
    return safeStorage.decryptString(Buffer.from(stored, 'base64'))
  } catch {
    // Coffre changé (autre session système, profil copié) : la clé est perdue.
    return null
  }
}

// ── Appels aux fournisseurs ────────────────────────────────────────────────

function httpError(status: number, body: unknown): string {
  const detail = (body as { error?: { message?: unknown } } | null)?.error?.message
  const text = typeof detail === 'string' ? detail.slice(0, 300) : ''
  if (status === 401 || status === 403) return `Clé API refusée par le fournisseur. Vérifiez-la dans les paramètres de l'assistant.${text ? ` (${text})` : ''}`
  if (status === 404) return `Modèle introuvable ou inaccessible avec cette clé.${text ? ` (${text})` : ''}`
  if (status === 429) return `Limite de requêtes ou de crédit atteinte chez le fournisseur.${text ? ` (${text})` : ''}`
  if (status >= 500) return `Le fournisseur est indisponible (erreur ${status}). Réessayez dans un instant.`
  return `Requête refusée (erreur ${status}).${text ? ` ${text}` : ''}`
}

/**
 * Marque le dernier bloc du dernier message : à chaque tour de la boucle
 * d'outils, tout l'historique précédent est relu depuis le cache. Copie
 * superficielle, les messages d'origine ne sont pas modifiés.
 */
function withMessageCache(messages: WireMessage[]): unknown[] {
  if (messages.length === 0) return messages
  const last = messages[messages.length - 1]
  if (last.content.length === 0) return messages
  const content = last.content.map((block, i) => i === last.content.length - 1
    ? { ...block, cache_control: { type: 'ephemeral' } } : block)
  return [...messages.slice(0, -1), { ...last, content }]
}

/**
 * Modèles Claude qui acceptent `output_config.effort` (famille 5 et Opus / Sonnet
 * 4.6 à 4.8). Pour les autres (Haiku 4.5, Sonnet 4.5…), le paramètre est refusé :
 * on ne l'envoie pas. La réflexion elle-même n'est jamais forcée ni coupée ici :
 * chaque modèle garde son comportement adaptatif par défaut.
 */
const ANTHROPIC_EFFORT_MODELS = /^claude-(?:(?:sonnet|opus|haiku|fable|mythos)-5(?:-\d+)?|opus-4-[678]|sonnet-4-6)$/
/** « xhigh » n'existe qu'à partir d'Opus 4.7. */
const ANTHROPIC_NO_XHIGH = /^claude-(?:opus|sonnet)-4-6$/

function anthropicEffort(model: string, effort: Effort): Record<string, unknown> {
  if (!ANTHROPIC_EFFORT_MODELS.test(model)) return {}
  const level = effort === 'xhigh' && ANTHROPIC_NO_XHIGH.test(model) ? 'high' : effort
  return { output_config: { effort: level } }
}

/** Modèles de raisonnement OpenAI (série « o », GPT-5) : seuls à accepter `reasoning_effort`. */
const OPENAI_REASONING_MODELS = /^(?:o\d|gpt-5)/

function openAiEffort(model: string, effort: Effort): Record<string, unknown> {
  if (!OPENAI_REASONING_MODELS.test(model)) return {}
  // OpenAI n'a que trois niveaux courants : « très élevé » devient « élevé ».
  return { reasoning_effort: effort === 'xhigh' ? 'high' : effort }
}

// ── Flux (streaming) ─────────────────────────────────────────────────────────

/** Ce que les appels signalent pendant qu'ils lisent le flux de réponse. */
interface StreamHooks {
  /** Texte produit par le modèle, au fil de l'eau (affiché en direct). */
  onText: (text: string) => void
  /** Un appel d'outil commence (nom de l'outil). */
  onTool: (name: string) => void
  /** Des octets sont arrivés : la connexion est vivante (délai d'inactivité). */
  onActivity: () => void
}

type Rec = Record<string, unknown>
const asRec = (value: unknown): Rec =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as Rec : {}

/**
 * Lit un flux « server-sent events » : un appel par événement, JSON déjà décodé.
 * Les fournisseurs séparent les événements par une ligne vide ; un événement
 * peut arriver coupé en deux morceaux réseau, d'où le tampon.
 */
async function readEvents(response: Response, onEvent: (data: Rec) => void, onActivity: () => void): Promise<void> {
  const reader = response.body?.getReader()
  if (!reader) throw new Error('Réponse vide du fournisseur.')
  const decoder = new TextDecoder()
  let buffer = ''

  const handle = (raw: string) => {
    const data = raw.split(/\r?\n/)
      .filter(line => line.startsWith('data:'))
      .map(line => line.slice(5).trimStart())
      .join('\n')
    if (!data || data === '[DONE]') return
    let parsed: unknown
    try { parsed = JSON.parse(data) } catch { return }
    onEvent(asRec(parsed))
  }

  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    onActivity()
    buffer += decoder.decode(value, { stream: true })
    for (;;) {
      const separator = /\r?\n\r?\n/.exec(buffer)
      if (!separator) break
      handle(buffer.slice(0, separator.index))
      buffer = buffer.slice(separator.index + separator[0].length)
    }
  }
  buffer += decoder.decode()
  if (buffer.trim()) handle(buffer)
}

async function callAnthropic(
  key: string, model: string, effort: Effort, req: TurnRequest, signal: AbortSignal, hooks: StreamHooks,
): Promise<TurnResult> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    signal,
    headers: {
      'content-type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: MAX_OUTPUT_TOKENS,
      stream: true,
      // Prompt caching : l'API met en cache tout ce qui précède chaque marqueur
      // (outils → système → messages). Les lectures coûtent ~10 % du prix normal.
      system: [{ type: 'text', text: req.system, cache_control: { type: 'ephemeral' } }],
      messages: withMessageCache(req.messages),
      tools: req.tools.map((t, i) => i === req.tools.length - 1
        ? { ...t, cache_control: { type: 'ephemeral' } } : t),
      ...anthropicEffort(model, effort),
    }),
  })
  hooks.onActivity()
  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null)
    return { ok: false, error: httpError(response.status, body) }
  }

  // Blocs reconstitués morceau par morceau, dans l'ordre d'arrivée.
  const parts = new Map<number, { block: Rec; json: string }>()
  const usage: Usage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }
  let stop: unknown
  let streamError: string | null = null

  await readEvents(response, event => {
    switch (event.type) {
      case 'message_start': {
        const u = asRec(asRec(event.message).usage)
        usage.input = count(u.input_tokens)
        usage.output = count(u.output_tokens)
        usage.cacheRead = count(u.cache_read_input_tokens)
        usage.cacheWrite = count(u.cache_creation_input_tokens)
        break
      }
      case 'content_block_start': {
        const block = { ...asRec(event.content_block) }
        parts.set(count(event.index), { block, json: '' })
        if (block.type === 'tool_use' && typeof block.name === 'string') hooks.onTool(block.name)
        break
      }
      case 'content_block_delta': {
        const part = parts.get(count(event.index))
        if (!part) break
        const delta = asRec(event.delta)
        if (delta.type === 'text_delta' && typeof delta.text === 'string') {
          part.block.text = String(part.block.text ?? '') + delta.text
          hooks.onText(delta.text)
        } else if (delta.type === 'thinking_delta' && typeof delta.thinking === 'string') {
          part.block.thinking = String(part.block.thinking ?? '') + delta.thinking
        } else if (delta.type === 'signature_delta' && typeof delta.signature === 'string') {
          part.block.signature = String(part.block.signature ?? '') + delta.signature
        } else if (delta.type === 'input_json_delta' && typeof delta.partial_json === 'string') {
          part.json += delta.partial_json
        }
        break
      }
      case 'message_delta': {
        stop = asRec(event.delta).stop_reason
        const u = asRec(event.usage)
        if (typeof u.output_tokens === 'number') usage.output = count(u.output_tokens)
        break
      }
      case 'error': {
        const message = asRec(event.error).message
        streamError = (typeof message === 'string' ? message : 'erreur du fournisseur').slice(0, 300)
        break
      }
    }
  }, hooks.onActivity)

  if (streamError) return { ok: false, error: `Le fournisseur a interrompu la réponse : ${streamError}` }

  const content: ContentBlock[] = []
  for (const [, part] of [...parts.entries()].sort((a, b) => a[0] - b[0])) {
    const b = part.block
    if (b.type === 'text') {
      // Un bloc de texte vide serait refusé par l'API au tour suivant.
      if (typeof b.text === 'string' && b.text) content.push({ type: 'text', text: b.text })
    } else if (b.type === 'thinking' || b.type === 'redacted_thinking') {
      // À renvoyer inchangé au tour suivant (la boucle d'outils l'exige).
      content.push(b as ContentBlock)
    } else if (b.type === 'tool_use' && typeof b.id === 'string' && typeof b.name === 'string') {
      let input: Rec = {}
      if (part.json.trim()) {
        try { input = asRec(JSON.parse(part.json)) } catch { /* arguments coupés : l'outil le dira au modèle */ }
      }
      content.push({ type: 'tool_use', id: b.id, name: b.name, input })
    }
  }
  const stopReason = stop === 'tool_use' ? 'tool_use' : stop === 'max_tokens' ? 'max_tokens' : 'end'
  return { ok: true, content, stopReason, usage }
}

/** Format interne (blocs de type Anthropic) → messages « chat completions ». */
function toOpenAiMessages(system: string, messages: WireMessage[]): unknown[] {
  const out: unknown[] = [{ role: 'system', content: system }]
  for (const message of messages) {
    if (message.role === 'assistant') {
      const text = message.content.filter(b => b.type === 'text').map(b => (b as { text: string }).text).join('\n')
      const calls = message.content.filter(b => b.type === 'tool_use') as Extract<ContentBlock, { type: 'tool_use' }>[]
      out.push({
        role: 'assistant',
        content: text || null,
        ...(calls.length > 0 && {
          tool_calls: calls.map(c => ({
            id: c.id, type: 'function',
            function: { name: c.name, arguments: JSON.stringify(c.input) },
          })),
        }),
      })
      continue
    }
    // Un message utilisateur porte soit du texte, soit des résultats d'outils.
    for (const block of message.content) {
      if (block.type === 'tool_result') {
        out.push({ role: 'tool', tool_call_id: block.tool_use_id, content: block.content })
      } else if (block.type === 'text') {
        out.push({ role: 'user', content: block.text })
      }
    }
  }
  return out
}

async function callOpenAi(
  key: string, model: string, effort: Effort, req: TurnRequest, signal: AbortSignal, hooks: StreamHooks,
): Promise<TurnResult> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    signal,
    headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      max_completion_tokens: MAX_OUTPUT_TOKENS,
      stream: true,
      // Sans cette option, le flux ne dit jamais combien de tokens ont été consommés.
      stream_options: { include_usage: true },
      ...openAiEffort(model, effort),
      messages: toOpenAiMessages(req.system, req.messages),
      tools: req.tools.map(t => ({
        type: 'function',
        function: { name: t.name, description: t.description, parameters: t.input_schema },
      })),
    }),
  })
  hooks.onActivity()
  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null)
    return { ok: false, error: httpError(response.status, body) }
  }

  let text = ''
  const calls = new Map<number, { id: string; name: string; args: string }>()
  let finish: string | undefined
  let promptTokens = 0
  let completionTokens = 0
  let cached = 0
  let streamError: string | null = null

  await readEvents(response, event => {
    const failure = asRec(event.error).message
    if (typeof failure === 'string') streamError = failure.slice(0, 300)

    const u = asRec(event.usage)
    if (Object.keys(u).length > 0) {
      promptTokens = count(u.prompt_tokens)
      completionTokens = count(u.completion_tokens)
      cached = count(asRec(u.prompt_tokens_details).cached_tokens)
    }

    const choice = asRec(Array.isArray(event.choices) ? event.choices[0] : undefined)
    const delta = asRec(choice.delta)
    if (typeof delta.content === 'string' && delta.content) {
      text += delta.content
      hooks.onText(delta.content)
    }
    for (const raw of Array.isArray(delta.tool_calls) ? delta.tool_calls : []) {
      const c = asRec(raw)
      const fn = asRec(c.function)
      const index = count(c.index)
      const entry = calls.get(index) ?? { id: '', name: '', args: '' }
      const hadName = entry.name !== ''
      if (typeof c.id === 'string' && c.id) entry.id = c.id
      if (typeof fn.name === 'string' && fn.name) entry.name = fn.name
      if (typeof fn.arguments === 'string') entry.args += fn.arguments
      calls.set(index, entry)
      if (!hadName && entry.name) hooks.onTool(entry.name)
    }
    if (typeof choice.finish_reason === 'string') finish = choice.finish_reason
  }, hooks.onActivity)

  if (streamError) return { ok: false, error: `Le fournisseur a interrompu la réponse : ${streamError}` }

  const content: ContentBlock[] = []
  if (text) content.push({ type: 'text', text })
  for (const [, call] of [...calls.entries()].sort((a, b) => a[0] - b[0])) {
    if (!call.id || !call.name) continue
    let input: Rec = {}
    try {
      input = asRec(JSON.parse(call.args || '{}'))
    } catch {
      // Arguments mal formés : l'outil recevra un objet vide et le dira au modèle.
    }
    content.push({ type: 'tool_use', id: call.id, name: call.name, input })
  }
  const stopReason = finish === 'tool_calls' ? 'tool_use' : finish === 'length' ? 'max_tokens' : 'end'
  // OpenAI compte les tokens en cache DANS prompt_tokens : on les en retire.
  const usage: Usage = {
    input: Math.max(0, promptTokens - cached),
    output: completionTokens,
    cacheRead: cached,
    cacheWrite: 0,
  }
  return { ok: true, content, stopReason, usage }
}

// ── Enregistrement des canaux IPC ─────────────────────────────────────────

const inFlight = new Map<string, AbortController>()

export function registerAiHandlers(getMainWindow: () => BrowserWindow | null) {
  // Seule la fenêtre de l'application peut parler à l'assistant.
  const guard = (sender: Electron.WebContents) => {
    const win = getMainWindow()
    if (!win || win.isDestroyed() || sender !== win.webContents) throw new Error('Accès refusé.')
  }

  ipcMain.handle('ai:get-settings', async (event): Promise<PublicSettings> => {
    guard(event.sender)
    return toPublic(await readSettings())
  })

  ipcMain.handle('ai:save-settings', async (event, patch: { provider?: unknown; model?: unknown; consent?: unknown; effort?: unknown }) => {
    guard(event.sender)
    const settings = await readSettings()
    if (isProvider(patch?.provider)) settings.provider = patch.provider
    const target = isProvider(patch?.provider) ? patch.provider : settings.provider
    if (typeof patch?.model === 'string' && patch.model.trim()) {
      settings.models[target] = patch.model.trim().slice(0, 100)
    }
    if (typeof patch?.consent === 'boolean') settings.consent[target] = patch.consent
    if (isEffort(patch?.effort)) settings.effort = patch.effort
    await writeSettings(settings)
    return toPublic(settings)
  })

  ipcMain.handle('ai:set-key', async (event, provider: unknown, key: unknown) => {
    guard(event.sender)
    if (!isProvider(provider)) throw new Error('Fournisseur inconnu.')
    if (typeof key !== 'string' || key.trim().length < 8 || /\s/.test(key.trim())) {
      throw new Error('Cette clé API ne semble pas valide.')
    }
    if (!secureStorageAvailable()) {
      throw new Error(
        "Le stockage sécurisé du système n'est pas disponible : la clé ne peut pas être enregistrée "
        + 'sans risque. Elle n\'a pas été sauvegardée.'
      )
    }
    const settings = await readSettings()
    settings.keys[provider] = safeStorage.encryptString(key.trim()).toString('base64')
    await writeSettings(settings)
    return toPublic(settings)
  })

  // Retirer la clé retire aussi le consentement : on le redemandera à la
  // prochaine saisie, comme à la toute première.
  ipcMain.handle('ai:clear-key', async (event, provider: unknown) => {
    guard(event.sender)
    if (!isProvider(provider)) throw new Error('Fournisseur inconnu.')
    const settings = await readSettings()
    delete settings.keys[provider]
    settings.consent[provider] = false
    await writeSettings(settings)
    return toPublic(settings)
  })

  ipcMain.handle('ai:turn', async (event, req: TurnRequest): Promise<TurnResult> => {
    guard(event.sender)
    if (!req || !isProvider(req.provider) || typeof req.requestId !== 'string'
      || !Array.isArray(req.messages) || !Array.isArray(req.tools) || typeof req.system !== 'string') {
      return { ok: false, error: 'Requête invalide.' }
    }

    const settings = await readSettings()
    if (!settings.consent[req.provider]) {
      return { ok: false, error: "Vous n'avez pas encore autorisé l'envoi de données à ce fournisseur." }
    }
    const key = decryptKey(settings, req.provider)
    if (!key) {
      return { ok: false, error: "Aucune clé API utilisable : saisissez-la à nouveau dans les paramètres de l'assistant." }
    }

    const controller = new AbortController()
    inFlight.set(req.requestId, controller)
    let timer: ReturnType<typeof setTimeout> | undefined
    const activity = () => {
      clearTimeout(timer)
      timer = setTimeout(() => controller.abort(new Error('timeout')), IDLE_TIMEOUT_MS)
    }
    activity()
    // Le texte part vers l'interface au fil de l'eau ; la réponse complète, elle,
    // revient comme avant par le résultat de cet appel.
    const emit = (payload: Record<string, unknown>) => {
      if (!event.sender.isDestroyed()) event.sender.send('ai:delta', { requestId: req.requestId, ...payload })
    }
    const hooks: StreamHooks = {
      onText: text => emit({ type: 'text', text }),
      onTool: name => emit({ type: 'tool', name }),
      onActivity: activity,
    }
    try {
      const model = settings.models[req.provider]
      return req.provider === 'anthropic'
        ? await callAnthropic(key, model, settings.effort, req, controller.signal, hooks)
        : await callOpenAi(key, model, settings.effort, req, controller.signal, hooks)
    } catch (err) {
      if (controller.signal.aborted) {
        const timedOut = (controller.signal.reason as Error | undefined)?.message === 'timeout'
        return { ok: false, error: timedOut ? "Le fournisseur n'a pas répondu à temps." : 'Interrompu.' }
      }
      // Le message d'erreur réseau ne contient jamais la clé (elle est en en-tête).
      return { ok: false, error: `Connexion impossible : ${err instanceof Error ? err.message : String(err)}` }
    } finally {
      clearTimeout(timer)
      inFlight.delete(req.requestId)
    }
  })

  ipcMain.on('ai:abort', (event, requestId: unknown) => {
    try { guard(event.sender) } catch { return }
    if (typeof requestId === 'string') inFlight.get(requestId)?.abort()
  })
}
