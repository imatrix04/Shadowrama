import type{ BlockConfig } from '../../types'

const shapeConfig: BlockConfig = {
  type: 'shape',
  label: '🟦 Forme',
  defaultProps: { shape: 'rectangle', backgroundColor: '#3b82f6', width: 150, height: 150 },
  properties: [
    { key: 'shape', label: 'Forme', type: 'text' },
    { key: 'backgroundColor', label: 'Couleur', type: 'color' },
  ]
}

export default shapeConfig