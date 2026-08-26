import type { BlockData } from '../types'

/**
 * Presse-papiers interne aux blocs (Ctrl+C / Ctrl+X / Ctrl+V).
 *
 * Volontairement séparé du presse-papiers système : un bloc n'est pas du texte,
 * et le sérialiser en `text/plain` obligerait à distinguer un vrai collage de
 * texte d'un collage de bloc. Le contenu vit donc en mémoire, pour la durée de
 * la session.
 */

/** Décalage appliqué quand un collage recouvrirait l'original. */
const PASTE_OFFSET = 16

interface ClipboardEntry {
  blocks: BlockData[]
  /** Diapositive d'où viennent les blocs, pour savoir si la place est libre. */
  sourceSlideId: number
  /** Un couper libère la place : le premier collage reprend la position exacte. */
  mode: 'copy' | 'cut'
  pasted: boolean
  /** Nombre de crans de décalage du dernier collage, pour les enchaîner. */
  lastSteps: number
}

let entry: ClipboardEntry | null = null

// Copie profonde : les blocs restent modifiables après un Ctrl+C sans que le
// presse-papiers suive les changements (`effects` et `motion` sont imbriqués,
// une copie de surface les partagerait).
function clone(blocks: BlockData[]): BlockData[] {
  return blocks.map(b => structuredClone(b))
}

export function writeClipboard(blocks: BlockData[], sourceSlideId: number, mode: 'copy' | 'cut') {
  if (blocks.length === 0) return
  entry = { blocks: clone(blocks), sourceSlideId, mode, pasted: false, lastSteps: 0 }
}

export function hasClipboard(): boolean {
  return entry !== null && entry.blocks.length > 0
}

/**
 * Rend une copie des blocs à insérer et le décalage à leur appliquer.
 * Le presse-papiers n'est pas vidé : on peut coller plusieurs fois.
 */
export function readClipboard(targetSlideId: number): { blocks: BlockData[]; shift: number } | null {
  if (!entry || entry.blocks.length === 0) return null

  // Rien à recouvrir — autre diapositive, ou blocs coupés — donc on conserve la
  // position d'origine. Les collages suivants se décalent en cascade.
  const placeIsFree = !entry.pasted && (entry.mode === 'cut' || targetSlideId !== entry.sourceSlideId)
  const steps = placeIsFree ? 0 : entry.lastSteps + 1

  entry.pasted = true
  entry.lastSteps = steps

  return { blocks: clone(entry.blocks), shift: steps * PASTE_OFFSET }
}

/**
 * Clés média retenues par le presse-papiers.
 *
 * Sans elles, couper une image puis enregistrer le projet purgerait le média
 * (plus aucun bloc ne le référence) et le collage suivant ne montrerait qu'un
 * cadre vide.
 */
export function clipboardMediaKeys(): string[] {
  if (!entry) return []
  return entry.blocks
    .filter((b): b is Extract<BlockData, { type: 'image' }> => b.type === 'image')
    .map(b => b.src)
    .filter(src => src?.startsWith('media/'))
}
