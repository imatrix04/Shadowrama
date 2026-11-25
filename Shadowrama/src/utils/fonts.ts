/**
 * Catalogue des polices proposées pour le texte des blocs.
 *
 * Toutes sont embarquées avec l'application (voir main.tsx) : le rendu est le
 * même sur tous les postes. L'identifiant d'une police est son nom de famille,
 * c'est aussi ce qui est écrit dans le .shma et dans le .pptx exporté.
 */

export type FontGroup = 'pro' | 'creative' | 'hand'
export type FontKind = 'sans' | 'serif' | 'mono' | 'display' | 'script'

export interface FontDef {
  /** Nom de famille : valeur de `fontFamily` dans les blocs. */
  id: string
  group: FontGroup
  kind: FontKind
  /** Pile CSS : la police, puis un repli du même genre. */
  stack: string
}

export const FONT_GROUP_LABELS: Record<FontGroup, string> = {
  pro: 'Sobre',
  creative: 'Créatif',
  hand: 'Manuscrit',
}

export const FONT_CATALOG: FontDef[] = [
  { id: 'Inter', group: 'pro', kind: 'sans', stack: "'Inter', system-ui, sans-serif" },
  { id: 'Montserrat', group: 'pro', kind: 'sans', stack: "'Montserrat', system-ui, sans-serif" },
  { id: 'Lato', group: 'pro', kind: 'sans', stack: "'Lato', system-ui, sans-serif" },
  { id: 'Merriweather', group: 'pro', kind: 'serif', stack: "'Merriweather', Georgia, serif" },
  { id: 'IBM Plex Mono', group: 'pro', kind: 'mono', stack: "'IBM Plex Mono', ui-monospace, monospace" },

  { id: 'Bricolage Grotesque', group: 'creative', kind: 'sans', stack: "'Bricolage Grotesque', system-ui, sans-serif" },
  { id: 'Space Grotesk', group: 'creative', kind: 'sans', stack: "'Space Grotesk', system-ui, sans-serif" },
  { id: 'Playfair Display', group: 'creative', kind: 'serif', stack: "'Playfair Display', Georgia, serif" },
  { id: 'Oswald', group: 'creative', kind: 'display', stack: "'Oswald', Impact, sans-serif" },
  { id: 'Bebas Neue', group: 'creative', kind: 'display', stack: "'Bebas Neue', Impact, sans-serif" },

  { id: 'Caveat', group: 'hand', kind: 'script', stack: "'Caveat', 'Segoe Script', cursive" },
  { id: 'Dancing Script', group: 'hand', kind: 'script', stack: "'Dancing Script', 'Segoe Script', cursive" },
  { id: 'Pacifico', group: 'hand', kind: 'script', stack: "'Pacifico', 'Segoe Script', cursive" },
  { id: 'Permanent Marker', group: 'hand', kind: 'script', stack: "'Permanent Marker', 'Segoe Print', cursive" },
]

const BY_ID = new Map(FONT_CATALOG.map(f => [f.id.toLowerCase(), f]))

/** Police du catalogue pour ce nom (insensible à la casse), sinon undefined. */
export function findFont(id: unknown): FontDef | undefined {
  return typeof id === 'string' ? BY_ID.get(id.trim().toLowerCase()) : undefined
}

/** Nom canonique d'une police du catalogue, ou undefined (= police par défaut). */
export function normalizeFontFamily(id: unknown): string | undefined {
  return findFont(id)?.id
}

/** Valeur CSS `font-family` d'un bloc ; undefined = hérite de la police par défaut. */
export function fontStack(id: unknown): string | undefined {
  return findFont(id)?.stack
}

/** Entrées du sélecteur de police. La valeur vide désigne la police par défaut. */
export const FONT_OPTIONS: { label: string; value: string; fontFamily?: string }[] = [
  { label: 'Par défaut', value: '' },
  ...FONT_CATALOG.map(f => ({
    label: `${f.id} · ${FONT_GROUP_LABELS[f.group]}`,
    value: f.id,
    fontFamily: f.stack,
  })),
]

// ── PowerPoint ──────────────────────────────────────────────────────────────

const SERIF_HINT = /times|georgia|garamond|cambria|palatino|bookman|century|serif(?!.*sans)|minion|baskerville|didot|constantia/i
const SCRIPT_HINT = /script|brush|hand|marker|comic|chalk|ink|calligraph|segoe print|bradley|lucida (hand|calli)|mistral|kunstler/i
const MONO_HINT = /mono|courier|consolas|menlo|lucida console|code/i
const DISPLAY_HINT = /impact|bebas|oswald|condensed|narrow|haettenschweiler/i

/**
 * Police du catalogue qui approche une police de PowerPoint.
 *
 * Un nom du catalogue est repris tel quel. Sinon on retombe sur la police du
 * même genre (empattement, manuscrite, chasse fixe, affichage). Rend undefined
 * pour une police sans empattement : c'est la police par défaut de l'éditeur,
 * inutile de la poser sur chaque bloc.
 */
export function fontFromPptx(typeface: string | undefined): string | undefined {
  if (!typeface) return undefined
  const exact = findFont(typeface)
  if (exact) return exact.id
  if (MONO_HINT.test(typeface)) return 'IBM Plex Mono'
  if (SCRIPT_HINT.test(typeface)) return 'Caveat'
  if (DISPLAY_HINT.test(typeface)) return 'Oswald'
  if (SERIF_HINT.test(typeface)) return 'Merriweather'
  return undefined
}
