import type { BlockData, TableBlockData } from '../../types'
import { nextId } from '../ids'
import { MAX_TABLE_COLS, MAX_TABLE_ROWS, normalizeCells } from '../table'
import { attr, descendants, kid, kids, numAttr } from './xml'
import { EMU_PER_PT, r1, readXfrm, toBox } from './context'
import type { Ctx, Tx } from './context'
import { readSolid } from './theme'

/**
 * Import d'un tableau PowerPoint (`<a:tbl>` d'un `graphicFrame`) vers un bloc
 * tableau.
 *
 * Conversion « au mieux » : le texte et la grille sont repris à l'identique ;
 * l'apparence est approchée (en-tête, lignes alternées, couleurs explicites des
 * cellules). Cellules fusionnées, styles de tableau du thème et bordures
 * individuelles ne sont pas représentés — ce qui est perdu est signalé.
 */

function cellText(tc: Element): string {
  const body = kid(tc, 'txBody')
  return kids(body, 'p').map(p => {
    let line = ''
    for (const node of kids(p)) {
      if (node.localName === 'r' || node.localName === 'fld') line += kid(node, 't')?.textContent ?? ''
      else if (node.localName === 'br') line += '\n'
    }
    return line
  }).join('\n')
}

/** Premier `rPr` portant une taille, une couleur… dans la cellule. */
function firstRunProps(tc: Element): Element | null {
  for (const r of descendants(kid(tc, 'txBody'), 'r')) {
    const rPr = kid(r, 'rPr')
    if (rPr) return rPr
  }
  return null
}

export function emitTable(node: Element, ctx: Ctx, tx: Tx, blocks: BlockData[]): boolean {
  const tbl = descendants(node, 'tbl')[0]
  if (!tbl) return false

  const xf = readXfrm(kid(node, 'xfrm'))
  if (!xf) {
    ctx.report.add(ctx.slideNo, 'Un tableau sans position connue a été ignoré.')
    return true
  }
  const box = toBox(xf, tx, ctx.frame)

  const trs = kids(tbl, 'tr')
  const rawRows = trs.map(tr => kids(tr, 'tc'))
  if (rawRows.length === 0 || rawRows.every(r => r.length === 0)) {
    ctx.report.add(ctx.slideNo, 'Un tableau vide a été ignoré.')
    return true
  }

  if (rawRows.length > MAX_TABLE_ROWS || rawRows.some(r => r.length > MAX_TABLE_COLS)) {
    ctx.report.add(ctx.slideNo, `Tableau tronqué à ${MAX_TABLE_ROWS} lignes et ${MAX_TABLE_COLS} colonnes.`)
  }
  const merged = rawRows.some(row => row.some(tc =>
    (numAttr(tc, 'gridSpan') ?? 1) > 1 || (numAttr(tc, 'rowSpan') ?? 1) > 1
    || attr(tc, 'hMerge') === '1' || attr(tc, 'vMerge') === '1'))
  if (merged) ctx.report.add(ctx.slideNo, 'Cellules fusionnées : leur texte est conservé dans la première cellule, sans fusion.')

  const cells = normalizeCells(rawRows.map(row => row.map(cellText)))

  const tblPr = kid(tbl, 'tblPr')
  const headerRow = attr(tblPr, 'firstRow') === '1'
  const striped = attr(tblPr, 'bandRow') === '1'

  const headTc = rawRows[0]?.[0]
  const bodyTc = rawRows[headerRow ? 1 : 0]?.[0] ?? rawRows[0]?.[0]

  const fillOf = (tc: Element | undefined) => readSolid(kid(kid(tc, 'tcPr'), 'solidFill'), ctx.theme)
  const colorOf = (tc: Element | undefined) => {
    const rPr = tc ? firstRunProps(tc) : null
    return readSolid(kid(rPr, 'solidFill'), ctx.theme)
  }

  const pxPerPt = ctx.frame.k * EMU_PER_PT
  const sizes = rawRows.flat().map(tc => numAttr(firstRunProps(tc), 'sz')).filter((v): v is number => !!v)
  const algn = attr(kid(kids(kid(bodyTc, 'txBody'), 'p')[0], 'pPr'), 'algn')

  const block: TableBlockData = {
    id: nextId(), type: 'table',
    x: r1(box.x), y: r1(box.y), width: Math.max(1, r1(box.w)), height: Math.max(1, r1(box.h)),
    cells,
    headerRow,
    striped,
    textAlign: algn === 'ctr' ? 'center' : algn === 'r' ? 'right' : 'left',
    ...(sizes.length ? { fontSize: Math.max(1, r1((sizes[0] / 100) * pxPerPt)) } : {}),
    ...(xf.rot !== 0 ? { rotation: r1(xf.rot) } : {}),
  }

  if (headerRow) {
    // Sans remplissage explicite, PowerPoint applique le style du tableau : sa
    // couleur d'accent principale, avec du texte blanc.
    const head = fillOf(headTc)
    const accent = ctx.theme.colors.accent1
    block.headerColor = head?.hex ?? (accent ? `#${accent}` : undefined)
    const headText = colorOf(headTc)
    if (headText) block.headerTextColor = headText.hex
    if (!block.headerColor) delete block.headerColor
  }

  const bodyFill = fillOf(bodyTc)
  if (bodyFill && bodyFill.alpha > 0) block.backgroundColor = bodyFill.hex
  const bodyText = colorOf(bodyTc)
  if (bodyText) block.textColor = bodyText.hex

  // Bordure : la première ligne explicite d'une cellule donne le style du tableau.
  const border = descendants(tbl, 'tcPr')
    .flatMap(pr => kids(pr, 'lnL', 'lnR', 'lnT', 'lnB'))
    .find(ln => kid(ln, 'solidFill'))
  if (border) {
    const color = readSolid(kid(border, 'solidFill'), ctx.theme)
    if (color) block.borderColor = color.hex
    const w = numAttr(border, 'w')
    if (w !== undefined) block.borderWidth = Math.max(0, r1(w * ctx.frame.k))
  }

  // Hauteur réelle : somme des lignes si elle diffère du cadre.
  const total = trs.reduce((sum, tr) => sum + (numAttr(tr, 'h') ?? 0), 0)
  if (total > 0) block.height = Math.max(1, r1(total * (tx.sy * ctx.frame.k)))

  blocks.push(block)
  return true
}
