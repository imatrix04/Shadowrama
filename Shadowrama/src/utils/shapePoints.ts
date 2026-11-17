import type { ShapeKind } from '../types'

/**
 * Sommets des formes polygonales intégrées (triangle, hexagone, étoile,
 * flèches). Partagé entre le rendu (ShapeBlock) et l'export PowerPoint, pour
 * que la forme exportée soit exactement celle affichée.
 */

export interface Box { x: number; y: number; w: number; h: number }
export type Point = [number, number]

/** Sommets de chaque forme polygonale, dans la boîte fournie. */
export function shapePoints(shape: ShapeKind, { x, y, w, h }: Box): Point[] {
  const cx = x + w / 2
  const cy = y + h / 2
  const right = x + w
  const bottom = y + h
  // Épaules des flèches, à 30 % et 70 % de la largeur (ou de la hauteur).
  const nearX = x + w * 0.3
  const farX = x + w * 0.7
  const nearY = y + h * 0.3
  const farY = y + h * 0.7

  switch (shape) {
    case 'triangle':
      return [[cx, y], [x, bottom], [right, bottom]]

    case 'hexagon': {
      const q = w / 4
      return [[x + q, y], [right - q, y], [right, cy], [right - q, bottom], [x + q, bottom], [x, cy]]
    }

    case 'star': {
      // Cinq branches : on alterne rayon externe et interne tous les 36°.
      const rx = w / 2
      const ry = h / 2
      const points: Point[] = []
      for (let i = 0; i < 10; i++) {
        const ratio = i % 2 === 0 ? 1 : 0.42
        const angle = (Math.PI / 5) * i - Math.PI / 2
        points.push([cx + Math.cos(angle) * rx * ratio, cy + Math.sin(angle) * ry * ratio])
      }
      return points
    }

    case 'arrow-up':
      return [[cx, y], [right, cy], [farX, cy], [farX, bottom], [nearX, bottom], [nearX, cy], [x, cy]]

    case 'arrow-down':
      return [[cx, bottom], [right, cy], [farX, cy], [farX, y], [nearX, y], [nearX, cy], [x, cy]]

    case 'arrow-right':
      return [[right, cy], [cx, bottom], [cx, farY], [x, farY], [x, nearY], [cx, nearY], [cx, y]]

    case 'arrow-left':
      return [[x, cy], [cx, bottom], [cx, farY], [right, farY], [right, nearY], [cx, nearY], [cx, y]]

    default:
      return [[x, y], [right, y], [right, bottom], [x, bottom]]
  }
}
