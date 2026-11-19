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

interface StoredSettings {
  provider: Provider
  models: Record<Provider, string>
  /** Consentement explicite, par fournisseur : un autre fournisseur = un autre destinataire. */
  consent: Record<Provider, boolean>
  /** Clés chiffrées (base64). */
  keys: Partial<Record<Provider, string>>
}

export interface PublicSettings {
  provider: Provider
  models: Record<Provider, string>
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

const MAX_OUTPUT_TOKENS = 4096
const REQUEST_TIMEOUT_MS = 120_000

const isProvider = (value: unknown): value is Provider =>
  typeof value === 'string' && (PROVIDERS as string[]).includes(value)

// ── Stockage ────────────────────────────────────────────────────────────────

const settingsPath = () => join(app.getPath('userData'), 'ai-settings.json')

function defaults(): StoredSettings {
  return {
    provider: 'anthropic',
    models: { ...DEFAULT_MODELS },
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

async function callAnthropic(key: string, model: string, req: TurnRequest, signal: AbortSignal): Promise<TurnResult> {
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
      // Prompt caching : l'API met en cache tout ce qui précède chaque marqueur
      // (outils → système → messages). Les lectures coûtent ~10 % du prix normal.
      system: [{ type: 'text', text: req.system, cache_control: { type: 'ephemeral' } }],
      messages: withMessageCache(req.messages),
      tools: req.tools.map((t, i) => i === req.tools.length - 1
        ? { ...t, cache_control: { type: 'ephemeral' } } : t),
    }),
  })
  const body: unknown = await response.json().catch(() => null)
  if (!response.ok) return { ok: false, error: httpError(response.status, body) }

  const data = body as { content?: unknown; stop_reason?: string; usage?: Record<string, unknown> }
  const content: ContentBlock[] = []
  for (const block of Array.isArray(data.content) ? data.content : []) {
    const b = block as { type?: string; text?: unknown; id?: unknown; name?: unknown; input?: unknown }
    if (b.type === 'text' && typeof b.text === 'string') content.push({ type: 'text', text: b.text })
    else if (b.type === 'tool_use' && typeof b.id === 'string' && typeof b.name === 'string') {
      content.push({
        type: 'tool_use', id: b.id, name: b.name,
        input: b.input && typeof b.input === 'object' ? b.input as Record<string, unknown> : {},
      })
    }
  }
  const stopReason = data.stop_reason === 'tool_use' ? 'tool_use'
    : data.stop_reason === 'max_tokens' ? 'max_tokens' : 'end'
  const usage: Usage = {
    input: count(data.usage?.input_tokens),
    output: count(data.usage?.output_tokens),
    cacheRead: count(data.usage?.cache_read_input_tokens),
    cacheWrite: count(data.usage?.cache_creation_input_tokens),
  }
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

async function callOpenAi(key: string, model: string, req: TurnRequest, signal: AbortSignal): Promise<TurnResult> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    signal,
    headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      max_completion_tokens: MAX_OUTPUT_TOKENS,
      messages: toOpenAiMessages(req.system, req.messages),
      tools: req.tools.map(t => ({
        type: 'function',
        function: { name: t.name, description: t.description, parameters: t.input_schema },
      })),
    }),
  })
  const body: unknown = await response.json().catch(() => null)
  if (!response.ok) return { ok: false, error: httpError(response.status, body) }

  const raw = body as { usage?: { prompt_tokens?: unknown; completion_tokens?: unknown; prompt_tokens_details?: { cached_tokens?: unknown } } } | null
  const choice = (body as { choices?: { message?: { content?: unknown; tool_calls?: unknown }; finish_reason?: string }[] })
    ?.choices?.[0]
  const content: ContentBlock[] = []
  if (typeof choice?.message?.content === 'string' && choice.message.content) {
    content.push({ type: 'text', text: choice.message.content })
  }
  for (const call of Array.isArray(choice?.message?.tool_calls) ? choice.message.tool_calls : []) {
    const c = call as { id?: unknown; function?: { name?: unknown; arguments?: unknown } }
    if (typeof c.id !== 'string' || typeof c.function?.name !== 'string') continue
    let input: Record<string, unknown> = {}
    try {
      const parsed: unknown = JSON.parse(typeof c.function.arguments === 'string' ? c.function.arguments : '{}')
      if (parsed && typeof parsed === 'object') input = parsed as Record<string, unknown>
    } catch {
      // Arguments mal formés : l'outil recevra un objet vide et le dira au modèle.
    }
    content.push({ type: 'tool_use', id: c.id, name: c.function.name, input })
  }
  const stopReason = choice?.finish_reason === 'tool_calls' ? 'tool_use'
    : choice?.finish_reason === 'length' ? 'max_tokens' : 'end'
  // OpenAI compte les tokens en cache DANS prompt_tokens : on les en retire.
  const cached = count(raw?.usage?.prompt_tokens_details?.cached_tokens)
  const usage: Usage = {
    input: Math.max(0, count(raw?.usage?.prompt_tokens) - cached),
    output: count(raw?.usage?.completion_tokens),
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

  ipcMain.handle('ai:save-settings', async (event, patch: { provider?: unknown; model?: unknown; consent?: unknown }) => {
    guard(event.sender)
    const settings = await readSettings()
    if (isProvider(patch?.provider)) settings.provider = patch.provider
    const target = isProvider(patch?.provider) ? patch.provider : settings.provider
    if (typeof patch?.model === 'string' && patch.model.trim()) {
      settings.models[target] = patch.model.trim().slice(0, 100)
    }
    if (typeof patch?.consent === 'boolean') settings.consent[target] = patch.consent
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
    const timer = setTimeout(() => controller.abort(new Error('timeout')), REQUEST_TIMEOUT_MS)
    try {
      const model = settings.models[req.provider]
      return req.provider === 'anthropic'
        ? await callAnthropic(key, model, req, controller.signal)
        : await callOpenAi(key, model, req, controller.signal)
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
