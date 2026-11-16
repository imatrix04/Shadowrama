import type { ShapeKind } from '../../types'
import { attr, kid, kids, numAttr } from './xml'
import { r1 } from './context'
import type { Box } from './context'

/**
 * Géométries : formes prédéfinies et tracés libres, ramenés aux formes de Shadowrama.
 */

// ── Géométries ───────────────────────────────────────────────────────────────

export type Pt = [number, number]

export interface ShapeSpec {
  shape: ShapeKind
  borderRadius: number
  customShape?: Pt[]
  /** Forme approchée par un rectangle : à signaler. */
  approximated?: string
}

export const POLYGONS: Record<string, Pt[]> = {
  diamond: [[0.5, 0], [1, 0.5], [0.5, 1], [0, 0.5]],
  parallelogram: [[0.2, 0], [1, 0], [0.8, 1], [0, 1]],
  trapezoid: [[0.2, 0], [0.8, 0], [1, 1], [0, 1]],
  pentagon: [[0.5, 0], [1, 0.38], [0.81, 1], [0.19, 1], [0, 0.38]],
  homePlate: [[0, 0], [0.75, 0], [1, 0.5], [0.75, 1], [0, 1]],
  chevron: [[0, 0], [0.7, 0], [1, 0.5], [0.7, 1], [0, 1], [0.3, 0.5]],
  octagon: [[0.29, 0], [0.71, 0], [1, 0.29], [1, 0.71], [0.71, 1], [0.29, 1], [0, 0.71], [0, 0.29]],
  snip1Rect: [[0, 0], [0.85, 0], [1, 0.15], [1, 1], [0, 1]],
  rtTriangle: [[0, 0], [1, 1], [0, 1]],
}

/** Réglage d'arrondi d'une forme prédéfinie : `<a:gd name="adj" fmla="val 4376"/>`. */
export function readAdjust(prstEl: Element | null): number | undefined {
  const guides = kids(kid(prstEl, 'avLst'), 'gd')
  const guide = guides.find(g => attr(g, 'name') === 'adj') ?? guides[0]
  const match = /val\s+(-?\d+)/.exec(attr(guide, 'fmla') ?? '')
  return match ? Number(match[1]) : undefined
}

export function presetSpec(prst: string, adj: number | undefined, box: Box): ShapeSpec {
  switch (prst) {
    case 'rect':
    case 'flowChartProcess':
      return { shape: 'rectangle', borderRadius: 0 }
    case 'roundRect': {
      const ratio = (adj ?? 16667) / 100000
      return { shape: 'rectangle', borderRadius: r1(Math.min(box.w, box.h) * Math.min(ratio, 0.5)) }
    }
    case 'ellipse':
    case 'flowChartConnector':
      return { shape: 'circle', borderRadius: 0 }
    case 'triangle':
      return { shape: 'triangle', borderRadius: 0 }
    case 'rightArrow': return { shape: 'arrow-right', borderRadius: 0 }
    case 'leftArrow': return { shape: 'arrow-left', borderRadius: 0 }
    case 'upArrow': return { shape: 'arrow-up', borderRadius: 0 }
    case 'downArrow': return { shape: 'arrow-down', borderRadius: 0 }
    case 'star5': return { shape: 'star', borderRadius: 0 }
    case 'hexagon': return { shape: 'hexagon', borderRadius: 0 }
    case 'line':
    case 'straightConnector1':
      return { shape: 'line', borderRadius: 0 }
    default: {
      const poly = POLYGONS[prst]
      if (poly) return { shape: 'grid', borderRadius: 0, customShape: poly }
      return { shape: 'rectangle', borderRadius: 0, approximated: prst }
    }
  }
}

/** Aplatit un tracé personnalisé (`custGeom`) en polygone normalisé 0–1. */
export function custGeomToPolygon(cust: Element): Pt[] | undefined {
  const pathEl = kid(kid(cust, 'pathLst'), 'path')
  if (!pathEl) return undefined
  const w = numAttr(pathEl, 'w')
  const h = numAttr(pathEl, 'h')
  if (!w || !h) return undefined

  const pts: Pt[] = []
  let cur: Pt = [0, 0]
  const point = (p: Element | null): Pt => [numAttr(p, 'x') ?? 0, numAttr(p, 'y') ?? 0]

  for (const cmd of kids(pathEl)) {
    switch (cmd.localName) {
      case 'moveTo':
      case 'lnTo': {
        cur = point(kid(cmd, 'pt'))
        pts.push(cur)
        break
      }
      case 'arcTo': {
        const wR = numAttr(cmd, 'wR') ?? 0
        const hR = numAttr(cmd, 'hR') ?? 0
        const st = ((numAttr(cmd, 'stAng') ?? 0) / 60000) * (Math.PI / 180)
        const sw = ((numAttr(cmd, 'swAng') ?? 0) / 60000) * (Math.PI / 180)
        const cx = cur[0] - wR * Math.cos(st)
        const cy = cur[1] - hR * Math.sin(st)
        const steps = 6
        for (let i = 1; i <= steps; i++) {
          const a = st + (sw * i) / steps
          cur = [cx + wR * Math.cos(a), cy + hR * Math.sin(a)]
          pts.push(cur)
        }
        break
      }
      case 'quadBezTo':
      case 'cubicBezTo': {
        const ctrl = kids(cmd, 'pt').map(p => point(p))
        const start = cur
        const steps = 8
        for (let i = 1; i <= steps; i++) {
          const t = i / steps
          const u = 1 - t
          if (ctrl.length === 2) {
            cur = [
              u * u * start[0] + 2 * u * t * ctrl[0][0] + t * t * ctrl[1][0],
              u * u * start[1] + 2 * u * t * ctrl[0][1] + t * t * ctrl[1][1],
            ]
          } else if (ctrl.length === 3) {
            cur = [
              u ** 3 * start[0] + 3 * u * u * t * ctrl[0][0] + 3 * u * t * t * ctrl[1][0] + t ** 3 * ctrl[2][0],
              u ** 3 * start[1] + 3 * u * u * t * ctrl[0][1] + 3 * u * t * t * ctrl[1][1] + t ** 3 * ctrl[2][1],
            ]
          }
          pts.push(cur)
        }
        break
      }
      default:
        break
    }
  }

  // Points consécutifs identiques : ils ne servent à rien et gênent l'arrondi.
  const clean = pts.filter((p, i) => i === 0 || Math.abs(p[0] - pts[i - 1][0]) + Math.abs(p[1] - pts[i - 1][1]) > 0.5)
  if (clean.length < 3) return undefined
  return clean.map(([x, y]) => [
    Math.min(1, Math.max(0, Math.round((x / w) * 1000) / 1000)),
    Math.min(1, Math.max(0, Math.round((y / h) * 1000) / 1000)),
  ])
}
