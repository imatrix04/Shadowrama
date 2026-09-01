import type { BlockConfig } from '../../types'

const imageConfig: BlockConfig = {
  type: 'image',
  label: 'Image',
  icon: 'image',
  defaultProps: { src: '', alt: 'Image', width: 300, height: 200, objectFit: 'cover' },
  properties: [
    { key: 'src', label: 'Image', type: 'file' },
    { key: 'alt', label: 'Description', type: 'text' },
    {
      key: 'objectFit',
      label: 'Cadrage',
      type: 'select',
      options: [
        { label: 'Remplir (rogne)', value: 'cover' },
        { label: 'Contenir (entière)', value: 'contain' },
        { label: 'Étirer', value: 'fill' },
      ],
    },
    { key: 'borderRadius', label: 'Arrondi', type: 'number' },
    {
      key: 'shapeMode',
      label: 'Forme',
      type: 'select',
      options: [
        { label: 'Rectangle (par défaut)', value: 'none' },
        { label: 'Forme personnalisée', value: 'grid' },
      ],
    },
    { key: 'customShape', label: 'Forme personnalisée', type: 'shapePolygon', showIf: { key: 'shapeMode', value: 'grid' } },
  ],
}

export default imageConfig