import type{ BlockConfig } from '../../types'

const shapeConfig: BlockConfig = {
  type: 'shape',
  label: '🟦 Forme',
  defaultProps: { shape: 'rectangle', backgroundColor: '#3b82f6', borderWidth: 0, borderColor: '#ffffff', width: 150, height: 150 },
  properties: [
    { 
      key: 'shape', 
      label: 'Forme', 
      type: 'select', 
      options: [
        { label: 'Rectangle', value: 'rectangle' },
        { label: 'Cercle', value: 'circle' },
        { label: 'Triangle', value: 'triangle' },
        { label: 'Flèche Haut', value: 'arrow-up' },
        { label: 'Flèche Bas', value: 'arrow-down' },
        { label: 'Flèche Gauche', value: 'arrow-left' },
        { label: 'Flèche Droite', value: 'arrow-right' }
      ]
    },
    { key: 'backgroundColor', label: 'Couleur', type: 'color' },
    { key: 'borderRadius', label: 'Arrondi', type: 'number' },
    { key: 'borderColor', label: 'Couleur de bordure', type: 'color' },
    { key: 'borderWidth', label: 'Largeur de bordure', type: 'number' },
    { key: 'opacity', label: 'Opacité', type: 'float' },
  ]
}

export default shapeConfig