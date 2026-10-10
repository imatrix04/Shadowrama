import type { BlockConfig } from '../../types'

const webviewConfig: BlockConfig = {
  type: 'webview',
  label: 'Page web',
  icon: 'globe',
  ultraOnly: true,
  defaultProps: {
    url: '',
    width: 640,
    height: 360,
    showToolbar: true,
    borderRadius: 8,
  },
  properties: [
    { key: 'url', label: 'Adresse', type: 'url' },
    { key: 'showToolbar', label: 'Barre de navigation', type: 'boolean' },
    { key: 'borderRadius', label: 'Arrondi', type: 'number' },
  ],
}

export default webviewConfig