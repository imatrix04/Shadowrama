import { useRef } from 'react'
import { polygonToPath, POLYGON_PRESETS, type ShapePolygon, type Point } from '../../utils/shapePolygon'
import styles from './PolygonShapeEditor.module.css'

interface Props {
  value: ShapePolygon | undefined
  onChange: (points: ShapePolygon) => void
  /** Rayon d'arrondi courant du bloc (même champ Arrondi que ShapeBlock),
   *  pour que l'aperçu dans l'éditeur corresponde à ce qui sera rendu. */
  radius?: number
}

const EMPTY: ShapePolygon = []

/**
 * Éditeur de forme personnalisée par points, en remplacement de l'ancienne
 * grille pixel art (voir GridShapeEditor / shapeGrid.ts) : rendu jugé trop
 * grossier. Arêtes droites entre les sommets par défaut ; l'arrondi (`radius`)
 * vient du même champ Arrondi que les autres formes, voir shapePolygon.ts.
 *
 * Clic sur le fond : ajoute un sommet, à la suite des précédents. Glisser un
 * sommet : le déplace (capture de pointeur sur le sommet lui-même, donc pas
 * besoin de listener `window` comme dans GridShapeEditor). Double-clic sur un
 * sommet : le supprime. La forme se referme automatiquement du dernier point
 * vers le premier — pas d'action de fermeture séparée à gérer, contrairement
 * à un éditeur de tracé classique.
 */
export default function PolygonShapeEditor({ value, onChange, radius = 0 }: Props) {
  const points = value ?? EMPTY
  const svgRef = useRef<SVGSVGElement>(null)

  const toNormalized = (e: { clientX: number; clientY: number }): Point => {
    const rect = svgRef.current!.getBoundingClientRect()
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height))
    return [x, y]
  }

  const path = polygonToPath(points, 100, 100, radius)

  return (
    <div className={styles.wrapper}>
      <div className={styles.canvasBox}>
        <svg
          ref={svgRef}
          className={styles.svg}
          viewBox="0 0 100 100"
          onClick={e => onChange([...points, toNormalized(e)])}
        >
          {/* Repères discrets pour situer le centre pendant la pose des points. */}
          <line x1={50} y1={0} x2={50} y2={100} className={styles.guideLine} strokeDasharray="2 3" />
          <line x1={0} y1={50} x2={100} y2={50} className={styles.guideLine} strokeDasharray="2 3" />

          {path && <path d={path} className={styles.preview} />}

          {points.map(([x, y], i) => (
            <circle
              key={i}
              cx={x * 100}
              cy={y * 100}
              r={3}
              className={styles.point}
              onPointerDown={e => {
                e.stopPropagation()
                ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
              }}
              onPointerMove={e => {
                if (e.buttons !== 1) return
                e.stopPropagation()
                const next = [...points]
                next[i] = toNormalized(e)
                onChange(next)
              }}
              onClick={e => e.stopPropagation()}
              onDoubleClick={e => {
                e.stopPropagation()
                onChange(points.filter((_, pi) => pi !== i))
              }}
            />
          ))}
        </svg>
      </div>

      <div className={styles.hint}>
        Clic : ajouter un point · glisser : déplacer · double-clic : supprimer
      </div>

      <div className={styles.presets}>
        <button type="button" className={styles.presetBtn} onClick={() => onChange([...EMPTY])}>
          Effacer
        </button>
        {POLYGON_PRESETS.map(p => (
          <button
            key={p.label}
            type="button"
            className={styles.presetBtn}
            onClick={() => onChange(p.points.map(pt => [...pt] as Point))}
          >
            {p.label}
          </button>
        ))}
      </div>
    </div>
  )
}