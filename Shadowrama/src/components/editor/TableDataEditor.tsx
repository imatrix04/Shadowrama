import { useRef } from 'react'
import { MAX_TABLE_COLS, MAX_TABLE_ROWS, normalizeCells, parseDelimited, resizeCells, toCsv } from '../../utils/table'
import Icon from '../ui/Icon'
import menu from './ContextMenu.module.css'
import styles from './TableDataEditor.module.css'

interface Props {
  cells: string[][]
  headerRow: boolean
  onChange: (cells: string[][]) => void
}

/**
 * Grille de saisie du tableau. Coller un tableau copié depuis Excel / Sheets dans
 * une cellule remplit la grille à partir de là ; un fichier CSV s'importe et
 * s'exporte par les boutons du bas.
 */
export default function TableDataEditor({ cells: rawCells, headerRow, onChange }: Props) {
  const cells = normalizeCells(rawCells)
  const rows = cells.length
  const cols = cells[0].length
  const fileRef = useRef<HTMLInputElement>(null)

  const setCell = (y: number, x: number, value: string) =>
    onChange(cells.map((row, ry) => (ry === y ? row.map((c, rx) => (rx === x ? value : c)) : row)))

  const paste = (y: number, x: number, text: string) => {
    const pasted = parseDelimited(text)
    if (pasted.length === 0) return
    const grid = resizeCells(cells, Math.max(rows, y + pasted.length), Math.max(cols, x + pasted[0].length))
    pasted.forEach((row, dy) => row.forEach((value, dx) => {
      if (grid[y + dy]?.[x + dx] !== undefined) grid[y + dy][x + dx] = value
    }))
    onChange(grid)
  }

  const importFile = async (file: File | undefined) => {
    if (!file) return
    const parsed = parseDelimited(await file.text())
    if (parsed.length > 0) onChange(parsed)
  }

  const exportCsv = () => {
    // BOM : Excel reconnaît ainsi l'UTF-8 (accents) à l'ouverture.
    const blob = new Blob([String.fromCharCode(0xFEFF), toCsv(cells)], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'tableau.csv'
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return (
    <div>
      <div className={styles.scroll}>
        <table className={styles.grid}>
          <tbody>
            {cells.map((row, y) => (
              <tr key={y}>
                {row.map((value, x) => (
                  <td key={x}>
                    <input
                      type="text"
                      className={`${menu.input} ${styles.cell} ${headerRow && y === 0 ? styles.head : ''}`}
                      value={value}
                      aria-label={`Ligne ${y + 1}, colonne ${x + 1}`}
                      onChange={e => setCell(y, x, e.target.value)}
                      onPaste={e => {
                        const text = e.clipboardData.getData('text')
                        if (/[\t\n]/.test(text)) {
                          e.preventDefault()
                          paste(y, x, text)
                        }
                      }}
                    />
                  </td>
                ))}
                <td>
                  <button
                    type="button"
                    className={styles.remove}
                    disabled={rows <= 1}
                    aria-label={`Supprimer la ligne ${y + 1}`}
                    onClick={() => onChange(cells.filter((_, ry) => ry !== y))}
                  >
                    <Icon name="trash" size={12} />
                  </button>
                </td>
              </tr>
            ))}
            <tr>
              {cells[0].map((_, x) => (
                <td key={x}>
                  <button
                    type="button"
                    className={styles.remove}
                    disabled={cols <= 1}
                    aria-label={`Supprimer la colonne ${x + 1}`}
                    onClick={() => onChange(cells.map(row => row.filter((__, rx) => rx !== x)))}
                  >
                    <Icon name="trash" size={12} />
                  </button>
                </td>
              ))}
              <td />
            </tr>
          </tbody>
        </table>
      </div>

      <div className={styles.actions}>
        <button type="button" className={styles.add} disabled={rows >= MAX_TABLE_ROWS}
          onClick={() => onChange(resizeCells(cells, rows + 1, cols))}>
          <Icon name="plus" size={13} /> Ligne
        </button>
        <button type="button" className={styles.add} disabled={cols >= MAX_TABLE_COLS}
          onClick={() => onChange(resizeCells(cells, rows, cols + 1))}>
          <Icon name="plus" size={13} /> Colonne
        </button>
      </div>
      <div className={styles.actions}>
        <button type="button" className={styles.add} onClick={() => fileRef.current?.click()}>
          <Icon name="open" size={13} /> Importer CSV
        </button>
        <button type="button" className={styles.add} onClick={exportCsv}>
          <Icon name="export" size={13} /> Exporter CSV
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,.tsv,.txt,text/csv,text/plain"
          hidden
          onChange={e => { void importFile(e.target.files?.[0]); e.target.value = '' }}
        />
      </div>
      <div className={styles.hint}>
        Astuce : collez un tableau copié depuis Excel dans une cellule. Maximum {MAX_TABLE_ROWS} lignes × {MAX_TABLE_COLS} colonnes.
      </div>
    </div>
  )
}
