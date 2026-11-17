import type { BlockUpdate } from './blockUpdates'

/** Format d'une diapositive (repère des blocs). */
export const SLIDE_WIDTH = 960
export const SLIDE_HEIGHT = 540

export interface Box {
  id: number
  x: number
  y: number
  width: number
  height: number
}

export type AlignMode = 'left' | 'centerX' | 'right' | 'top' | 'centerY' | 'bottom'
/** Sur quoi s'aligner : l'enveloppe de la sélection, ou la diapositive entière. */
export type AlignReference = 'selection' | 'slide'

type Rect = Omit<Box, 'id'>

/** Deux décimales suffisent et évitent d'accumuler du bruit flottant. */
const round = (v: number) => Math.round(v * 100) / 100

export function boundsOf(boxes: Rect[]): Rect {
  const left = Math.min(...boxes.map(b => b.x))
  const top = Math.min(...boxes.map(b => b.y))
  const right = Math.max(...boxes.map(b => b.x + b.width))
  const bottom = Math.max(...boxes.map(b => b.y + b.height))
  return { x: left, y: top, width: right - left, height: bottom - top }
}

/**
 * Alignement des blocs sur un bord ou un centre de la référence. Un seul bloc
 * n'a rien d'autre à qui s'aligner que la diapositive.
 *
 * Ne renvoie que les blocs qui bougent réellement : un lot vide ne crée pas
 * d'entrée d'historique (voir commitBlocks).
 */
export function alignBlocks(boxes: Box[], mode: AlignMode, reference: AlignReference): BlockUpdate[] {
  if (boxes.length === 0) return []
  const frame: Rect = reference === 'slide' || boxes.length === 1
    ? { x: 0, y: 0, width: SLIDE_WIDTH, height: SLIDE_HEIGHT }
    : boundsOf(boxes)

  const updates: BlockUpdate[] = []
  for (const b of boxes) {
    let x = b.x
    let y = b.y
    switch (mode) {
      case 'left': x = frame.x; break
      case 'centerX': x = frame.x + (frame.width - b.width) / 2; break
      case 'right': x = frame.x + frame.width - b.width; break
      case 'top': y = frame.y; break
      case 'centerY': y = frame.y + (frame.height - b.height) / 2; break
      case 'bottom': y = frame.y + frame.height - b.height; break
    }
    x = round(x)
    y = round(y)
    if (x !== b.x || y !== b.y) updates.push({ id: b.id, changes: { x, y } })
  }
  return updates
}

/**
 * Répartition à espaces égaux entre les bords : les deux blocs extrêmes ne
 * bougent pas, ceux du milieu s'étalent entre eux. Il faut au moins trois blocs.
 */
export function distributeBlocks(boxes: Box[], axis: 'x' | 'y'): BlockUpdate[] {
  if (boxes.length < 3) return []
  const pos = axis === 'x' ? 'x' : 'y'
  const size = axis === 'x' ? 'width' : 'height'

  const sorted = [...boxes].sort((a, b) => a[pos] - b[pos] || a.id - b.id)
  const start = sorted[0][pos]
  const end = Math.max(...sorted.map(b => b[pos] + b[size]))
  const total = sorted.reduce((sum, b) => sum + b[size], 0)
  const gap = (end - start - total) / (sorted.length - 1)

  const updates: BlockUpdate[] = []
  let cursor = start
  for (const b of sorted) {
    const next = round(cursor)
    if (next !== b[pos]) updates.push({ id: b.id, changes: { [pos]: next } })
    cursor += b[size] + gap
  }
  return updates
}
