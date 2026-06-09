import type{ BlockConfig } from '../../types'

const shapeConfig: BlockConfig = {
  type: 'shape',
  label: '🟦 Forme',
  defaultProps: { shape: 'rectangle', backgroundColor: '#3b82f6', width: 150, height: 150 },
  properties: [
    { key: 'shape', label: 'Forme', type: 'text' },
    { key: 'backgroundColor', label: 'Couleur', type: 'color' },
    { key: 'borderRadius', label: 'Arrondi', type: 'number' },
    { key: 'borderColor', label: 'Couleur de bordure', type: 'color' },
    { key: 'borderWidth', label: 'Largeur de bordure', type: 'number' },
    { key: 'opacity', label: 'Opacité', type: 'float' },
  ]
}

export default shapeConfig