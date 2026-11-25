/**
 * Présentation des blocs dans la palette (catégorie, accroche, mots-clés).
 *
 * Ces informations ne servent qu'à l'affichage : elles vivent ici et non dans
 * `BlockConfig`, qui décrit ce qu'EST un bloc (propriétés, valeurs par défaut).
 * Un type absent de cette table reste proposé, dans la catégorie « Autres ».
 */

export type BlockCategory = 'text' | 'media' | 'data' | 'misc'

export const BLOCK_CATEGORIES: { id: BlockCategory; label: string; hue: string }[] = [
  { id: 'text', label: 'Texte', hue: '#8b7cff' },
  { id: 'media', label: 'Médias', hue: '#ff7a9c' },
  { id: 'data', label: 'Données', hue: '#4ed1a1' },
  { id: 'misc', label: 'Formes & web', hue: '#ffb347' },
]

interface BlockMeta {
  category: BlockCategory
  /** Une ligne sous le nom, pour savoir à quoi sert le bloc sans l'essayer. */
  tagline: string
  /** Mots que l'on peut taper dans la recherche, en plus du nom. */
  keywords: string
}

const META: Record<string, BlockMeta> = {
  text: { category: 'text', tagline: 'Paragraphe libre', keywords: 'texte paragraphe écrire légende' },
  title: { category: 'text', tagline: 'Grand titre accrocheur', keywords: 'titre heading en-tête accroche' },
  image: { category: 'media', tagline: 'Photo ou illustration', keywords: 'image photo illustration logo' },
  video: { category: 'media', tagline: 'Lecture intégrée', keywords: 'vidéo film clip mp4' },
  carousel: { category: 'media', tagline: 'Galerie qui défile', keywords: 'carrousel galerie diaporama images' },
  table: { category: 'data', tagline: 'Lignes et colonnes', keywords: 'tableau grille cellules excel csv' },
  chart: { category: 'data', tagline: 'Barres, courbes, camemberts', keywords: 'graphique chart histogramme camembert courbe statistiques' },
  shape: { category: 'misc', tagline: 'Rectangle, cercle, flèche…', keywords: 'forme rectangle cercle triangle étoile flèche ligne' },
  webview: { category: 'misc', tagline: 'Site web en direct', keywords: 'page web site internet navigateur url' },
}

const FALLBACK: BlockMeta = { category: 'misc', tagline: '', keywords: '' }

export function blockMeta(type: string): BlockMeta {
  return META[type] ?? FALLBACK
}

const normalize = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/** Le bloc correspond-il à la recherche ? Insensible à la casse et aux accents. */
export function matchesBlock(label: string, type: string, query: string): boolean {
  const q = normalize(query.trim())
  if (!q) return true
  const meta = blockMeta(type)
  return normalize(`${label} ${meta.tagline} ${meta.keywords}`).includes(q)
}
