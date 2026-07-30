// types.ts
import type { IconName } from './components/ui/Icon'

export interface BlockProperty {
  key: string
  label: string
  type: 'text' | 'textarea' | 'number' | 'color' | 'select' | 'float' | 'file'
  options?: { label: string; value: string }[]
}

export type AnimationType = 'fadeIn' | 'slideInLeft' | 'slideInRight' | 'slideInUp' | 'zoomIn' | 'none'

export interface AnimationConfig {
  type: AnimationType
  duration?: number   // secondes, défaut 0.6
  delay?: number      // secondes, défaut 0
  ease?: string       // ex: 'power2.out', défaut 'power2.out'
}

// Champs communs à TOUS les blocs, quel que soit leur type.
// Les descripteurs de champs éditables ne sont volontairement PAS stockés ici :
// ils sont résolus depuis BLOCKS_CONFIG via `getBlockProperties(block.type)`.
// Les embarquer dans le bloc les figeait dans le fichier .shma, si bien qu'un
// projet enregistré ne voyait jamais les champs ajoutés dans les versions
// suivantes.
export interface BaseBlockData {
  id: number
  x: number
  y: number
  width: number
  height: number
  zIndex?: number
  animation?: AnimationConfig
}

// ── Un type par bloc, avec SES props spécifiques ──

export interface ImageBlockData extends BaseBlockData {
  type: 'image'
  src: string
  alt?: string
  borderRadius?: number
  objectFit?: 'cover' | 'contain' | 'fill'
}

export interface ShapeBlockData extends BaseBlockData {
  type: 'shape'
  shape: 'rectangle' | 'circle' | 'triangle' | 'arrow-up' | 'arrow-down' | 'arrow-left' | 'arrow-right'
  backgroundColor: string
  borderRadius?: number
  borderColor?: string
  borderWidth?: number
  opacity?: number
}

export interface TextBlockData extends BaseBlockData {
  type: 'text'
  content: string
  fontSize?: number
  color?: string
  textAlign?: 'left' | 'center' | 'right'
}

export interface TitleBlockData extends BaseBlockData {
  type: 'title'
  content: string
  fontSize?: number
  color?: string
  textAlign?: 'left' | 'center' | 'right'
}

// Futurs blocs : vidéo, graphique, carrousel...
// export interface VideoBlockData extends BaseBlockData {
//   type: 'video'
//   src: string
//   autoplay?: boolean
//   loop?: boolean
// }

// ── L'union discriminée ──
export type BlockData =
  | ImageBlockData
  | ShapeBlockData
  | TextBlockData
  | TitleBlockData
// | VideoBlockData  (à ajouter au fur et à mesure)

export interface BlockConfig {
  type: BlockData['type']
  label: string
  /** Nom d'icône (voir components/ui/Icon). L'icône était auparavant un emoji
   *  collé dans `label`, donc ni stylable ni indépendant du système. */
  icon: IconName
  defaultProps: Partial<BlockData>
  properties: BlockProperty[]
}

export interface BlockComponentProps<T extends BlockData = BlockData> {
  block: T
  onUpdate?: (id: number, changes: Partial<T>) => void
  isEditing?: boolean
  onStartEdit?: () => void
  onStopEdit?: () => void
}

export interface Slide {
  id: number
  blocks: BlockData[]
}

// ── Échappatoire typée pour les composants génériques (panneau de propriétés) ──
// On centralise le seul endroit où on accède dynamiquement par clé.
export function getBlockField(block: BlockData, key: string): unknown {
  return (block as unknown as Record<string, unknown>)[key]
}

export function setBlockField<T extends BlockData>(
  block: T,
  key: string,
  value: unknown
): T {
  return { ...block, [key]: value }
}