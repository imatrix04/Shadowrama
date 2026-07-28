import type { BlockConfig } from '../../types'

const imageConfig: BlockConfig = {
  type: 'image',
  label: '🖼️ Image',
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
  ],
}

export default imageConfig
