import type { Slide, SlideNumbering } from '../types'
import { normalizeHex } from './color'

/**
 * Couleurs réellement utilisées dans le projet, pour la ligne « Du projet » du
 * sélecteur : rester cohérent d'une diapositive à l'autre sans les retaper.
 */

/** Champs qui portent une couleur, directement sur un bloc. */
const BLOCK_COLOR_KEYS = ['color', 'backgroundColor', 'borderColor', 'controlColor'] as const

type Counter = Map<string, number>

function count(counter: Counter, value: unknown) {
  if (typeof value !== 'string') return
  // « transparent », « var(--x) » et autres valeurs non hexadécimales sont ignorées.
  const hex = normalizeHex(value)
  if (hex) counter.set(hex, (counter.get(hex) ?? 0) + 1)
}

/**
 * Du plus utilisé au moins utilisé (à égalité : ordre d'apparition), plafonné.
 * Parcourt blocs, effets, fonds, particules et numérotation.
 */
export function collectProjectColors(slides: Slide[], numbering: SlideNumbering, max = 12): string[] {
  const counter: Counter = new Map()

  for (const slide of slides) {
    for (const block of slide.blocks) {
      const fields = block as unknown as Record<string, unknown>
      for (const key of BLOCK_COLOR_KEYS) count(counter, fields[key])
      const fx = block.effects
      if (fx) {
        count(counter, fx.shadow?.color)
        count(counter, fx.glow?.color)
        count(counter, fx.gradient?.from)
        count(counter, fx.gradient?.to)
        count(counter, fx.textStroke?.color)
      }
    }

    const bg = slide.background
    if (bg) {
      count(counter, bg.color)
      count(counter, bg.gradient?.from)
      count(counter, bg.gradient?.to)
      count(counter, bg.overlay?.color)
      bg.particles?.colors.forEach(c => count(counter, c))
      count(counter, bg.particles?.links.color)
    }
  }

  count(counter, numbering.color)

  // Le tri d'un tableau est stable : à nombre égal, l'ordre d'insertion est gardé.
  return [...counter.entries()].sort((a, b) => b[1] - a[1]).slice(0, max).map(([hex]) => hex)
}
