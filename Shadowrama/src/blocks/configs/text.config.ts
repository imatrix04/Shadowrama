import type { BlockConfig } from '../../types'

const textConfig: BlockConfig = {
  type: 'text',
  label: '📝 Texte',
  defaultProps: { content: 'Mon texte', fontSize: 18, color: '#ffffff' },
  properties: [
    { key: 'content', label: 'Contenu', type: 'textarea' },
    { key: 'fontSize', label: 'Taille police', type: 'number' },
    { key: 'color', label: 'Couleur', type: 'color' },
  ]
}

export default textConfig