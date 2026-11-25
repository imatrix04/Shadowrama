/**
 * Outils du bloc tableau : normalisation, import/export texte (CSV, TSV).
 *
 * Source unique pour tout ce qui touche à la forme des cellules — lecture d'un
 * `.shma`, collage depuis Excel, import PowerPoint, outils de l'assistant IA —
 * afin qu'un tableau soit toujours une grille régulière et bornée.
 */

export const MAX_TABLE_ROWS = 30
export const MAX_TABLE_COLS = 12
export const MAX_CELL_LENGTH = 300

export const DEFAULT_TABLE_CELLS = (): string[][] => [
  ['Colonne 1', 'Colonne 2', 'Colonne 3'],
  ['', '', ''],
  ['', '', ''],
]

function cellText(value: unknown): string {
  if (typeof value === 'string') return value.slice(0, MAX_CELL_LENGTH)
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  if (typeof value === 'boolean') return value ? 'Oui' : 'Non'
  return ''
}

/**
 * Remet des cellules inconnues en grille régulière : lignes et colonnes bornées,
 * toutes les lignes à la largeur de la plus longue. Rend toujours au moins une
 * cellule, pour qu'un tableau ne puisse jamais être vide.
 */
export function normalizeCells(raw: unknown): string[][] {
  const rows = Array.isArray(raw) ? raw.slice(0, MAX_TABLE_ROWS) : []
  const grid = rows.map(row => (Array.isArray(row) ? row.slice(0, MAX_TABLE_COLS).map(cellText) : []))
  const width = Math.max(1, ...grid.map(r => r.length))
  if (grid.length === 0) return [Array(width).fill('')]
  return grid.map(r => [...r, ...Array<string>(width - r.length).fill('')])
}

/**
 * Lit du texte tabulé (collage depuis Excel / Sheets) ou du CSV (`,` ou `;`,
 * guillemets doublés). Le séparateur est celui qui apparaît le plus sur la
 * première ligne.
 */
export function parseDelimited(text: string): string[][] {
  const source = (text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text).replace(/\r\n?/g, '\n').replace(/\n+$/, '')
  if (!source.trim()) return []

  const firstLine = source.split('\n', 1)[0]
  const count = (c: string) => firstLine.split(c).length - 1
  const candidates = ['\t', ';', ','].map(c => ({ c, n: count(c) }))
  const delimiter = candidates.reduce((best, cur) => (cur.n > best.n ? cur : best)).c

  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < source.length; i++) {
    const ch = source[i]
    if (quoted) {
      if (ch === '"' && source[i + 1] === '"') { cell += '"'; i++ }
      else if (ch === '"') quoted = false
      else cell += ch
    } else if (ch === '"' && cell === '') {
      quoted = true
    } else if (ch === delimiter) {
      row.push(cell); cell = ''
    } else if (ch === '\n') {
      row.push(cell); rows.push(row); row = []; cell = ''
    } else {
      cell += ch
    }
  }
  row.push(cell)
  rows.push(row)
  return normalizeCells(rows)
}

/** Texte CSV (séparateur `;`, ouvrable directement par Excel en français). */
export function toCsv(cells: string[][]): string {
  const quote = (v: string) => (/[;"\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)
  return cells.map(row => row.map(quote).join(';')).join('\n')
}

/** Ajoute ou retire des lignes/colonnes sans jamais descendre sous 1×1. */
export function resizeCells(cells: string[][], rows: number, cols: number): string[][] {
  const r = Math.min(MAX_TABLE_ROWS, Math.max(1, rows))
  const c = Math.min(MAX_TABLE_COLS, Math.max(1, cols))
  return Array.from({ length: r }, (_, y) => Array.from({ length: c }, (_, x) => cells[y]?.[x] ?? ''))
}

/** Apparence par défaut, partagée par le rendu, la config et l'export PowerPoint. */
export const TABLE_STYLE = {
  fontSize: 18,
  headerColor: '#6c8cff',
  headerTextColor: '#ffffff',
  stripeColor: 'rgba(128, 128, 128, 0.14)',
  borderColor: 'rgba(128, 128, 128, 0.5)',
  borderWidth: 1,
  textColor: 'var(--slide-ink)',
} as const
