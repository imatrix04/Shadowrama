// types.ts
import type { IconName } from './components/ui/Icon'

export interface BlockProperty {
  key: string
  label: string
  type: 'text' | 'textarea' | 'number' | 'color' | 'select' | 'float' | 'file' | 'shapePolygon'
  options?: { label: string; value: string }[]
  showIf?: { key: string; value: string }
}

export type AnimationType = 'fadeIn' | 'slideInLeft' | 'slideInRight' | 'slideInUp' | 'zoomIn' | 'none'

export interface AnimationConfig {
  type: AnimationType
  duration?: number   // secondes, défaut 0.6
  delay?: number      // secondes, défaut 0
  ease?: string       // ex: 'power2.out', défaut 'power2.out'
}


// ── Mode Ultra Design ───────────────────────────────────────────────────────
// Tout est optionnel : un projet créé en mode simple reste valide, et un projet
// Ultra s'ouvre en mode simple — les effets et séquences sont alors ignorés au
// rendu, mais conservés dans le fichier.

export interface Shadow {
  x: number
  y: number
  blur: number
  color: string
}

export interface Glow {
  blur: number
  color: string
}

export interface Gradient {
  from: string
  to: string
  /** Degrés. 0 = de bas en haut, 90 = de gauche à droite. */
  angle: number
}

export interface CornerRadius {
  tl: number
  tr: number
  br: number
  bl: number
}

/** Effets visuels avancés, appliqués par-dessus le rendu propre au bloc. */
export interface BlockEffects {
  shadow?: Shadow
  glow?: Glow
  /** Remplace la couleur unie du bloc quand il en accepte une (forme, texte). */
  gradient?: Gradient
  /** Flou gaussien, en pixels. */
  blur?: number
  /** 1 = neutre. */
  brightness?: number
  saturate?: number
  contrast?: number
  blendMode?: 'normal' | 'multiply' | 'screen' | 'overlay' | 'difference' | 'exclusion' | 'luminosity'
  /** Arrondi par coin, indépendant du `borderRadius` simple. */
  corners?: CornerRadius
  textStroke?: { width: number; color: string }
  /** Flottement doux en boucle, amplifié au survol de la souris. */
  float?: { amplitude: number; duration: number }
}

/** Propriétés animables. Toutes optionnelles : une étape ne touche que ce qu'elle nomme. */
export interface Keyframe {
  opacity?: number
  /** Décalages en pixels, relatifs à la position du bloc. */
  x?: number
  y?: number
  scale?: number
  /** Degrés, en plus de la rotation propre au bloc. */
  rotate?: number
  skewX?: number
  skewY?: number
  blur?: number
}

export interface AnimationStep {
  to: Keyframe
  /** Secondes. */
  duration: number
  ease?: string
}

export type MotionPhase = 'in' | 'out'

export interface MotionPreset {
  id: string
  label: string
  tier: 'basic' | 'ultra'
  phase: MotionPhase
  family: 'fondu' | 'glissement' | 'echelle' | 'rotation' | 'flou' | 'texte'
  from: Keyframe
  steps: AnimationStep[]
  split?: 'chars' | 'words'
}

/** Réglages d'une phase sur un bloc donné. */
export interface MotionSettings {
  preset: string
  /** Multiplicateur de la durée du preset. 1 = durée d'origine. */
  speed?: number
  /** Secondes avant le démarrage. */
  delay?: number
  /** Décalage entre les fragments d'un texte découpé, en secondes. */
  stagger?: number
}

export interface BlockMotion {
  in?: MotionSettings
  out?: MotionSettings
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
  /** 0–1. Était propre aux formes ; remontée ici pour valoir aussi pour le
   *  texte, les titres et les images. La clé étant inchangée, les projets
   *  enregistrés restent lisibles. */
  opacity?: number
  /** Degrés, sens horaire. Appliquée au rendu du bloc (voir Block.tsx). */
  rotation?: number
  /** Mode Ultra Design : effets visuels avancés. */
  effects?: BlockEffects
  /** Mode Ultra Design : séquences d'entrée et de sortie. Prend le pas sur
   *  `animation`, conservée pour les projets antérieurs. */
  motion?: BlockMotion
}

// ── Un type par bloc, avec SES props spécifiques ──

