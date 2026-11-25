import type { CSSProperties } from 'react'
import type { BlockComponentProps, TableBlockData } from '../../types'
import { fontStack } from '../../utils/fonts'
import { TABLE_STYLE, normalizeCells } from '../../utils/table'

/**
 * Bloc tableau : une vraie `<table>` à colonnes et lignes égales qui remplit le
 * bloc. Sans animation propre — les mouvements d'entrée communs s'appliquent.
 */
export default function TableBlock({ block }: BlockComponentProps<TableBlockData>) {
  const cells = normalizeCells(block.cells)
  const header = block.headerRow !== false
  const stripe = block.striped ? (block.stripeColor ?? TABLE_STYLE.stripeColor) : undefined
  const border = block.borderWidth ?? TABLE_STYLE.borderWidth
  const borderColor = block.borderColor ?? TABLE_STYLE.borderColor
  const rowHeight = `${100 / cells.length}%`

  const wrapper: CSSProperties = {
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    borderRadius: block.borderRadius ?? 0,
    background: block.backgroundColor,
    boxSizing: 'border-box',
  }

  const table: CSSProperties = {
    width: '100%',
    height: '100%',
    tableLayout: 'fixed',
    borderCollapse: 'collapse',
    fontSize: block.fontSize ?? TABLE_STYLE.fontSize,
    fontFamily: fontStack(block.fontFamily),
    color: block.textColor ?? TABLE_STYLE.textColor,
  }

  return (
    <div style={wrapper}>
      <table style={table}>
        <tbody>
          {cells.map((row, y) => {
            const isHeader = header && y === 0
            const bodyIndex = y - (header ? 1 : 0)
            const background = isHeader
              ? (block.headerColor ?? TABLE_STYLE.headerColor)
              : stripe && bodyIndex % 2 === 1 ? stripe : undefined
            return (
              <tr key={y} style={{ height: rowHeight, background }}>
                {row.map((text, x) => {
                  const style: CSSProperties = {
                    border: border > 0 ? `${border}px solid ${borderColor}` : 'none',
                    padding: '4px 8px',
                    textAlign: block.textAlign ?? 'left',
                    verticalAlign: 'middle',
                    overflow: 'hidden',
                    overflowWrap: 'anywhere',
                    whiteSpace: 'pre-wrap',
                    fontWeight: isHeader ? 700 : undefined,
                    color: isHeader ? (block.headerTextColor ?? TABLE_STYLE.headerTextColor) : undefined,
                  }
                  const Cell = isHeader ? 'th' : 'td'
                  return <Cell key={x} style={style}>{text}</Cell>
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
