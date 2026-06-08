import type { BlockConfig } from '../../types'

const textConfig: BlockConfig = {
  type: 'text',
  label: '📝 Texte',
  defaultProps: { content: 'Mon texte', fontSize: 18, color: '#ffffff', width: 200, height: 60 },
  properties: [
    { key: 'content', label: 'Contenu', type: 'textarea' },
    { key: 'fontSize', label: 'Taille police', type: 'number' },
    { key: 'color', label: 'Couleur', type: 'color' },
    { key: 'width', label: 'Largeur', type: 'number' },
    { key: 'height', label: 'Hauteur', type: 'number' },
  ]
}

export default textConfig