export interface ImageBlockData extends BaseBlockData {
  type: 'image'
  src: string
  alt?: string
  borderRadius?: number
  objectFit?: 'cover' | 'contain' | 'fill'
  /** Découpe l'image dans la forme du polygone (voir utils/shapePolygon). */
  shapeMode?: 'none' | 'grid'
  customShape?: [number, number][]
}

export type ShapeKind =
  | 'rectangle' | 'circle' | 'triangle'
  | 'arrow-up' | 'arrow-down' | 'arrow-left' | 'arrow-right'
  | 'line' | 'star' | 'hexagon' | 'grid'

export interface ShapeBlockData extends BaseBlockData {
  type: 'shape'
  shape: ShapeKind
  backgroundColor: string
  borderRadius?: number
  borderColor?: string
  borderWidth?: number
  /** Polygone dessiné à la main, utilisé quand `shape === 'grid'`. */
  customShape?: [number, number][]
}

export interface TextBlockData extends BaseBlockData {
  type: 'text'
  content: string
  fontSize?: number
  color?: string
  textAlign?: 'left' | 'center' | 'right'
  /** Alignement dans la hauteur du bloc : le texte était toujours collé en haut. */
  verticalAlign?: 'top' | 'middle' | 'bottom'
  fontWeight?: 'normal' | 'bold'
  fontStyle?: 'normal' | 'italic'
  /** Multiplicateur (1.4 = 140 %). */
  lineHeight?: number
  /** En pixels, peut être négatif. */
  letterSpacing?: number
}

export interface TitleBlockData extends BaseBlockData {
  type: 'title'
  content: string
  fontSize?: number
  color?: string
  textAlign?: 'left' | 'center' | 'right'
  /** Alignement dans la hauteur du bloc : le texte était toujours collé en haut. */
  verticalAlign?: 'top' | 'middle' | 'bottom'
  fontWeight?: 'normal' | 'bold'
  fontStyle?: 'normal' | 'italic'
  /** Multiplicateur (1.4 = 140 %). */
  lineHeight?: number
  /** En pixels, peut être négatif. */
  letterSpacing?: number
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

/** Transition appliquée EN ENTRANT sur cette diapositive. */
export interface SlideTransitionSettings {
  preset: string
  /** Multiplicateur de la durée du preset. 1 = durée d'origine. */
  speed?: number
}

/**
 * Fond d'une diapositive.
 *
 * Hors mode Ultra Design, seul `type: 'color'` a un effet au rendu (voir
 * `getSlideBackgroundStyle`) : dégradé et image restent enregistrés dans le
 * projet mais inertes, comme les transitions et séquences Ultra.
 */
export interface SlideBackground {
  type: 'color' | 'gradient' | 'image'
  color?: string
  /** Réutilise le type existant des dégradés de bloc (from/to/angle). */
  gradient?: Gradient
  /** Anime doucement le dégradé en boucle. Ignoré hors type 'gradient'. */
  animated?: boolean
  /** Clé média (voir mediaStore) pour une image importée, ou URL directe. */
  image?: string
  imageFit?: 'cover' | 'contain'
  /** Superposition unie par-dessus le fond, pour garder le texte lisible sur
   *  une image ou un dégradé chargé. */
  overlay?: { color: string; opacity: number }
}

export interface Slide {
  id: number
  blocks: BlockData[]
  transition?: SlideTransitionSettings
  background?: SlideBackground
}

/** État d'une couche de diapositive pendant une transition. */
export interface SlideKeyframe {
  opacity?: number
  /** Pourcentage de la largeur/hauteur de la diapositive. */
  xPercent?: number
  yPercent?: number
  scale?: number
  rotateY?: number
  rotateZ?: number
  blur?: number
}

export interface SlideTransition {
  id: string
  label: string
  /** `ultra` n'est proposé qu'en mode Ultra Design. */
  tier: 'basic' | 'ultra'
  /** Secondes. */
  duration: number
  ease?: string
  /** Cible de la diapositive qui s'en va (elle part de l'état neutre). */
  from: SlideKeyframe
  /** État de départ de la diapositive qui arrive (elle rejoint l'état neutre). */
  to: SlideKeyframe
  /** Ajoute une perspective au conteneur, nécessaire aux rotations 3D. */
  perspective?: boolean
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