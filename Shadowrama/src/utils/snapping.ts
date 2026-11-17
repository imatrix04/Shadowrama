/**
 * Magnétisme sur un axe : calcul pur, hors du composant, pour être testable.
 *
 * L'ancienne version aimantait chaque bord (gauche, centre, droit) l'un après
 * l'autre en décalant le bloc à chaque fois, sans recalculer les autres : deux
 * bords proches d'une cible décalaient donc le bloc deux fois (sauts), et la
 * première cible trouvée l'emportait sur la plus proche. Ici, UNE seule
 * correction est choisie par axe — la plus petite — puis appliquée d'un bloc.
 */

export interface AxisSnap {
  /** Décalage à ajouter à la position brute (0 si rien n'est aimanté). */
  delta: number
  /** Positions des cibles réellement alignées après correction : les guides à tracer. */
  guides: number[]
}

/** Tolérance de comparaison flottante pour décider qu'une cible est « atteinte ». */
const EPSILON = 0.01

/**
 * @param sources    bords du bloc (ou de la sélection) : gauche, centre, droit…
 * @param targets    positions à rejoindre : bords du canevas, bords/centres des autres blocs
 * @param threshold  distance maximale d'attraction, dans le repère des positions
 */
export function snapAxis(sources: number[], targets: number[], threshold: number): AxisSnap {
  let best: number | null = null
  for (const source of sources) {
    for (const target of targets) {
      const delta = target - source
      if (Math.abs(delta) < threshold && (best === null || Math.abs(delta) < Math.abs(best))) {
        best = delta
      }
    }
  }
  if (best === null) return { delta: 0, guides: [] }

  // Une fois corrigé, plusieurs bords peuvent tomber sur des cibles : on les
  // trace toutes, pas seulement celle qui a décidé de la correction.
  const guides = new Set<number>()
  for (const source of sources) {
    for (const target of targets) {
      if (Math.abs(source + best - target) < EPSILON) guides.add(target)
    }
  }
  return { delta: best, guides: [...guides] }
}

/** Cible la plus proche d'une valeur, ou null si aucune n'est dans le seuil. */
export function nearestTarget(value: number, targets: number[], threshold: number): number | null {
  let best: number | null = null
  for (const target of targets) {
    const distance = Math.abs(value - target)
    if (distance < threshold && (best === null || distance < Math.abs(value - best))) best = target
  }
  return best
}
