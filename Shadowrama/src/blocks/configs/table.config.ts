import type { BlockConfig, TableBlockData } from '../../types'
import { FONT_OPTIONS } from '../../utils/fonts'
import { DEFAULT_TABLE_CELLS, TABLE_STYLE } from '../../utils/table'

const tableConfig: BlockConfig = {
  type: 'table',
  label: 'Tableau',
  icon: 'table',
  // Lu à chaque ajout : chaque tableau reçoit sa propre grille.
  get defaultProps(): Partial<TableBlockData> {
    return {
      cells: DEFAULT_TABLE_CELLS(),
      headerRow: true,
      fontSize: TABLE_STYLE.fontSize,
      textAlign: 'left',
      headerColor: TABLE_STYLE.headerColor,
      headerTextColor: TABLE_STYLE.headerTextColor,
      striped: true,
      borderWidth: TABLE_STYLE.borderWidth,
      borderRadius: 0,
      width: 600,
      height: 180,
    }
  },
  properties: [
    { key: 'cells', label: 'Contenu', type: 'tableData' },
    { key: 'headerRow', label: 'Ligne d\'en-tête', type: 'boolean' },
    { key: 'fontFamily', label: 'Police', type: 'select', options: FONT_OPTIONS },
    { key: 'fontSize', label: 'Taille du texte', type: 'number' },
    {
      key: 'textAlign',
      label: 'Alignement',
      type: 'select',
      options: [
        { label: 'Gauche', value: 'left' },
        { label: 'Centre', value: 'center' },
        { label: 'Droite', value: 'right' },
      ],
    },
    { key: 'textColor', label: 'Couleur du texte', type: 'color' },
    { key: 'headerColor', label: 'Fond de l\'en-tête', type: 'color', showIf: { key: 'headerRow', value: 'true' } },
    { key: 'headerTextColor', label: 'Texte de l\'en-tête', type: 'color', showIf: { key: 'headerRow', value: 'true' } },
    { key: 'backgroundColor', label: 'Fond du tableau', type: 'color' },
    { key: 'striped', label: 'Lignes alternées', type: 'boolean' },
    { key: 'stripeColor', label: 'Couleur des lignes alternées', type: 'color', showIf: { key: 'striped', value: 'true' } },
    { key: 'borderColor', label: 'Couleur des bordures', type: 'color' },
    { key: 'borderWidth', label: 'Épaisseur des bordures', type: 'number' },
    { key: 'borderRadius', label: 'Arrondi du cadre', type: 'number' },
  ],
}

export default tableConfig
