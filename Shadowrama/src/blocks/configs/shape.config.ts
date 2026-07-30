import type { BlockConfig } from '../../types'

const shapeConfig: BlockConfig = {
  type: 'shape',
  label: 'Forme',
  icon: 'shape',
  defaultProps: {
    shape: 'rectangle',
    backgroundColor: '#3b82f6',
    borderWidth: 0,
    borderColor: '#ffffff',
    borderRadius: 4,
    width: 150,
    height: 150,
  },
  properties: [
    {
      key: 'shape',
      label: 'Forme',
      type: 'select',
      options: [
        { label: 'Rectangle', value: 'rectangle' },
        { label: 'Cercle', value: 'circle' },
        { label: 'Triangle', value: 'triangle' },
        { label: 'Hexagone', value: 'hexagon' },
        { label: 'Étoile', value: 'star' },
        { label: 'Ligne', value: 'line' },
        { label: 'Flèche haut', value: 'arrow-up' },
        { label: 'Flèche bas', value: 'arrow-down' },
        { label: 'Flèche gauche', value: 'arrow-left' },
        { label: 'Flèche droite', value: 'arrow-right' },
      ],
    },
    { key: 'backgroundColor', label: 'Couleur', type: 'color' },
    { key: 'borderRadius', label: 'Arrondi', type: 'number' },
    { key: 'borderColor', label: 'Couleur de bordure', type: 'color' },
    { key: 'borderWidth', label: 'Largeur de bordure', type: 'number' },
    // `opacity` vient désormais des propriétés communes (voir blocks/index.ts).
  ],
}

export default shapeConfig
