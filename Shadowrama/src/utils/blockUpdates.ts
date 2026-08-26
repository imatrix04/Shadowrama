import type { BlockData, Slide } from '../types'

/** Modification à appliquer à un bloc, dans un lot. */
export interface BlockUpdate {
  id: number
  changes: Partial<BlockData>
}

/**
 * Applique plusieurs modifications de blocs en UN SEUL parcours.
 *
 * Le déplacement d'une sélection émettait auparavant une mise à jour par bloc et
 * par frame, chacune reparcourant toutes les diapositives et tous leurs blocs :
 * déplacer vingt blocs coûtait vingt parcours complets, soixante fois par
 * seconde. Le lot ramène ça à un seul parcours.
 *
 * La fonction est volontairement pure et hors du composant : c'est le cœur de
 * toute édition de bloc, et il doit pouvoir être testé sans monter React.
 */
export function applyBlockUpdates(slides: Slide[], index: number, updates: BlockUpdate[]): Slide[] {
  if (updates.length === 0) return slides
  const byId = new Map(updates.map(u => [u.id, u.changes]))
  return slides.map((slide, i) => {
    if (i !== index) return slide
    return {
      ...slide,
      blocks: slide.blocks.map(b => {
        const changes = byId.get(b.id)
        return changes ? ({ ...b, ...changes } as BlockData) : b
      }),
    }
  })
}
