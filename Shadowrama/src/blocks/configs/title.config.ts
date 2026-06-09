import type { BlockConfig } from '../../types'

const titleConfig: BlockConfig = {
  type: 'title',
  label: '🔤 Titre',
  defaultProps: { content: 'Mon Titre', fontSize: 36, color: '#ffffff'},
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

export default titleConfig