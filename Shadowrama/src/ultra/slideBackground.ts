import type { SlideBackground } from '../types'
import { resolveMedia } from '../utils/mediaStore'

/** Dégradés prêts à l'emploi, dans la palette de l'app (accent violet inclus). */
export const GRADIENT_PRESETS: { label: string; from: string; to: string; angle: number }[] = [
  { label: 'Aurore', from: '#7c5cff', to: '#00d4ff', angle: 135 },
  { label: 'Coucher de soleil', from: '#ff6b6b', to: '#feca57', angle: 135 },
  { label: 'Minuit', from: '#1a1a2e', to: '#16213e', angle: 180 },
  { label: 'Océan', from: '#0f2027', to: '#2c5364', angle: 135 },
  { label: 'Fuchsia', from: '#c471ed', to: '#f64f59', angle: 135 },
]

export const DEFAULT_GRADIENT = GRADIENT_PRESETS[0]

function withAlpha(hex: string, opacity: number): string {
  const clean = hex.replace('#', '')
  const r = parseInt(clean.substring(0, 2), 16)
  const g = parseInt(clean.substring(2, 4), 16)
  const b = parseInt(clean.substring(4, 6), 16)
  return `rgba(${Number.isNaN(r) ? 0 : r}, ${Number.isNaN(g) ? 0 : g}, ${Number.isNaN(b) ? 0 : b}, ${opacity})`
}

export interface ResolvedSlideBackground {
  style: React.CSSProperties
  /** Vrai si le dégradé doit tourner : le composant ajoute alors sa classe d'animation. */
  animated: boolean
}

/**
 * Traduit le réglage de fond en style CSS prêt à poser sur le conteneur de
 * diapositive (canvas d'édition, couche de présentation, vignette).
 *
 * Hors mode Ultra, dégradé et image restent inertes : seule la couleur unie
 * s'applique, cohérent avec le reste des réglages Ultra (transitions, effets).
 */
export function getSlideBackgroundStyle(
  background: SlideBackground | undefined,
  ultra: boolean,
): ResolvedSlideBackground {
  if (!background) return { style: {}, animated: false }

  if (background.type === 'color') {
    return { style: { backgroundColor: background.color || undefined }, animated: false }
  }

  // Dégradé et image sont des réglages Ultra : neutres si le mode est coupé.
  if (!ultra) return { style: {}, animated: false }

  const layers: string[] = []
  const overlay = background.overlay
  if (overlay && overlay.opacity > 0) {
    const overlayLayer = withAlpha(overlay.color, overlay.opacity)
    // Une couche plate en dégradé « from == to » : superposable à l'image ou
    // au dégradé de fond via `background-image` multicouche.
    layers.push(`linear-gradient(${overlayLayer}, ${overlayLayer})`)
  }

  if (background.type === 'gradient' && background.gradient) {
    const { from, to, angle } = background.gradient
    layers.push(`linear-gradient(${angle}deg, ${from}, ${to})`)
    return {
      style: {
        backgroundImage: layers.join(', '),
        backgroundSize: background.animated ? '200% 200%' : undefined,
      },
      animated: !!background.animated,
    }
  }

  if (background.type === 'image' && background.image) {
    const src = background.image.startsWith('media/') ? resolveMedia(background.image) : background.image
    if (!src) return { style: {}, animated: false }
    layers.push(`url(${src})`)
    return {
      style: {
        backgroundImage: layers.join(', '),
        backgroundSize: background.imageFit === 'contain' ? 'contain' : 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      },
      animated: false,
    }
  }

  return { style: {}, animated: false }
}