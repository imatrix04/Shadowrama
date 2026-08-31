import { useRef, useEffect } from 'react'
import { GRID_SIZE, EMPTY_GRID, isCellSet, toggleCell, GRID_PRESETS, type ShapeGrid } from '../../utils/shapeGrid'
import styles from './GridShapeEditor.module.css'

interface Props {
  value: ShapeGrid | undefined
  onChange: (grid: ShapeGrid) => void
}

export default function GridShapeEditor({ value, onChange }: Props) {
  const grid = value ?? EMPTY_GRID
  // Le premier clic décide si on peint ou on efface ; le survol qui suit tant
  // que le bouton reste enfoncé applique la même valeur, sans redéclencher de
  // mousedown par cellule traversée.
  const paintValue = useRef<boolean | null>(null)

  useEffect(() => {
    const reset = () => { paintValue.current = null }
    window.addEventListener('mouseup', reset)
    return () => window.removeEventListener('mouseup', reset)
  }, [])

  const paint = (row: number, col: number, forced: boolean) => {
    onChange(toggleCell(grid, row, col, forced))
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.grid} onMouseLeave={() => { /* le listener window gère le relâchement hors grille */ }}>
        {Array.from({ length: GRID_SIZE }).map((_, row) => (
          <div key={row} className={styles.row}>
            {Array.from({ length: GRID_SIZE }).map((_, col) => {
              const active = isCellSet(grid, row, col)
              return (
                <div
                  key={col}
                  className={`${styles.cell} ${active ? styles.cellActive : ''}`}
                  onMouseDown={e => {
                    e.preventDefault()
                    paintValue.current = !active
                    paint(row, col, !active)
                  }}
                  onMouseEnter={() => {
                    if (paintValue.current !== null) paint(row, col, paintValue.current)
                  }}
                />
              )
            })}
          </div>
        ))}
      </div>

      <div className={styles.presets}>
        <button type="button" className={styles.presetBtn} onClick={() => onChange([...EMPTY_GRID])}>
          Effacer
        </button>
        {GRID_PRESETS.map(p => (
          <button
            key={p.label}
            type="button"
            className={styles.presetBtn}
            onClick={() => onChange([...p.grid])}
          >
            {p.label}
          </button>
        ))}
      </div>
    </div>
  )
}