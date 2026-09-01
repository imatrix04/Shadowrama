/**
 * Forme personnalisée par points, en remplacement de l'ancienne grille 10×10
 * (voir git blame shapeGrid.ts) : rendu pixel art jugé trop grossier.
 *
 * Un polygone = liste de sommets normalisés (0–1) relatifs à la boîte du
 * bloc, dans l'ordre de pose. Normalisé plutôt qu'en pixels réels pour rester
 * valide si le bloc est redimensionné après coup.
 *
 * Le tracé relie les sommets par des arêtes droites, avec un unique rayon
 * d'arrondi qui coupe chaque coin (même technique que `shapePoints` +
 * l'ancien `roundedPolygonPath` de ShapeBlock.tsx pour triangle/hexagone/
 * étoile/flèches — mutualisée ici plutôt que dupliquée). Arrondi à 0 : arêtes
 * nettes. Un seul champ pour toute la forme, pas de réglage séparé par côté :
 * il n'y a qu'un seul type d'arête (droite) à arrondir, donc rien à gagner à
 * distinguer « côtés » et « arêtes » ici.
 */
export type Point = [number, number]
export type ShapePolygon = Point[]

const MIN_POINTS = 3

/**
 * Une forme lue depuis un `.shma` peut être corrompue ou éditée à la main :
 * on ne garde que des paires de nombres finis, bornées sur [0, 1].
 *
 * Ne filtre PAS sur un nombre minimum de sommets : ce serait confondre
 * « format valide » et « forme qu'on peut tracer ». Ce dernier point est du
 * ressort de `polygonToPath` (voir MIN_POINTS ci-dessous) — le distinguer ici
 * évite qu'un polygone à 1 ou 2 points, valide pendant qu'on le dessine dans
 * l'éditeur, ne soit effacé à chaque re-render tant qu'il n'a pas 3 sommets.
 */
export function normalizePolygon(raw: unknown): ShapePolygon | undefined {
  if (!Array.isArray(raw)) return undefined
  const points: ShapePolygon = []
  for (const entry of raw) {
    if (!Array.isArray(entry) || entry.length !== 2) continue
    const [x, y] = entry
    if (typeof x !== 'number' || typeof y !== 'number') continue
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue
    points.push([Math.max(0, Math.min(1, x)), Math.max(0, Math.min(1, y))])
  }
  return points.length > 0 ? points : undefined
}

/**
 * Chemin SVG d'un polygone aux angles arrondis, dans le système de
 * coordonnées des points fournis (pixels réels ou viewBox abstrait selon
 * l'appelant). `radius <= 0` : arêtes droites, sommets nets. Sinon, chaque
 * sommet devient une courbe quadratique qui rentre et ressort le long des
 * deux arêtes — identique à la technique déjà utilisée pour les formes
 * intégrées (triangle, hexagone, étoile, flèches), pour un rendu cohérent
 * dans toute l'app.
 */
export function roundedPolygonPath(points: Point[], radius: number): string {
  const n = points.length
  if (n < MIN_POINTS) return ''
  if (radius <= 0) {
    return `M ${points.map(p => p.join(' ')).join(' L ')} Z`
  }

  const segments: string[] = []

  for (let i = 0; i < n; i++) {
    const prev = points[(i - 1 + n) % n]
    const curr = points[i]
    const next = points[(i + 1) % n]

    const toPrev = [prev[0] - curr[0], prev[1] - curr[1]]
    const toNext = [next[0] - curr[0], next[1] - curr[1]]
    const lenPrev = Math.hypot(toPrev[0], toPrev[1]) || 1
    const lenNext = Math.hypot(toNext[0], toNext[1]) || 1

    // Le rayon ne peut dépasser la moitié de l'arête la plus courte, sinon les
    // courbes de deux sommets voisins se chevauchent.
    const r = Math.min(radius, lenPrev / 2, lenNext / 2)

    const start: Point = [curr[0] + (toPrev[0] / lenPrev) * r, curr[1] + (toPrev[1] / lenPrev) * r]
    const end: Point = [curr[0] + (toNext[0] / lenNext) * r, curr[1] + (toNext[1] / lenNext) * r]

    segments.push(
      `${i === 0 ? 'M' : 'L'} ${start[0]} ${start[1]}`,
      `Q ${curr[0]} ${curr[1]} ${end[0]} ${end[1]}`,
    )
  }

  return `${segments.join(' ')} Z`
}

