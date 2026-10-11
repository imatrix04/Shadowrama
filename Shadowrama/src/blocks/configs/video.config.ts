import type { BlockConfig } from '../../types'
import { FRAME_PROPERTIES } from './frameProperties'
import { VIDEO_SPEEDS } from '../../utils/video'

// Pas de `ultraOnly` : comme l'image, la vidéo s'utilise aussi en mode simple.
// Les animations d'entrée/sortie et les effets Ultra viennent du bloc lui-même
// (BaseBlockData), il n'y a rien de plus à déclarer ici.
const videoConfig: BlockConfig = {
  type: 'video',
  label: 'Vidéo',
  icon: 'video',
  defaultProps: {
    src: '',
    width: 480,
    height: 270,
    objectFit: 'cover',
    autoplay: true,
    loop: false,
    muted: false,
    volume: 1,
    showControls: false,
    playbackRate: 1,
    startTime: 0,
    endTime: 0,
  },
  properties: [
    { key: 'src', label: 'Vidéo', type: 'file', accept: 'video/*' },
    { key: 'autoplay', label: 'Lecture automatique', type: 'boolean' },
    { key: 'loop', label: 'Lire en boucle', type: 'boolean' },
    { key: 'muted', label: 'Sans le son', type: 'boolean' },
    { key: 'volume', label: 'Volume (0 à 1)', type: 'float' },
    { key: 'showControls', label: 'Commandes de lecture', type: 'boolean' },
    {
      key: 'playbackRate',
      label: 'Vitesse',
      type: 'select',
      options: VIDEO_SPEEDS.map(v => ({ label: `×${v}`, value: String(v) })),
    },
    { key: 'startTime', label: 'Début (s)', type: 'number' },
    { key: 'endTime', label: 'Fin (s, 0 = jusqu’au bout)', type: 'number' },
    ...FRAME_PROPERTIES,
  ],
}

export default videoConfig