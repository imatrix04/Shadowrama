import type { BlockConfig } from '../../types'

const textConfig: BlockConfig = {
  type: 'text',
  label: 'Texte',
  icon: 'text',
  defaultProps: { content: 'Mon texte', fontSize: 18, color: '#ffffff', verticalAlign: 'middle', fontWeight: 'normal', fontStyle: 'normal', lineHeight: 1.4 },
  properties: [
    { key: 'content', label: 'Contenu', type: 'textarea' },
    { key: 'fontSize', label: 'Taille police', type: 'number' },
    { key: 'color', label: 'Couleur', type: 'color' },
    { key: 'textAlign', label: 'Alignement', type: 'select', options: [
      { label: 'Gauche', value: 'left' },
      { label: 'Centré', value: 'center' },
      { label: 'Droite', value: 'right' },
    ] },
    { key: 'verticalAlign', label: 'Alignement vertical', type: 'select', options: [
      { label: 'Haut', value: 'top' },
      { label: 'Milieu', value: 'middle' },
      { label: 'Bas', value: 'bottom' },
    ] },
    { key: 'fontWeight', label: 'Graisse', type: 'select', options: [
      { label: 'Normale', value: 'normal' },
      { label: 'Gras', value: 'bold' },
    ] },
    { key: 'fontStyle', label: 'Style', type: 'select', options: [
      { label: 'Normal', value: 'normal' },
      { label: 'Italique', value: 'italic' },
    ] },
    { key: 'lineHeight', label: 'Interlignage', type: 'float' },
    { key: 'letterSpacing', label: 'Interlettrage (px)', type: 'number' },
  ]
}

export default textConfig