/**
 * Chemin SVG du polygone, dans le système de coordonnées réel du bloc — pas
 * un viewBox abstrait — pour que l'épaisseur de bordure et le rayon
 * d'arrondi du bloc forme restent cohérents même sur un bloc non carré.
 *
 * Passe par `normalizePolygon` en interne : appelé directement depuis le
 * rendu (ShapeBlock, ImageBlock) avec les données brutes d'un `.shma`, qui
 * peuvent encore porter l'ancien format grille (`number[]` de bitmasks) sur
 * un projet ouvert depuis une version antérieure. Sans ce filtre, un entier
 * comme `1020` remonte tel quel jusqu'au `.map(([x, y]) => ...)` plus bas et
 * fait planter le rendu (un number n'est pas itérable).
 */
export function polygonToPath(polygon: unknown, width: number, height: number, radius = 0): string {
  const normalized = normalizePolygon(polygon)
  if (!normalized || normalized.length < MIN_POINTS) return ''
  const pixelPoints: Point[] = normalized.map(([x, y]) => [x * width, y * height])
  return roundedPolygonPath(pixelPoints, radius)
}

/**
 * Data URI d'un masque CSS (`mask-image`), pour découper une image dans la
 * forme du polygone. Viewbox abstrait 0–100 : `mask-size: 100% 100%` en JSX
 * l'étire ensuite au bloc réel (même logique que l'ancien `gridToMaskDataUri`).
 *
 * `radius` est donné en pixels réels du bloc (même champ Arrondi que
 * ShapeBlock) : on le convertit dans l'échelle abstraite 0–100 en le
 * rapportant au plus petit côté du bloc, pour qu'il reste visuellement
 * proportionné même si l'image n'est pas carrée — `width`/`height` doivent
 * donc être les dimensions réelles du bloc, pas celles du viewBox.
 */
export function polygonToMaskDataUri(polygon: unknown, radius = 0, width = 1, height = 1): string | undefined {
  const abstractRadius = radius > 0 ? (radius * 100) / Math.max(1, Math.min(width, height)) : 0
  const path = polygonToPath(polygon, 100, 100, abstractRadius)
  if (!path) return undefined
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="${path}" fill="#000"/></svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

/** Presets de base, prêts à l'emploi dans l'éditeur de polygone. */
export const POLYGON_PRESETS: { label: string; points: ShapePolygon }[] = [
  {
    label: 'Cercle',
    points: Array.from({ length: 24 }, (_, i) => {
      const a = (i / 24) * Math.PI * 2 - Math.PI / 2
      return [0.5 + 0.48 * Math.cos(a), 0.5 + 0.48 * Math.sin(a)] as Point
    }),
  },
  {
    label: 'Étoile',
    points: Array.from({ length: 10 }, (_, i) => {
      const ratio = i % 2 === 0 ? 1 : 0.42
      const a = (Math.PI / 5) * i - Math.PI / 2
      return [0.5 + 0.48 * ratio * Math.cos(a), 0.5 + 0.48 * ratio * Math.sin(a)] as Point
    }),
  },
  {
    label: 'Diamant',
    points: [[0.5, 0.02], [0.98, 0.5], [0.5, 0.98], [0.02, 0.5]],
  },
  {
    label: 'Croix',
    points: [
      [0.35, 0.02], [0.65, 0.02], [0.65, 0.35], [0.98, 0.35],
      [0.98, 0.65], [0.65, 0.65], [0.65, 0.98], [0.35, 0.98],
      [0.35, 0.65], [0.02, 0.65], [0.02, 0.35], [0.35, 0.35],
    ],
  },
  {
    label: 'Éclair',
    points: [
      [0.58, 0.02], [0.22, 0.52], [0.46, 0.52],
      [0.34, 0.98], [0.82, 0.4], [0.54, 0.4],
    ],
  },
  {
    // Sommets échantillonnés sur la courbe paramétrique classique du cœur
    // (x = 16sin³t, y = 13cos t − 5cos 2t − 2cos 3t − cos 4t), normalisés.
    label: 'Cœur',
    points: [
      [0.5, 0.26], [0.51, 0.21], [0.57, 0.11], [0.71, 0.03],
      [0.86, 0.07], [0.97, 0.2], [0.97, 0.38], [0.86, 0.54],
      [0.71, 0.69], [0.57, 0.82], [0.51, 0.93], [0.5, 0.97],
      [0.49, 0.93], [0.43, 0.82], [0.29, 0.69], [0.14, 0.54],
      [0.03, 0.38], [0.03, 0.2], [0.14, 0.07], [0.29, 0.03],
      [0.43, 0.11], [0.49, 0.21],
    ],
  },
]