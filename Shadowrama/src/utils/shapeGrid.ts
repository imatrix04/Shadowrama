export const GRID_SIZE = 10

/**
 * Une grille = 10 nombres, un par ligne, chacun un masque de bits sur 10
 * colonnes (bit `col` = colonne `col`, LSB = colonne 0). Plus compact et plus
 * simple à valider à la lecture d'un fichier qu'un tableau imbriqué de
 * booléens, tout en restant lisible cellule par cellule.
 */
export type ShapeGrid = number[]

export const EMPTY_GRID: ShapeGrid = Array(GRID_SIZE).fill(0)

export function isCellSet(grid: ShapeGrid | undefined, row: number, col: number): boolean {
  if (!grid) return false
  return ((grid[row] ?? 0) & (1 << col)) !== 0
}

export function toggleCell(grid: ShapeGrid, row: number, col: number, value?: boolean): ShapeGrid {
  const next = [...grid]
  const bit = 1 << col
  const shouldSet = value ?? !isCellSet(grid, row, col)
  next[row] = shouldSet ? (next[row] | bit) : (next[row] & ~bit)
  return next
}

/** Une grille lue depuis un `.shma` peut être corrompue ou éditée à la main :
 *  on ne garde que des nombres bornés sur 10 bits, à la bonne longueur. */
export function normalizeGrid(raw: unknown): ShapeGrid | undefined {
  if (!Array.isArray(raw)) return undefined
  const grid = EMPTY_GRID.map((_, i) => {
    const v = raw[i]
    return typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(1023, Math.trunc(v))) : 0
  })
  return grid.some(v => v !== 0) ? grid : undefined
}

/**
 * Chemin SVG (un sous-tracé carré par cellule active), dans le système de
 * coordonnées réel du bloc — pas un viewBox abstrait — pour que l'épaisseur de
 * bordure du bloc forme reste cohérente même sur un bloc non carré.
 *
 * Pas de fusion des contours entre cellules voisines : chaque carré garde le
 * sien, assumé comme un rendu « pixel art » qui rend la grille lisible plutôt
 * que de calculer un contour lissé (bien plus complexe pour un gain modeste).
 */
export function gridToPath(grid: ShapeGrid | undefined, width: number, height: number): string {
  if (!grid) return ''
  const cellW = width / GRID_SIZE
  const cellH = height / GRID_SIZE
  const parts: string[] = []
  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      if (!isCellSet(grid, row, col)) continue
      const x = col * cellW
      const y = row * cellH
      parts.push(`M ${x} ${y} h ${cellW} v ${cellH} h ${-cellW} Z`)
    }
  }
  return parts.join(' ')
}

/**
 * Data URI d'un masque CSS (`mask-image`), pour découper une image dans la
 * forme de la grille. Viewbox abstrait 0–100 : `mask-size: 100% 100%` en JSX
 * l'étire ensuite au bloc réel, sans souci de distorsion vu qu'un masque n'a
 * pas de bordure à garder proportionnée.
 */
export function gridToMaskDataUri(grid: ShapeGrid | undefined): string | undefined {
  const path = gridToPath(grid, 100, 100)
  if (!path) return undefined
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="${path}" fill="#000"/></svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

function rowsToGrid(rows: string[]): ShapeGrid {
  return rows.map(row => {
    let mask = 0
    for (let col = 0; col < row.length; col++) {
      if (row[col] === '1') mask |= (1 << col)
    }
    return mask
  })
}

/** Presets de base, prêts à l'emploi dans l'éditeur de grille. */
export const GRID_PRESETS: { label: string; grid: ShapeGrid }[] = [
  {
    label: 'Cœur',
    grid: rowsToGrid([
      '0110011000',
      '1111011110',
      '1111111111',
      '1111111111',
      '0111111110',
      '0011111100',
      '0001111000',
      '0000110000',
      '0000000000',
      '0000000000',
    ]),
  },
  {
    label: 'Étoile',
    grid: rowsToGrid([
      '0000110000',
      '0000110000',
      '0001111000',
      '0011111100',
      '1111111111',
      '1111111111',
      '0011111100',
      '0001111000',
      '0000110000',
      '0000110000',
    ]),
  },
  {
    label: 'Diamant',
    grid: rowsToGrid([
      '0000110000',
      '0001111000',
      '0011111100',
      '0111111110',
      '1111111111',
      '1111111111',
      '0111111110',
      '0011111100',
      '0001111000',
      '0000110000',
    ]),
  },
  {
    label: 'Croix',
    grid: rowsToGrid([
      '0001111000',
      '0001111000',
      '0001111000',
      '1111111111',
      '1111111111',
      '1111111111',
      '1111111111',
      '0001111000',
      '0001111000',
      '0001111000',
    ]),
  },
  {
    label: 'Cercle',
    grid: rowsToGrid([
      '0011111100',
      '0111111110',
      '1111111111',
      '1111111111',
      '1111111111',
      '1111111111',
      '1111111111',
      '1111111111',
      '0111111110',
      '0011111100',
    ]),
  },
  {
    label: 'Éclair',
    grid: rowsToGrid([
      '0000111000',
      '0000110000',
      '0001110000',
      '0001100000',
      '0111111100',
      '0000111000',
      '0001110000',
      '0011100000',
      '0111000000',
      '0110000000',
    ]),
  },
]