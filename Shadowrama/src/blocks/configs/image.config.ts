import type { BlockConfig } from '../../types'

const imageConfig: BlockConfig = {
  type: 'image',
  label: '🖼️ Image',
  defaultProps: { src: '', alt: 'Image', width: 300, height: 200 },
    properties: [
    { key: 'src', label: 'Image', type: 'file' },
    { key: 'alt', label: 'Description', type: 'text' },
  ]
}

export default imageConfig