import type { BlockProperty } from '../../types'

/**
 * Cadrage, arrondi et découpe en forme libre : les réglages d'un média posé
 * sur la diapositive, communs au bloc image et au bloc vidéo. Les déclarer ici
 * garde les deux blocs alignés (voir aussi blocks/registry/frameStyle).
 */
export const FRAME_PROPERTIES: BlockProperty[] = [
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
]