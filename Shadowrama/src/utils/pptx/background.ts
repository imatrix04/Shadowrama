import type { SlideBackground, SlideTransitionSettings } from '../../types'
import { attr, descendants, kid, kids, numAttr, path, relAttr } from './xml'
import { readColor } from './theme'
import type { Part, Ctx } from './context'
import { readFillElement } from './fills'

/**
 * Fond et transition d'une diapositive.
 */

// ── Fonds et transitions ─────────────────────────────────────────────────────

export function backgroundOf(part: Part | null, ctx: Ctx): SlideBackground | undefined {
  const bg = path(part?.root, 'cSld', 'bg')
  if (!bg) return undefined
  const bgPr = kid(bg, 'bgPr')
  if (bgPr) {
    for (const child of kids(bgPr)) {
      if (child.localName === 'blipFill') {
        const embed = relAttr(kid(child, 'blip'), 'embed')
        const key = embed ? part?.images.get(embed) : undefined
        if (key) return { type: 'image', image: key, imageFit: 'cover', color: '#1a1a2e' }
        ctx.report.add(ctx.slideNo, 'Fond image dans un format non pris en charge.')
        return undefined
      }
      const fill = readFillElement(child, ctx.theme)
      if (!fill) continue
      if (fill.kind === 'solid') return { type: 'color', color: fill.color.hex }
      if (fill.kind === 'gradient') {
        return {
          type: 'gradient',
          // Hors mode Ultra seul `color` est lu : la première couleur sert de repli.
          color: fill.from.hex,
          gradient: { from: fill.from.hex, to: fill.to.hex, angle: Math.round(fill.angle) },
        }
      }
    }
    return undefined
  }
  const ref = kid(bg, 'bgRef')
  const color = readColor(kids(ref)[0], ctx.theme)
  return color ? { type: 'color', color: color.hex } : undefined
}

export function transitionOf(slideRoot: Element): SlideTransitionSettings | undefined {
  const tr = descendants(slideRoot, 'transition')[0]
  if (!tr) return undefined
  const effect = kids(tr).find(k => k.localName !== 'sndAc')
  if (!effect) return undefined
  const dir = attr(effect, 'dir')
  let preset: string | undefined
  switch (effect.localName) {
    case 'fade': preset = 'fade'; break
    case 'push':
    case 'cover':
    case 'pull':
    case 'wipe':
      preset = dir === 'u' || dir === 'd' ? 'slide-up' : 'slide'
      break
    case 'zoom': preset = 'zoom'; break
    case 'cut': return undefined
    default: preset = 'fade'
  }
  const dur = numAttr(tr, 'dur')
  const speed = dur ? Math.min(3, Math.max(0.25, 600 / dur)) : undefined
  return { preset, ...(speed && Math.abs(speed - 1) > 0.05 ? { speed: Math.round(speed * 100) / 100 } : {}) }
}
