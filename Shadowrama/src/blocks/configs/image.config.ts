import type { BlockConfig } from '../../types'
import { FRAME_PROPERTIES } from './frameProperties'

const imageConfig: BlockConfig = {
  type: 'image',
  label: 'Image',
  icon: 'image',
  defaultProps: { src: '', alt: 'Image', width: 300, height: 200, objectFit: 'cover' },
  properties: [
    { key: 'src', label: 'Image', type: 'file' },
    { key: 'alt', label: 'Description', type: 'text' },
    ...FRAME_PROPERTIES,
  ],
}

export default imageConfig