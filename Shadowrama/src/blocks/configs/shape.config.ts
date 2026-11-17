import type { BlockConfig } from '../../types'

const shapeConfig: BlockConfig = {
  type: 'shape',
  label: 'Forme',
  icon: 'shape',
  defaultProps: {
    shape: 'rectangle',
    // Pas de couleur ici : le remplissage et la bordure sont posés à la création
    // d'après le fond de la diapositive (voir addBlock dans Editor.tsx).
    borderWidth: 0,
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
        { label: 'Forme personnalisée', value: 'grid' },
      ],
    },
    { key: 'customShape', label: 'Forme personnalisée', type: 'shapePolygon', showIf: { key: 'shape', value: 'grid' } },
    { key: 'backgroundColor', label: 'Couleur', type: 'color' },
    { key: 'borderRadius', label: 'Arrondi', type: 'number' },
    { key: 'borderColor', label: 'Couleur de bordure', type: 'color' },
    { key: 'borderWidth', label: 'Largeur de bordure', type: 'number' },
    // `opacity` vient désormais des propriétés communes (voir blocks/index.ts).
  ],
}

export default shapeConfig