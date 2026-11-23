import type { ChartBlockData, ChartDatum, ChartEase } from '../types'

/** Palette par défaut : lisible sur fond clair comme sur fond sombre. */
export const CHART_PALETTE = [
  '#6c8cff', '#ff7a9c', '#4ed1a1', '#ffc857',
  '#b07cff', '#4fc3f7', '#ff9f5a', '#9ae66e',
]

export const MAX_CHART_DATA = 24
export const DEFAULT_CHART_INK = 'var(--slide-ink)'

export function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n))
}

/** Valeur exploitable : fini et positif, sinon 0. */
export function safeValue(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0
}

/** Couleur d'une donnée : la sienne, sinon la couleur unique, sinon la palette. */
export function datumColor(block: Pick<ChartBlockData, 'colorMode' | 'accentColor'>, datum: ChartDatum, index: number): string {
  if (datum.color) return datum.color
  if (block.colorMode === 'single') return block.accentColor ?? CHART_PALETTE[0]
  return CHART_PALETTE[index % CHART_PALETTE.length]
}

/**
 * Plus petit « beau » maximum au-dessus de la valeur (1, 2, 2.5, 5 × 10ⁿ), pour
 * que l'axe se gradue en nombres ronds. Renvoie aussi le pas de graduation.
 */
export function niceScale(max: number, ticks = 4): { max: number; step: number } {
  if (!(max > 0)) return { max: 1, step: 1 / ticks }
  const rough = max / ticks
  const magnitude = 10 ** Math.floor(Math.log10(rough))
  const normalized = rough / magnitude
  const factor = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 2.5 ? 2.5 : normalized <= 5 ? 5 : 10
  const step = factor * magnitude
  return { max: step * Math.ceil(max / step - 1e-9), step }
}

/** Courbes d'accélération de l'animation, de 0 à 1. */
export function easeProgress(kind: ChartEase | undefined, t: number): number {
  const x = clamp01(t)
  if (kind === 'linear') return x
  if (kind === 'bounce') {
    const c1 = 1.70158
    const c3 = c1 + 1
    return 1 + c3 * (x - 1) ** 3 + c1 * (x - 1) ** 2
  }
  return 1 - (1 - x) ** 3
}

/**
 * Avancement de la donnée `index` sur `count`, d'après l'avancement global `t`.
 * Sans cascade, toutes avancent ensemble ; avec, chacune démarre un peu après la précédente.
 */
export function itemProgress(t: number, index: number, count: number, cascade: boolean): number {
  if (!cascade || count < 2) return t
  const stagger = 0.6 / count
  return clamp01((t * (1 + stagger * (count - 1)) - stagger * index))
}

/** Nombre à la française, suivi de l'unité (« 42 % », « 1 200 k€ »). */
export function formatValue(value: number, unit = ''): string {
  const rounded = Math.abs(value) >= 100 ? Math.round(value) : Math.round(value * 10) / 10
  const text = rounded.toLocaleString('fr-FR')
  if (!unit) return text
  return unit === '%' || unit === '°' ? `${text}${unit}` : `${text} ${unit}`
}

/** Tracé d'une courbe passant par les points : segments droits ou lissage (Catmull-Rom → Bézier). */
export function linePath(points: [number, number][], smooth: boolean): string {
  if (points.length === 0) return ''
  if (points.length === 1 || !smooth) return `M ${points.map(p => `${p[0]} ${p[1]}`).join(' L ')}`
  const parts = [`M ${points[0][0]} ${points[0][1]}`]
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = points[i + 2] ?? p2
    const c1x = p1[0] + (p2[0] - p0[0]) / 6
    const c1y = p1[1] + (p2[1] - p0[1]) / 6
    const c2x = p2[0] - (p3[0] - p1[0]) / 6
    const c2y = p2[1] - (p3[1] - p1[1]) / 6
    parts.push(`C ${c1x} ${c1y} ${c2x} ${c2y} ${p2[0]} ${p2[1]}`)
  }
  return parts.join(' ')
}

/** Secteur d'anneau (ou de disque si `inner` vaut 0) entre deux angles, en radians depuis midi, sens horaire. */
export function arcPath(cx: number, cy: number, outer: number, inner: number, a0: number, a1: number): string {
  const sweep = a1 - a0
  if (sweep <= 0.0001) return ''
  // Un tour complet ne se dessine pas en un seul arc (points de départ et d'arrivée confondus).
  const end = sweep >= Math.PI * 2 - 0.0001 ? a0 + Math.PI * 2 - 0.0001 : a1
  const large = end - a0 > Math.PI ? 1 : 0
  const pt = (r: number, a: number) => [cx + r * Math.sin(a), cy - r * Math.cos(a)]
  const [x0, y0] = pt(outer, a0)
  const [x1, y1] = pt(outer, end)
  if (inner <= 0) {
    return `M ${cx} ${cy} L ${x0} ${y0} A ${outer} ${outer} 0 ${large} 1 ${x1} ${y1} Z`
  }
  const [x2, y2] = pt(inner, end)
  const [x3, y3] = pt(inner, a0)
  return `M ${x0} ${y0} A ${outer} ${outer} 0 ${large} 1 ${x1} ${y1} L ${x2} ${y2} A ${inner} ${inner} 0 ${large} 0 ${x3} ${y3} Z`
}

/** Nettoie une liste de données lue dans un projet ou fournie par l'assistant. */
export function normalizeChartData(raw: unknown, makeId: () => number): ChartDatum[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((d): d is Record<string, unknown> => !!d && typeof d === 'object')
    .slice(0, MAX_CHART_DATA)
    .map(d => ({
      id: typeof d.id === 'number' ? d.id : makeId(),
      label: typeof d.label === 'string' ? d.label.slice(0, 60) : '',
      value: safeValue(d.value),
      ...(typeof d.color === 'string' && d.color ? { color: d.color } : {}),
    }))
}
