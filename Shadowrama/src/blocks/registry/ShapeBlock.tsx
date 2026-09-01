import type { BlockComponentProps, ShapeBlockData, ShapeKind } from '../../types'
import { gradientCss } from '../../ultra/effectStyle'
import { polygonToPath } from '../../utils/shapePolygon'

const DEFAULT_FILL = 'var(--accent)'
const DEFAULT_STROKE = 'var(--editor-text)'

interface Box { x: number; y: number; w: number; h: number }
type Point = [number, number]

/** Sommets de chaque forme polygonale, dans la boîte fournie. */
function shapePoints(shape: ShapeKind, { x, y, w, h }: Box): Point[] {
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

/**
 * Chemin SVG d'un polygone aux angles arrondis.
 *
 * `border-radius` n'existe pas pour un `<polygon>` : le champ « Arrondi » était
 * proposé pour toutes les formes mais n'agissait que sur le rectangle et le
 * cercle. On construit donc le tracé à la main — chaque sommet devient une
 * courbe quadratique qui rentre et ressort le long des deux arêtes.
 */
function roundedPolygonPath(points: Point[], radius: number): string {
  const n = points.length
  if (radius <= 0 || n < 3) {
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

export default function ShapeBlock({ block }: BlockComponentProps<ShapeBlockData>) {
  const shape = block.shape ?? 'rectangle'
  const borderWidth = Math.max(0, block.borderWidth ?? 0)
  // Mode Ultra : un dégradé prend le pas sur la couleur unie. En SVG il passe
  // par une définition <linearGradient>, la propriété `fill` n'acceptant pas de
  // valeur CSS `linear-gradient()`.
  const gradient = block.effects?.gradient
  const gradientId = `grad-${block.id}`
  const fill = gradient ? `url(#${gradientId})` : (block.backgroundColor ?? DEFAULT_FILL)
  const hasBorder = borderWidth > 0
  const stroke = hasBorder ? (block.borderColor ?? DEFAULT_STROKE) : 'none'

  // Rectangle et cercle restent en CSS : plus léger, et `border-radius` y est
  // natif. `box-sizing: border-box` garde la bordure à l'intérieur du bloc, là
  // où l'ancienne version la faisait dépasser avec un décalage négatif.
  if (shape === 'rectangle' || shape === 'circle') {
    return (
      <div style={{
        position: 'absolute',
        inset: 0,
        boxSizing: 'border-box',
        backgroundColor: gradient ? undefined : (block.backgroundColor ?? DEFAULT_FILL),
        backgroundImage: gradient ? gradientCss(gradient) : undefined,
        borderRadius: shape === 'circle' ? '50%' : `${block.borderRadius ?? 4}px`,
        border: hasBorder ? `${borderWidth}px solid ${stroke}` : 'none',
      }} />
    )
  }

  if (shape === 'grid') {
    const gridInset = borderWidth / 2
    const gridW = Math.max(1, block.width - borderWidth)
    const gridH = Math.max(1, block.height - borderWidth)
    const path = polygonToPath(block.customShape, gridW, gridH)
    return (
      <svg
        width="100%" height="100%"
        viewBox={`0 0 ${block.width} ${block.height}`}
        preserveAspectRatio="none"
        style={{ position: 'absolute', inset: 0, display: 'block' }}
      >
        {gradient && (
          <defs>
            <linearGradient id={gradientId} gradientTransform={`rotate(${gradient.angle} 0.5 0.5)`}>
              <stop offset="0%" stopColor={gradient.from} />
              <stop offset="100%" stopColor={gradient.to} />
            </linearGradient>
          </defs>
        )}
        {path && (
          <path
            d={path}
            fill={fill}
            stroke={stroke}
            strokeWidth={borderWidth}
            strokeLinejoin="round"
            transform={`translate(${gridInset} ${gridInset})`}
          />
        )}
      </svg>
    )
  }

  // La ligne n'a pas de surface : la couleur de fond lui sert de trait et la
  // largeur de bordure d'épaisseur. La rotation du bloc permet de l'incliner.
  if (shape === 'line') {
    const thickness = Math.max(2, borderWidth || 4)
    return (
      <svg
        width="100%" height="100%"
        viewBox={`0 0 ${block.width} ${block.height}`}
        preserveAspectRatio="none"
        style={{ position: 'absolute', inset: 0, display: 'block' }}
      >
        {gradient && (
          <defs>
            <linearGradient id={gradientId} gradientTransform={`rotate(${gradient.angle} 0.5 0.5)`}>
              <stop offset="0%" stopColor={gradient.from} />
              <stop offset="100%" stopColor={gradient.to} />
            </linearGradient>
          </defs>
        )}
        <line
          x1={thickness / 2} y1={block.height / 2}
          x2={block.width - thickness / 2} y2={block.height / 2}
          stroke={fill}
          strokeWidth={thickness}
          strokeLinecap="round"
        />
      </svg>
    )
  }

  // Le tracé est rentré d'une demi-épaisseur : le `stroke` SVG est centré sur le
  // chemin, la moitié débordait donc du bloc — et `overflow: visible` la laissait
  // même sortir de la zone de sélection.
  const inset = borderWidth / 2
  const box: Box = {
    x: inset,
    y: inset,
    w: Math.max(1, block.width - borderWidth),
    h: Math.max(1, block.height - borderWidth),
  }

  return (
    <svg
      width="100%" height="100%"
      viewBox={`0 0 ${block.width} ${block.height}`}
      preserveAspectRatio="none"
      style={{ position: 'absolute', inset: 0, display: 'block' }}
    >
        {gradient && (
          <defs>
            <linearGradient id={gradientId} gradientTransform={`rotate(${gradient.angle} 0.5 0.5)`}>
              <stop offset="0%" stopColor={gradient.from} />
              <stop offset="100%" stopColor={gradient.to} />
            </linearGradient>
          </defs>
        )}
      <path
        d={roundedPolygonPath(shapePoints(shape, box), block.borderRadius ?? 0)}
        fill={fill}
        stroke={stroke}
        strokeWidth={borderWidth}
        strokeLinejoin="round"
      />
    </svg>
  )
}