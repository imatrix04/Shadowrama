import type { BlockConfig } from '../../types'

const textConfig: BlockConfig = {
  type: 'text',
  label: '📝 Texte',
  defaultProps: { content: 'Mon texte', fontSize: 18, color: '#ffffff' },
  properties: [
    { key: 'content', label: 'Contenu', type: 'textarea' },
    { key: 'fontSize', label: 'Taille police', type: 'number' },
    { key: 'color', label: 'Couleur', type: 'color' },
    { key: 'textAlign', label: 'Alignement', type: 'select', options: [
      { label: 'Gauche', value: 'left' },
      { label: 'Centré', value: 'center' },
      { label: 'Droite', value: 'right' },
    ] },
  ]
}

export default textConfig