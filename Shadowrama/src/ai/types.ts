// Types partagés du module assistant IA. Le format des messages est celui de
// l'API Anthropic (blocs texte / appel d'outil / résultat d'outil) : le
// processus principal le traduit pour les autres fournisseurs (electron/ai.ts).

export type Provider = 'anthropic' | 'openai'

export const PROVIDER_LABELS: Record<Provider, string> = {
  anthropic: 'Anthropic (Claude)',
  openai: 'OpenAI',
}

export const PROVIDER_ORGS: Record<Provider, string> = {
  anthropic: 'Anthropic',
  openai: 'OpenAI',
}

/** Où créer une clé : affiché dans l'écran de configuration. */
export const PROVIDER_KEY_URLS: Record<Provider, string> = {
  anthropic: 'https://console.anthropic.com/settings/keys',
  openai: 'https://platform.openai.com/api-keys',
}

export type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
  | { type: 'tool_result'; tool_use_id: string; content: string; is_error?: boolean }
  /** Réflexion du modèle : opaque, renvoyée telle quelle dans la boucle d'outils. */
  | { type: 'thinking' | 'redacted_thinking'; [key: string]: unknown }

export interface WireMessage {
  role: 'user' | 'assistant'
  content: ContentBlock[]
}

export interface ToolDef {
  name: string
  description: string
  input_schema: Record<string, unknown>
}

/** Puissance de réflexion : plus c'est haut, plus l'IA raisonne et consomme de tokens. */
export type Effort = 'low' | 'medium' | 'high' | 'xhigh'

export const EFFORT_LEVELS: { value: Effort; label: string; hint: string }[] = [
  { value: 'low', label: 'Faible', hint: 'Rapide et économe : modifications simples, textes courts.' },
  { value: 'medium', label: 'Moyen', hint: 'Équilibré : la plupart des demandes.' },
  { value: 'high', label: 'Élevé', hint: 'Plus de réflexion : mises en page et enchaînements complexes. Consomme davantage.' },
  { value: 'xhigh', label: 'Très élevé', hint: 'Réflexion maximale : formes calculées, présentations entières. Le plus lent et le plus coûteux.' },
]

export interface AISettings {
  provider: Provider
  models: Record<Provider, string>
  effort: Effort
  consent: Record<Provider, boolean>
  hasKey: Record<Provider, boolean>
  secureStorage: boolean
}

/**
 * Fichier joint par l'utilisateur dans la conversation. Seuls son numéro, son
 * nom et ses dimensions sont décrits au modèle : jamais son contenu.
 */
export interface Attachment {
  id: number
  name: string
  /** Clé du magasin de médias (`media/img-….png`). Jamais envoyée au modèle. */
  key: string
  kind: 'image' | 'video'
  width?: number
  height?: number
}

/** Une ligne affichée dans la conversation. */
export interface ChatItem {
  id: number
  kind: 'user' | 'assistant' | 'action' | 'error'
  text: string
  isError?: boolean
  /** Vrai tant que la réponse s'écrit en direct (jamais enregistré). */
  streaming?: boolean
}

/** Morceau de réponse reçu pendant que le modèle écrit (voir electron/ai.ts). */
export type StreamDelta =
  | { requestId: string; type: 'text'; text: string }
  | { requestId: string; type: 'tool'; name: string }

/** Tokens d'un appel, normalisés entre fournisseurs. `input` exclut le cache. */
export interface Usage {
  input: number
  output: number
  cacheRead: number
  cacheWrite: number
}

export const EMPTY_USAGE: Usage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }

export function addUsage(a: Usage, b: Usage): Usage {
  return {
    input: a.input + b.input,
    output: a.output + b.output,
    cacheRead: a.cacheRead + b.cacheRead,
    cacheWrite: a.cacheWrite + b.cacheWrite,
  }
}

export type TurnResult =
  | { ok: true; content: ContentBlock[]; stopReason: 'tool_use' | 'end' | 'max_tokens'; usage?: Usage }
  | { ok: false; error: string }
