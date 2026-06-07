import type { BlockConfig } from '../../types'

const titleConfig: BlockConfig = {
  type: 'title',
  label: '🔤 Titre',
  defaultProps: { content: 'Mon Titre', fontSize: 36, color: '#ffffff', width: 300, height: 80 },
  properties: [
    { key: 'content', label: 'Contenu', type: 'textarea' },
    { key: 'fontSize', label: 'Taille police', type: 'number' },
    { key: 'color', label: 'Couleur', type: 'color' },
  ]
}

export default titleConfig