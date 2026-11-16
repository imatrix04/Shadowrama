import { kid, kids, numAttr, path } from './xml'
import { readColor, readSolid } from './theme'
import type { ColorValue, ThemeContext } from './theme'
import { EMU_PER_PT, r1 } from './context'
import type { Ctx } from './context'

/**
 * Couleurs, remplissages et contours des formes.
 */

// ── Couleurs et remplissages ─────────────────────────────────────────────────

export type Fill =
  | { kind: 'none' }
  | { kind: 'solid'; color: ColorValue }
  | { kind: 'gradient'; from: ColorValue; to: ColorValue; angle: number }
  | { kind: 'unsupported'; what: string }

export function readGradient(grad: Element, theme: ThemeContext, phColor?: string): Fill {
  const stops = kids(kid(grad, 'gsLst'), 'gs')
    .map(gs => ({ pos: numAttr(gs, 'pos') ?? 0, color: readColor(kids(gs)[0], theme, phColor) }))
    .filter((s): s is { pos: number; color: ColorValue } => !!s.color)
    .sort((a, b) => a.pos - b.pos)
  if (stops.length === 0) return { kind: 'none' }
  const lin = kid(grad, 'lin')
  // OOXML : 0° = vers la droite, sens horaire. CSS : 0° = vers le haut.
  const angle = ((numAttr(lin, 'ang') ?? 5400000) / 60000 + 90) % 360
  return { kind: 'gradient', from: stops[0].color, to: stops[stops.length - 1].color, angle }
}

export function readFillElement(el: Element, theme: ThemeContext, phColor?: string): Fill | undefined {
  switch (el.localName) {
    case 'noFill': return { kind: 'none' }
    case 'solidFill': {
      const color = readSolid(el, theme, phColor)
      return color ? { kind: 'solid', color } : { kind: 'none' }
    }
    case 'gradFill': return readGradient(el, theme, phColor)
    case 'pattFill': {
      const color = readSolid(kid(el, 'fgClr'), theme, phColor)
      return color ? { kind: 'solid', color } : { kind: 'none' }
    }
    case 'blipFill': return { kind: 'unsupported', what: 'remplissage par image' }
    default: return undefined
  }
}

export const FILL_NAMES = ['noFill', 'solidFill', 'gradFill', 'pattFill', 'blipFill', 'grpFill']

/** Remplissage d'une forme : explicite d'abord, sinon celui du style du thème. */
export function resolveShapeFill(spPr: Element | null, sp: Element, theme: ThemeContext): Fill {
  for (const child of kids(spPr)) {
    if (!FILL_NAMES.includes(child.localName)) continue
    const fill = readFillElement(child, theme)
    if (fill) return fill
  }
  const ref = path(sp, 'style', 'fillRef')
  if (ref && (numAttr(ref, 'idx') ?? 0) > 0) {
    const color = readColor(kids(ref)[0], theme)
    if (color) return { kind: 'solid', color }
  }
  return { kind: 'none' }
}

export interface Stroke {
  color: string
  /** Pixels. */
  width: number
}

export function resolveStroke(spPr: Element | null, sp: Element, ctx: Ctx): Stroke | undefined {
  const ln = kid(spPr, 'ln')
  if (ln) {
    const widthEmu = numAttr(ln, 'w') ?? EMU_PER_PT
    for (const child of kids(ln)) {
      if (child.localName === 'noFill') return undefined
      if (child.localName === 'solidFill') {
        const color = readSolid(child, ctx.theme)
        if (color) return { color: color.hex, width: Math.max(0.5, r1(widthEmu * ctx.frame.k)) }
      }
      if (child.localName === 'gradFill') {
        const g = readGradient(child, ctx.theme)
        if (g.kind === 'gradient') return { color: g.from.hex, width: Math.max(0.5, r1(widthEmu * ctx.frame.k)) }
      }
    }
  }
  const ref = path(sp, 'style', 'lnRef')
  if (!ln && ref && (numAttr(ref, 'idx') ?? 0) > 0) {
    const color = readColor(kids(ref)[0], ctx.theme)
    if (color) return { color: color.hex, width: Math.max(0.5, r1(EMU_PER_PT * ctx.frame.k)) }
  }
  return undefined
}
